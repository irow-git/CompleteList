// @vitest-environment node
import { afterEach, beforeEach, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanFolder, createImageSync } from "./imageSync";
import type { RcloneRunner } from "./rclone";

// A stand-in for rclone with the behaviour the image sync relies on. Each remote is a folder under `cloud`
let root: string;
let cloud: string;
let calls: string[][];
let loginOutcome: "ok" | "fail" | "wait";
// Every --files-from list rclone was given
let lists: string[][];

const remoteDir = (spec: string) => {
  const [name, folder = ""] = spec.split(":");
  return path.join(cloud, name, folder);
};
const isRemote = (spec: string) => /^completelist-\w+:/.test(spec);

const listed = (command: string[]) => {
  const files = fs.readFileSync(command[command.indexOf("--files-from") + 1], "utf8").split("\n").filter(Boolean);
  lists.push(files);
  return files;
};

const fakeRclone: RcloneRunner = async (args, { onOutput, signal } = {}) => {
  const command = args.slice(0, args.indexOf("--config"));
  calls.push(command);
  const ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
  switch (command[0]) {
    case "config":
      if (command[1] === "delete") return ok();
      onOutput?.("NOTICE: If your browser doesn't open automatically go to the following link: http://127.0.0.1:53682/auth?state=abc123\n");
      onOutput?.("NOTICE: Waiting for code...\n");
      if (loginOutcome === "wait") {
        await new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      }
      return loginOutcome === "ok" ? ok() : { code: 1, stdout: "", stderr: "2026/10/26 12:00:00 Failed to configure token: access_denied\n" };
    case "mkdir":
      fs.mkdirSync(remoteDir(command[1]), { recursive: true });
      return ok();
    case "lsf": {
      // --recursive --files-only: every file, as a path relative to the folder
      const root = remoteDir(command[1]);
      const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.relative(root, path.join(dir, entry.name))]
        );
      return ok(walk(root).map((file) => `${file}\n`).join(""));
    }
    case "copy": {
      const [, from, to] = command;
      const files = listed(command);
      const source = isRemote(from) ? remoteDir(from) : from;
      const target = isRemote(to) ? remoteDir(to) : to;
      for (const file of files) {
        fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
        fs.copyFileSync(path.join(source, file), path.join(target, file));
      }
      return ok();
    }
    case "delete":
      for (const file of listed(command)) fs.rmSync(path.join(remoteDir(command[1]), file));
      return ok();
  }
  return { code: 1, stdout: "", stderr: `unknown command ${command.join(" ")}` };
};

const device = (name: string, rclone: { path: string; version: string } | null = { path: "/usr/bin/rclone", version: "v1.68.2" }) => {
  const imagesDir = path.join(root, name, "images");
  fs.mkdirSync(imagesDir, { recursive: true });
  const sync = createImageSync({ dataDir: path.join(root, name, "rclone"), imagesDir, findRclone: async () => rclone, runner: () => fakeRclone });
  return { sync, imagesDir };
};

const ref = (char: string) => `${char.repeat(64)}.png`;
const thumb = (char: string) => `${char.repeat(64)}.thumb.webp`;
const game = "0b8f1c2e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const cover = (char: string) => ({ gameId: game, image: ref(char) });
const addImage = (imagesDir: string, char: string) => {
  fs.mkdirSync(path.join(imagesDir, game), { recursive: true });
  fs.writeFileSync(path.join(imagesDir, game, ref(char)), `image ${char}`);
  fs.writeFileSync(path.join(imagesDir, game, thumb(char)), `thumb ${char}`);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "complete-list-image-sync-"));
  cloud = path.join(root, "cloud");
  calls = [];
  lists = [];
  loginOutcome = "ok";
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test("connecting creates the remote with the provider's options, passes on the login link once and checks the folder", async () => {
  const { sync } = device("a");
  const links: string[] = [];

  const status = await sync.connect("drive", "/Games//covers/", (url) => links.push(url));

  expect(links).toEqual(["http://127.0.0.1:53682/auth?state=abc123"]);
  expect(calls).toEqual([
    ["config", "delete", "completelist-drive"],
    ["config", "create", "completelist-drive", "drive", "scope", "drive.file"],
    ["mkdir", "completelist-drive:Games/covers"],
  ]);
  expect(status).toMatchObject({ provider: "drive", folder: "Games/covers", rclone: { version: "v1.68.2" } });
  expect(sync.isConnected()).toBe(true);
});

test("a failed or cancelled login leaves image sync disconnected, with a readable reason", async () => {
  const { sync } = device("a");

  loginOutcome = "fail";
  await expect(sync.connect("pcloud", "", () => {})).rejects.toThrow("Signing in failed: Failed to configure token: access_denied");

  loginOutcome = "wait";
  const pending = sync.connect("pcloud", "", () => {});
  await new Promise((resolve) => setTimeout(resolve, 20));
  sync.cancelConnect();
  await expect(pending).rejects.toThrow("Sign-in was cancelled.");
  expect(sync.isConnected()).toBe(false);
});

test("switching provider removes the old remote; disconnecting removes the current one", async () => {
  const { sync } = device("a");
  await sync.connect("drive", "", () => {});
  await sync.connect("pcloud", "", () => {});
  expect(calls).toContainEqual(["config", "delete", "completelist-drive"]);
  expect((await sync.status()).provider).toBe("pcloud");

  calls = [];
  expect((await sync.disconnect()).provider).toBeNull();
  expect(calls).toEqual([["config", "delete", "completelist-pcloud"]]);
});

test("syncing uploads the covers the cloud lacks, downloads the ones this computer lacks, and deletes deleted ones", async () => {
  const a = device("a");
  const b = device("b");
  await a.sync.connect("drive", "", () => {});
  await b.sync.connect("drive", "", () => {});
  const cloudFolder = path.join(cloud, "completelist-drive", "CompleteList", "images");

  addImage(a.imagesDir, "a");
  fs.writeFileSync(path.join(a.imagesDir, game, `${ref("a")}.1234.tmp`), "half-written");
  expect(await a.sync.sync({ live: [cover("a")], deleted: [] })).toEqual({ uploaded: 1, downloaded: 0, deleted: 0, missing: 0 });
  expect(fs.readdirSync(path.join(cloudFolder, game)).sort()).toEqual([ref("a"), thumb("a")].sort());

  // b's history has a's cover, and one that no computer has uploaded yet
  expect(await b.sync.sync({ live: [cover("a"), cover("b")], deleted: [] })).toEqual({ uploaded: 0, downloaded: 1, deleted: 0, missing: 1 });
  expect(fs.readFileSync(path.join(b.imagesDir, game, ref("a")), "utf8")).toBe("image a");
  expect(fs.existsSync(path.join(b.imagesDir, game, thumb("a")))).toBe(true);
  expect(await b.sync.sync({ live: [cover("a")], deleted: [] })).toEqual({ uploaded: 0, downloaded: 0, deleted: 0, missing: 0 });

  // Deleted from the history: gone from the cloud and from both computers
  expect(await b.sync.sync({ live: [], deleted: [cover("a")] })).toEqual({ uploaded: 0, downloaded: 0, deleted: 1, missing: 0 });
  expect(fs.existsSync(path.join(cloudFolder, game, ref("a")))).toBe(false);
  expect(fs.existsSync(path.join(b.imagesDir, game))).toBe(false);
  await a.sync.sync({ live: [], deleted: [cover("a")] });
  expect(fs.existsSync(path.join(a.imagesDir, game, ref("a")))).toBe(false);
});

test("without rclone, connecting explains what to do", async () => {
  const { sync } = device("a", null);
  await expect(sync.connect("drive", "", () => {})).rejects.toThrow("rclone wasn't found");
  expect((await sync.status()).rclone).toBeNull();
});

test("cloud folders can't climb out of themselves", () => {
  expect(cleanFolder("../../etc")).toBe("etc");
  expect(cleanFolder(" /a//b/ ")).toBe("a/b");
  expect(cleanFolder("a/../../b")).toBe("a/b");
  expect(cleanFolder(" .. / . /x")).toBe("x");
  expect(cleanFolder("a\u0000/\nb\u007f")).toBe("a/b");
  expect(cleanFolder("")).toBe("CompleteList/images");
  expect(cleanFolder("/")).toBe("CompleteList/images");
  expect(cleanFolder("..\\..")).toBe("CompleteList/images");
});

test("a hand-edited settings file can't point the sync outside a folder, or at the storage's top level", async () => {
  const { sync } = device("a");
  const settingsFile = path.join(root, "a", "rclone", "image-sync.json");
  const save = (folder: unknown) => {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({ provider: "pcloud", folder }));
  };

  save("a/../../b");
  expect((await sync.status()).folder).toBe("a/b");
  await sync.sync({ live: [], deleted: [] });
  expect(calls.flat().filter(isRemote)).toEqual(["completelist-pcloud:a/b", "completelist-pcloud:a/b"]);

  save("../../");
  expect((await sync.status()).folder).toBe("CompleteList/images");
  save(42);
  expect(sync.isConnected()).toBe(false);
});

test("nothing outside the cloud folder or the images folder is touched, whatever the cover history says", async () => {
  const { sync, imagesDir } = device("a");
  await sync.connect("drive", "Games/covers", () => {});
  const remote = path.join(cloud, "completelist-drive");
  const folder = path.join(remote, "Games", "covers");
  const sentinels = [
    path.join(remote, "Games", "keep.txt"),
    path.join(remote, "keep.txt"),
    path.join(folder, "other.txt"),
    path.join(folder, game, "notes.png"),
    path.join(root, "a", "keep.txt"),
    path.join(root, "a", "rclone", "keep.txt"),
  ];
  for (const file of sentinels) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "keep");
  }
  addImage(imagesDir, "a");
  await sync.sync({ live: [cover("a")], deleted: [] });

  calls = [];
  lists = [];
  const hostile = [
    { gameId: "..", image: ref("a") },
    { gameId: "../..", image: "keep.txt" },
    { gameId: `${game}/..`, image: ref("a") },
    { gameId: game, image: "../other.txt" },
    { gameId: game, image: `../../${ref("a")}` },
    { gameId: game, image: `${ref("a")}/../../other.txt` },
    { gameId: game, image: "notes.png" },
    { gameId: game.toUpperCase().replace(/-/g, "/"), image: ref("a") },
    { gameId: "", image: "" },
  ];
  expect(await sync.sync({ live: hostile, deleted: hostile })).toEqual({ uploaded: 0, downloaded: 0, deleted: 0, missing: 0 });

  for (const file of sentinels) expect(fs.existsSync(file), file).toBe(true);
  expect(fs.existsSync(path.join(folder, game, ref("a")))).toBe(true);
  expect(fs.existsSync(path.join(imagesDir, game, ref("a")))).toBe(true);
  // Read-only listing of the folder only; no copy or delete was even attempted
  expect(calls).toEqual([
    ["mkdir", "completelist-drive:Games/covers"],
    ["lsf", "completelist-drive:Games/covers", "--recursive", "--files-only"],
  ]);
});

test("copies and deletes only ever name the folder and a list of covers' files in it", async () => {
  const a = device("a");
  const b = device("b");
  await a.sync.connect("drive", "Games/covers", () => {});
  await b.sync.connect("drive", "Games/covers", () => {});
  addImage(a.imagesDir, "a");
  addImage(a.imagesDir, "b");
  await a.sync.sync({ live: [cover("a"), cover("b")], deleted: [] });
  await b.sync.sync({ live: [cover("a"), cover("b")], deleted: [] });
  await b.sync.sync({ live: [cover("a")], deleted: [cover("b")] });

  const coverFile = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{64}\.(png|jpg|webp|gif|thumb\.webp)$/;
  const changing = calls.filter((command) => command[0] === "copy" || command[0] === "delete");
  expect(changing.map((command) => command[0])).toEqual(["copy", "copy", "delete"]);
  for (const command of changing) {
    expect(command).toContain("--files-from");
    expect(command.filter(isRemote)).toEqual(["completelist-drive:Games/covers"]);
  }
  expect(lists.flat().length).toBeGreaterThan(0);
  for (const file of lists.flat()) expect(file).toMatch(coverFile);
});

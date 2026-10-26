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

const remoteDir = (spec: string) => {
  const [name, folder = ""] = spec.split(":");
  return path.join(cloud, name, folder);
};
const isRemote = (spec: string) => /^completelist-\w+:/.test(spec);

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
    case "lsf":
      return ok(fs.readdirSync(remoteDir(command[1])).map((name) => `${name}\n`).join(""));
    case "copy": {
      const [, from, to] = command;
      const files = fs.readFileSync(command[command.indexOf("--files-from") + 1], "utf8").split("\n").filter(Boolean);
      const source = isRemote(from) ? remoteDir(from) : from;
      const target = isRemote(to) ? remoteDir(to) : to;
      for (const file of files) fs.copyFileSync(path.join(source, file), path.join(target, file));
      return ok();
    }
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
const addImage = (imagesDir: string, char: string) => {
  fs.writeFileSync(path.join(imagesDir, ref(char)), `image ${char}`);
  fs.writeFileSync(path.join(imagesDir, thumb(char)), `thumb ${char}`);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "complete-list-image-sync-"));
  cloud = path.join(root, "cloud");
  calls = [];
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

test("syncing uploads what the cloud lacks and downloads what this computer's games use", async () => {
  const a = device("a");
  const b = device("b");
  await a.sync.connect("drive", "", () => {});
  await b.sync.connect("drive", "", () => {});

  addImage(a.imagesDir, "a");
  fs.writeFileSync(path.join(a.imagesDir, `${ref("a")}.1234.tmp`), "half-written");
  expect(await a.sync.sync([ref("a")])).toEqual({ uploaded: 1, downloaded: 0, missing: 0 });
  expect(fs.readdirSync(path.join(cloud, "completelist-drive", "CompleteList", "images")).sort()).toEqual([ref("a"), thumb("a")].sort());

  // b's games use a's image, and one that no computer has uploaded yet
  expect(await b.sync.sync([ref("a"), ref("b")])).toEqual({ uploaded: 0, downloaded: 1, missing: 1 });
  expect(fs.readFileSync(path.join(b.imagesDir, ref("a")), "utf8")).toBe("image a");
  expect(fs.existsSync(path.join(b.imagesDir, thumb("a")))).toBe(true);

  expect(await b.sync.sync([ref("a")])).toEqual({ uploaded: 0, downloaded: 0, missing: 0 });
});

test("without rclone, connecting explains what to do", async () => {
  const { sync } = device("a", null);
  await expect(sync.connect("drive", "", () => {})).rejects.toThrow("rclone wasn't found");
  expect((await sync.status()).rclone).toBeNull();
});

test("cloud folders can't climb out of themselves", () => {
  expect(cleanFolder("../../etc")).toBe("etc");
  expect(cleanFolder(" /a//b/ ")).toBe("a/b");
  expect(cleanFolder("")).toBe("CompleteList/images");
  expect(cleanFolder("..\\..")).toBe("CompleteList/images");
});

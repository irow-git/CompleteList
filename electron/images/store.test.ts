// @vitest-environment node
import { afterEach, beforeEach, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { imagePath, removeImage, removeUnusedImages, saveImage, storedFiles } from "./store";

// A real 1×1 PNG (not a cover), and buffers that only need WebP's header to pass as covers
const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const webp = (content = "") => new Uint8Array(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from(`WEBPVP8 ${content}`)]));
const game = "0b8f1c2e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const other = "1c9e2d3f-5e6b-4c7d-9e8f-0a1b2c3d4e5f";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "complete-list-images-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("stores a cover in its game's folder, under its hash, once", () => {
  const ref = saveImage(dir, game, webp());

  expect(ref).toMatch(/^[a-f0-9]{64}\.webp$/);
  expect(saveImage(dir, game, webp())).toBe(ref);
  expect(storedFiles(dir)).toEqual([`${game}/${ref}`]);
  expect(fs.readFileSync(imagePath(dir, game, ref)!)).toEqual(Buffer.from(webp()));
  // Another game using the same picture gets its own copy
  expect(saveImage(dir, other, webp())).toBe(ref);
  expect(storedFiles(dir)).toHaveLength(2);
});

test("refuses anything that isn't a WebP cover, absurdly large data and unknown owners", () => {
  expect(() => saveImage(dir, game, png)).toThrow("couldn't be created");
  expect(() => saveImage(dir, game, new Uint8Array())).toThrow("couldn't be created");
  const huge = new Uint8Array(9 * 1024 * 1024);
  huge.set(webp());
  expect(() => saveImage(dir, game, huge)).toThrow("couldn't be created");
  expect(() => saveImage(dir, "../outside", webp())).toThrow("for a game");
  expect(fs.readdirSync(dir)).toEqual([]);
});

test("only real owners and references map to files, so requests can't reach outside the folder", () => {
  const ref = `${"a".repeat(64)}.webp`;
  expect(imagePath(dir, game, "../../etc/passwd")).toBeNull();
  expect(imagePath(dir, "..", ref)).toBeNull();
  expect(imagePath(dir, game, `${"a".repeat(64)}.png`)).toBeNull();
  expect(imagePath(dir, game, ref)).toBe(path.join(dir, game, ref));
});

test("removing a cover takes its folder once it's empty", () => {
  const ref = saveImage(dir, game, webp());
  removeImage(dir, game, ref);
  expect(fs.readdirSync(dir)).toEqual([]);
});

test("clean-up keeps exactly the covers listed, and clears everything else, older layouts included", () => {
  const kept = saveImage(dir, game, webp());
  const unused = saveImage(dir, game, webp("unused"));
  saveImage(dir, other, webp());
  fs.writeFileSync(path.join(dir, `${"f".repeat(64)}.png`), "old flat layout");
  // An original and its thumbnail, from when both were kept
  fs.writeFileSync(path.join(dir, game, `${"e".repeat(64)}.png`), "old original");
  fs.writeFileSync(path.join(dir, game, `${"e".repeat(64)}.thumb.webp`), "old thumbnail");

  expect(removeUnusedImages(dir, new Set([`${game}/${kept}`]))).toBe(2);
  expect(storedFiles(dir)).toEqual([`${game}/${kept}`]);
  expect(fs.existsSync(path.join(dir, game, unused))).toBe(false);
  expect(fs.existsSync(path.join(dir, other))).toBe(false);
});

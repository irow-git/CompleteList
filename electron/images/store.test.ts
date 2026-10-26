// @vitest-environment node
import { afterEach, beforeEach, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { imagePath, removeImage, removeUnusedImages, saveImage, storedFiles } from "./store";

// A real 1×1 PNG, and a buffer that only needs WebP's signature to pass as a thumbnail
const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const webp = new Uint8Array(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]));
const game = "0b8f1c2e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const other = "1c9e2d3f-5e6b-4c7d-9e8f-0a1b2c3d4e5f";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "complete-list-images-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("stores an image and its thumbnail in its game's folder, under the image's hash, once", () => {
  const ref = saveImage(dir, game, { type: "image/png", data: png, thumbnail: webp });

  expect(ref).toMatch(/^[a-f0-9]{64}\.png$/);
  expect(saveImage(dir, game, { type: "image/png", data: png, thumbnail: webp })).toBe(ref);
  expect(storedFiles(dir).sort()).toEqual([`${game}/${ref}`, `${game}/${ref.replace(".png", ".thumb.webp")}`].sort());
  expect(fs.readFileSync(imagePath(dir, game, ref)!)).toEqual(Buffer.from(png));
  // Another game using the same picture gets its own copy
  expect(saveImage(dir, other, { type: "image/png", data: png, thumbnail: webp })).toBe(ref);
  expect(storedFiles(dir)).toHaveLength(4);
});

test("refuses files that aren't what they claim, unsupported types, oversized images and unknown owners", () => {
  expect(() => saveImage(dir, game, { type: "image/jpeg", data: png, thumbnail: webp })).toThrow("isn't a valid image");
  expect(() => saveImage(dir, game, { type: "image/bmp", data: png, thumbnail: webp })).toThrow("PNG, JPEG, WebP or GIF");
  expect(() => saveImage(dir, game, { type: "image/png", data: png, thumbnail: png })).toThrow("thumbnail");
  const huge = new Uint8Array(5 * 1024 * 1024);
  huge.set(png);
  expect(() => saveImage(dir, game, { type: "image/png", data: huge, thumbnail: webp })).toThrow("4 MB");
  expect(() => saveImage(dir, "../outside", { type: "image/png", data: png, thumbnail: webp })).toThrow("for a game");
  expect(fs.readdirSync(dir)).toEqual([]);
});

test("only real owners and references map to files, so requests can't reach outside the folder", () => {
  const ref = `${"a".repeat(64)}.png`;
  expect(imagePath(dir, game, "../../etc/passwd")).toBeNull();
  expect(imagePath(dir, "..", ref)).toBeNull();
  expect(imagePath(dir, game, ref, true)).toBe(path.join(dir, game, `${"a".repeat(64)}.thumb.webp`));
});

test("removing an image takes its thumbnail and, once empty, its folder", () => {
  const ref = saveImage(dir, game, { type: "image/png", data: png, thumbnail: webp });
  removeImage(dir, game, ref);
  expect(fs.readdirSync(dir)).toEqual([]);
});

test("clean-up keeps exactly the covers listed, and clears everything else, old flat files included", () => {
  const kept = saveImage(dir, game, { type: "image/png", data: png, thumbnail: webp });
  const gif = new Uint8Array(Buffer.from("GIF89a-rest-of-file"));
  const unused = saveImage(dir, game, { type: "image/gif", data: gif, thumbnail: webp });
  saveImage(dir, other, { type: "image/png", data: png, thumbnail: webp });
  fs.writeFileSync(path.join(dir, `${"f".repeat(64)}.png`), "old layout");

  expect(removeUnusedImages(dir, new Set([`${game}/${kept}`]))).toBe(3);
  expect(storedFiles(dir).sort()).toEqual([`${game}/${kept}`, `${game}/${kept.replace(".png", ".thumb.webp")}`].sort());
  expect(fs.existsSync(path.join(dir, game, unused))).toBe(false);
  expect(fs.existsSync(path.join(dir, other))).toBe(false);
});

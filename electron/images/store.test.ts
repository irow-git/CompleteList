// @vitest-environment node
import { afterEach, beforeEach, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { imagePath, removeUnusedImages, saveImage } from "./store";

// A real 1×1 PNG, and a buffer that only needs WebP's signature to pass as a thumbnail
const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const webp = new Uint8Array(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]));

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "complete-list-images-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test("stores an image and its thumbnail under the image's hash, once", () => {
  const ref = saveImage(dir, { type: "image/png", data: png, thumbnail: webp });

  expect(ref).toMatch(/^[a-f0-9]{64}\.png$/);
  expect(saveImage(dir, { type: "image/png", data: png, thumbnail: webp })).toBe(ref);
  expect(fs.readdirSync(dir).sort()).toEqual([ref, ref.replace(".png", ".thumb.webp")].sort());
  expect(fs.readFileSync(imagePath(dir, ref)!)).toEqual(Buffer.from(png));
});

test("refuses files that aren't what they claim, unsupported types and oversized images", () => {
  expect(() => saveImage(dir, { type: "image/jpeg", data: png, thumbnail: webp })).toThrow("isn't a valid image");
  expect(() => saveImage(dir, { type: "image/bmp", data: png, thumbnail: webp })).toThrow("PNG, JPEG, WebP or GIF");
  expect(() => saveImage(dir, { type: "image/png", data: png, thumbnail: png })).toThrow("thumbnail");
  const huge = new Uint8Array(26 * 1024 * 1024);
  huge.set(png);
  expect(() => saveImage(dir, { type: "image/png", data: huge, thumbnail: webp })).toThrow("25 MB");
  expect(fs.readdirSync(dir)).toEqual([]);
});

test("only real references map to files, so requests can't reach outside the folder", () => {
  expect(imagePath(dir, "../../etc/passwd")).toBeNull();
  expect(imagePath(dir, `${"a".repeat(64)}.png/../../x`)).toBeNull();
  expect(imagePath(dir, `${"a".repeat(64)}.png`, true)).toBe(path.join(dir, `${"a".repeat(64)}.thumb.webp`));
});

test("cleanup removes unreferenced images and their thumbnails, and keeps the rest", () => {
  const kept = saveImage(dir, { type: "image/png", data: png, thumbnail: webp });
  const gifData = new Uint8Array(Buffer.from("GIF89a-rest-of-file"));
  const unused = saveImage(dir, { type: "image/gif", data: gifData, thumbnail: webp });

  expect(removeUnusedImages(dir, new Set([kept]))).toBe(1);
  expect(fs.readdirSync(dir).sort()).toEqual([kept, kept.replace(".png", ".thumb.webp")].sort());
  expect(fs.existsSync(path.join(dir, unused))).toBe(false);
});

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ImageInput } from "../../src/interfaces";
import { isImageRef } from "../../src/lib/imageRef";

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

// The bytes each format starts with, so a file can't claim to be an image it isn't
const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  png: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  webp: (bytes) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
  gif: (bytes) => bytes.toString("ascii", 0, 4) === "GIF8",
};

const thumbnailName = (ref: string) => `${ref.slice(0, ref.indexOf("."))}.thumb.webp`;

// Written under a temporary name first, so a crash mid-write never leaves a broken file under the real name
function writeOnce(file: string, bytes: Buffer) {
  if (fs.existsSync(file)) return;
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
}

// Stores an image and its thumbnail, returning the reference to put on the game. Saving the same picture twice
// returns the same reference without writing anything
export function saveImage(dir: string, input: ImageInput): string {
  const extension = EXTENSIONS[input.type];
  if (!extension) throw new Error("Use a PNG, JPEG, WebP or GIF image.");

  const data = Buffer.from(input.data);
  const thumbnail = Buffer.from(input.thumbnail);
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) throw new Error("Images can be up to 25 MB.");
  if (!SIGNATURES[extension](data)) throw new Error("That file isn't a valid image.");
  if (thumbnail.length > MAX_THUMBNAIL_BYTES || !SIGNATURES.webp(thumbnail)) throw new Error("The thumbnail couldn't be created.");

  const ref = `${createHash("sha256").update(data).digest("hex")}.${extension}`;
  fs.mkdirSync(dir, { recursive: true });
  writeOnce(path.join(dir, ref), data);
  writeOnce(path.join(dir, thumbnailName(ref)), thumbnail);
  return ref;
}

// The file behind a reference, or null for anything that isn't one (so a request can never reach outside the folder)
export function imagePath(dir: string, ref: string, thumbnail = false): string | null {
  if (!isImageRef(ref)) return null;
  return path.join(dir, thumbnail ? thumbnailName(ref) : ref);
}

// Deletes the images (and thumbnails) no game points at any more, e.g. a replaced cover. Returns how many were removed
export function removeUnusedImages(dir: string, referenced: Set<string>): number {
  if (!fs.existsSync(dir)) return 0;
  const keep = new Set([...referenced].flatMap((ref) => [ref, thumbnailName(ref)]));
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (keep.has(name)) continue;
    fs.rmSync(path.join(dir, name), { force: true });
    if (isImageRef(name)) removed++;
  }
  return removed;
}

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ImageInput } from "../../src/interfaces";
import { isImageRef, isOwnerId } from "../../src/lib/imageRef";

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

// The bytes each format starts with, so a file can't claim to be an image it isn't
const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  png: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  webp: (bytes) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
  gif: (bytes) => bytes.toString("ascii", 0, 4) === "GIF8",
};

// Covers are stored as <images folder>/<game or DLC id>/<ref>, plus <hash>.thumb.webp next to each
export const thumbnailName = (ref: string) => `${ref.slice(0, ref.indexOf("."))}.thumb.webp`;

// An image and its thumbnail, as paths relative to the images folder ("<owner>/<file>"), which is also how the
// cloud copy is laid out
export const imageFiles = (owner: string, ref: string) => [`${owner}/${ref}`, `${owner}/${thumbnailName(ref)}`];

// Written under a temporary name first, so a crash mid-write never leaves a broken file under the real name
function writeOnce(file: string, bytes: Buffer) {
  if (fs.existsSync(file)) return;
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
}

// Stores an image and its thumbnail in the folder of the game or DLC it's for, returning the reference to put on it.
// Saving the same picture twice returns the same reference without writing anything
export function saveImage(dir: string, owner: string, input: ImageInput): string {
  if (!isOwnerId(owner)) throw new Error("Covers can only be stored for a game.");
  const extension = EXTENSIONS[input.type];
  if (!extension) throw new Error("Use a PNG, JPEG, WebP or GIF image.");

  const data = Buffer.from(input.data);
  const thumbnail = Buffer.from(input.thumbnail);
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) throw new Error("Images can be up to 4 MB.");
  if (!SIGNATURES[extension](data)) throw new Error("That file isn't a valid image.");
  if (thumbnail.length > MAX_THUMBNAIL_BYTES || !SIGNATURES.webp(thumbnail)) throw new Error("The thumbnail couldn't be created.");

  const ref = `${createHash("sha256").update(data).digest("hex")}.${extension}`;
  const folder = path.join(dir, owner);
  fs.mkdirSync(folder, { recursive: true });
  writeOnce(path.join(folder, ref), data);
  writeOnce(path.join(folder, thumbnailName(ref)), thumbnail);
  return ref;
}

// The file behind a reference, or null for anything that isn't one (so a request can never reach outside the folder)
export function imagePath(dir: string, owner: string, ref: string, thumbnail = false): string | null {
  if (!isOwnerId(owner) || !isImageRef(ref)) return null;
  return path.join(dir, owner, thumbnail ? thumbnailName(ref) : ref);
}

// Removes an image and its thumbnail, and the owner's folder once it's empty
export function removeImage(dir: string, owner: string, ref: string) {
  if (!isOwnerId(owner) || !isImageRef(ref)) return;
  for (const file of imageFiles(owner, ref)) fs.rmSync(path.join(dir, file), { force: true });
  const folder = path.join(dir, owner);
  if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
}

// Every stored file as "<owner>/<file>": images and thumbnails in the owners' folders (half-written .tmp files left out)
export function storedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isOwnerId(entry.name))
    .flatMap((folder) => fs.readdirSync(path.join(dir, folder.name)).map((file) => `${folder.name}/${file}`))
    .filter((file) => !file.endsWith(".tmp"));
}

// Deletes every file that isn't one of the covers to keep ("<owner>/<ref>" pairs): replaced covers that were never
// saved, deleted covers, leftovers of games that are gone, and anything from older layouts. Returns how many images
// (not counting thumbnails) were removed
export function removeUnusedImages(dir: string, keep: Set<string>): number {
  if (!fs.existsSync(dir)) return 0;
  const kept = new Set([...keep].flatMap((entry) => imageFiles(...(entry.split("/") as [string, string]))));
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) {
      // The old layout kept images directly in the folder
      fs.rmSync(entryPath, { force: true });
      if (isImageRef(entry.name)) removed++;
      continue;
    }
    if (!isOwnerId(entry.name)) continue;
    for (const file of fs.readdirSync(entryPath)) {
      if (kept.has(`${entry.name}/${file}`)) continue;
      fs.rmSync(path.join(entryPath, file), { force: true });
      if (isImageRef(file)) removed++;
    }
    if (fs.readdirSync(entryPath).length === 0) fs.rmdirSync(entryPath);
  }
  return removed;
}

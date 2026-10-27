import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isImageRef, isOwnerId } from "../../src/lib/imageRef";

// Not a limit on the pictures people pick (any size is cropped and scaled down first), just a bound on what the main
// process accepts: a cropped cover is a few hundred KB
const MAX_COVER_BYTES = 8 * 1024 * 1024;

// WebP's header, so the bytes are what they claim to be
const isWebp = (bytes: Buffer) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";

// Covers are stored as <images folder>/<game or DLC id>/<ref>. As a path relative to the images folder, which is also
// how the cloud copy is laid out
export const imageFile = (owner: string, ref: string) => `${owner}/${ref}`;

// Written under a temporary name first, so a crash mid-write never leaves a broken file under the real name
function writeOnce(file: string, bytes: Buffer) {
  if (fs.existsSync(file)) return;
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
}

// Stores a cropped cover (WebP) in the folder of the game or DLC it's for, returning the reference to put on it.
// Saving the same picture twice returns the same reference without writing anything
export function saveImage(dir: string, owner: string, cover: Uint8Array): string {
  if (!isOwnerId(owner)) throw new Error("Covers can only be stored for a game.");
  const data = Buffer.from(cover);
  if (data.length === 0 || data.length > MAX_COVER_BYTES || !isWebp(data)) throw new Error("The cover couldn't be created.");

  const ref = `${createHash("sha256").update(data).digest("hex")}.webp`;
  fs.mkdirSync(path.join(dir, owner), { recursive: true });
  writeOnce(path.join(dir, imageFile(owner, ref)), data);
  return ref;
}

// The file behind a reference, or null for anything that isn't one (so a request can never reach outside the folder)
export function imagePath(dir: string, owner: string, ref: string): string | null {
  if (!isOwnerId(owner) || !isImageRef(ref)) return null;
  return path.join(dir, imageFile(owner, ref));
}

// Removes a cover, and the owner's folder once it's empty
export function removeImage(dir: string, owner: string, ref: string) {
  if (!isOwnerId(owner) || !isImageRef(ref)) return;
  fs.rmSync(path.join(dir, imageFile(owner, ref)), { force: true });
  const folder = path.join(dir, owner);
  if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
}

// Every stored file as "<owner>/<file>" in the owners' folders (half-written .tmp files left out)
export function storedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isOwnerId(entry.name))
    .flatMap((folder) => fs.readdirSync(path.join(dir, folder.name)).map((file) => `${folder.name}/${file}`))
    .filter((file) => !file.endsWith(".tmp"));
}

// Deletes every file that isn't one of the covers to keep ("<owner>/<ref>" pairs): replaced covers that were never
// saved, deleted covers, leftovers of games that are gone, and anything from older layouts (originals and their
// thumbnails included). Returns how many covers were removed
export function removeUnusedImages(dir: string, keep: Set<string>): number {
  if (!fs.existsSync(dir)) return 0;
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
      if (keep.has(imageFile(entry.name, file))) continue;
      fs.rmSync(path.join(entryPath, file), { force: true });
      if (isImageRef(file)) removed++;
    }
    if (fs.readdirSync(entryPath).length === 0) fs.rmdirSync(entryPath);
  }
  return removed;
}

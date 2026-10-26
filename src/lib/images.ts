import { ImageInput } from "@/interfaces";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
// Twice the widest card, so thumbnails stay sharp on high-DPI screens
const THUMBNAIL_WIDTH = 480;

// Served by the main process (electron/images/protocol.ts); a reference always means the same bytes
export const imageUrl = (ref: string, variant: "full" | "thumb" = "full") => `img://local/${ref}${variant === "thumb" ? "/thumb" : ""}`;

// Reads a picked, dropped or pasted file and makes its thumbnail here, where Chromium can decode every format
export async function prepareImage(file: Blob): Promise<ImageInput> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG, WebP or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images can be up to 25 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image.");
  }
  const scale = Math.min(1, THUMBNAIL_WIDTH / bitmap.width);
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // WebP keeps transparency, which JPEG would turn black
  const thumbnail = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });

  return { type: file.type, data: new Uint8Array(await file.arrayBuffer()), thumbnail: new Uint8Array(await thumbnail.arrayBuffer()) };
}

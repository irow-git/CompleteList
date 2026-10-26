import { ImageInput } from "@/interfaces";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// The cover area of a card, width / height: 2:3, the usual shape of game box art. The cropper uses the same ratio
export const COVER_ASPECT = 2 / 3;
// The stored cover is at most this tall (so 800×1200); the thumbnail is twice the widest card, for high-DPI screens
const COVER_MAX_HEIGHT = 1200;
const THUMBNAIL_WIDTH = 640;

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Served by the main process (electron/images/protocol.ts) from the folder of the game or DLC the cover belongs to; a
// reference always means the same bytes
export const imageUrl = (owner: string, ref: string, variant: "full" | "thumb" = "full") =>
  `img://local/${owner}/${ref}${variant === "thumb" ? "/thumb" : ""}`;

// Throws a message for the user if the file can't be used as a cover
export function checkImageFile(file: Blob) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG, WebP or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images can be up to 4 MB.");
}

export async function readImage(file: Blob): Promise<ImageBitmap> {
  checkImageFile(file);
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image.");
  }
}

const encode = async (source: ImageBitmap, area: CropArea, width: number, height: number, quality: number) => {
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  // WebP keeps transparency, which JPEG would turn black
  return new Uint8Array(await (await canvas.convertToBlob({ type: "image/webp", quality })).arrayBuffer());
};

// Cuts the chosen area out of the picture (done here, where Chromium can decode every format) and makes the stored
// cover and its thumbnail from it
export async function cropCover(source: ImageBitmap, area: CropArea): Promise<ImageInput> {
  const scale = Math.min(1, COVER_MAX_HEIGHT / area.height);
  const thumbScale = Math.min(1, THUMBNAIL_WIDTH / area.width);
  return {
    type: "image/webp",
    data: await encode(source, area, area.width * scale, area.height * scale, 0.9),
    thumbnail: await encode(source, area, area.width * thumbScale, area.height * thumbScale, 0.85),
  };
}

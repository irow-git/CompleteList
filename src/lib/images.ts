export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// The cover area of a card, width / height: 2:3, the usual shape of game box art. The cropper uses the same ratio
export const COVER_ASPECT = 2 / 3;
// Covers are stored at most this wide (so 640×960): twice the widest card, for high-DPI screens
const COVER_MAX_WIDTH = 640;

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Served by the main process (electron/images/protocol.ts) from the folder of the game or DLC the cover belongs to; a
// reference always means the same bytes
export const imageUrl = (owner: string, ref: string) => `img://local/${owner}/${ref}`;

// Throws a message for the user if the file can't be used as a cover. Any size is fine: only the cropped, scaled-down
// cover is kept
export function checkImageFile(file: Blob) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG, WebP or GIF image.");
}

export async function readImage(file: Blob): Promise<ImageBitmap> {
  checkImageFile(file);
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image.");
  }
}

// Cuts the chosen area out of the picture (done here, where Chromium can decode every format) and scales it down to
// the stored cover. Only this is kept, not the original picture. WebP keeps transparency, which JPEG would turn black
export async function cropCover(source: ImageBitmap, area: CropArea): Promise<Uint8Array> {
  const scale = Math.min(1, COVER_MAX_WIDTH / area.width);
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(area.width * scale)), Math.max(1, Math.round(area.height * scale)));
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Uint8Array(await (await canvas.convertToBlob({ type: "image/webp", quality: 0.9 })).arrayBuffer());
}

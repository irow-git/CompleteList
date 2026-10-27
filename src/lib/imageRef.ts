// How a game points at its cover: the SHA-256 of the file's bytes plus its extension, e.g. "3fa9…c1.webp". Covers are
// always WebP (see cropCover in src/lib/images.ts). They're content-addressed, so the same picture is stored once and
// a file never changes after it's written. Shared by the renderer and the main process, which checks every reference
// it's given against it
export const IMAGE_REF = /^[a-f0-9]{64}\.webp$/;

export const isImageRef = (value: unknown): value is string => typeof value === "string" && IMAGE_REF.test(value);

// Covers live in a folder per game or DLC, named by its id (a UUID). Checked wherever a folder name is built from an
// id, so nothing can point outside the images folder
const OWNER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOwnerId = (value: unknown): value is string => typeof value === "string" && OWNER_ID.test(value);

// A cover's id: one row per game and image, the same on every computer
export const coverId = (gameId: string, image: string) => `${gameId}:${image}`;

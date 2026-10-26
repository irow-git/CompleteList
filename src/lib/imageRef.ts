// How a game points at an image: the SHA-256 of the file's bytes plus its extension, e.g. "3fa9…c1.png".
// Images are content-addressed, so the same picture is stored once and a file never changes after it's written.
// Shared by the renderer and the main process, which checks every reference it's given against it
export const IMAGE_REF = /^[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

export const isImageRef = (value: unknown): value is string => typeof value === "string" && IMAGE_REF.test(value);

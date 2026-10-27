import { imageUrl } from "./images";

// The colour a card glows in when a lot of hours went into the game: the cover's most vivid colour, so a mostly dark
// cover with a red logo glows red rather than muddy brown

// Every glow is kept bright and saturated enough to show up around the card
const vivid = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  let hue = 0;
  if (chroma > 0) {
    if (max === r) hue = ((g - b) / chroma + 6) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
  }
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return `hsl(${Math.round(hue * 60)} ${percent(Math.max(saturation, 0.55))} ${percent(Math.min(0.65, Math.max(0.5, lightness)))})`;
};

// For a colour like "#47434d", e.g. the placeholder of a game without a cover
export const vividHex = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  return vivid(r, g, b);
};

// Averages a small copy of the image, each pixel weighted by how colourful it is; greys barely count
async function sample(owner: string, ref: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl(owner, ref));
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob(), { resizeWidth: 16, resizeHeight: 24 });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let [r, g, b, total] = [0, 0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      const [pr, pg, pb] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
      const chroma = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
      const weight = (chroma * chroma + 0.01) * (data[i + 3] / 255);
      r += pr * weight;
      g += pg * weight;
      b += pb * weight;
      total += weight;
    }
    return total > 0 ? vivid(r / total, g / total, b / total) : null;
  } catch {
    // e.g. the file isn't on this computer yet, or there's no main process (yarn dev:web)
    return null;
  }
}

const sampled = new Map<string, Promise<string | null>>();

// Null if the image can't be read. Worked out once per cover: a reference always means the same picture
export function coverGlowColor(owner: string, ref: string) {
  const key = `${owner}/${ref}`;
  let color = sampled.get(key);
  if (!color) sampled.set(key, (color = sample(owner, ref)));
  return color;
}

// A game's score: a whole number from 1 to 100, or null for none. Shared by the renderer and the main process, which
// cleans every score it's given with toScore
export const SCORE_MIN = 1;
export const SCORE_MAX = 100;

export const toScore = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(value))) : null;

// Red up to 40, through orange and yellow, to green from 85. Bright enough for black text on top
export const scoreColor = (score: number) => {
  const t = Math.min(1, Math.max(0, (score - 40) / 45));
  return `hsl(${Math.round(t * 120)} 80% 48%)`;
};

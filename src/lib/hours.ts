// Hours played: 0 or more, to one decimal (what the form lets you type), or null for unknown. Shared by the renderer
// and the main process, which cleans every value it's given with toHours
export const MAX_HOURS = 999999;

export const toHours = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(MAX_HOURS, Math.round(value * 10) / 10) : null;

export const formatHours = (hours: number) => `${hours.toLocaleString("en-US", { maximumFractionDigits: 1 })}h`;

// The ranges the card view's ruler groups hours into: each one is over its bound and up to the next. The database
// groups by the same bounds (checkpointKey in electron/db/games.ts)
export const HOURS_RANGES = [0, 10, 25, 50, 100, 250, 500, 1000, 9000];

// How much a card glows: a little over 100 hours, more over 500, and bright red over 9000
export const glowLevel = (hours: number | null): 0 | 1 | 2 | 3 =>
  hours === null ? 0 : hours > 9000 ? 3 : hours > 500 ? 2 : hours > 100 ? 1 : 0;

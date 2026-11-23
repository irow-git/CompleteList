import { inArray } from "drizzle-orm";
import type { SelectList, SyncChange } from "../../src/interfaces";
import { formatDay } from "../../src/lib/dates";
import { formatHours } from "../../src/lib/hours";
import type { Db } from "../db";
import { games } from "../db/schema";
import type { RemoteDetails } from "./remote";

// Turns what a sync does into SyncChanges: each game's properties as text, and which of them differ

type Field = SyncChange["fields"][number];

const text = (value: string) => (value.trim() ? value : null);
const list = (values: string[]) => (values.length > 0 ? values.join(", ") : null);
const day = (value: Date | null) => (value ? formatDay(value) : null);
const yesNo = (value: boolean) => (value ? "Yes" : "No");

// Covers and images are named by their content, so a short piece of the name tells them apart (like a commit hash)
export const shortImage = (image: string | null) => (image ? image.slice(0, 8) : null);

// In the order the details show them
const FIELDS: [string, (game: RemoteDetails) => string | null][] = [
  ["Title", (game) => text(game.title)],
  ["Series", (game) => (game.series ? game.series : null)],
  ["Platform", (game) => list(game.platform)],
  ["Tags", (game) => list(game.tags)],
  ["Completion", (game) => text(game.completion)],
  ["Release date", (game) => day(game.release_date)],
  ["Last completion", (game) => day(game.last_completion)],
  ["Score", (game) => (game.score === null ? null : String(game.score))],
  ["Hours", (game) => (game.hours === null ? null : formatHours(game.hours))],
  ["Original copy", (game) => yesNo(game.original_copy)],
  ["Free to play", (game) => yesNo(game.free_to_play)],
  ["Service", (game) => yesNo(game.service)],
  ["Comment", (game) => text(game.comment)],
  ["Cover", (game) => shortImage(game.cover_image)],
];

// The properties that differ between two versions of a game; with no previous version, every one it has.
// ignoreSeries: when the newer version doesn't say (uploaded by a version of the app without series), so it isn't
// being changed
export function gameFields(before: RemoteDetails | null, after: RemoteDetails, ignoreSeries = false): Field[] {
  const fields: Field[] = [];
  for (const [name, read] of FIELDS) {
    if (ignoreSeries && name === "Series") continue;
    const from = before ? read(before) : null;
    const to = read(after);
    if (from !== to && !(before === null && to === "No")) fields.push({ name, from, to });
  }
  return fields;
}

// Titles by game id, for naming DLCs' games, covers and images. Deleted games still have their row until purged
export function titlesOf(db: Pick<Db, "select">, ids: string[]): Map<string, string> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  return new Map(
    db
      .select({ id: games.id, title: games.title })
      .from(games)
      .where(inArray(games.id, unique))
      .all()
      .map((row) => [row.id, row.title])
  );
}

export const gameChange = (
  side: SyncChange["side"],
  action: SyncChange["action"],
  title: string,
  parentTitle: string | null | undefined,
  fields: Field[] = []
): SyncChange => ({
  side,
  kind: parentTitle === undefined ? "game" : "dlc",
  action,
  title: title || "Untitled",
  ...(parentTitle !== undefined && { note: `DLC of ${parentTitle ?? "a removed game"}` }),
  fields,
});

export const coverChange = (side: SyncChange["side"], deleted: boolean, title: string | undefined, image: string): SyncChange => ({
  side,
  kind: "cover",
  action: deleted ? "deleted" : "added",
  title: title ?? "A game not on this computer",
  note: "Cover history",
  fields: [{ name: "Cover", from: deleted ? shortImage(image) : null, to: deleted ? null : shortImage(image) }],
});

const LIST_NAMES: Record<SelectList, string> = { platform: "Platform option", tags: "Tag option" };

export const optionChange = (side: SyncChange["side"], deleted: boolean, list: SelectList, value: string): SyncChange => ({
  side,
  kind: "option",
  action: deleted ? "deleted" : "added",
  title: value,
  note: LIST_NAMES[list],
  fields: [],
});

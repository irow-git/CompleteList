import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import Fuse from "fuse.js";
import { detectSeries, normalizeSeries, seriesKey, suggestSeries, type SeriesSuggestion } from "../../src/lib/series";
import { titleWithoutArticle } from "../../src/lib/titles";
import type { SeriesMember, SeriesSave, SeriesSummary } from "../../src/interfaces";
import type { Db } from ".";
import { setSeriesOf } from "./games";
import { gameMetadata, games } from "./schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// The games on a series card
const PREVIEW_GAMES = 8;

const byRelease = (a: SeriesMember, b: SeriesMember) =>
  (a.release_date?.getTime() ?? Infinity) - (b.release_date?.getTime() ?? Infinity) || a.title.localeCompare(b.title);

// Live base games: the only ones with a series (DLCs go with their game)
const baseGames = (db: Db | Tx, series?: string) =>
  db
    .select({ id: games.id, title: games.title, cover_image: games.cover_image, release_date: games.release_date, series: games.series })
    .from(games)
    .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
    .where(
      and(
        isNull(gameMetadata.deleted_at),
        isNull(games.parent_id),
        series === undefined ? undefined : sql`${games.series} = ${series} collate nocase`
      )
    )
    .all();

// Every series, by name (without a leading article, like the title sort), each with its games by release
function groupSeries(db: Db) {
  const groups = new Map<string, { name: string; members: SeriesMember[] }>();
  for (const game of baseGames(db)) {
    if (!game.series) continue;
    const key = seriesKey(game.series);
    if (!groups.has(key)) groups.set(key, { name: game.series, members: [] });
    groups.get(key)!.members.push(game);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, members: group.members.sort(byRelease) }))
    .sort((a, b) => titleWithoutArticle(a.name).localeCompare(titleWithoutArticle(b.name), undefined, { sensitivity: "base" }));
}

// The series screen: every series, or those whose name (or one of whose games) matches the search
export function listSeries(db: Db, search?: string): SeriesSummary[] {
  let groups = groupSeries(db);
  const query = search?.trim();
  if (query) {
    const fuse = new Fuse(
      groups.map((group) => ({ group, name: group.name, titles: group.members.map((member) => member.title) })),
      { keys: [{ name: "name", weight: 3 }, "titles"], threshold: 0.35, ignoreLocation: true }
    );
    groups = fuse.search(query).map((result) => result.item.group);
  }
  return groups.map(({ name, members }) => ({
    name,
    count: members.length,
    games: members.slice(0, PREVIEW_GAMES).map(({ id, title, cover_image }) => ({ id, title, cover_image })),
  }));
}

// A series and its games by release, or null if no game is in it
export function getSeries(db: Db, name: string): { name: string; members: SeriesMember[] } | null {
  const members = baseGames(db, name).sort(byRelease);
  return members.length > 0 ? { name: members[0].series!, members } : null;
}

// Which series a new game with this title (and release date) likely belongs to (see src/lib/series.ts)
export const suggestForTitle = (db: Db, title: string, release: Date | null = null, excludeId?: string): SeriesSuggestion =>
  suggestSeries(
    title,
    baseGames(db).filter((game) => game.id !== excludeId),
    release instanceof Date ? release : null
  );

// The same for a game already in the collection, or null when it's already in a series (or gone)
export function suggestForGame(db: Db, id: string): { title: string; suggestion: SeriesSuggestion } | null {
  const game = baseGames(db).find((row) => row.id === id);
  if (!game || game.series) return null;
  return { title: game.title, suggestion: suggestForTitle(db, game.title, game.release_date, id) };
}

// Looks for series across the games that have none: clear matches are saved straight away, and the games it couldn't
// decide for are returned, for the user to go through one by one
export function detectAll(db: Db): { assigned: number; unclear: string[] } {
  const { assigned, unclear } = detectSeries(baseGames(db));
  const byName = new Map<string, string[]>();
  for (const [id, name] of assigned) byName.set(name, [...(byName.get(name) ?? []), id]);
  let changed = 0;
  db.transaction((tx) => {
    const now = new Date();
    for (const [name, ids] of byName) changed += setSeriesOf(tx, ids, name, now).length;
  });
  return { assigned: changed, unclear };
}

// Puts games in a series (the user's pick for an unclear match), or takes them out of theirs with null
export function assignSeries(db: Db, ids: string[], name: string | null): void {
  db.transaction((tx) => setSeriesOf(tx, ids, name, new Date()));
}

// The series edit screen: renames the series and makes memberIds its games. Fails if the new name belongs to another
// series, rather than quietly merging the two
export function saveSeries(db: Db, { oldName, name: rawName, memberIds }: SeriesSave): string {
  const name = normalizeSeries(rawName);
  if (!name) throw new Error("A series needs a name");
  return db.transaction((tx) => {
    const isRenamed = oldName === null || seriesKey(oldName) !== seriesKey(name);
    if (isRenamed) {
      const taken = tx
        .select({ id: games.id })
        .from(games)
        .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
        .where(and(isNull(gameMetadata.deleted_at), isNotNull(games.series), sql`${games.series} = ${name} collate nocase`))
        .get();
      if (taken) throw new Error(`There already is a series called "${name}"`);
    }
    const now = new Date();
    const keep = new Set(memberIds);
    const leaving = oldName === null ? [] : baseGames(tx, oldName).filter((game) => !keep.has(game.id));
    setSeriesOf(
      tx,
      leaving.map((game) => game.id),
      null,
      now
    );
    setSeriesOf(tx, memberIds, name, now);
    return name;
  });
}

// Takes every game out of the series
export function deleteSeries(db: Db, name: string): void {
  db.transaction((tx) =>
    setSeriesOf(
      tx,
      baseGames(tx, name).map((game) => game.id),
      null,
      new Date()
    )
  );
}

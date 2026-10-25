import { and, count, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import Fuse from "fuse.js";
import { formatDay } from "../../src/lib/dates";
import type {
  GameDetails,
  GamePage,
  GameSort,
  GameUpdate,
  IGame,
  NewGame,
  PageRequest,
  SortableField,
} from "../../src/interfaces";
import type { Db } from ".";
import { gameMetadata, games } from "./schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type GameRow = typeof games.$inferSelect;

// Copies only the editable fields, so stray keys coming over IPC (id, DLCs, parent_id...) never reach an insert/update
const detailsOf = (game: GameDetails): GameDetails => ({
  title: game.title,
  completion: game.completion,
  release_date: game.release_date,
  last_completion: game.last_completion,
  platform: game.platform,
  tags: game.tags,
  original_copy: game.original_copy,
  free_to_play: game.free_to_play,
  service: game.service,
  comment: game.comment,
});

const sameDetails = (a: GameDetails, b: GameDetails) => JSON.stringify(detailsOf(a)) === JSON.stringify(detailsOf(b));

const toGame = (base: GameRow, dlcs: GameRow[]): IGame => ({
  id: base.id,
  ...detailsOf(base),
  DLCs: dlcs.map((dlc) => ({ id: dlc.id, ...detailsOf(dlc) })),
});

// Case-insensitive by title, with the id as a tiebreaker so pages never overlap
const listOrder = [sql`${games.title} collate nocase`, games.id];

// What each sortable column orders by
const sortExpressions: Record<SortableField, SQL> = {
  platform: sql`${games.platform} collate nocase`,
  // Service games show "Service" in this column, so they sort after the plain yes/no values
  original_copy: sql`${games.service} * 2 + ${games.original_copy}`,
  free_to_play: sql`${games.free_to_play}`,
  title: sql`${games.title} collate nocase`,
  completion: sql`${games.completion} collate nocase`,
  release_date: sql`${games.release_date}`,
  last_completion: sql`${games.last_completion}`,
};

// Empty values (missing dates) go last in both directions; ties keep the default title order
const orderFor = (sort?: GameSort | null) => {
  if (!sort || !(sort.field in sortExpressions)) return listOrder;
  const direction = sql.raw(sort.direction === "desc" ? "desc" : "asc");
  return [sql`${sortExpressions[sort.field]} ${direction} nulls last`, ...listOrder];
};

const isLive = isNull(gameMetadata.deleted_at);

// Live (not soft-deleted) rows, optionally narrowed by an extra condition
const liveRows = (tx: Db | Tx, where?: ReturnType<typeof eq>) =>
  tx
    .select({ game: games })
    .from(games)
    .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
    .where(and(isLive, where))
    .orderBy(...listOrder)
    .all()
    .map((row) => row.game);

const insertRow = (tx: Tx, details: GameDetails, parentId: string | null, now: Date) => {
  const row = tx.insert(games).values({ ...detailsOf(details), parent_id: parentId }).returning().get();
  tx.insert(gameMetadata).values({ game_id: row.id, created_at: now, updated_at: now }).run();
  return row;
};

const markChanged = (tx: Tx, ids: string[], now: Date, deleted = false) => {
  if (ids.length === 0) return;
  tx.update(gameMetadata)
    .set({ updated_at: now, dirty: true, ...(deleted && { deleted_at: now }) })
    .where(inArray(gameMetadata.game_id, ids))
    .run();
};

// A calendar day as the table shows it ("2015-May-19") and as "2015-05-19", so either form can be searched
const searchableDay = (day: Date | null) => (day ? [formatDay(day), day.toISOString().slice(0, 10)] : []);

const searchKeys = [
  { name: "title", weight: 3 },
  { name: "dlcTitles", weight: 2 },
  "platform",
  "tags",
  "completion",
  "comment",
  "releaseDate",
  "lastCompletion",
];

// Every word has to match somewhere, each in any field, so "witcher pc" or "may 2015" work. Words are fuzzy, except
// ones with digits: those must appear as typed, or "2015" would also find "2016" (the ' prefix is Fuse's exact-include).
const toFuseQuery = (search: string) => ({
  $and: search
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/\d/.test(word) ? `'${word}` : word))
    .map((pattern) => ({ $or: searchKeys.map((key) => ({ [typeof key === "string" ? key : key.name]: pattern })) })),
});

// Ids of the base games matching a search, best match first. SQLite has no typo-tolerant search, and a personal
// collection is small enough to rank in memory. A matching DLC brings up its base game.
function searchGameIds(db: Db, search: string): string[] {
  const rows = liveRows(db);
  const dlcTitles = new Map<string, string[]>();
  for (const row of rows) {
    if (row.parent_id) dlcTitles.set(row.parent_id, [...(dlcTitles.get(row.parent_id) ?? []), row.title]);
  }
  const documents = rows
    .filter((row) => !row.parent_id)
    .map((row) => ({
      id: row.id,
      title: row.title,
      dlcTitles: dlcTitles.get(row.id) ?? [],
      platform: row.platform,
      tags: row.tags,
      completion: row.completion,
      comment: row.comment,
      releaseDate: searchableDay(row.release_date),
      lastCompletion: searchableDay(row.last_completion),
    }));

  const fuse = new Fuse(documents, {
    keys: searchKeys,
    threshold: 0.35,
    // Match anywhere in the text, not just near the start
    ignoreLocation: true,
    useExtendedSearch: true,
  });
  return fuse.search(toFuseQuery(search)).map((result) => result.item.id);
}

export function listGames(db: Db, { page, pageSize, sort, search }: PageRequest): GamePage {
  const query = search?.trim();
  const matchingIds = query ? searchGameIds(db, query) : null;
  if (matchingIds?.length === 0) return { games: [], total: 0 };

  const isListed = and(isLive, isNull(games.parent_id), matchingIds ? inArray(games.id, matchingIds) : undefined);
  const selectBases = (where: SQL | undefined) =>
    db.select({ game: games }).from(games).innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id)).where(where);

  let bases: GameRow[];
  let total: number;
  if (matchingIds && !sort) {
    // Search results keep their relevance order: page through the ranked ids, then load those rows
    total = matchingIds.length;
    const pageIds = matchingIds.slice(page * pageSize, (page + 1) * pageSize);
    const rows = new Map(
      (pageIds.length > 0 ? selectBases(inArray(games.id, pageIds)).all() : []).map(({ game }) => [game.id, game])
    );
    bases = pageIds.map((id) => rows.get(id)!);
  } else {
    total =
      matchingIds?.length ??
      db.select({ total: count() }).from(games).innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id)).where(isListed).get()!.total;
    bases = selectBases(isListed)
      .orderBy(...orderFor(sort))
      .limit(pageSize)
      .offset(page * pageSize)
      .all()
      .map((row) => row.game);
  }

  const dlcs = bases.length > 0 ? liveRows(db, inArray(games.parent_id, bases.map((base) => base.id))) : [];
  const dlcsByParent = new Map<string, GameRow[]>();
  for (const dlc of dlcs) dlcsByParent.set(dlc.parent_id!, [...(dlcsByParent.get(dlc.parent_id!) ?? []), dlc]);

  return { games: bases.map((base) => toGame(base, dlcsByParent.get(base.id) ?? [])), total };
}

// A base game with its DLCs, or null if it doesn't exist (or was deleted)
export function getGame(db: Db, id: string): IGame | null {
  const [base] = liveRows(db, and(eq(games.id, id), isNull(games.parent_id)));
  return base ? toGame(base, liveRows(db, eq(games.parent_id, id))) : null;
}

export function createGame(db: Db, game: NewGame): IGame {
  return db.transaction((tx) => {
    const now = new Date();
    const base = insertRow(tx, game, null, now);
    const dlcs = game.DLCs.map((dlc) => insertRow(tx, dlc, base.id, now));
    return toGame(base, dlcs);
  });
}

// Only rows whose details actually changed get a new updated_at, so a sync doesn't re-upload untouched DLCs
export function updateGame(db: Db, game: GameUpdate): IGame {
  return db.transaction((tx) => {
    const now = new Date();
    const [base] = liveRows(tx, eq(games.id, game.id));
    if (!base || base.parent_id) throw new Error(`Game ${game.id} not found`);

    if (!sameDetails(base, game)) {
      tx.update(games).set(detailsOf(game)).where(eq(games.id, base.id)).run();
      markChanged(tx, [base.id], now);
    }

    const existing = new Map(liveRows(tx, eq(games.parent_id, base.id)).map((dlc) => [dlc.id, dlc]));
    for (const dlc of game.DLCs) {
      const current = dlc.id ? existing.get(dlc.id) : undefined;
      if (!current) {
        insertRow(tx, dlc, base.id, now);
      } else if (!sameDetails(current, dlc)) {
        tx.update(games).set(detailsOf(dlc)).where(eq(games.id, current.id)).run();
        markChanged(tx, [current.id], now);
      }
    }

    const kept = new Set(game.DLCs.map((dlc) => dlc.id));
    markChanged(tx, [...existing.keys()].filter((id) => !kept.has(id)), now, true);

    return toGame(liveRows(tx, eq(games.id, base.id))[0], liveRows(tx, eq(games.parent_id, base.id)));
  });
}

// Soft delete of the game and its DLCs; the rows are purged once the deletion has been synced
export function removeGame(db: Db, id: string): void {
  db.transaction((tx) => {
    const dlcIds = liveRows(tx, eq(games.parent_id, id)).map((dlc) => dlc.id);
    markChanged(tx, [id, ...dlcIds], new Date(), true);
  });
}

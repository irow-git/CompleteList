import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { GameDetails, GamePage, GameUpdate, IGame, NewGame, PageRequest } from "../../src/interfaces";
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

export function listGames(db: Db, { page, pageSize }: PageRequest): GamePage {
  const isLiveBase = and(isLive, isNull(games.parent_id));

  const [{ total }] = db
    .select({ total: count() })
    .from(games)
    .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
    .where(isLiveBase)
    .all();

  const bases = db
    .select({ game: games })
    .from(games)
    .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
    .where(isLiveBase)
    .orderBy(...listOrder)
    .limit(pageSize)
    .offset(page * pageSize)
    .all()
    .map((row) => row.game);

  const dlcs = bases.length > 0 ? liveRows(db, inArray(games.parent_id, bases.map((base) => base.id))) : [];
  const dlcsByParent = new Map<string, GameRow[]>();
  for (const dlc of dlcs) dlcsByParent.set(dlc.parent_id!, [...(dlcsByParent.get(dlc.parent_id!) ?? []), dlc]);

  return { games: bases.map((base) => toGame(base, dlcsByParent.get(base.id) ?? [])), total };
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

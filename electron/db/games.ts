import { and, eq, inArray, isNull } from "drizzle-orm";
import type { GameDetails, GameUpdate, IGame, NewGame } from "../../src/interfaces";
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

// Live (not soft-deleted) rows, optionally narrowed by an extra condition
const liveRows = (tx: Db | Tx, where?: ReturnType<typeof eq>) =>
  tx
    .select({ game: games })
    .from(games)
    .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
    .where(and(isNull(gameMetadata.deleted_at), where))
    .orderBy(games.title)
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

export function listGames(db: Db): IGame[] {
  const rows = liveRows(db);
  const dlcsByParent = new Map<string, GameRow[]>();
  for (const row of rows) {
    if (row.parent_id) dlcsByParent.set(row.parent_id, [...(dlcsByParent.get(row.parent_id) ?? []), row]);
  }
  return rows.filter((row) => !row.parent_id).map((base) => toGame(base, dlcsByParent.get(base.id) ?? []));
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

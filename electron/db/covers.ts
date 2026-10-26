import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { CoverEntry } from "../../src/interfaces";
import { coverId, isImageRef } from "../../src/lib/imageRef";
import type { Db } from ".";
import { covers, gameMetadata, games } from "./schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Called whenever a game or DLC is saved with a cover: adds it to the history, or brings it back if it was deleted
export function recordCover(tx: Db | Tx, gameId: string, image: string | null, now: Date) {
  if (!isImageRef(image)) return;
  const id = coverId(gameId, image);
  const existing = tx.select({ deletedAt: covers.deleted_at }).from(covers).where(eq(covers.id, id)).get();
  if (!existing) {
    tx.insert(covers).values({ id, game_id: gameId, image, created_at: now, updated_at: now }).run();
  } else if (existing.deletedAt) {
    tx.update(covers).set({ deleted_at: null, updated_at: now, dirty: true }).where(eq(covers.id, id)).run();
  }
}

// When games or DLCs are deleted, so are their covers (the image sync then removes the files from the cloud)
export function deleteCoversOf(tx: Db | Tx, gameIds: string[], now: Date) {
  if (gameIds.length === 0) return;
  tx.update(covers)
    .set({ deleted_at: now, updated_at: now, dirty: true })
    .where(and(inArray(covers.game_id, gameIds), isNull(covers.deleted_at)))
    .run();
}

// A game's or DLC's covers, newest first
export function listCovers(db: Db, gameId: string): CoverEntry[] {
  return db
    .select()
    .from(covers)
    .where(and(eq(covers.game_id, gameId), isNull(covers.deleted_at)))
    .orderBy(covers.created_at)
    .all()
    .reverse()
    .map((cover) => ({ id: cover.id, gameId: cover.game_id, image: cover.image, createdAt: cover.created_at }));
}

const liveGameIds = (db: Db) =>
  db.select({ id: games.id }).from(games).innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id)).where(isNull(gameMetadata.deleted_at));

// What the image sync works from: the covers this computer should have (of games that still exist), and the deleted
// ones whose files have to go, here and in the cloud
export function coversForImageSync(db: Db) {
  const live = db
    .select({ gameId: covers.game_id, image: covers.image })
    .from(covers)
    .where(and(isNull(covers.deleted_at), inArray(covers.game_id, liveGameIds(db))))
    .all();
  const deleted = db.select({ gameId: covers.game_id, image: covers.image }).from(covers).where(isNotNull(covers.deleted_at)).all();
  return { live, deleted };
}

// The files the startup clean-up keeps, as "<owner>/<ref>"
export const coverFilesToKeep = (db: Db) => new Set(coversForImageSync(db).live.map(({ gameId, image }) => `${gameId}/${image}`));

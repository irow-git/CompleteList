import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import type { SyncResult, SyncStatus } from "../../src/interfaces";
import type { Db } from "../db";
import { detailsOf } from "../db/games";
import { gameMetadata, games, syncState } from "../db/schema";
import type { PushRecord, RemoteStore } from "./remote";

type SyncKey = "checkpoint" | "lastSyncedAt";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const readState = (db: Db, key: SyncKey) => db.select().from(syncState).where(eq(syncState.key, key)).get()?.value;

const writeState = (db: Db | Tx, key: SyncKey, value: string) =>
  db.insert(syncState).values({ key, value }).onConflictDoUpdate({ target: syncState.key, set: { value } }).run();

// Forgets everything about the previous sync target, so connecting to another project or account starts fresh:
// pull from the beginning, and upload every local game (they may never have been in that project)
export function resetSync(db: Db) {
  db.transaction((tx) => {
    tx.delete(syncState).run();
    tx.update(gameMetadata).set({ dirty: true }).run();
  });
}

// For a sync that only did images (no Firebase project connected)
export const recordSync = (db: Db, at: Date) => writeState(db, "lastSyncedAt", String(at.getTime()));

export function syncStatus(db: Db, configured: boolean): SyncStatus {
  const lastSyncedAt = readState(db, "lastSyncedAt");
  const [{ pending }] = db.select({ pending: count() }).from(gameMetadata).where(eq(gameMetadata.dirty, true)).all();
  return { configured, lastSyncedAt: lastSyncedAt ? new Date(Number(lastSyncedAt)) : null, pendingChanges: pending };
}

// Applies remote changes that are newer than the local copy (last write wins, by updated_at) and returns how many
async function pull(db: Db, remote: RemoteStore): Promise<number> {
  const checkpoint = Number(readState(db, "checkpoint") ?? 0);
  const changed = await remote.changedMetadataSince(checkpoint);
  if (changed.length === 0) return 0;

  const local = new Map(
    db
      .select({ id: gameMetadata.game_id, updatedAt: gameMetadata.updated_at })
      .from(gameMetadata)
      .where(inArray(gameMetadata.game_id, changed.map((meta) => meta.id)))
      .all()
      .map((row) => [row.id, row.updatedAt.getTime()])
  );
  const newer = changed.filter((meta) => meta.updatedAt.getTime() > (local.get(meta.id) ?? -Infinity));
  const details = await remote.fetchDetails(newer.filter((meta) => !meta.deletedAt).map((meta) => meta.id));

  // Base games first, so a DLC's parent is already there when the DLC is written
  const ordered = [...newer].sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null));
  let applied = 0;
  db.transaction((tx) => {
    for (const meta of ordered) {
      if (meta.deletedAt) {
        if (!local.has(meta.id)) continue; // never had it, nothing to delete
        tx.update(gameMetadata)
          .set({ updated_at: meta.updatedAt, deleted_at: meta.deletedAt, dirty: false })
          .where(eq(gameMetadata.game_id, meta.id))
          .run();
        applied++;
        continue;
      }

      const game = details.get(meta.id);
      if (!game) continue; // deleted remotely between reading its metadata and its details; the next sync sees that
      // A DLC added on one device to a game another device deleted (and has since purged) has nowhere to go
      if (meta.parentId && !tx.select({ id: games.id }).from(games).where(eq(games.id, meta.parentId)).get()) continue;

      const row = { ...detailsOf(game), parent_id: meta.parentId };
      tx.insert(games).values({ id: meta.id, ...row }).onConflictDoUpdate({ target: games.id, set: row }).run();
      const metadata = { created_at: meta.createdAt, updated_at: meta.updatedAt, deleted_at: null, dirty: false };
      tx.insert(gameMetadata)
        .values({ game_id: meta.id, ...metadata })
        .onConflictDoUpdate({ target: gameMetadata.game_id, set: metadata })
        .run();
      applied++;
    }
    // Only what was pulled moves the checkpoint. A push can't learn the server timestamps it got, so this device's
    // own uploads come back once on the next sync (skipped above as not newer) and move it then. Jumping to the push
    // time instead could skip another device's upload that landed between this pull and that push
    const newCheckpoint = changed.reduce((latest, meta) => Math.max(latest, meta.serverUpdatedAt), checkpoint);
    writeState(tx, "checkpoint", String(newCheckpoint));
  });
  return applied;
}

// Uploads every local change (tombstones included) and returns how many
async function push(db: Db, remote: RemoteStore): Promise<number> {
  const records: PushRecord[] = db
    .select({ game: games, meta: gameMetadata })
    .from(games)
    .innerJoin(gameMetadata, eq(gameMetadata.game_id, games.id))
    .where(eq(gameMetadata.dirty, true))
    .all()
    .map(({ game, meta }) => ({
      id: game.id,
      parentId: game.parent_id,
      createdAt: meta.created_at,
      updatedAt: meta.updated_at,
      deletedAt: meta.deleted_at,
      details: meta.deleted_at ? null : detailsOf(game),
    }));
  if (records.length === 0) return 0;

  await remote.push(records);

  // Only rows still exactly as uploaded are clean: anything edited while the upload ran stays dirty for next time
  db.transaction((tx) => {
    for (const record of records) {
      tx.update(gameMetadata)
        .set({ dirty: false })
        .where(and(eq(gameMetadata.game_id, record.id), eq(gameMetadata.updated_at, record.updatedAt)))
        .run();
    }
  });
  return records.length;
}

// Tombstones only exist so a deletion reaches the cloud; once it has, the rows can go
function purgeSyncedTombstones(db: Db) {
  const synced = db
    .select({ id: gameMetadata.game_id })
    .from(gameMetadata)
    .where(and(isNotNull(gameMetadata.deleted_at), eq(gameMetadata.dirty, false)));
  db.delete(games).where(inArray(games.id, synced)).run();
}

// Pull first, so a newer remote edit wins over an older local one before anything is uploaded
export async function runSync(db: Db, remote: RemoteStore): Promise<SyncResult> {
  const pulled = await pull(db, remote);
  const pushed = await push(db, remote);
  purgeSyncedTombstones(db);

  const syncedAt = new Date();
  writeState(db, "lastSyncedAt", String(syncedAt.getTime()));
  return { pushed, pulled, syncedAt };
}

// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { GameDetails } from "../../src/interfaces";
import type { Db } from "../db";
import { createGame, getGame, listGames, removeCover, removeGame, updateGame } from "../db/games";
import { coversForImageSync, listCovers } from "../db/covers";
import * as schema from "../db/schema";
import { resetSync, runSync, syncStatus } from "./engine";
import type { PushRecord, RemoteCover, RemoteMetadata, RemoteStore } from "./remote";

// Stands in for Firestore. It has its own clock, unrelated to either device's, like Firestore's serverTimestamp()
class FakeRemote implements RemoteStore {
  serverTime = 5_000;
  metadata = new Map<string, RemoteMetadata>();
  details = new Map<string, GameDetails>();
  covers = new Map<string, RemoteCover & { serverUpdatedAt: number }>();
  beforePush?: () => void;

  async changedMetadataSince(checkpoint: number) {
    return [...this.metadata.values()]
      .filter((meta) => meta.serverUpdatedAt > checkpoint)
      .sort((a, b) => a.serverUpdatedAt - b.serverUpdatedAt)
      .map((meta) => structuredClone(meta));
  }

  async fetchDetails(ids: string[]) {
    return new Map(ids.filter((id) => this.details.has(id)).map((id) => [id, structuredClone(this.details.get(id)!)]));
  }

  async push(records: PushRecord[]) {
    this.beforePush?.();
    for (const { details, ...meta } of records) {
      this.metadata.set(meta.id, { ...structuredClone(meta), serverUpdatedAt: ++this.serverTime });
      if (details) this.details.set(meta.id, structuredClone(details));
      else this.details.delete(meta.id);
    }
  }

  async changedCoversSince(checkpoint: number) {
    return [...this.covers.values()]
      .filter((cover) => cover.serverUpdatedAt > checkpoint)
      .sort((x, y) => x.serverUpdatedAt - y.serverUpdatedAt)
      .map((cover) => structuredClone(cover));
  }

  async pushCovers(records: RemoteCover[]) {
    for (const cover of records) this.covers.set(cover.id, { ...structuredClone(cover), serverUpdatedAt: ++this.serverTime });
  }
}

const device = (): Db => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
};

const details = (title: string, extra: Partial<GameDetails> = {}): GameDetails => ({
  title,
  completion: "Main story",
  release_date: new Date(Date.UTC(2015, 4, 19)),
  last_completion: null,
  platform: ["PC"],
  tags: [],
  original_copy: true,
  free_to_play: false,
  service: false,
  comment: "",
  cover_image: null,
  score: null,
  hours: null,
  ...extra,
});

const allGames = (db: Db) => listGames(db, { page: 0, pageSize: 100 }).games;
const rowCount = (db: Db) => db.select().from(schema.games).all().length;
const setClock = (iso: string) => vi.setSystemTime(new Date(iso));

let remote: FakeRemote;
let a: Db;
let b: Db;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setClock("2026-01-01T10:00:00Z");
  remote = new FakeRemote();
  a = device();
  b = device();
});

afterEach(() => {
  vi.useRealTimers();
});

test("a game created on one device reaches the other with its DLCs and dates intact", async () => {
  const game = createGame(a, { ...details("The Witcher 3"), DLCs: [details("Blood and Wine"), details("Hearts of Stone")] });

  expect(await runSync(a, remote)).toMatchObject({ pushed: 3, pulled: 0 });
  expect(await runSync(b, remote)).toMatchObject({ pushed: 0, pulled: 3 });

  const copy = getGame(b, game.id)!;
  expect(copy).toEqual(game);
  expect(copy.release_date).toBeInstanceOf(Date);
  expect(syncStatus(b, true).pendingChanges).toBe(0);
});

test("edits travel both ways", async () => {
  const game = createGame(a, { ...details("Witcher 3"), DLCs: [details("Blood and Wine")] });
  await runSync(a, remote);
  await runSync(b, remote);

  setClock("2026-01-01T11:00:00Z");
  updateGame(b, { ...getGame(b, game.id)!, title: "The Witcher 3", comment: "Played on B" });
  await runSync(b, remote);
  expect(await runSync(a, remote)).toMatchObject({ pulled: 1 });

  expect(getGame(a, game.id)).toMatchObject({ title: "The Witcher 3", comment: "Played on B" });
});

test("a deletion reaches the other device, takes the DLCs with it, and tombstones are purged everywhere", async () => {
  const game = createGame(a, { ...details("Witcher 3"), DLCs: [details("Blood and Wine")] });
  await runSync(a, remote);
  await runSync(b, remote);

  setClock("2026-01-01T11:00:00Z");
  removeGame(a, game.id);
  expect(await runSync(a, remote)).toMatchObject({ pushed: 2 });
  expect(await runSync(b, remote)).toMatchObject({ pulled: 2 });

  expect(allGames(b)).toEqual([]);
  expect(rowCount(a)).toBe(0);
  expect(rowCount(b)).toBe(0);
  // The cloud keeps the tombstones (so devices that sync later still learn about the deletion), but no details
  expect(remote.metadata.get(game.id)?.deletedAt).toBeInstanceOf(Date);
  expect(remote.details.has(game.id)).toBe(false);
});

test("when both devices edit the same game offline, the later edit wins on both", async () => {
  const game = createGame(a, { ...details("Celeste"), DLCs: [] });
  await runSync(a, remote);
  await runSync(b, remote);

  setClock("2026-01-02T10:00:00Z");
  updateGame(a, { ...game, comment: "A's older edit" });
  setClock("2026-01-02T12:00:00Z");
  updateGame(b, { ...game, comment: "B's newer edit" });

  // B uploads first; then A pulls B's newer edit, which replaces A's own before A uploads anything
  await runSync(b, remote);
  expect(await runSync(a, remote)).toMatchObject({ pulled: 1, pushed: 0 });
  await runSync(b, remote);

  expect(getGame(a, game.id)?.comment).toBe("B's newer edit");
  expect(getGame(b, game.id)?.comment).toBe("B's newer edit");
});

test("the newer local edit survives a pull and gets uploaded", async () => {
  const game = createGame(a, { ...details("Celeste"), DLCs: [] });
  await runSync(a, remote);
  await runSync(b, remote);

  setClock("2026-01-02T10:00:00Z");
  updateGame(b, { ...game, comment: "B's older edit" });
  await runSync(b, remote);
  setClock("2026-01-02T12:00:00Z");
  updateGame(a, { ...game, comment: "A's newer edit" });

  expect(await runSync(a, remote)).toMatchObject({ pulled: 0, pushed: 1 });
  await runSync(b, remote);
  expect(getGame(b, game.id)?.comment).toBe("A's newer edit");
});

test("an edit made while the upload is running stays unsynced for next time", async () => {
  const game = createGame(a, { ...details("Celeste"), DLCs: [] });
  remote.beforePush = () => {
    setClock("2026-01-01T10:00:05Z");
    updateGame(a, { ...game, comment: "edited mid-sync" });
  };

  await runSync(a, remote);
  remote.beforePush = undefined;
  expect(syncStatus(a, true).pendingChanges).toBe(1);

  expect(await runSync(a, remote)).toMatchObject({ pushed: 1 });
  expect(syncStatus(a, true).pendingChanges).toBe(0);
});

test("syncing again with nothing new moves nothing", async () => {
  createGame(a, { ...details("Celeste"), DLCs: [details("Farewell")] });
  await runSync(a, remote);
  await runSync(b, remote);

  expect(await runSync(a, remote)).toMatchObject({ pushed: 0, pulled: 0 });
  expect(await runSync(b, remote)).toMatchObject({ pushed: 0, pulled: 0 });
});

test("the pull checkpoint is the server's clock, so a device whose clock runs ahead still gets everything", async () => {
  setClock("2040-01-01T00:00:00Z");
  await runSync(a, remote);

  setClock("2020-01-01T00:00:00Z");
  const game = createGame(b, { ...details("Braid"), DLCs: [] });
  await runSync(b, remote);

  setClock("2040-01-01T00:01:00Z");
  expect(await runSync(a, remote)).toMatchObject({ pulled: 1 });
  expect(getGame(a, game.id)?.title).toBe("Braid");
  const checkpoint = a.select().from(schema.syncState).where(eq(schema.syncState.key, "checkpoint")).get()?.value;
  expect(Number(checkpoint)).toBe(remote.serverTime);
});

test("a DLC that arrives before its game still lands", async () => {
  const game = createGame(a, { ...details("Hollow Knight"), DLCs: [details("Godmaster")] });
  await runSync(a, remote);
  // Make the DLC look older on the server than its game, so it's pulled first
  const dlcMeta = remote.metadata.get(game.DLCs[0].id)!;
  dlcMeta.serverUpdatedAt = 1;

  await runSync(b, remote);
  expect(getGame(b, game.id)?.DLCs.map((dlc) => dlc.title)).toEqual(["Godmaster"]);
});

test("status counts unsynced changes and remembers the last sync; reset starts over", async () => {
  createGame(a, { ...details("Celeste"), DLCs: [details("Farewell")] });
  expect(syncStatus(a, true)).toEqual({ configured: true, lastSyncedAt: null, pendingChanges: 2 });

  const { syncedAt } = await runSync(a, remote);
  expect(syncStatus(a, true)).toEqual({ configured: true, lastSyncedAt: syncedAt, pendingChanges: 0 });

  resetSync(a);
  expect(syncStatus(a, false)).toEqual({ configured: false, lastSyncedAt: null, pendingChanges: 2 });
});

test("cover history syncs: a cover added on one device reaches the other, and so does deleting it", async () => {
  const cover = `${"ab".repeat(32)}.webp`;
  setClock("2026-10-27T09:00:00Z");
  const game = createGame(a, { ...details("Celeste"), cover_image: cover, DLCs: [] });
  await runSync(a, remote);
  await runSync(b, remote);

  expect(listCovers(b, game.id).map((entry) => entry.image)).toEqual([cover]);
  expect(coversForImageSync(b).live).toEqual([{ gameId: game.id, image: cover }]);

  // Deleted on b (later) while it's the current cover: the game loses its cover too, on both devices
  setClock("2026-10-27T10:00:00Z");
  removeCover(b, listCovers(b, game.id)[0].id);
  await runSync(b, remote);
  await runSync(a, remote);
  expect(listCovers(a, game.id)).toEqual([]);
  expect(getGame(a, game.id)!.cover_image).toBeNull();
  expect(coversForImageSync(a).deleted).toEqual([{ gameId: game.id, image: cover }]);
});

test("malformed cover entries from the cloud are ignored, since they turn into file paths", async () => {
  const game = createGame(a, { ...details("Celeste"), DLCs: [] });
  const image = `${"ab".repeat(32)}.png`;
  const at = new Date("2026-10-27T09:00:00Z");
  const entry = (gameId: string, image: string, id = `${gameId}:${image}`): RemoteCover => ({ id, gameId, image, createdAt: at, updatedAt: at, deletedAt: at });
  await remote.pushCovers([
    entry("../..", image),
    entry(game.id, "../../etc/passwd"),
    entry(`${game.id}/..`, image),
    // A well-formed game and image under some other id
    entry(game.id, image, "anything"),
  ]);

  await runSync(a, remote);
  expect(coversForImageSync(a)).toEqual({ live: [], deleted: [] });
});

test("deleting a game deletes its covers, and their tombstones outlive the purged game", async () => {
  const game = createGame(a, { ...details("Celeste"), cover_image: `${"cd".repeat(32)}.png`, DLCs: [] });
  removeGame(a, game.id);
  await runSync(a, remote);

  expect(getGame(a, game.id)).toBeNull();
  expect(coversForImageSync(a)).toEqual({ live: [], deleted: [{ gameId: game.id, image: `${"cd".repeat(32)}.png` }] });
});

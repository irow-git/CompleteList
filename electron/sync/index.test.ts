import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "../db";
import { listGames } from "../db/games";
import * as schema from "../db/schema";
import type { ImageSync } from "../images/imageSync";
import type { RemoteMetadata, RemoteStore } from "./remote";

// The service's own parts are replaced: no Electron (settings) and no network (Firestore)
const remote = vi.hoisted(() => ({ current: null as unknown as RemoteStore, firebase: true }));
vi.mock("./settings", () => ({
  readAccount: async () => (remote.firebase ? { config: {}, email: "a@b.c", password: "secret" } : null),
  isSyncConfigured: () => remote.firebase,
}));
vi.mock("./firestore", () => ({ connectFirestore: async () => remote.current }));

const { createSyncService } = await import("./index");

const device = (): Db => {
  const db = drizzle({ client: new Database(":memory:"), schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
};

const noImages = { isConnected: () => false } as unknown as ImageSync;

// Image sync connected to Drive, with or without an rclone to run
const images = (rcloneFound: boolean) => {
  const sync = vi.fn(async () => ({ uploaded: 1, downloaded: 2, deleted: 0, missing: 0 }));
  const imageSync = {
    isConnected: () => true,
    status: async () => ({ rclone: rcloneFound ? { path: "/bin/rclone", version: "v1.70.0" } : null, customRclonePath: null, provider: "drive", folder: "x" }),
    sync,
  } as unknown as ImageSync;
  return { imageSync, sync };
};

const emptyRemote = (): RemoteStore => ({
  changedMetadataSince: async () => [],
  fetchDetails: async () => new Map(),
  push: async () => {},
  changedCoversSince: async () => [],
  pushCovers: async () => {},
  changedSelectItemsSince: async () => [],
  pushSelectItems: async () => {},
});

beforeEach(() => {
  remote.firebase = true;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("reports each step as it starts", async () => {
  remote.current = emptyRemote();
  const steps: string[] = [];
  const sync = createSyncService(device(), noImages, { onStep: (step) => steps.push(step) });

  const result = await sync.run();

  expect(result.warnings).toEqual(["Image sync isn't set up, so cover images weren't synced. Connect it under Settings → Image sync."]);
  expect(steps).toEqual([
    "Signing in to Firebase",
    "Checking the cloud for changed games",
    "Checking the cloud for changed covers",
    "Checking the cloud for changed dropdown options",
  ]);
});

test("gives up after a minute, naming the stuck step, and ignores the answer if it comes later", async () => {
  let answer!: (changed: RemoteMetadata[]) => void;
  const fetchDetails = vi.fn(async () => new Map());
  remote.current = {
    ...emptyRemote(),
    changedMetadataSince: () => new Promise((resolve) => (answer = resolve)),
    fetchDetails,
  };
  const steps: string[] = [];
  const db = device();
  const sync = createSyncService(db, noImages, { onStep: (step) => steps.push(step) });

  const run = sync.run();
  const outcome = expect(run).rejects.toThrow(
    "Sync timed out after 1 minute while checking the cloud for changed games. Check your internet connection and try again"
  );
  await vi.advanceTimersByTimeAsync(59_999);
  expect(answer).toBeTypeOf("function"); // still waiting on Firestore
  await vi.advanceTimersByTimeAsync(1);
  await outcome;

  // The late answer is dropped: nothing more is fetched, written or reported
  const at = new Date();
  answer([{ id: "late", parentId: null, createdAt: at, updatedAt: at, deletedAt: null, serverUpdatedAt: 9_000 }]);
  await vi.runAllTimersAsync();
  expect(fetchDetails).not.toHaveBeenCalled();
  expect(listGames(db, { page: 0, pageSize: 10 }).games).toEqual([]);
  expect(steps.at(-1)).toBe("Checking the cloud for changed games");

  // And the next sync starts afresh instead of joining the abandoned one
  remote.current = emptyRemote();
  await expect(sync.run()).resolves.toMatchObject({ pulled: 0, pushed: 0 });
});

test("rclone missing is only a warning when Firebase is set up: the games still sync", async () => {
  remote.current = emptyRemote();
  const { imageSync, sync: syncImages } = images(false);

  const result = await createSyncService(device(), imageSync).run();

  expect(result.warnings).toEqual(["rclone wasn't found, so cover images weren't synced. Install it, or set its path under Settings → Image sync."]);
  expect(result.images).toBeUndefined();
  expect(syncImages).not.toHaveBeenCalled();
});

test("Firebase missing is only a warning when image sync can run: the images still sync", async () => {
  remote.firebase = false;
  const { imageSync } = images(true);

  const result = await createSyncService(device(), imageSync).run();

  expect(result.images).toEqual({ uploaded: 1, downloaded: 2, deleted: 0, missing: 0 });
  expect(result.warnings).toEqual([
    "Firebase isn't set up, so games, cover history and dropdown options weren't synced. Connect it under Settings → Game sync.",
  ]);
});

test("it's an error only when neither half can run", async () => {
  remote.firebase = false;

  await expect(createSyncService(device(), noImages).run()).rejects.toThrow("Sync isn't set up yet");
  await expect(createSyncService(device(), images(false).imageSync).run()).rejects.toThrow(
    "Nothing could sync: Firebase isn't set up and rclone wasn't found."
  );
});

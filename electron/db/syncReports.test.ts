import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { SyncChange, SyncReport } from "../../src/interfaces";
import type { Db } from ".";
import * as schema from "./schema";
import { getSyncReport, listSyncReports, MAX_SYNC_REPORTS, saveSyncReport } from "./syncReports";

const device = (): Db => {
  const db = drizzle({ client: new Database(":memory:"), schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return db;
};

const change = (side: SyncChange["side"]): SyncChange => ({
  side,
  kind: "game",
  action: "changed",
  title: "Celeste",
  fields: [{ name: "Score", from: "90", to: "95" }],
});

const report = (minute: number, changes: SyncChange[], extra: Partial<SyncReport> = {}): SyncReport => ({
  result: { pushed: 1, pulled: 1, syncedAt: new Date(Date.UTC(2026, 0, 1, 10, minute, 5)) },
  error: null,
  failedStep: null,
  warnings: [],
  steps: ["Signing in to Firebase"],
  changes,
  startedAt: new Date(Date.UTC(2026, 0, 1, 10, minute)),
  finishedAt: new Date(Date.UTC(2026, 0, 1, 10, minute, 5)),
  ...extra,
});

test("only syncs that changed something are kept, newest first, and come back whole", () => {
  const db = device();
  saveSyncReport(db, report(1, [change("local"), change("cloud"), change("cloud")]));
  saveSyncReport(db, report(2, []));
  const failed = report(3, [change("local")], { result: null, error: "Timed out", failedStep: "Uploading", warnings: ["No rclone"] });
  saveSyncReport(db, failed);

  const { entries, total } = listSyncReports(db, 0, 25);
  expect(total).toBe(2);
  expect(entries.map(({ startedAt, failed, warnings, localChanges, cloudChanges }) => [startedAt.getUTCMinutes(), failed, warnings, localChanges, cloudChanges])).toEqual([
    [3, true, 1, 1, 0],
    [1, false, 0, 1, 2],
  ]);
  expect(getSyncReport(db, entries[0].id)).toEqual(failed);
  const first = getSyncReport(db, entries[1].id)!;
  expect(first).toEqual(report(1, [change("local"), change("cloud"), change("cloud")]));
  expect(first.result!.syncedAt).toBeInstanceOf(Date);
  expect(getSyncReport(db, 999)).toBeNull();
});

test("pages through them, and drops the oldest beyond the limit", () => {
  const db = device();
  for (let i = 0; i < MAX_SYNC_REPORTS + 5; i++) {
    saveSyncReport(db, report(0, [change("local")], { startedAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000) }));
  }
  const first = listSyncReports(db, 0, 25);
  expect(first.total).toBe(MAX_SYNC_REPORTS);
  expect(first.entries).toHaveLength(25);
  expect(first.entries[0].startedAt.getTime()).toBe(Date.UTC(2026, 0, 1) + (MAX_SYNC_REPORTS + 4) * 60_000);
  const last = listSyncReports(db, Math.ceil(MAX_SYNC_REPORTS / 25) - 1, 25);
  expect(last.entries.at(-1)!.startedAt.getTime()).toBe(Date.UTC(2026, 0, 1) + 5 * 60_000); // the 5 oldest are gone
});

import { count, desc, eq, notInArray } from "drizzle-orm";
import type { SyncHistoryPage, SyncReport } from "../../src/interfaces";
import type { Db } from ".";
import { syncReports } from "./schema";

// The sync history: reports of the syncs that changed something, newest first

// Older ones are dropped beyond this. A first sync of a big collection lists every game, so reports can be large
export const MAX_SYNC_REPORTS = 200;

type StoredReport = Omit<SyncReport, "startedAt" | "finishedAt">;

// Saves the report if the sync changed anything (failed ones too: what they changed before failing is kept)
export function saveSyncReport(db: Db, report: SyncReport) {
  if (report.changes.length === 0) return;
  const { startedAt, finishedAt, ...rest } = report;
  const stored: StoredReport = rest;
  db.transaction((tx) => {
    tx.insert(syncReports)
      .values({
        started_at: startedAt,
        finished_at: finishedAt,
        failed: report.error !== null,
        warnings: report.warnings.length,
        local_changes: report.changes.filter((change) => change.side === "local").length,
        cloud_changes: report.changes.filter((change) => change.side === "cloud").length,
        report: JSON.stringify(stored),
      })
      .run();
    const kept = tx.select({ id: syncReports.id }).from(syncReports).orderBy(desc(syncReports.started_at), desc(syncReports.id)).limit(MAX_SYNC_REPORTS);
    tx.delete(syncReports).where(notInArray(syncReports.id, kept)).run();
  });
}

export function listSyncReports(db: Db, page: number, pageSize: number): SyncHistoryPage {
  const size = Math.max(1, Math.floor(pageSize));
  const offset = Math.max(0, Math.floor(page)) * size;
  const entries = db
    .select({
      id: syncReports.id,
      startedAt: syncReports.started_at,
      finishedAt: syncReports.finished_at,
      failed: syncReports.failed,
      warnings: syncReports.warnings,
      localChanges: syncReports.local_changes,
      cloudChanges: syncReports.cloud_changes,
    })
    .from(syncReports)
    .orderBy(desc(syncReports.started_at), desc(syncReports.id))
    .limit(size)
    .offset(offset)
    .all();
  const [{ total }] = db.select({ total: count() }).from(syncReports).all();
  return { entries, total };
}

export function getSyncReport(db: Db, id: number): SyncReport | null {
  const row = db.select().from(syncReports).where(eq(syncReports.id, id)).get();
  if (!row) return null;
  const stored = JSON.parse(row.report) as StoredReport;
  return {
    ...stored,
    // JSON keeps dates as text
    result: stored.result ? { ...stored.result, syncedAt: new Date(stored.result.syncedAt) } : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

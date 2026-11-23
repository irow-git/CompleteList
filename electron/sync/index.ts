import type { SyncChange, SyncReport, SyncResult } from "../../src/interfaces";
import type { Db } from "../db";
import { coversForImageSync } from "../db/covers";
import { saveSyncReport } from "../db/syncReports";
import type { Cover, ImageSync } from "../images/imageSync";
import { shortImage, titlesOf } from "./changes";
import { recordSync, runSync, syncStatus, type ReportStep, type SyncLog } from "./engine";
import { connectFirestore } from "./firestore";
import type { RemoteStore } from "./remote";
import { isSyncConfigured, readAccount } from "./settings";

// A sync that hasn't finished by then is given up on, so a stalled connection can't leave it spinning forever
export const SYNC_TIMEOUT_MS = 60_000;

// Firestore requests can't be cancelled, so the calls are fenced instead: once the sync has been given up on, none
// starts, and the result of one still in flight is thrown away before the engine can write anything from it
function guarded(remote: RemoteStore, signal: AbortSignal): RemoteStore {
  const guard =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      signal.throwIfAborted();
      const result = await call(...args);
      signal.throwIfAborted();
      return result;
    };
  return {
    changedMetadataSince: guard(remote.changedMetadataSince),
    fetchDetails: guard(remote.fetchDetails),
    push: guard(remote.push),
    changedCoversSince: guard(remote.changedCoversSince),
    pushCovers: guard(remote.pushCovers),
    changedSelectItemsSince: guard(remote.changedSelectItemsSince),
    pushSelectItems: guard(remote.pushSelectItems),
  };
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// onStep hears each step of every sync as it starts (see ReportStep), for showing progress in the window
export function createSyncService(db: Db, imageSync: ImageSync, { onStep = () => {}, timeoutMs = SYNC_TIMEOUT_MS }: { onStep?: ReportStep; timeoutMs?: number } = {}) {
  // A second sync request while one is running gets the running one's report instead of starting another
  let running: Promise<SyncReport> | null = null;

  // Games first: pulling them brings in the covers other computers added, which the image sync then downloads.
  // Either half runs on its own when the other isn't set up (that's a warning); only when neither can run is it an error
  const sync = async (signal: AbortSignal, log: SyncLog, warnings: string[]): Promise<SyncResult> => {
    const account = await readAccount();
    const imagesConnected = imageSync.isConnected();
    if (!account && !imagesConnected) throw new Error("Sync isn't set up yet. Connect Firebase or image sync in Settings.");

    let rcloneFound = false;
    if (imagesConnected) {
      log.step("Looking for rclone");
      rcloneFound = (await imageSync.status()).rclone !== null;
      signal.throwIfAborted();
    }
    if (!account) warnings.push("Firebase isn't set up, so games, cover history and dropdown options weren't synced. Connect it under Settings → Game sync.");
    if (!imagesConnected) warnings.push("Image sync isn't set up, so cover images weren't synced. Connect it under Settings → Image sync.");
    else if (!rcloneFound) warnings.push("rclone wasn't found, so cover images weren't synced. Install it, or set its path under Settings → Image sync.");
    if (!account && !rcloneFound) {
      throw new Error("Nothing could sync: Firebase isn't set up and rclone wasn't found. Install rclone, or set its path under Settings → Image sync.");
    }

    let result: SyncResult = { pushed: 0, pulled: 0, syncedAt: new Date() };
    if (account) {
      log.step("Signing in to Firebase");
      const remote = await connectFirestore(account);
      signal.throwIfAborted();
      result = await runSync(db, guarded(remote, signal), log);
    }
    if (rcloneFound) {
      const onFiles = (action: "uploaded" | "downloaded" | "deleted", covers: Cover[]) => {
        const titles = titlesOf(db, covers.map((cover) => cover.gameId));
        for (const cover of covers) {
          log.change({
            side: action === "downloaded" ? "local" : "cloud",
            kind: "image",
            action: action === "deleted" ? "deleted" : "added",
            title: titles.get(cover.gameId) ?? "A game not on this computer",
            note: "Cover image file",
            fields: [{ name: "File", from: action === "deleted" ? shortImage(cover.image) : null, to: action === "deleted" ? null : shortImage(cover.image) }],
          });
        }
      };
      try {
        result.images = await imageSync.sync(coversForImageSync(db), { signal, report: log.step, onFiles });
      } catch (error) {
        if (signal.aborted) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(account ? `Games synced, but images didn't. ${message}` : message);
      }
    }
    signal.throwIfAborted();
    if (!account) recordSync(db, result.syncedAt);
    return result;
  };

  // Runs a sync with the time limit and reports on it, failed or not. When the time runs out, the sync is aborted
  // (rclone is stopped, Firestore results are ignored) and the report comes at once, naming the step it was stuck on
  const syncWithTimeout = async (): Promise<SyncReport> => {
    const startedAt = new Date();
    const controller = new AbortController();
    const steps: string[] = [];
    const changes: SyncChange[] = [];
    const warnings: string[] = [];
    // A sync given up on stays quiet while it winds down
    const log: SyncLog = {
      step: (step) => {
        if (controller.signal.aborted) return;
        steps.push(step);
        onStep(step);
      },
      change: (change) => {
        if (!controller.signal.aborted) changes.push(change);
      },
    };
    const timedOut = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
    });
    const timer = setTimeout(() => {
      const seconds = Math.round(timeoutMs / 1000);
      const limit = seconds === 60 ? "1 minute" : `${seconds} seconds`;
      controller.abort(
        new Error(
          `Sync timed out after ${limit} while ${lowerFirst(steps.at(-1) ?? "Starting")}. Check your internet connection and try again; anything finished before that was kept.`
        )
      );
    }, timeoutMs);

    let result: SyncResult | null = null;
    let error: string | null = null;
    try {
      result = await Promise.race([sync(controller.signal, log, warnings), timedOut]);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      clearTimeout(timer);
    }
    // Copies: a sync given up on may still be winding down
    return {
      result,
      error,
      failedStep: error ? (steps.at(-1) ?? null) : null,
      warnings: [...warnings],
      steps: [...steps],
      changes: [...changes],
      startedAt,
      finishedAt: new Date(),
    };
  };

  return {
    // Cheap: file checks and one count query, so it's fine to call after every change
    status: () => syncStatus(db, isSyncConfigured() || imageSync.isConnected()),
    // Syncs that changed something are kept in the sync history
    run: () => {
      running ??= syncWithTimeout()
        .then((report) => {
          try {
            saveSyncReport(db, report);
          } catch (error) {
            console.error("Couldn't save the sync report", error); // the sync itself still went fine
          }
          return report;
        })
        .finally(() => {
          running = null;
        });
      return running;
    },
  };
}

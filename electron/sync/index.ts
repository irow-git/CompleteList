import type { SyncResult } from "../../src/interfaces";
import type { Db } from "../db";
import { coversForImageSync } from "../db/covers";
import type { ImageSync } from "../images/imageSync";
import { recordSync, runSync, syncStatus, type ReportStep } from "./engine";
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
  // A second sync request while one is running gets the running one's result instead of starting another
  let running: Promise<SyncResult> | null = null;

  // Games first: pulling them brings in the covers other computers added, which the image sync then downloads.
  // Either half runs on its own when the other isn't set up (that's a warning); only when neither can run is it an error
  const sync = async (signal: AbortSignal, report: ReportStep): Promise<SyncResult> => {
    const account = await readAccount();
    const imagesConnected = imageSync.isConnected();
    if (!account && !imagesConnected) throw new Error("Sync isn't set up yet. Connect Firebase or image sync in Settings.");

    let rcloneFound = false;
    if (imagesConnected) {
      report("Looking for rclone");
      rcloneFound = (await imageSync.status()).rclone !== null;
      signal.throwIfAborted();
    }
    const warnings: string[] = [];
    if (!account) warnings.push("Firebase isn't set up, so games, cover history and dropdown options weren't synced. Connect it under Settings → Game sync.");
    if (!imagesConnected) warnings.push("Image sync isn't set up, so cover images weren't synced. Connect it under Settings → Image sync.");
    else if (!rcloneFound) warnings.push("rclone wasn't found, so cover images weren't synced. Install it, or set its path under Settings → Image sync.");
    if (!account && !rcloneFound) {
      throw new Error("Nothing could sync: Firebase isn't set up and rclone wasn't found. Install rclone, or set its path under Settings → Image sync.");
    }

    let result: SyncResult = { pushed: 0, pulled: 0, syncedAt: new Date(), warnings };
    if (account) {
      report("Signing in to Firebase");
      const remote = await connectFirestore(account);
      signal.throwIfAborted();
      result = { ...(await runSync(db, guarded(remote, signal), report)), warnings };
    }
    if (rcloneFound) {
      try {
        result.images = await imageSync.sync(coversForImageSync(db), { signal, report });
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

  // Runs a sync with the time limit. When it runs out, the sync is aborted (rclone is stopped, Firestore results are
  // ignored) and this rejects at once, naming the step it was stuck on
  const syncWithTimeout = async (): Promise<SyncResult> => {
    const controller = new AbortController();
    let step = "Starting";
    const report: ReportStep = (next) => {
      if (controller.signal.aborted) return; // a sync given up on stays quiet while it winds down
      step = next;
      onStep(next);
    };
    const timedOut = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
    });
    const timer = setTimeout(() => {
      const seconds = Math.round(timeoutMs / 1000);
      const limit = seconds === 60 ? "1 minute" : `${seconds} seconds`;
      controller.abort(
        new Error(
          `Sync timed out after ${limit} while ${lowerFirst(step)}. Check your internet connection and try again; anything finished before that was kept.`
        )
      );
    }, timeoutMs);
    try {
      return await Promise.race([sync(controller.signal, report), timedOut]);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    // Cheap: file checks and one count query, so it's fine to call after every change
    status: () => syncStatus(db, isSyncConfigured() || imageSync.isConnected()),
    run: () => {
      running ??= syncWithTimeout().finally(() => {
        running = null;
      });
      return running;
    },
  };
}

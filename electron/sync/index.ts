import type { SyncResult } from "../../src/interfaces";
import type { Db } from "../db";
import { runSync, syncStatus } from "./engine";
import { connectFirestore } from "./firestore";
import { isSyncConfigured, readAccount } from "./settings";

export function createSyncService(db: Db) {
  // A second sync request while one is running gets the running one's result instead of starting another
  let running: Promise<SyncResult> | null = null;

  const sync = async () => {
    const account = await readAccount();
    if (!account) throw new Error("Sync isn't set up yet. Add your Firebase project in Settings.");
    return runSync(db, await connectFirestore(account));
  };

  return {
    // Cheap: a file check and one count query, so it's fine to call after every change
    status: () => syncStatus(db, isSyncConfigured()),
    run: () => {
      running ??= sync().finally(() => {
        running = null;
      });
      return running;
    },
  };
}

import type { SyncResult } from "../../src/interfaces";
import type { Db } from "../db";
import { coversForImageSync } from "../db/covers";
import type { ImageSync } from "../images/imageSync";
import { recordSync, runSync, syncStatus } from "./engine";
import { connectFirestore } from "./firestore";
import { isSyncConfigured, readAccount } from "./settings";

export function createSyncService(db: Db, imageSync: ImageSync) {
  // A second sync request while one is running gets the running one's result instead of starting another
  let running: Promise<SyncResult> | null = null;

  // Games first: pulling them brings in the covers other computers added, which the image sync then downloads
  const sync = async (): Promise<SyncResult> => {
    const account = await readAccount();
    const imagesConnected = imageSync.isConnected();
    if (!account && !imagesConnected) throw new Error("Sync isn't set up yet. Connect Firebase or image sync in Settings.");

    const result: SyncResult = account ? await runSync(db, await connectFirestore(account)) : { pushed: 0, pulled: 0, syncedAt: new Date() };
    if (imagesConnected) {
      try {
        result.images = await imageSync.sync(coversForImageSync(db));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(account ? `Games synced, but images didn't. ${message}` : message);
      }
    }
    if (!account) recordSync(db, result.syncedAt);
    return result;
  };

  return {
    // Cheap: file checks and one count query, so it's fine to call after every change
    status: () => syncStatus(db, isSyncConfigured() || imageSync.isConnected()),
    run: () => {
      running ??= sync().finally(() => {
        running = null;
      });
      return running;
    },
  };
}

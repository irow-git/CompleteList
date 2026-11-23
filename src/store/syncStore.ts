import { create } from "zustand";
import { SyncResult, SyncStatus } from "../interfaces";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useGamesStore } from "./gamesStore";
import { useSelectItemsStore } from "./selectItemsStore";

interface SyncState {
  status: SyncStatus | null; // null until first loaded
  running: boolean;
  error?: string;
  lastResult?: SyncResult;

  // The latest sync, for the progress toast: the steps the main process reported, in order, and when it started and
  // ended. The toast shows while toastOpen is true
  steps: string[];
  startedAt?: number;
  finishedAt?: number;
  toastOpen: boolean;

  refresh(): Promise<void>;
  run(): Promise<void>;
  dismissToast(): void;
}

// Subscribed once, on the first sync, and never dropped: Electron doesn't keep the progress messages in order with the
// sync's result, so a step can arrive just after it (always, when it fails at once). Unsubscribing when the result
// came would lose it
let listening = false;

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: null,
  running: false,
  steps: [],
  toastOpen: false,

  refresh: async () => {
    try {
      set({ status: await window.api.sync.status() });
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    }
  },

  run: async () => {
    if (get().running) return;
    set({ running: true, error: undefined, lastResult: undefined, steps: [], startedAt: Date.now(), finishedAt: undefined, toastOpen: true });
    if (!listening) {
      window.api.sync.onProgress((step) => set((state) => ({ steps: [...state.steps, step] })));
      listening = true;
    }
    try {
      const lastResult = await window.api.sync.run();
      set({ lastResult });
      // Pulled changes can touch any page, so the list is re-read too, and so are the dropdown options
      set((state) => ({ steps: [...state.steps, "Refreshing the list"] }));
      await Promise.all([useGamesStore.getState().reload(), useSelectItemsStore.getState().load()]);
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    } finally {
      set({ running: false, finishedAt: Date.now() });
      await get().refresh();
    }
  },

  dismissToast: () => set({ toastOpen: false }),
}));

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

  refresh(): Promise<void>;
  run(): Promise<void>;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: null,
  running: false,

  refresh: async () => {
    try {
      set({ status: await window.api.sync.status() });
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    }
  },

  run: async () => {
    if (get().running) return;
    set({ running: true, error: undefined });
    try {
      const lastResult = await window.api.sync.run();
      set({ lastResult });
      // Pulled changes can touch any page, so the list is re-read too, and so are the dropdown options
      await Promise.all([useGamesStore.getState().reload(), useSelectItemsStore.getState().load()]);
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    } finally {
      set({ running: false });
      await get().refresh();
    }
  },
}));

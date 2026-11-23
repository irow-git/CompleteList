import { create } from "zustand";
import { SyncReport, SyncStatus } from "../interfaces";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useGamesStore } from "./gamesStore";
import { useSelectItemsStore } from "./selectItemsStore";

interface SyncState {
  status: SyncStatus | null; // null until first loaded
  running: boolean;
  error?: string;

  // The latest sync's report, once it's finished (see SyncReport). Kept until the next sync, for the details dialog
  report: SyncReport | null;
  // The running sync's steps as the main process reports them, for the progress toast; replaced by the report's when
  // it finishes
  steps: string[];
  startedAt?: number;
  toastOpen: boolean;
  detailsOpen: boolean;

  refresh(): Promise<void>;
  run(): Promise<void>;
  dismissToast(): void;
  openDetails(): void;
  closeDetails(): void;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: null,
  running: false,
  report: null,
  steps: [],
  toastOpen: false,
  detailsOpen: false,

  refresh: async () => {
    try {
      set({ status: await window.api.sync.status() });
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    }
  },

  run: async () => {
    if (get().running) return;
    set({ running: true, error: undefined, report: null, steps: [], startedAt: Date.now(), toastOpen: true });
    // Electron doesn't keep these in order with the result, so a step can arrive after the sync has finished. Those
    // are ignored: the report has every step
    const unsubscribe = window.api.sync.onProgress((step) => set((state) => (state.running && !state.report ? { steps: [...state.steps, step] } : {})));
    try {
      const report = await window.api.sync.run();
      set({ report, steps: report.steps, error: report.error ?? undefined });
      // Pulled changes can touch any page, so the list is re-read too, and so are the dropdown options
      // (also after a failure, if it got that far)
      if (report.changes.some((change) => change.side === "local")) await Promise.all([useGamesStore.getState().reload(), useSelectItemsStore.getState().load()]);
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    } finally {
      unsubscribe();
      set({ running: false });
      await get().refresh();
    }
  },

  dismissToast: () => set({ toastOpen: false }),
  openDetails: () => set({ detailsOpen: true }),
  closeDetails: () => set({ detailsOpen: false }),
}));

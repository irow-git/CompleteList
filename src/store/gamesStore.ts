import { create } from "zustand";
import { GameUpdate, IGame, NewGame } from "../interfaces";

export const PAGE_SIZE = 25;

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface GamesState {
  // The current page of base games, each with its DLCs nested
  games: IGame[];
  page: number; // 0-based
  pageSize: number;
  total: number; // base games across all pages
  status: LoadStatus;
  error?: string;

  loadPage(page: number): Promise<void>;
  reload(): Promise<void>;
  add(game: NewGame): Promise<IGame>;
  update(game: GameUpdate): Promise<IGame>;
  remove(id: string): Promise<void>;
}

// Bumped on every load, so a slow response for an older request can't overwrite a newer page
let latestRequest = 0;

export const useGamesStore = create<GamesState>()((set, get) => ({
  games: [],
  page: 0,
  pageSize: PAGE_SIZE,
  total: 0,
  status: "idle",
  error: undefined,

  loadPage: async (page) => {
    const request = ++latestRequest;
    const { pageSize } = get();
    set({ status: "loading", error: undefined });
    try {
      let result = await window.api.games.list({ page, pageSize });
      // After deletions the requested page can be past the end; fall back to the last one
      const lastPage = Math.max(0, Math.ceil(result.total / pageSize) - 1);
      if (page > lastPage) {
        page = lastPage;
        result = await window.api.games.list({ page, pageSize });
      }
      if (request !== latestRequest) return;
      set({ games: result.games, total: result.total, page, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  // Changes re-read the current page rather than patching `games`: a new or renamed game can land on another page,
  // and adds/removes shift the total and what's on this page
  reload: () => get().loadPage(get().page),

  add: async (game) => {
    const created = await window.api.games.create(game);
    await get().reload();
    return created;
  },

  update: async (game) => {
    const updated = await window.api.games.update(game);
    await get().reload();
    return updated;
  },

  remove: async (id) => {
    await window.api.games.remove(id);
    await get().reload();
  },
}));

import { create } from "zustand";
import { GamePage, GameSort, GameUpdate, IGame, NewGame } from "../interfaces";
import { useSyncStore } from "./syncStore";

export const PAGE_SIZE = 25;

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface GamesState {
  // The loaded base games, each with its DLCs nested: one page in the table, pages 0..page in the card view
  games: IGame[];
  page: number; // 0-based; in infinite mode, the last page loaded
  // The card view scrolls instead of paging: it starts at the first page and appends the next as you scroll
  infinite: boolean;
  pageSize: number;
  total: number; // base games across all pages (matching ones, while searching)
  // Applied in order; empty means the default order (title, or relevance while searching)
  sort: GameSort[];
  search: string;
  counts: GamePage["counts"];
  status: LoadStatus;
  error?: string;

  // Paged mode: replaces `games` with that page
  loadPage(page: number): Promise<void>;
  // Infinite mode: starts over at the first page, then loadMore appends the next one (if there is one)
  loadFirst(): Promise<void>;
  loadMore(): Promise<void>;
  // Both go back to the first page, since the old page number means nothing in the new order
  setSort(sort: GameSort[]): Promise<void>;
  setSearch(search: string): Promise<void>;
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
  infinite: false,
  pageSize: PAGE_SIZE,
  total: 0,
  sort: [],
  search: "",
  counts: { games: 0, dlcs: 0 },
  status: "idle",
  error: undefined,

  loadPage: async (page) => {
    const request = ++latestRequest;
    const { pageSize, sort, search } = get();
    set({ status: "loading", error: undefined });
    try {
      let result = await window.api.games.list({ page, pageSize, sort, search });
      // After deletions the requested page can be past the end; fall back to the last one
      const lastPage = Math.max(0, Math.ceil(result.total / pageSize) - 1);
      if (page > lastPage) {
        page = lastPage;
        result = await window.api.games.list({ page, pageSize, sort, search });
      }
      if (request !== latestRequest) return;
      set({ games: result.games, total: result.total, counts: result.counts, page, infinite: false, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  loadFirst: async () => {
    const request = ++latestRequest;
    const { pageSize, sort, search } = get();
    set({ status: "loading", error: undefined });
    try {
      const result = await window.api.games.list({ page: 0, pageSize, sort, search });
      if (request !== latestRequest) return;
      set({ games: result.games, total: result.total, counts: result.counts, page: 0, infinite: true, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  loadMore: async () => {
    const { infinite, status, games, total, page, pageSize, sort, search } = get();
    if (!infinite || status === "loading" || games.length >= total) return;
    const request = ++latestRequest;
    set({ status: "loading", error: undefined });
    try {
      const result = await window.api.games.list({ page: page + 1, pageSize, sort, search });
      if (request !== latestRequest) return;
      set({
        games: [...get().games, ...result.games],
        total: result.total,
        counts: result.counts,
        page: page + 1,
        status: "ready",
      });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  setSort: (sort) => {
    set({ sort });
    return get().infinite ? get().loadFirst() : get().loadPage(0);
  },

  setSearch: (search) => {
    set({ search });
    return get().infinite ? get().loadFirst() : get().loadPage(0);
  },

  // Changes re-read what's loaded rather than patching `games`: a new or renamed game can move to another page, and
  // adds/removes shift the total. In infinite mode that's every page scrolled through so far, in one request, so the
  // view keeps its scroll position
  reload: async () => {
    const { infinite, page, pageSize, sort, search } = get();
    if (!infinite) return get().loadPage(page);

    const request = ++latestRequest;
    try {
      const result = await window.api.games.list({ page: 0, pageSize: (page + 1) * pageSize, sort, search });
      if (request !== latestRequest) return;
      set({ games: result.games, total: result.total, counts: result.counts, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  // Every change also refreshes the sync status, whose count of unsynced changes it just moved
  add: async (game) => {
    const created = await window.api.games.create(game);
    await Promise.all([get().reload(), useSyncStore.getState().refresh()]);
    return created;
  },

  update: async (game) => {
    const updated = await window.api.games.update(game);
    await Promise.all([get().reload(), useSyncStore.getState().refresh()]);
    return updated;
  },

  remove: async (id) => {
    await window.api.games.remove(id);
    await Promise.all([get().reload(), useSyncStore.getState().refresh()]);
  },
}));

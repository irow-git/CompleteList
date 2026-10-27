import { create } from "zustand";
import { GamePage, GameSort, GameUpdate, IGame, NewGame } from "../interfaces";
import { useSyncStore } from "./syncStore";

export const PAGE_SIZES = [10, 25, 50, 75, 100];
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_KEY = "page-size";
const SEPARATE_DLCS_KEY = "separate-dlcs";

// The page size is a per-computer preference, so it lives in localStorage rather than the database
const savedPageSize = () => {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
};

const savedSeparateDlcs = () => {
  try {
    return localStorage.getItem(SEPARATE_DLCS_KEY) === "true";
  } catch {
    return false;
  }
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface GamesState {
  // The loaded base games, each with its DLCs nested (or, with separateDlcs, games and DLCs as entries of their own):
  // one page in the table, pages 0..page in the card view
  games: IGame[];
  page: number; // 0-based; in infinite mode, the last page loaded
  // The card view scrolls instead of paging: it starts at the first page and appends the next as you scroll
  infinite: boolean;
  // Where each view was left, so coming back to it lands in the same place: the table's page, and how many pages the
  // card view had loaded and how far it was scrolled
  tablePage: number;
  cardPage: number;
  cardScroll: number;
  pageSize: number;
  total: number; // entries across all pages (matching ones, while searching)
  // Applied in order; empty means the default order (title, or relevance while searching)
  sort: GameSort[];
  search: string;
  // Both views list DLCs as entries of their own, among the games, instead of inside their game. Remembered on this
  // computer, like the page size
  separateDlcs: boolean;
  counts: GamePage["counts"];
  status: LoadStatus;
  error?: string;

  // Paged mode: replaces `games` with that page
  loadPage(page: number): Promise<void>;
  // Infinite mode: starts over at the first page, then loadMore appends the next one (if there is one)
  loadFirst(): Promise<void>;
  loadMore(): Promise<void>;
  // Infinite mode, coming back to the card view: reloads every page it had loaded (in one request) unless they're
  // still in the store, so cardScroll points at the same cards again
  restoreCards(): Promise<void>;
  setCardScroll(scroll: number): void;
  // Infinite mode: makes sure the game at `index` is loaded, loading every page up to it in one request (the ruler
  // jumping further down than the cards have scrolled)
  loadUntil(index: number): Promise<void>;
  // Keeps the first game currently shown on screen, on whichever page it lands at the new size
  setPageSize(pageSize: number): Promise<void>;
  // Both go back to the first page, since the old page number means nothing in the new order
  setSort(sort: GameSort[]): Promise<void>;
  setSearch(search: string): Promise<void>;
  setSeparateDlcs(separateDlcs: boolean): Promise<void>;
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
  tablePage: 0,
  cardPage: 0,
  cardScroll: 0,
  pageSize: savedPageSize(),
  total: 0,
  sort: [],
  search: "",
  separateDlcs: savedSeparateDlcs(),
  counts: { games: 0, dlcs: 0 },
  status: "idle",
  error: undefined,

  loadPage: async (page) => {
    page = Math.max(0, Math.floor(page) || 0);
    const request = ++latestRequest;
    const { pageSize, sort, search, separateDlcs } = get();
    set({ status: "loading", error: undefined });
    try {
      let result = await window.api.games.list({ page, pageSize, sort, search, separateDlcs });
      // After deletions the requested page can be past the end; fall back to the last one
      const lastPage = Math.max(0, Math.ceil(result.total / pageSize) - 1);
      if (page > lastPage) {
        page = lastPage;
        result = await window.api.games.list({ page, pageSize, sort, search, separateDlcs });
      }
      if (request !== latestRequest) return;
      set({ games: result.games, total: result.total, counts: result.counts, page, tablePage: page, infinite: false, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  loadFirst: async () => {
    const request = ++latestRequest;
    const { pageSize, sort, search, separateDlcs } = get();
    set({ status: "loading", error: undefined });
    try {
      const result = await window.api.games.list({ page: 0, pageSize, sort, search, separateDlcs });
      if (request !== latestRequest) return;
      set({
        games: result.games,
        total: result.total,
        counts: result.counts,
        page: 0,
        cardPage: 0,
        cardScroll: 0,
        infinite: true,
        status: "ready",
      });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  loadMore: async () => {
    const { infinite, status, games, total, page, pageSize, sort, search, separateDlcs } = get();
    if (!infinite || status === "loading" || games.length >= total) return;
    const request = ++latestRequest;
    set({ status: "loading", error: undefined });
    try {
      const result = await window.api.games.list({ page: page + 1, pageSize, sort, search, separateDlcs });
      if (request !== latestRequest) return;
      set({
        games: [...get().games, ...result.games],
        total: result.total,
        counts: result.counts,
        page: page + 1,
        cardPage: page + 1,
        status: "ready",
      });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  restoreCards: async () => {
    const { infinite, cardPage, pageSize, sort, search, separateDlcs } = get();
    if (infinite) return;
    const request = ++latestRequest;
    set({ status: "loading", error: undefined });
    try {
      const result = await window.api.games.list({ page: 0, pageSize: (cardPage + 1) * pageSize, sort, search, separateDlcs });
      if (request !== latestRequest) return;
      // Fewer games than before (e.g. some were deleted) means fewer pages
      const page = Math.max(0, Math.ceil(result.games.length / pageSize) - 1);
      set({ games: result.games, total: result.total, counts: result.counts, page, cardPage: page, infinite: true, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  setCardScroll: (cardScroll) => set({ cardScroll }),

  loadUntil: async (index) => {
    const { infinite, games, total, pageSize, sort, search, separateDlcs } = get();
    if (!infinite || index < games.length || games.length >= total) return;
    const pages = Math.ceil((index + 1) / pageSize);
    const request = ++latestRequest;
    set({ status: "loading", error: undefined });
    try {
      const result = await window.api.games.list({ page: 0, pageSize: pages * pageSize, sort, search, separateDlcs });
      if (request !== latestRequest) return;
      set({ games: result.games, total: result.total, counts: result.counts, page: pages - 1, cardPage: pages - 1, status: "ready" });
    } catch (error) {
      if (request !== latestRequest) return;
      set({ status: "error", error: String(error) });
    }
  },

  setPageSize: (pageSize) => {
    if (!PAGE_SIZES.includes(pageSize)) return Promise.resolve();
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    } catch {
      // Not saved; the size still applies until the app restarts
    }
    const { page, pageSize: oldSize, cardPage } = get();
    const firstShown = page * oldSize;
    // The card view keeps about as many games loaded as before, so its scroll position stays meaningful
    set({ pageSize, cardPage: Math.max(0, Math.ceil(((cardPage + 1) * oldSize) / pageSize) - 1) });
    return get().infinite ? get().loadFirst() : get().loadPage(Math.floor(firstShown / pageSize));
  },

  // A new order or search makes both views' remembered positions meaningless
  setSort: (sort) => {
    set({ sort, tablePage: 0, cardPage: 0, cardScroll: 0 });
    return get().infinite ? get().loadFirst() : get().loadPage(0);
  },

  setSearch: (search) => {
    set({ search, tablePage: 0, cardPage: 0, cardScroll: 0 });
    return get().infinite ? get().loadFirst() : get().loadPage(0);
  },

  setSeparateDlcs: (separateDlcs) => {
    try {
      localStorage.setItem(SEPARATE_DLCS_KEY, String(separateDlcs));
    } catch {
      // Not saved; it still applies until the app restarts
    }
    set({ separateDlcs, tablePage: 0, cardPage: 0, cardScroll: 0 });
    return get().infinite ? get().loadFirst() : get().loadPage(0);
  },

  // Changes re-read what's loaded rather than patching `games`: a new or renamed game can move to another page, and
  // adds/removes shift the total. In infinite mode that's every page scrolled through so far, in one request, so the
  // view keeps its scroll position
  reload: async () => {
    const { infinite, page, pageSize, sort, search, separateDlcs } = get();
    if (!infinite) return get().loadPage(page);

    const request = ++latestRequest;
    try {
      const result = await window.api.games.list({ page: 0, pageSize: (page + 1) * pageSize, sort, search, separateDlcs });
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

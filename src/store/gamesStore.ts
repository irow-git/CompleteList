import { create } from "zustand";
import { doc, getDoc } from "firebase/firestore";
import db from "../firebaseConfig";
import { IGame, NewGame } from "../interfaces";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface GamesState {
  games: IGame[];
  status: LoadStatus;
  error?: string;

  load(): Promise<void>;
  add(game: NewGame): Promise<IGame>;
  update(game: IGame): Promise<void>;
  remove(id: string): Promise<void>;
}

export const useGamesStore = create<GamesState>()((set) => ({
  games: [],
  status: "idle",
  error: undefined,

  // Temporary: still reads the single Firestore doc so the table keeps showing data.
  // Becomes `await window.api.games.list()` once SQLite is in place.
  load: async () => {
    set({ status: "loading", error: undefined });
    try {
      // const snapshot = await getDoc(doc(db, "main", "allGames"));
      // const data = snapshot.exists() ? snapshot.data() : {};
      // const games = Object.entries(data).map(([id, game]) => ({ ...game, id }) as IGame);
      // set({ games, status: "ready" });
    } catch (error) {
      //set({ status: "error", error: String(error) });
    }
  },

  add: async (game) => {
    return window.api.games.create(game);
  },

  // TODO: window.api.games.upsert(), then replace the game in `games` by id
  update: async (game) => {
    throw new Error("gamesStore.update is not implemented yet");
  },

  // TODO: window.api.games.remove(), then filter the game out of `games`
  remove: async (id) => {
    throw new Error("gamesStore.remove is not implemented yet");
  },
}));

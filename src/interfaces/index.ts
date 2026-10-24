// A game or DLC as it's stored. Dates are ISO strings so records pass through JSON (SQLite, Firestore) unchanged
export interface GameDetails {
  title: string;
  completion: string;
  release_date?: string;
  last_completion?: string;
  platform: string[];
  tags: string[];
  original_copy: boolean;
  free_to_play: boolean;
  service: boolean;
  comment: string;
}

export interface IGame extends GameDetails {
  id: string;
  DLCs: GameDetails[];
}

// What gets passed in when creating a game; the storage layer assigns the id
export type NewGame = Omit<IGame, "id">;

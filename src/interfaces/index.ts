// A game or DLC as it's stored. Dates are calendar days held as that day's UTC midnight (see src/lib/dates.ts)
export interface GameDetails {
  title: string;
  completion: string;
  release_date: Date | null;
  last_completion: Date | null;
  platform: string[];
  tags: string[];
  original_copy: boolean;
  free_to_play: boolean;
  service: boolean;
  comment: string;
}

export interface IDLC extends GameDetails {
  id: string;
}

export interface IGame extends GameDetails {
  id: string;
  DLCs: IDLC[];
}

// What gets passed in when creating a game; the database assigns the ids
export type NewGame = GameDetails & { DLCs: GameDetails[] };

// What gets passed in when saving an existing game. DLCs without an id are new; existing DLCs left out are deleted
export type GameUpdate = GameDetails & { id: string; DLCs: (GameDetails & { id?: string })[] };

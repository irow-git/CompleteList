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

export type SortableField =
  | "platform"
  | "original_copy"
  | "free_to_play"
  | "title"
  | "completion"
  | "release_date"
  | "last_completion";

export interface GameSort {
  field: SortableField;
  direction: "asc" | "desc";
}

// Lists page through base games only: DLCs come nested in their game and don't count towards pageSize or total
export interface PageRequest {
  page: number; // 0-based
  pageSize: number;
  // Applied in order: the first sort decides, the next breaks its ties, and so on.
  // Without any, games are listed by title, or by relevance while searching
  sort?: GameSort[];
  // Fuzzy search over title, platform, tags, completion, comment and DLC titles
  search?: string;
}

export interface GamePage {
  games: IGame[];
  total: number; // base games across all pages (matching ones, while searching)
  // The whole collection, regardless of search
  counts: { games: number; dlcs: number };
}

// The web app config from the Firebase console (Project settings → Your apps)
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

// What the settings screen gets back. The password never leaves the main process
export interface FirebaseSettings {
  config: FirebaseConfig;
  email: string;
}

export interface FirebaseSettingsInput extends FirebaseSettings {
  // Left out to keep the stored password (e.g. when only the config changes)
  password?: string;
  // Create the account in the project's Firebase Auth instead of signing in to an existing one
  createAccount?: boolean;
}

export interface SyncStatus {
  configured: boolean;
  lastSyncedAt: Date | null;
  // Games and DLCs changed locally since the last sync
  pendingChanges: number;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  syncedAt: Date;
}

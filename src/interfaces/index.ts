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
  // Reference to the cover image in the local image store (see src/lib/imageRef.ts), or null
  cover_image: string | null;
  // Optional: a whole number from 1 to 100 (see src/lib/score.ts), and hours played (see src/lib/hours.ts)
  score: number | null;
  hours: number | null;
}

export interface IDLC extends GameDetails {
  id: string;
}

export interface IGame extends GameDetails {
  id: string;
  DLCs: IDLC[];
}

// What gets passed in when creating a game. The form gives the game and its DLCs their ids up front (covers are stored
// in a folder per id before the game is saved); without one, the database assigns it
export type NewGame = GameDetails & { id?: string; DLCs: (GameDetails & { id?: string })[] };

// What gets passed in when saving an existing game. DLCs without an id are new; existing DLCs left out are deleted
export type GameUpdate = GameDetails & { id: string; DLCs: (GameDetails & { id?: string })[] };

export type SortableField =
  | "platform"
  | "original_copy"
  | "free_to_play"
  | "title"
  | "completion"
  | "release_date"
  | "last_completion"
  | "score"
  | "hours";

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

// What the card view's ruler marks: titles' first letters, the year of a date, or a range of scores or hours
export type CheckpointKind = "letter" | "release_date" | "last_completion" | "score" | "hours";

export type CheckpointRequest = Pick<PageRequest, "sort" | "search"> & { kind: CheckpointKind };

// A run of consecutive games (in the list's order) sharing a letter or year, and where it starts in the list
export interface Checkpoint {
  // "A"…"Z", "#" for anything else; a year; the low end of a range of scores or hours; or "" for
  // games without that value
  label: string;
  index: number;
  count: number;
}

export interface GamePage {
  games: IGame[];
  total: number; // base games across all pages (matching ones, while searching)
  // The whole collection, regardless of search
  counts: { games: number; dlcs: number };
}

// A picture handed to the main process to store: the original file's bytes plus a small WebP thumbnail made from it
export interface ImageInput {
  type: string; // MIME type of `data`
  data: Uint8Array;
  thumbnail: Uint8Array;
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
  // Only when image sync is connected
  images?: ImageSyncResult;
}

export type ImageSyncProviderId = "drive" | "pcloud";

export interface ImageSyncStatus {
  // The rclone the app found (or was pointed at), or null if there's none it can run
  rclone: { path: string; version: string } | null;
  // The path set in settings, if any (otherwise rclone is looked up on PATH and the usual install folders)
  customRclonePath: string | null;
  // Connected storage, or null
  provider: ImageSyncProviderId | null;
  folder: string;
}

// A cover a game or DLC has been saved with (its current one included)
export interface CoverEntry {
  id: string;
  gameId: string;
  image: string;
  createdAt: Date;
}

export interface ImageSyncResult {
  uploaded: number;
  downloaded: number;
  // Covers deleted from the history, removed from the cloud
  deleted: number;
  // Used by a game here but not in the cloud yet (e.g. picked on a computer that hasn't synced since)
  missing: number;
}

import type {
  FirebaseSettings,
  FirebaseSettingsInput,
  GamePage,
  GameUpdate,
  IGame,
  NewGame,
  PageRequest,
  SyncResult,
  SyncStatus,
} from "../src/interfaces";

// Contract between the preload script and the renderer: everything the React app can ask the main process for.
// The preload implements it, and src/electron.d.ts types `window.api` with it.
// Planned additions: images.*

export interface ElectronApi {
  app: {
    version(): Promise<string>;
  };
  games: {
    list(request: PageRequest): Promise<GamePage>;
    get(id: string): Promise<IGame | null>;
    create(game: NewGame): Promise<IGame>;
    update(game: GameUpdate): Promise<IGame>;
    remove(id: string): Promise<void>;
  };
  settings: {
    // secureStorage is false when the OS offers no keyring and safeStorage falls back to a fixed key (Linux basic_text)
    getFirebase(): Promise<{ settings: FirebaseSettings | null; secureStorage: boolean }>;
    // Signs in (or creates the account) to check the settings before storing them; rejects with the reason if it fails
    saveFirebase(input: FirebaseSettingsInput): Promise<void>;
    clearFirebase(): Promise<void>;
  };
  sync: {
    status(): Promise<SyncStatus>;
    // Pulls remote changes, then pushes local ones. Rejects if sync isn't set up or Firebase is unreachable
    run(): Promise<SyncResult>;
  };
}

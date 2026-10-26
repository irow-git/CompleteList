import type {
  Checkpoint,
  CheckpointRequest,
  FirebaseSettings,
  FirebaseSettingsInput,
  GamePage,
  GameUpdate,
  CoverEntry,
  IGame,
  ImageInput,
  ImageSyncProviderId,
  ImageSyncStatus,
  NewGame,
  PageRequest,
  SyncResult,
  SyncStatus,
} from "../src/interfaces";

// Contract between the preload script and the renderer: everything the React app can ask the main process for.
// The preload implements it, and src/electron.d.ts types `window.api` with it.

export interface ElectronApi {
  app: {
    version(): Promise<string>;
  };
  games: {
    list(request: PageRequest): Promise<GamePage>;
    get(id: string): Promise<IGame | null>;
    checkpoints(request: CheckpointRequest): Promise<Checkpoint[]>;
    create(game: NewGame): Promise<IGame>;
    update(game: GameUpdate): Promise<IGame>;
    remove(id: string): Promise<void>;
  };
  images: {
    // Stores the picture in the folder of the game or DLC it's for (once, however often it's saved) and returns the
    // reference to put on it
    save(owner: string, image: ImageInput): Promise<string>;
    // Where the covers are kept on this computer
    folder(): Promise<string>;
    // Opens that folder in the system's file manager; rejects with the reason if it can't
    openFolder(): Promise<void>;
  };
  covers: {
    // Every cover a game or DLC has been saved with, newest first
    list(gameId: string): Promise<CoverEntry[]>;
    // Deletes one from the history (and its files; the cloud copy at the next sync). A game whose current cover it
    // was goes back to having none
    remove(id: string): Promise<void>;
  };
  imageSync: {
    status(): Promise<ImageSyncStatus>;
    // null goes back to looking rclone up on PATH and in the usual install folders
    setRclonePath(path: string | null): Promise<ImageSyncStatus>;
    // rclone opens the provider's login in the browser; resolves once signed in and the folder can be written to
    connect(provider: ImageSyncProviderId, folder: string): Promise<ImageSyncStatus>;
    cancelConnect(): Promise<void>;
    disconnect(): Promise<ImageSyncStatus>;
    openLoginPage(url: string): Promise<void>;
    // The login page's address, sent while connect() waits, in case the browser didn't open. Returns an unsubscribe
    onLoginUrl(listener: (url: string) => void): () => void;
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

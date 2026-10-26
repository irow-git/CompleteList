import type {
  FirebaseSettings,
  FirebaseSettingsInput,
  GamePage,
  GameUpdate,
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
    create(game: NewGame): Promise<IGame>;
    update(game: GameUpdate): Promise<IGame>;
    remove(id: string): Promise<void>;
  };
  images: {
    // Stores the picture (once, however often it's saved) and returns the reference to put on a game
    save(image: ImageInput): Promise<string>;
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

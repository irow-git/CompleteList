// Contract between the preload script and the renderer: everything the React app can ask the main process for.
// The preload implements it, and src/electron.d.ts types `window.api` with it.
// Planned additions: games.* (SQLite), images.*, settings.* (Firebase config via safeStorage), sync.*

export interface ElectronApi {
  app: {
    version(): Promise<string>;
  };
}

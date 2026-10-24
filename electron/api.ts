import type { GamePage, GameUpdate, IGame, NewGame, PageRequest } from "../src/interfaces";

// Contract between the preload script and the renderer: everything the React app can ask the main process for.
// The preload implements it, and src/electron.d.ts types `window.api` with it.
// Planned additions: images.*, settings.* (Firebase config via safeStorage), sync.*

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
}

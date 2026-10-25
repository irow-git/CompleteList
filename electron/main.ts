import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import path from "node:path";
import { Db, openDatabase } from "./db";
import { createGame, getGame, listGames, removeGame, updateGame } from "./db/games";
import { createSyncService } from "./sync";
import { clearFirebaseSettings, getFirebaseSettings, saveFirebaseSettings } from "./sync/settings";

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // The renderer gets no Node access; everything goes through window.api (see preload.ts)
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("context-menu", (_event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Inspect Element",
        click: () => {
          win.webContents.inspectElement(params.x, params.y);
        },
      },
    ]);
    menu.popup({ window: win });
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function registerIpcHandlers(db: Db) {
  ipcMain.handle("app:version", () => app.getVersion());

  ipcMain.handle("games:list", (_event, request) => listGames(db, request));
  ipcMain.handle("games:get", (_event, id) => getGame(db, id));
  ipcMain.handle("games:create", (_event, game) => createGame(db, game));
  ipcMain.handle("games:update", (_event, game) => updateGame(db, game));
  ipcMain.handle("games:remove", (_event, id) => removeGame(db, id));

  ipcMain.handle("settings:getFirebase", () => getFirebaseSettings());
  ipcMain.handle("settings:saveFirebase", (_event, input) => saveFirebaseSettings(db, input));
  ipcMain.handle("settings:clearFirebase", () => clearFirebaseSettings(db));

  const sync = createSyncService(db);
  ipcMain.handle("sync:status", () => sync.status());
  ipcMain.handle("sync:run", () => sync.run());
}

app.whenReady().then(() => {
  registerIpcHandlers(openDatabase());
  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window when the dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // On macOS apps stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") app.quit();
});

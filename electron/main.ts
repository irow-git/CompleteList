import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import path from "node:path";
import { Db, openDatabase } from "./db";
import { createGame, getGame, listCheckpoints, listGames, removeGame, updateGame } from "./db/games";
import { createSyncService } from "./sync";
import { clearFirebaseSettings, getFirebaseSettings, saveFirebaseSettings } from "./sync/settings";
import { games } from "./db/schema";
import { handleImageRequests, registerImageScheme } from "./images/protocol";
import { removeUnusedImages, saveImage } from "./images/store";
import { createImageSync, LOGIN_URL } from "./images/imageSync";
import { findRclone, rcloneRunner } from "./images/rclone";

const imagesDir = () => path.join(app.getPath("userData"), "images");

registerImageScheme();

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, "../dist/icon.png"),
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
  ipcMain.handle("games:checkpoints", (_event, request) => listCheckpoints(db, request));
  ipcMain.handle("games:create", (_event, game) => createGame(db, game));
  ipcMain.handle("games:update", (_event, game) => updateGame(db, game));
  ipcMain.handle("games:remove", (_event, id) => removeGame(db, id));

  ipcMain.handle("images:save", (_event, image) => saveImage(imagesDir(), image));

  ipcMain.handle("settings:getFirebase", () => getFirebaseSettings());
  ipcMain.handle("settings:saveFirebase", (_event, input) => saveFirebaseSettings(db, input));
  ipcMain.handle("settings:clearFirebase", () => clearFirebaseSettings(db));

  const imageSync = createImageSync({
    dataDir: path.join(app.getPath("userData"), "rclone"),
    imagesDir: imagesDir(),
    findRclone,
    runner: rcloneRunner,
  });
  ipcMain.handle("imageSync:status", () => imageSync.status());
  ipcMain.handle("imageSync:setRclonePath", (_event, customPath) => imageSync.setRclonePath(customPath));
  ipcMain.handle("imageSync:connect", (event, provider, folder) =>
    imageSync.connect(provider, folder, (url) => event.sender.send("imageSync:loginUrl", url))
  );
  ipcMain.handle("imageSync:cancelConnect", () => imageSync.cancelConnect());
  ipcMain.handle("imageSync:disconnect", () => imageSync.disconnect());
  // Only rclone's local login page; links in general go through setWindowOpenHandler (https only)
  ipcMain.handle("imageSync:openLoginPage", (_event, url) => {
    if (typeof url === "string" && LOGIN_URL.test(url)) shell.openExternal(url);
  });

  const sync = createSyncService(db, imageSync);
  ipcMain.handle("sync:status", () => sync.status());
  ipcMain.handle("sync:run", () => sync.run());
}

// Covers that were replaced or belonged to games since purged. Only at startup, so a picture chosen in a form that
// hasn't been saved yet is never removed from under it
function cleanUpImages(db: Db) {
  const referenced = db.select({ ref: games.cover_image }).from(games).all().flatMap(({ ref }) => (ref ? [ref] : []));
  removeUnusedImages(imagesDir(), new Set(referenced));
}

app.whenReady().then(() => {
  const db = openDatabase();
  cleanUpImages(db);
  handleImageRequests(imagesDir());
  registerIpcHandlers(db);
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

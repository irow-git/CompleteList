import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Db, openDatabase } from "./db";
import { createGame, getGame, listCheckpoints, listGames, removeCover, removeGame, updateGame } from "./db/games";
import { coverFilesToKeep, listCovers } from "./db/covers";
import { createSyncService } from "./sync";
import { clearFirebaseSettings, getFirebaseSettings, saveFirebaseSettings } from "./sync/settings";
import { handleImageRequests, registerImageScheme } from "./images/protocol";
import { removeImage, removeUnusedImages, saveImage } from "./images/store";
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

  win.webContents.on("context-menu", (_event, { isEditable, selectionText, editFlags, x, y }) => {
    const template: MenuItemConstructorOptions[] = [];
    if (isEditable) {
      template.push(
        { role: "cut", enabled: editFlags.canCut },
        { role: "copy", enabled: editFlags.canCopy },
        { role: "paste", enabled: editFlags.canPaste },
        { type: "separator" },
        { role: "selectAll", enabled: editFlags.canSelectAll }
      );
    } else if (selectionText.trim()) {
      template.push({ role: "copy" });
    }
    if (!app.isPackaged) {
      if (template.length) template.push({ type: "separator" });
      template.push({ label: "Inspect Element", click: () => win.webContents.inspectElement(x, y) });
    }
    if (template.length) Menu.buildFromTemplate(template).popup({ window: win });
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

  ipcMain.handle("images:save", (_event, owner, cover) => saveImage(imagesDir(), owner, cover));
  ipcMain.handle("covers:list", (_event, gameId) => listCovers(db, gameId));
  // The files go straight away; the cloud copy goes at the next sync, once the deletion has been recorded there
  ipcMain.handle("covers:remove", (_event, id) => {
    const removed = removeCover(db, id);
    if (removed) removeImage(imagesDir(), removed.gameId, removed.image);
  });
  ipcMain.handle("images:folder", () => imagesDir());
  ipcMain.handle("images:openFolder", async () => {
    // Created first, so it opens even before the first cover has been added
    fs.mkdirSync(imagesDir(), { recursive: true });
    const error = await shell.openPath(imagesDir());
    if (error) throw new Error(`Couldn't open the folder: ${error}`);
  });

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

// Files no cover in the history points at: pictures picked in a form that was never saved, deleted covers, and
// anything from the old flat layout. Only at startup, so a picture chosen in a form that's still open is never
// removed from under it
function cleanUpImages(db: Db) {
  removeUnusedImages(imagesDir(), coverFilesToKeep(db));
}

app.whenReady().then(() => {
  // No File/Edit/View menu bar in the packaged app. macOS keeps its menu: it lives in the top bar, not the window,
  // and without it Cmd+C/Cmd+V stop working
  if (app.isPackaged && process.platform !== "darwin") Menu.setApplicationMenu(null);

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

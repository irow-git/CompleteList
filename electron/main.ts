import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";

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

  // Links that try to open a new window go to the system browser instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Set by vite-plugin-electron while `yarn dev` is running
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function registerIpcHandlers() {
  ipcMain.handle("app:version", () => app.getVersion());
}

app.whenReady().then(() => {
  registerIpcHandlers();
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

import { contextBridge, ipcRenderer } from "electron";
import type { ElectronApi } from "./api";

// Expose named functions only; never hand the renderer ipcRenderer itself
const api: ElectronApi = {
  app: {
    version: () => ipcRenderer.invoke("app:version"),
  },
  games: {
    list: (request) => ipcRenderer.invoke("games:list", request),
    get: (id) => ipcRenderer.invoke("games:get", id),
    create: (game) => ipcRenderer.invoke("games:create", game),
    update: (game) => ipcRenderer.invoke("games:update", game),
    remove: (id) => ipcRenderer.invoke("games:remove", id),
  },
  settings: {
    getFirebase: () => ipcRenderer.invoke("settings:getFirebase"),
    saveFirebase: (input) => ipcRenderer.invoke("settings:saveFirebase", input),
    clearFirebase: () => ipcRenderer.invoke("settings:clearFirebase"),
  },
  sync: {
    status: () => ipcRenderer.invoke("sync:status"),
    run: () => ipcRenderer.invoke("sync:run"),
  },
};

contextBridge.exposeInMainWorld("api", api);

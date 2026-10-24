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
};

contextBridge.exposeInMainWorld("api", api);

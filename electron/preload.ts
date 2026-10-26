import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { ElectronApi } from "./api";

// Expose named functions only; never hand the renderer ipcRenderer itself
const api: ElectronApi = {
  app: {
    version: () => ipcRenderer.invoke("app:version"),
  },
  games: {
    list: (request) => ipcRenderer.invoke("games:list", request),
    get: (id) => ipcRenderer.invoke("games:get", id),
    checkpoints: (request) => ipcRenderer.invoke("games:checkpoints", request),
    create: (game) => ipcRenderer.invoke("games:create", game),
    update: (game) => ipcRenderer.invoke("games:update", game),
    remove: (id) => ipcRenderer.invoke("games:remove", id),
  },
  images: {
    save: (image) => ipcRenderer.invoke("images:save", image),
  },
  imageSync: {
    status: () => ipcRenderer.invoke("imageSync:status"),
    setRclonePath: (customPath) => ipcRenderer.invoke("imageSync:setRclonePath", customPath),
    connect: (provider, folder) => ipcRenderer.invoke("imageSync:connect", provider, folder),
    cancelConnect: () => ipcRenderer.invoke("imageSync:cancelConnect"),
    disconnect: () => ipcRenderer.invoke("imageSync:disconnect"),
    openLoginPage: (url) => ipcRenderer.invoke("imageSync:openLoginPage", url),
    onLoginUrl: (listener) => {
      const handler = (_event: IpcRendererEvent, url: string) => listener(url);
      ipcRenderer.on("imageSync:loginUrl", handler);
      return () => ipcRenderer.removeListener("imageSync:loginUrl", handler);
    },
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

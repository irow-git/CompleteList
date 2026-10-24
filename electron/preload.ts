import { contextBridge, ipcRenderer } from "electron";
import type { ElectronApi } from "./api";

// Expose named functions only; never hand the renderer ipcRenderer itself
const api: ElectronApi = {
  app: {
    version: () => ipcRenderer.invoke("app:version"),
  },
};

contextBridge.exposeInMainWorld("api", api);

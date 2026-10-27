import fs from "node:fs";
import path from "node:path";
import type { ImageSyncProviderId, ImageSyncResult, ImageSyncStatus } from "../../src/interfaces";
import { isImageRef, isOwnerId } from "../../src/lib/imageRef";
import { imageFile, removeImage, storedFiles } from "./store";
import { DEFAULT_IMAGE_FOLDER, IMAGE_SYNC_PROVIDERS } from "../../src/lib/imageSyncProviders";
import type { RcloneOutput, RcloneRunner } from "./rclone";

interface Settings {
  customRclonePath: string | null;
  provider: ImageSyncProviderId | null;
  folder: string;
}

// A cover as the image sync sees it: which game's folder, and which file
export interface Cover {
  gameId: string;
  image: string;
}

export interface ImageSyncDeps {
  // Holds the app's own rclone config (kept apart from any personal rclone setup) and these settings
  dataDir: string;
  imagesDir: string;
  findRclone: (customPath: string | null) => Promise<{ path: string; version: string } | null>;
  runner: (executable: string) => RcloneRunner;
}

// rclone prints the address of its local login page while it waits for the browser login to finish
export const LOGIN_URL = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/auth\?\S+/;

const remoteName = (provider: ImageSyncProviderId) => `completelist-${provider}`;

// A folder inside the storage: no leading/trailing slashes, no control characters, and nothing that climbs out of it.
// Never empty, so syncing never works on the storage's top level
export function cleanFolder(folder: string): string {
  const parts = folder
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  return parts.length > 0 ? parts.join("/") : DEFAULT_IMAGE_FOLDER;
}

// The most useful line of rclone's output for an error message
function failure(action: string, { code, stderr, stdout }: RcloneOutput): Error {
  const lines = `${stderr}\n${stdout}`.split("\n").map((line) => line.trim()).filter(Boolean);
  const detail = lines.find((line) => /error|failed|couldn't|denied/i.test(line)) ?? lines.at(-1);
  return new Error(`${action} failed${detail ? `: ${detail.replace(/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d /, "")}` : ` (rclone exited with ${code})`}`);
}

export function createImageSync({ dataDir, imagesDir, findRclone, runner }: ImageSyncDeps) {
  const settingsFile = path.join(dataDir, "image-sync.json");
  const configFile = path.join(dataDir, "rclone.conf");
  let login: AbortController | null = null;

  const readSettings = (): Settings => {
    try {
      const saved = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
      const provider = IMAGE_SYNC_PROVIDERS.some((p) => p.id === saved.provider) ? saved.provider : null;
      return { customRclonePath: saved.customRclonePath || null, provider, folder: cleanFolder(saved.folder ?? "") };
    } catch {
      return { customRclonePath: null, provider: null, folder: DEFAULT_IMAGE_FOLDER };
    }
  };

  const writeSettings = (settings: Settings) => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  };

  // Every command uses the app's own config file
  const rclone = async () => {
    const found = await findRclone(readSettings().customRclonePath);
    if (!found) throw new Error("rclone wasn't found. Install it, or set its path under Image sync in Settings.");
    const run = runner(found.path);
    return (args: string[], options?: Parameters<RcloneRunner>[1]) => run([...args, "--config", configFile], options);
  };

  const status = async (): Promise<ImageSyncStatus> => {
    const settings = readSettings();
    return { rclone: await findRclone(settings.customRclonePath), ...settings };
  };

  return {
    status,

    isConnected: () => readSettings().provider !== null,

    setRclonePath: async (customPath: string | null) => {
      writeSettings({ ...readSettings(), customRclonePath: customPath?.trim() || null });
      return status();
    },

    // Creates the remote, which makes rclone open the provider's login page in the browser and wait for it. The link
    // is passed on as well, in case the browser doesn't open by itself
    connect: async (providerId: ImageSyncProviderId, folder: string, onLoginUrl: (url: string) => void) => {
      const provider = IMAGE_SYNC_PROVIDERS.find((p) => p.id === providerId);
      if (!provider) throw new Error("Unknown storage provider.");
      const run = await rclone();
      const previous = readSettings().provider;
      const name = remoteName(provider.id);
      const target = cleanFolder(folder);

      login?.abort();
      login = new AbortController();
      try {
        await run(["config", "delete", name]);
        let linkShown = false;
        const created = await run(["config", "create", name, provider.rcloneType, ...Object.entries(provider.options).flat()], {
          signal: login.signal,
          onOutput: (text) => {
            const url = LOGIN_URL.exec(text)?.[0];
            if (url && !linkShown) {
              linkShown = true;
              onLoginUrl(url);
            }
          },
        });
        if (created.code !== 0) throw failure("Signing in", created);
      } catch (error) {
        if (login.signal.aborted) throw new Error("Sign-in was cancelled.");
        throw error;
      } finally {
        login = null;
      }

      // Proves the login works and that the folder can be written to
      const made = await run(["mkdir", `${name}:${target}`]);
      if (made.code !== 0) {
        await run(["config", "delete", name]);
        throw failure("Creating the folder", made);
      }
      if (previous && previous !== provider.id) await run(["config", "delete", remoteName(previous)]);
      writeSettings({ ...readSettings(), provider: provider.id, folder: target });
      return status();
    },

    cancelConnect: () => {
      login?.abort();
    },

    disconnect: async () => {
      const settings = readSettings();
      if (settings.provider) {
        // The login token goes even if rclone can't be found any more: it's in the app's own config file
        try {
          await (await rclone())(["config", "delete", remoteName(settings.provider)]);
        } catch {
          fs.rmSync(configFile, { force: true });
        }
      }
      writeSettings({ ...settings, provider: null });
      return status();
    },

    // Covers are named by their content, in a folder per game, so syncing is: upload the covers the cloud doesn't have,
    // download the ones this computer's games use but doesn't have, and delete the ones deleted from a history (here
    // and in the cloud). Nothing is ever overwritten. One recursive listing covers every game's folder
    sync: async (coversToSync: { live: Cover[]; deleted: Cover[] }): Promise<ImageSyncResult> => {
      const { provider, folder } = readSettings();
      if (!provider) throw new Error("Image sync isn't connected.");
      const run = await rclone();
      const remote = `${remoteName(provider)}:${folder}`;

      const made = await run(["mkdir", remote]);
      if (made.code !== 0) throw failure("Reaching the cloud folder", made);
      const listed = await run(["lsf", remote, "--recursive", "--files-only"]);
      if (listed.code !== 0) throw failure("Listing the cloud folder", listed);
      const inCloud = new Set(listed.stdout.split("\n").map((line) => line.trim()).filter(Boolean));

      const valid = (cover: Cover) => isOwnerId(cover.gameId) && isImageRef(cover.image);
      const live = coversToSync.live.filter(valid);
      const deleted = coversToSync.deleted.filter(valid);
      const local = new Set(storedFiles(imagesDir));

      const liveFiles = live.map((cover) => imageFile(cover.gameId, cover.image));
      const toUpload = liveFiles.filter((file) => local.has(file) && !inCloud.has(file));
      const toDownload = liveFiles.filter((file) => !local.has(file) && inCloud.has(file));
      const toDelete = deleted.map((cover) => imageFile(cover.gameId, cover.image)).filter((file) => inCloud.has(file));

      // rclone reads the files to act on from a list, as paths relative to the folders it's given
      const withList = async (files: string[], action: string, args: (list: string) => string[]) => {
        if (files.length === 0) return;
        fs.mkdirSync(dataDir, { recursive: true });
        const list = path.join(dataDir, `files-${Date.now()}.txt`);
        fs.writeFileSync(list, files.join("\n"));
        try {
          const result = await run(args(list));
          if (result.code !== 0) throw failure(action, result);
        } finally {
          fs.rmSync(list, { force: true });
        }
      };
      const copyArgs = (from: string, to: string) => (list: string) => ["copy", from, to, "--files-from", list, "--no-traverse", "--ignore-existing"];
      fs.mkdirSync(imagesDir, { recursive: true });
      await withList(toUpload, "Uploading covers", copyArgs(imagesDir, remote));
      await withList(toDownload, "Downloading covers", copyArgs(remote, imagesDir));
      await withList(toDelete, "Deleting covers from the cloud", (list) => ["delete", remote, "--files-from", list]);
      // Deleted covers that came from another computer's history go from this one too
      for (const cover of deleted) removeImage(imagesDir, cover.gameId, cover.image);

      return {
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDelete.length,
        missing: liveFiles.filter((file) => !local.has(file) && !inCloud.has(file)).length,
      };
    },
  };
}

export type ImageSync = ReturnType<typeof createImageSync>;

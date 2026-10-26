import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface RcloneOutput {
  code: number;
  stdout: string;
  stderr: string;
}

// Runs rclone with an argument list (never through a shell, so no file or folder name can become a command)
export type RcloneRunner = (args: string[], options?: { onOutput?: (text: string) => void; signal?: AbortSignal }) => Promise<RcloneOutput>;

export const rcloneRunner =
  (executable: string): RcloneRunner =>
  (args, { onOutput, signal } = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(executable, args, { signal, windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk;
        onOutput?.(chunk.toString());
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk;
        onOutput?.(chunk.toString());
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });

// Older versions lack `config create` taking defaults for every question it would ask, which the login relies on
const MIN_VERSION = [1, 55, 0];

const isAtLeast = (version: number[], minimum: number[]) => {
  for (let i = 0; i < minimum.length; i++) if (version[i] !== minimum[i]) return (version[i] ?? 0) > minimum[i];
  return true;
};

const executableName = process.platform === "win32" ? "rclone.exe" : "rclone";

// PATH first, then where the usual installers put it: an app started from the macOS Dock doesn't see Homebrew's PATH,
// and on Windows winget and scoop use their own folders
function candidatePaths(): string[] {
  const home = os.homedir();
  const fromPath = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const usual =
    process.platform === "win32"
      ? [path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links"), path.join(home, "scoop", "shims"), "C:\\Program Files\\rclone"]
      : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/snap/bin", path.join(home, ".local", "bin"), path.join(home, "bin")];
  return [...new Set([...fromPath, ...usual])].map((dir) => path.join(dir, executableName));
}

// The rclone to use and its version, or null. A custom path is the only one tried when it's set
export async function findRclone(customPath: string | null): Promise<{ path: string; version: string } | null> {
  for (const candidate of customPath ? [customPath] : candidatePaths()) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    try {
      const signal = AbortSignal.timeout(10_000);
      const { code, stdout } = await rcloneRunner(candidate)(["version"], { signal });
      const match = /rclone v(\d+)\.(\d+)\.(\d+)/.exec(stdout);
      if (code === 0 && match && isAtLeast(match.slice(1).map(Number), MIN_VERSION)) {
        return { path: candidate, version: match[0].replace("rclone ", "") };
      }
    } catch {
      // Not runnable; try the next one
    }
  }
  return null;
}

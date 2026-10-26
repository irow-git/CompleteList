// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { rcloneRunner } from "./rclone";

let root: string | undefined;
afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  delete process.env.RCLONE_CONFIG_COMPLETELIST_DRIVE_ROOT_FOLDER_ID;
  delete process.env.rclone_include;
});

test.skipIf(process.platform === "win32")("rclone doesn't get RCLONE_* environment variables, which could redirect a remote", async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "complete-list-rclone-"));
  const fake = path.join(root, "rclone");
  fs.writeFileSync(fake, "#!/bin/sh\nenv\n", { mode: 0o755 });
  process.env.RCLONE_CONFIG_COMPLETELIST_DRIVE_ROOT_FOLDER_ID = "someone-elses-folder";
  process.env.rclone_include = "**";

  const { code, stdout } = await rcloneRunner(fake)(["version"]);
  expect(code).toBe(0);
  expect(stdout).toMatch(/^PATH=/m);
  expect(stdout).not.toMatch(/^rclone_/im);
});

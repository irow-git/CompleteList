import { defineConfig } from "drizzle-kit";
import os from "node:os";
import path from "node:path";

// Where Electron's app.getPath("userData") points for this app on each OS (electron/db/index.ts opens the DB there)
function appDatabasePath() {
  const appData =
    process.platform === "win32"
      ? process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Application Support")
        : process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(appData, "complete-list", "complete-list.db");
}

// `yarn db:generate` diffs electron/db/schema.ts against drizzle/ and writes a new SQL migration there.
// The app applies pending migrations on startup (electron/db/index.ts).
// `yarn db:studio` opens the app's database in Drizzle Studio; set DB_FILE to open a different one.
export default defineConfig({
  dialect: "sqlite",
  schema: "./electron/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DB_FILE ?? appDatabasePath(),
  },
});

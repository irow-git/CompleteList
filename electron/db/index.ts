import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "node:path";
import * as schema from "./schema";

export type Db = ReturnType<typeof openDatabase>;

// Opens (or creates) the database in the user data folder and applies any pending migrations from drizzle/
export function openDatabase(file = path.join(app.getPath("userData"), "complete-list.db")) {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: path.join(app.getAppPath(), "drizzle") });

  app.on("will-quit", () => sqlite.close());
  return db;
}

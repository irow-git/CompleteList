import { AnySQLiteColumn, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Game details: what the user edits. Keys match GameDetails in src/interfaces so rows map onto it directly.
// DLCs are rows too, pointing at their base game through parent_id.
export const games = sqliteTable(
  "games",
  {
    id: text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    parent_id: text().references((): AnySQLiteColumn => games.id, { onDelete: "cascade" }),
    title: text().notNull(),
    completion: text().notNull(),
    // Calendar days, stored as that day's UTC midnight (see src/lib/dates.ts)
    release_date: integer({ mode: "timestamp_ms" }),
    last_completion: integer({ mode: "timestamp_ms" }),
    platform: text({ mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    tags: text({ mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    original_copy: integer({ mode: "boolean" }).notNull().default(false),
    free_to_play: integer({ mode: "boolean" }).notNull().default(false),
    service: integer({ mode: "boolean" }).notNull().default(false),
    comment: text().notNull().default(""),
    cover_image: text(), // see src/lib/imageRef.ts
    score: integer(), // 1–100
    hours: real(),
  },
  (table) => [index("games_parent_id_idx").on(table.parent_id)]
);

// Sync bookkeeping, one row per game or DLC. Kept apart from the details so a sync can compare every
// game's timestamps cheaply and then fetch only the changed details, page by page.
export const gameMetadata = sqliteTable(
  "game_metadata",
  {
    game_id: text()
      .primaryKey()
      .references(() => games.id, { onDelete: "cascade" }),
    created_at: integer({ mode: "timestamp_ms" }).notNull(),
    updated_at: integer({ mode: "timestamp_ms" }).notNull(),
    // Soft delete: the row stays as a tombstone so the deletion can be synced
    deleted_at: integer({ mode: "timestamp_ms" }),
    // Local only: changed since the last sync
    dirty: integer({ mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("game_metadata_dirty_idx").on(table.dirty)]
);

// Sync bookkeeping that isn't per game, e.g. the pull checkpoint and when the last sync finished
export const syncState = sqliteTable("sync_state", {
  key: text().primaryKey(),
  value: text().notNull(),
});

// Every cover a game or DLC has been saved with, so earlier ones can be picked again or deleted. Synced like the games:
// deleting one leaves a tombstone, so the deletion reaches every computer, and the image sync then removes the file
// from the cloud. game_id is deliberately not a foreign key: tombstones have to outlive their game (deleted games are
// purged after syncing), or a deleted game's cover files would never be cleaned up. The id is "<game id>:<image>", so
// two computers recording the same cover end up with the same row
export const covers = sqliteTable(
  "covers",
  {
    id: text().primaryKey(),
    game_id: text().notNull(),
    image: text().notNull(), // see src/lib/imageRef.ts
    created_at: integer({ mode: "timestamp_ms" }).notNull(),
    updated_at: integer({ mode: "timestamp_ms" }).notNull(),
    deleted_at: integer({ mode: "timestamp_ms" }),
    // Local only: changed since the last sync
    dirty: integer({ mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("covers_game_id_idx").on(table.game_id), index("covers_dirty_idx").on(table.dirty)]
);

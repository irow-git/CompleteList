// @vitest-environment node
import { beforeEach, expect, test } from "vitest";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { GameDetails } from "../../src/interfaces";
import type { Db } from ".";
import { createGame, listGames, removeGame, updateGame } from "./games";
import * as schema from "./schema";

const details = (title: string): GameDetails => ({
  title,
  completion: "Main story",
  release_date: "2015-05-19",
  last_completion: null,
  platform: ["PC"],
  tags: [],
  original_copy: true,
  free_to_play: false,
  service: false,
  comment: "",
});

const metadataOf = (db: Db, id: string) =>
  db.select().from(schema.gameMetadata).where(eq(schema.gameMetadata.game_id, id)).get()!;

let db: Db;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: "drizzle" });
});

test("creates a game with DLCs and lists it back", () => {
  const created = createGame(db, { ...details("Witcher 3"), DLCs: [details("Blood and Wine"), details("Hearts of Stone")] });

  expect(listGames(db)).toEqual([created]);
  expect(created.DLCs.map((dlc) => dlc.title)).toEqual(["Blood and Wine", "Hearts of Stone"]);
  expect(created.platform).toEqual(["PC"]);
  expect(metadataOf(db, created.DLCs[0].id)).toMatchObject({ dirty: true, deleted_at: null });
});

test("update adds, edits and removes DLCs, touching only changed rows", () => {
  const game = createGame(db, { ...details("Witcher 3"), DLCs: [details("Blood and Wine"), details("Hearts of Stone")] });
  const [bloodAndWine, heartsOfStone] = game.DLCs;
  // Pretend everything has been synced
  const synced = new Date(0);
  db.update(schema.gameMetadata).set({ dirty: false, updated_at: synced }).run();

  const updated = updateGame(db, {
    ...game,
    DLCs: [bloodAndWine, { ...heartsOfStone, comment: "Best DLC" }, details("Expansion Pass")],
  });
  expect(updated.DLCs.map((dlc) => dlc.title).sort()).toEqual(["Blood and Wine", "Expansion Pass", "Hearts of Stone"]);
  expect(metadataOf(db, game.id)).toMatchObject({ dirty: false, updated_at: synced });
  expect(metadataOf(db, bloodAndWine.id)).toMatchObject({ dirty: false, updated_at: synced });
  expect(metadataOf(db, heartsOfStone.id).dirty).toBe(true);

  const trimmed = updateGame(db, { ...updated, DLCs: updated.DLCs.filter((dlc) => dlc.id !== bloodAndWine.id) });
  expect(trimmed.DLCs.map((dlc) => dlc.id)).not.toContain(bloodAndWine.id);
  expect(metadataOf(db, bloodAndWine.id).deleted_at).toBeInstanceOf(Date);
});

test("remove soft-deletes the game and its DLCs", () => {
  const game = createGame(db, { ...details("Witcher 3"), DLCs: [details("Blood and Wine")] });

  removeGame(db, game.id);

  expect(listGames(db)).toEqual([]);
  expect(metadataOf(db, game.id).deleted_at).toBeInstanceOf(Date);
  expect(metadataOf(db, game.DLCs[0].id).deleted_at).toBeInstanceOf(Date);
});

test("updating a missing game throws", () => {
  expect(() => updateGame(db, { ...details("Ghost"), id: "nope", DLCs: [] })).toThrow("not found");
});

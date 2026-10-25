// @vitest-environment node
import { beforeEach, expect, test } from "vitest";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { GameDetails } from "../../src/interfaces";
import type { Db } from ".";
import { createGame, getGame, listGames, removeGame, updateGame } from "./games";
import * as schema from "./schema";

const details = (title: string): GameDetails => ({
  title,
  completion: "Main story",
  release_date: new Date(Date.UTC(2015, 4, 19)),
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

const firstPage = { page: 0, pageSize: 25 };

let db: Db;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: "drizzle" });
});

test("creates a game with DLCs and lists it back", () => {
  const created = createGame(db, { ...details("Witcher 3"), DLCs: [details("Blood and Wine"), details("Hearts of Stone")] });

  expect(listGames(db, firstPage).games).toEqual([created]);
  expect(created.DLCs.map((dlc) => dlc.title)).toEqual(["Blood and Wine", "Hearts of Stone"]);
  expect(created.platform).toEqual(["PC"]);
  expect(created.release_date).toEqual(new Date("2015-05-19T00:00:00.000Z"));
  // Stored as epoch milliseconds (UTC)
  expect(db.$client.prepare("select release_date from games limit 1").get()).toEqual({ release_date: Date.UTC(2015, 4, 19) });
  expect(metadataOf(db, created.DLCs[0].id)).toMatchObject({ dirty: true, deleted_at: null });
});

test("lists base games a page at a time, with DLCs nested and not counted", () => {
  for (let i = 1; i <= 30; i++) {
    createGame(db, { ...details(`Game ${String(i).padStart(2, "0")}`), DLCs: [details(`DLC of ${i}`)] });
  }
  removeGame(db, listGames(db, firstPage).games[0].id);

  const first = listGames(db, firstPage);
  const second = listGames(db, { page: 1, pageSize: 25 });

  expect(first.total).toBe(29);
  expect(first.games).toHaveLength(25);
  expect(first.games[0].title).toBe("Game 02");
  expect(first.games[0].DLCs.map((dlc) => dlc.title)).toEqual(["DLC of 2"]);
  expect(second.games.map((game) => game.title)).toEqual(["Game 27", "Game 28", "Game 29", "Game 30"]);
  expect(listGames(db, { page: 2, pageSize: 25 }).games).toEqual([]);
});

test("titles sort case-insensitively", () => {
  for (const title of ["beta", "Alpha", "gamma"]) createGame(db, { ...details(title), DLCs: [] });

  expect(listGames(db, firstPage).games.map((game) => game.title)).toEqual(["Alpha", "beta", "gamma"]);
});

test("sorts by any column across pages, with empty dates last in both directions", () => {
  createGame(db, { ...details("Celeste"), release_date: new Date(Date.UTC(2018, 0, 25)), DLCs: [] });
  createGame(db, { ...details("Braid"), release_date: null, DLCs: [] });
  createGame(db, { ...details("Antichamber"), release_date: new Date(Date.UTC(2013, 0, 31)), DLCs: [] });
  createGame(db, { ...details("Destiny 2"), service: true, DLCs: [] });
  const titles = (sort: Parameters<typeof listGames>[1]["sort"], pageSize = 25) =>
    listGames(db, { page: 0, pageSize, sort }).games.map((game) => game.title);

  // Destiny 2 has the default 2015 release date from details()
  expect(titles({ field: "release_date", direction: "asc" })).toEqual(["Antichamber", "Destiny 2", "Celeste", "Braid"]);
  expect(titles({ field: "release_date", direction: "desc" })).toEqual(["Celeste", "Destiny 2", "Antichamber", "Braid"]);
  expect(titles({ field: "title", direction: "desc" }, 2)).toEqual(["Destiny 2", "Celeste"]);
  expect(titles({ field: "original_copy", direction: "desc" })[0]).toBe("Destiny 2");
});

test("fuzzy search tolerates typos, matches DLC titles and other fields, and pages through the matches", () => {
  createGame(db, { ...details("The Witcher 3"), DLCs: [details("Blood and Wine")] });
  createGame(db, { ...details("Celeste"), tags: ["platformer"], DLCs: [] });
  createGame(db, { ...details("Hollow Knight"), tags: ["platformer"], DLCs: [] });
  const search = (text: string, sort?: Parameters<typeof listGames>[1]["sort"]) =>
    listGames(db, { page: 0, pageSize: 25, search: text, sort }).games.map((game) => game.title);

  expect(search("wticher")).toEqual(["The Witcher 3"]);
  expect(search("blood wine")).toEqual(["The Witcher 3"]);
  expect(search("platformer").sort()).toEqual(["Celeste", "Hollow Knight"]);
  expect(search("zzzz")).toEqual([]);
  expect(listGames(db, { page: 0, pageSize: 25, search: "zzzz" }).total).toBe(0);
  expect(search("   ")).toHaveLength(3);
  // Words can match in different fields
  expect(search("witcher pc")).toEqual(["The Witcher 3"]);
  expect(search("celeste ps5")).toEqual([]);
  // With a sort, the matches follow it instead of relevance
  expect(search("platformer", { field: "title", direction: "desc" })).toEqual(["Hollow Knight", "Celeste"]);
  expect(search("platformer", { field: "title", direction: "asc" })).toEqual(["Celeste", "Hollow Knight"]);
});

test("dates are searchable as shown in the table or as YYYY-MM-DD, and numbers match exactly", () => {
  createGame(db, { ...details("Celeste"), release_date: new Date(Date.UTC(2018, 0, 25)), DLCs: [] });
  createGame(db, { ...details("Hades"), release_date: new Date(Date.UTC(2020, 8, 17)), last_completion: new Date(Date.UTC(2018, 2, 3)), DLCs: [] });
  createGame(db, { ...details("Braid"), release_date: new Date(Date.UTC(2008, 7, 6)), DLCs: [] });
  const search = (text: string) => listGames(db, { page: 0, pageSize: 25, search: text }).games.map((game) => game.title).sort();

  expect(search("2018")).toEqual(["Celeste", "Hades"]);
  expect(search("2018-Jan")).toEqual(["Celeste"]);
  expect(search("jan 2018")).toEqual(["Celeste"]);
  expect(search("2020-09-17")).toEqual(["Hades"]);
  // Not fuzzy: 2019 is one digit off 2018 and 2008 but matches nothing
  expect(search("2019")).toEqual([]);
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

  expect(listGames(db, firstPage).games).toEqual([]);
  expect(metadataOf(db, game.id).deleted_at).toBeInstanceOf(Date);
  expect(metadataOf(db, game.DLCs[0].id).deleted_at).toBeInstanceOf(Date);
});

test("gets a base game with its DLCs; DLC ids and deleted games give null", () => {
  const game = createGame(db, { ...details("Witcher 3"), DLCs: [details("Blood and Wine")] });

  expect(getGame(db, game.id)).toEqual(game);
  expect(getGame(db, game.DLCs[0].id)).toBeNull();
  removeGame(db, game.id);
  expect(getGame(db, game.id)).toBeNull();
});

test("updating a missing game throws", () => {
  expect(() => updateGame(db, { ...details("Ghost"), id: "nope", DLCs: [] })).toThrow("not found");
});

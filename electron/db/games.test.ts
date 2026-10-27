// @vitest-environment node
import { beforeEach, expect, test } from "vitest";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { GameDetails } from "../../src/interfaces";
import type { Db } from ".";
import { createGame, getGame, listCheckpoints, listGames, removeCover, removeGame, updateGame } from "./games";
import { listCovers } from "./covers";
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
  cover_image: null,
  score: null,
  hours: null,
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
  expect(titles([{ field: "release_date", direction: "asc" }])).toEqual(["Antichamber", "Destiny 2", "Celeste", "Braid"]);
  expect(titles([{ field: "release_date", direction: "desc" }])).toEqual(["Celeste", "Destiny 2", "Antichamber", "Braid"]);
  expect(titles([{ field: "title", direction: "desc" }], 2)).toEqual(["Destiny 2", "Celeste"]);
  expect(titles([{ field: "original_copy", direction: "desc" }])[0]).toBe("Destiny 2");
});

test("multiple sorts apply in order, each breaking the previous one's ties", () => {
  createGame(db, { ...details("Celeste"), platform: ["Switch"], DLCs: [] });
  createGame(db, { ...details("Braid"), platform: ["PC"], DLCs: [] });
  createGame(db, { ...details("Antichamber"), platform: ["PC"], DLCs: [] });
  createGame(db, { ...details("Dead Cells"), platform: ["Switch"], DLCs: [] });
  const titles = (sort: Parameters<typeof listGames>[1]["sort"]) =>
    listGames(db, { page: 0, pageSize: 25, sort }).games.map((game) => game.title);

  expect(titles([{ field: "platform", direction: "desc" }, { field: "title", direction: "desc" }])).toEqual([
    "Dead Cells",
    "Celeste",
    "Braid",
    "Antichamber",
  ]);
  // A repeated field only counts once
  expect(titles([{ field: "platform", direction: "asc" }, { field: "platform", direction: "desc" }])).toEqual([
    "Antichamber",
    "Braid",
    "Celeste",
    "Dead Cells",
  ]);
});

test("counts cover the whole collection: live games and DLCs, regardless of search", () => {
  createGame(db, { ...details("The Witcher 3"), DLCs: [details("Blood and Wine"), details("Hearts of Stone")] });
  const removed = createGame(db, { ...details("Braid"), DLCs: [details("Braid DLC")] });
  createGame(db, { ...details("Celeste"), DLCs: [] });
  removeGame(db, removed.id);

  expect(listGames(db, firstPage).counts).toEqual({ games: 2, dlcs: 2 });
  expect(listGames(db, { ...firstPage, search: "celeste" }).counts).toEqual({ games: 2, dlcs: 2 });
  expect(listGames(db, { ...firstPage, search: "zzzz" }).counts).toEqual({ games: 2, dlcs: 2 });
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
  expect(search("platformer", [{ field: "title", direction: "desc" }])).toEqual(["Hollow Knight", "Celeste"]);
  expect(search("platformer", [{ field: "title", direction: "asc" }])).toEqual(["Celeste", "Hollow Knight"]);
});

test("the labels cards show are searchable: original, service and free to play", () => {
  createGame(db, { ...details("Celeste"), original_copy: true, DLCs: [] });
  createGame(db, { ...details("Destiny 2"), original_copy: true, service: true, free_to_play: true, DLCs: [] });
  createGame(db, { ...details("Braid"), original_copy: false, DLCs: [] });
  const search = (text: string) => listGames(db, { page: 0, pageSize: 25, search: text }).games.map((game) => game.title).sort();

  expect(search("original")).toEqual(["Celeste"]);
  expect(search("service")).toEqual(["Destiny 2"]);
  expect(search("free to play")).toEqual(["Destiny 2"]);
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

test("title order ignores a leading \"The\" or \"A\"", () => {
  for (const title of ["The Witcher 3", "A Short Hike", "Celeste", "the binding of isaac", "Theme Hospital", "Alan Wake"]) {
    createGame(db, { ...details(title), DLCs: [] });
  }
  const titles = (sort?: Parameters<typeof listGames>[1]["sort"]) => listGames(db, { ...firstPage, sort }).games.map((game) => game.title);
  const expected = ["Alan Wake", "the binding of isaac", "Celeste", "A Short Hike", "Theme Hospital", "The Witcher 3"];

  expect(titles()).toEqual(expected);
  expect(titles([{ field: "title", direction: "desc" }])).toEqual([...expected].reverse());
});

test("covers keep valid image references and drop anything else", () => {
  const ref = `${"ab".repeat(32)}.webp`;
  const game = createGame(db, { ...details("Witcher 3"), cover_image: ref, DLCs: [{ ...details("Blood and Wine"), cover_image: "../../secret.png" }] });

  expect(game.cover_image).toBe(ref);
  expect(game.DLCs[0].cover_image).toBeNull();
  expect(updateGame(db, { ...game, cover_image: null }).cover_image).toBeNull();
});

test("ruler checkpoints follow the list's order: letters ignore The/A, years put games without a date last", () => {
  const add = (title: string, year: number | null) =>
    createGame(db, { ...details(title), release_date: year ? new Date(Date.UTC(year, 5, 1)) : null, DLCs: [] });
  add("The Witcher 3", 2015);
  add("Alan Wake", 2010);
  add("A Short Hike", 2019);
  add("8 Ball Pool", null);
  add("Witness", 2016);
  add("Braid", null);

  expect(listCheckpoints(db, { kind: "letter", sort: [{ field: "title", direction: "asc" }] })).toEqual([
    { label: "#", index: 0, count: 1 },
    { label: "A", index: 1, count: 1 },
    { label: "B", index: 2, count: 1 },
    { label: "S", index: 3, count: 1 },
    { label: "W", index: 4, count: 2 },
  ]);
  const years = (direction: "asc" | "desc") =>
    listCheckpoints(db, { kind: "release_date", sort: [{ field: "release_date", direction }] }).map(({ label, count }) => `${label || "none"}×${count}`);
  expect(years("asc")).toEqual(["2010×1", "2015×1", "2016×1", "2019×1", "none×2"]);
  expect(years("desc")).toEqual(["2019×1", "2016×1", "2015×1", "2010×1", "none×2"]);
  // The indexes line up with the list itself
  const list = listGames(db, { page: 0, pageSize: 25, sort: [{ field: "release_date", direction: "desc" }] }).games;
  expect(list[4].title).toBe("8 Ball Pool");
  expect(listCheckpoints(db, { kind: "letter", sort: [{ field: "title", direction: "asc" }], search: "witcher" })).toEqual([
    { label: "W", index: 0, count: 1 },
  ]);
});

test("scores are whole numbers from 1 to 100 and hours keep one decimal", () => {
  const game = createGame(db, { ...details("Witcher 3"), score: 140, hours: 101.26, DLCs: [{ ...details("Blood and Wine"), score: 0.4, hours: -3 }] });

  expect([game.score, game.hours]).toEqual([100, 101.3]);
  expect([game.DLCs[0].score, game.DLCs[0].hours]).toEqual([1, null]);
  // Left out, as by an older client, they're stored as none
  const { score, hours, ...rest } = game;
  expect(updateGame(db, rest as typeof game)).toMatchObject({ score: null, hours: null });
});

test("sorts and rules by score and hours, games without them last", () => {
  const add = (title: string, score: number | null, hours: number | null) => createGame(db, { ...details(title), score, hours, DLCs: [] });
  add("Braid", 91, 8);
  add("Celeste", 100, 60);
  add("Dota 2", 76, 9001);
  add("Elden Ring", 96, 250);
  add("Fez", null, null);
  add("Gris", 72, 10.5);

  const titles = (field: "score" | "hours", direction: "asc" | "desc") =>
    listGames(db, { ...firstPage, sort: [{ field, direction }] }).games.map((game) => game.title);
  expect(titles("score", "desc")).toEqual(["Celeste", "Elden Ring", "Braid", "Dota 2", "Gris", "Fez"]);
  expect(titles("hours", "asc")).toEqual(["Braid", "Gris", "Celeste", "Elden Ring", "Dota 2", "Fez"]);

  const ruler = (kind: "score" | "hours", direction: "asc" | "desc") =>
    listCheckpoints(db, { kind, sort: [{ field: kind, direction }] }).map(({ label, count }) => `${label || "none"}×${count}`);
  // 100 counts with the 90s
  expect(ruler("score", "desc")).toEqual(["90×3", "70×2", "none×1"]);
  // Each range is over its bound: 250 is still in 100–250, 10.5 is over 10
  expect(ruler("hours", "asc")).toEqual(["0×1", "10×1", "50×1", "100×1", "9000×1", "none×1"]);
});

test("the form's ids are used, every saved cover joins the history, and deleting the current one clears it", () => {
  const id = "0b8f1c2e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
  const dlcId = "1c9e2d3f-5e6b-4c7d-9e8f-0a1b2c3d4e5f";
  const [first, second] = [`${"ab".repeat(32)}.webp`, `${"cd".repeat(32)}.webp`];
  const game = createGame(db, { ...details("Celeste"), id, cover_image: first, DLCs: [{ ...details("Farewell"), id: dlcId }] });
  expect([game.id, game.DLCs[0].id]).toEqual([id, dlcId]);
  // Not a UUID, or already taken: a fresh id instead
  expect(createGame(db, { ...details("Other"), id: "../x", DLCs: [] }).id).not.toBe("../x");
  expect(createGame(db, { ...details("Another"), id, DLCs: [] }).id).not.toBe(id);

  updateGame(db, { ...game, cover_image: second });
  expect(listCovers(db, id).map((cover) => cover.image).sort()).toEqual([first, second].sort());

  removeCover(db, listCovers(db, id).find((cover) => cover.image === second)!.id);
  expect(getGame(db, id)!.cover_image).toBeNull();
  expect(listCovers(db, id).map((cover) => cover.image)).toEqual([first]);
  // Saving a deleted cover again brings it back
  updateGame(db, { ...getGame(db, id)!, cover_image: second });
  expect(listCovers(db, id)).toHaveLength(2);
});

test("separate DLCs are entries of their own: sorted, searched, paged and ruled among the games", () => {
  createGame(db, { ...details("Elden Ring"), score: 96, DLCs: [{ ...details("Shadow of the Erdtree"), score: 94 }] });
  createGame(db, { ...details("Witcher 3"), score: 92, DLCs: [{ ...details("Blood and Wine"), score: 98 }, { ...details("Hearts of Stone"), score: 40 }] });
  const separate = { ...firstPage, separateDlcs: true };

  const byScore = listGames(db, { ...separate, sort: [{ field: "score", direction: "desc" }] });
  expect(byScore.games.map((game) => [game.title, game.parent?.title ?? null])).toEqual([
    ["Blood and Wine", "Witcher 3"],
    ["Elden Ring", null],
    ["Shadow of the Erdtree", "Elden Ring"],
    ["Witcher 3", null],
    ["Hearts of Stone", "Witcher 3"],
  ]);
  expect(byScore.games.every((game) => game.DLCs.length === 0)).toBe(true);
  expect(byScore.total).toBe(5);
  expect(byScore.counts).toEqual({ games: 2, dlcs: 3 });

  // Paging counts DLCs too
  expect(listGames(db, { ...separate, page: 1, pageSize: 2 }).games.map((game) => game.title)).toEqual(["Hearts of Stone", "Shadow of the Erdtree"]);
  // A DLC matches on its own title, or on its game's
  expect(listGames(db, { ...separate, search: "erdtree" }).games.map((game) => game.title)).toEqual(["Shadow of the Erdtree"]);
  expect(listGames(db, { ...separate, search: "witcher" }).games.map((game) => game.title).sort()).toEqual(["Blood and Wine", "Hearts of Stone", "Witcher 3"]);
  // Without the option, DLCs stay nested and only games count
  expect(listGames(db, firstPage).games.map((game) => game.title)).toEqual(["Elden Ring", "Witcher 3"]);

  expect(listCheckpoints(db, { kind: "letter", sort: [{ field: "title", direction: "asc" }], separateDlcs: true })).toEqual([
    { label: "B", index: 0, count: 1 },
    { label: "E", index: 1, count: 1 },
    { label: "H", index: 2, count: 1 },
    { label: "S", index: 3, count: 1 },
    { label: "W", index: 4, count: 1 },
  ]);
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

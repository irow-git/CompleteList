import { expect, test } from "vitest";
import { detectSeries, normalizeSeries, suggestSeries, type SeriesGame } from "./series";

let nextId = 0;
const game = (title: string, series: string | null = null, year = 2000): SeriesGame => ({
  id: `g${++nextId}`,
  title,
  series,
  release_date: new Date(Date.UTC(year, 0, 1)),
});

test("normalizes names: single spaces, trimmed, empty is null", () => {
  expect(normalizeSeries("  Final   Fantasy ")).toBe("Final Fantasy");
  expect(normalizeSeries("   ")).toBeNull();
  expect(normalizeSeries(undefined)).toBeNull();
  expect(normalizeSeries(42)).toBeNull();
});

test("unrelated titles suggest nothing", () => {
  expect(suggestSeries("Hollow Knight", [game("Celeste"), game("Dead Cells"), game("Hades")])).toEqual({ kind: "none" });
  // One shared word isn't enough on its own
  expect(suggestSeries("Dead Space", [game("Dead Cells")])).toEqual({ kind: "none" });
});

test("a sequel joins the game it follows: Halo and Halo 2", () => {
  const halo = game("Halo", null, 2001);
  const suggestion = suggestSeries("Halo 2", [halo, game("Hades")]);
  expect(suggestion).toMatchObject({ kind: "auto", candidate: { name: "Halo", existing: false, join: [{ id: halo.id }] } });
});

test("numbered entries share the name without the numeral: Final Fantasy VII and X", () => {
  const seven = game("Final Fantasy VII", null, 1997);
  const ten = game("Final Fantasy X", null, 2001);
  const suggestion = suggestSeries("Final Fantasy XV", [ten, seven]);
  expect(suggestion.kind).toBe("auto");
  if (suggestion.kind !== "auto") return;
  expect(suggestion.candidate.name).toBe("Final Fantasy");
  expect(suggestion.candidate.join.map((joined) => joined.id).sort()).toEqual([seven.id, ten.id].sort());
});

test("the name is spelled as in the oldest title, punctuation and article included", () => {
  const asylum = game("Batman: Arkham Asylum", null, 2009);
  const city = game("Batman: Arkham City", null, 2011);
  expect(suggestSeries("Batman: Arkham Knight", [city, asylum])).toMatchObject({ kind: "auto", candidate: { name: "Batman: Arkham" } });
  expect(suggestSeries("Witcher 3", [game("The Witcher", null, 2007)])).toMatchObject({ kind: "auto", candidate: { name: "The Witcher" } });
  // The game being placed counts too, when it's the oldest
  const release = new Date(Date.UTC(2007, 0, 1));
  expect(suggestSeries("The Witcher", [game("Witcher 3", null, 2015)], release)).toMatchObject({ candidate: { name: "The Witcher" } });
  const { assigned } = detectSeries([game("Witcher 3", null, 2015), game("The Witcher", null, 2007)]);
  expect([...new Set(assigned.values())]).toEqual(["The Witcher"]);
});

test("joins an existing series its title starts with", () => {
  const ocarina = game("Ocarina of Time", "Zelda");
  expect(suggestSeries("Zelda II", [ocarina])).toMatchObject({
    kind: "auto",
    candidate: { name: "Zelda", existing: true, members: [{ id: ocarina.id }], join: [] },
  });
});

test("a match already in a series offers that series", () => {
  const origins = game("Assassin's Creed Origins", "Assassin's Creed");
  expect(suggestSeries("Assassins Creed Odyssey", [origins])).toMatchObject({
    kind: "auto",
    candidate: { name: "Assassin's Creed", existing: true },
  });
});

test("matches in a different series than the new prefix are left to the user", () => {
  const city = game("Batman: Arkham City", "Arkham");
  const asylum = game("Batman: Arkham Asylum");
  const suggestion = suggestSeries("Batman: Arkham Knight", [city, asylum]);
  expect(suggestion.kind).toBe("ambiguous");
  if (suggestion.kind !== "ambiguous") return;
  expect(suggestion.candidates.map((candidate) => candidate.name).sort()).toEqual(["Arkham", "Batman: Arkham"]);
});

test("nested prefixes are left to the user: Star Wars or Star Wars Jedi", () => {
  const suggestion = suggestSeries("Star Wars Jedi: Survivor", [game("Star Wars Jedi: Fallen Order"), game("Star Wars Battlefront")]);
  expect(suggestion.kind).toBe("ambiguous");
  if (suggestion.kind !== "ambiguous") return;
  expect(suggestion.candidates.map((candidate) => candidate.name).sort()).toEqual(["Star Wars", "Star Wars Jedi"]);
});

test("a single common word shared by several titles is only offered, never applied", () => {
  const suggestion = suggestSeries("Super Mario Odyssey", [game("Super Meat Boy"), game("Super Hexagon")]);
  expect(suggestion).toMatchObject({ kind: "ambiguous", candidates: [{ name: "Super", strong: false }] });
  // ...and doesn't drag an existing series in either
  expect(suggestSeries("Super Mario Odyssey", [game("Super Meat Boy", "Meat Boy"), game("Super Hexagon")])).toMatchObject({
    kind: "ambiguous",
  });
});

test("detection assigns clear matches and leaves unclear ones for the user", () => {
  const halo = game("Halo", null, 2001);
  const halo2 = game("Halo 2", null, 2004);
  const halo3 = game("Halo 3", null, 2007);
  const jedi = game("Star Wars Jedi: Fallen Order", null, 2019);
  const battlefront = game("Star Wars Battlefront", null, 2015);
  const survivor = game("Star Wars Jedi: Survivor", null, 2023);
  const celeste = game("Celeste");
  const { assigned, unclear } = detectSeries([halo3, celeste, halo, survivor, halo2, jedi, battlefront]);

  expect(assigned.get(halo.id)).toBe("Halo");
  expect(assigned.get(halo2.id)).toBe("Halo");
  expect(assigned.get(halo3.id)).toBe("Halo");
  expect(assigned.has(celeste.id)).toBe(false);
  // Survivor could be "Star Wars" or "Star Wars Jedi", so none of the three is decided for the user, whichever comes first.
  // The ones with a real choice to make are asked about first
  expect([...unclear].sort()).toEqual([battlefront.id, jedi.id, survivor.id].sort());
  expect(unclear.indexOf(battlefront.id)).toBe(2);
});

test("a series named more specifically than the shared words is offered, not applied", () => {
  // "Star Wars Battlefront" shares only "Star Wars" with the games of "Star Wars Jedi"
  const suggestion = suggestSeries("Star Wars Battlefront", [
    game("Star Wars Jedi: Fallen Order", "Star Wars Jedi"),
    game("Star Wars Jedi: Survivor", "Star Wars Jedi"),
  ]);
  expect(suggestion).toMatchObject({ kind: "ambiguous", candidates: [{ name: "Star Wars Jedi", strong: false }] });
  // A series named differently from the titles is the user's choice of name, and still clear
  expect(suggestSeries("Batman: Arkham Knight", [game("Batman: Arkham City", "Arkham")])).toMatchObject({
    kind: "auto",
    candidate: { name: "Arkham" },
  });
});

// Series: a base game can belong to one, by name. Games without one sort as a series of their own (their title), so a
// title sort ties the games of a series together and the next sort (release date by default) orders them.
//
// When a game is added, its series is guessed from the titles already in the collection: titles are split into words,
// the new title's longest common word prefix with every other title is a candidate, and how many titles share a
// candidate decides how much it's trusted. One clear candidate is applied as is; anything else is left to the user.

const MAX_SERIES_LENGTH = 200;

// A series name as stored: single spaces, trimmed, null when empty
export function normalizeSeries(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim().slice(0, MAX_SERIES_LENGTH);
  return name || null;
}

// Series names are compared ignoring case, like the database does (collate nocase)
export const seriesKey = (name: string) => name.toLocaleLowerCase();
export const sameSeries = (a: string | null | undefined, b: string | null | undefined) =>
  a != null && b != null && seriesKey(a) === seriesKey(b);

interface Token {
  key: string; // lowercased, apostrophes dropped ("Assassin's" → "assassins")
  start: number; // where it is in the title, so a series name can be cut out of it with the original spelling
  end: number;
}

interface Tokenized {
  tokens: Token[];
  articleStart: boolean; // the title starts with "The " or "A ", which is left out of the tokens
}

const LEADING_ARTICLE = /^\s*(the|a)\s+/i;

// Words of a title, without a leading article. Punctuation (":", "-", "&"...) separates words and is otherwise ignored
export function tokenize(title: string): Tokenized {
  const article = LEADING_ARTICLE.exec(title);
  const offset = article ? article[0].length : 0;
  const tokens: Token[] = [];
  for (const match of title.slice(offset).matchAll(/[\p{L}\p{N}'’]+/gu)) {
    const key = match[0].replace(/['’]/g, "").toLocaleLowerCase();
    if (!key) continue;
    const start = offset + match.index!;
    tokens.push({ key, start, end: start + match[0].length });
  }
  return { tokens, articleStart: article !== null };
}

// Words a series name never ends with
const STOP_WORDS = new Set(["of", "the", "a", "an", "and", "in", "on", "to", "for", "vs"]);
// Numbers and roman numerals (up to 20) mark sequels: "Halo 2", "Final Fantasy VII", "FIFA 2020"
const SEQUEL_MARKER = /^(\d+|i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xvi{0,3}|xix|xx|v|x)$/;
const isSequelMarker = (key: string) => SEQUEL_MARKER.test(key);

// Words in a title once sequel markers at its end are dropped: "Halo 2" is "halo", like "Halo"
const coreLength = (tokens: Token[]) => {
  let length = tokens.length;
  while (length > 0 && isSequelMarker(tokens[length - 1].key)) length--;
  return length;
};

// How many leading words two titles share, without stop words or sequel markers left dangling at the end
// ("Final Fantasy VII" and "Final Fantasy X" share "final fantasy")
function sharedPrefixLength(a: Token[], b: Token[]) {
  let length = 0;
  while (length < a.length && length < b.length && a[length].key === b[length].key) length++;
  while (length > 0 && (STOP_WORDS.has(a[length - 1].key) || isSequelMarker(a[length - 1].key))) length--;
  return length;
}

const startsWith = (tokens: Token[], prefix: Token[]) =>
  prefix.length > 0 && prefix.length <= tokens.length && prefix.every((token, index) => tokens[index].key === token.key);

// A one-word prefix has to be this long and shared by this many titles (the new one included) to be offered at all,
// and is never applied without asking
const WEAK_MIN_LETTERS = 4;
const WEAK_MIN_TITLES = 3;

export interface SeriesGame {
  id: string;
  title: string;
  series: string | null;
  release_date?: Date | null;
}

export interface SeriesCandidate {
  name: string;
  // Already a series in the collection (as opposed to one this would start)
  existing: boolean;
  // Its games right now
  members: { id: string; title: string }[];
  // Games without a series that would join it along with the new one
  join: { id: string; title: string }[];
  // Weak candidates (a single short or common word) are only ever offered, never applied on their own
  strong: boolean;
}

export type SeriesSuggestion =
  | { kind: "none" }
  | { kind: "auto"; candidate: SeriesCandidate }
  | { kind: "ambiguous"; candidates: SeriesCandidate[] };

const byRelease = (a: SeriesGame, b: SeriesGame) =>
  (a.release_date?.getTime() ?? Infinity) - (b.release_date?.getTime() ?? Infinity) || a.title.localeCompare(b.title);

// The first `length` words of a title, as spelled there. A leading article is kept ("The Witcher"); the sort ignores it
function nameFrom(title: string, { tokens, articleStart }: Tokenized, length: number) {
  const start = articleStart ? title.search(/\S/) : tokens[0].start;
  return normalizeSeries(title.slice(start, tokens[length - 1].end))!;
}

// Which series a game called `title` (released on `release`) most likely belongs to, given the other base games
export function suggestSeries(title: string, others: SeriesGame[], release: Date | null = null): SeriesSuggestion {
  const own = tokenize(title);
  if (own.tokens.length === 0) return { kind: "none" };

  const games = others.map((game) => ({ game, tokenized: tokenize(game.title) })).filter(({ tokenized }) => tokenized.tokens.length > 0);
  const candidates = new Map<string, SeriesCandidate>();
  const membersOf = (series: string) =>
    games.filter(({ game }) => sameSeries(game.series, series)).map(({ game }) => ({ id: game.id, title: game.title }));
  // An existing series is as trustworthy as the prefix that led to it
  const addExisting = (series: string, strong: boolean) => {
    const key = seriesKey(series);
    const candidate = candidates.get(key);
    if (candidate) candidate.strong ||= strong;
    else candidates.set(key, { name: series, existing: true, members: membersOf(series), join: [], strong });
  };

  // A series whose name the title starts with ("Zelda II" and a series called "Zelda")
  for (const series of new Set(games.flatMap(({ game }) => (game.series ? [game.series] : [])))) {
    if (startsWith(own.tokens, tokenize(series).tokens)) addExisting(series, true);
  }

  // Every prefix the title shares with another title, by length. Prefixes are all of this title, so they nest
  const lengths = new Set(games.map(({ tokenized }) => sharedPrefixLength(own.tokens, tokenized.tokens)).filter((length) => length > 0));
  for (const length of lengths) {
    const prefix = own.tokens.slice(0, length);
    const matches = games.filter(({ tokenized }) => startsWith(tokenized.tokens, prefix));
    const wholeTitle = coreLength(own.tokens) === length || matches.some(({ tokenized }) => coreLength(tokenized.tokens) === length);
    const strong = length >= 2 || wholeTitle;
    const weak = !strong && prefix[0].key.length >= WEAK_MIN_LETTERS && matches.length + 1 >= WEAK_MIN_TITLES;
    if (!strong && !weak) continue;

    // Games already in a series offer that series; the rest could start (or join) one named after the prefix. A series
    // named more specifically than what the titles share ("Star Wars Jedi", when only "Star Wars" is shared) is only
    // offered: the title may well belong to a wider series
    for (const { game } of matches) {
      if (!game.series) continue;
      const seriesTokens = tokenize(game.series).tokens;
      const moreSpecific = seriesTokens.length > length && startsWith(seriesTokens, prefix);
      addExisting(game.series, strong && !moreSpecific);
    }
    const loose = matches.filter(({ game }) => !game.series).map(({ game }) => game);
    if (loose.length === 0) continue;
    // Named after the oldest game, this one included: "The Witcher" rather than "Witcher" from "Witcher 3"
    const oldest = [...loose, { id: "", title, series: null, release_date: release }].sort(byRelease)[0];
    const name = nameFrom(oldest.title, tokenize(oldest.title), length);
    const join = loose.map((game) => ({ id: game.id, title: game.title }));
    const existing = candidates.get(seriesKey(name));
    if (existing) {
      existing.join.push(...join.filter((game) => !existing.join.some((joined) => joined.id === game.id)));
      existing.strong ||= strong;
    } else {
      candidates.set(seriesKey(name), { name, existing: false, members: [], join, strong });
    }
  }

  const list = [...candidates.values()].sort(
    (a, b) => b.members.length + b.join.length - (a.members.length + a.join.length) || b.name.length - a.name.length
  );
  if (list.length === 0) return { kind: "none" };
  if (list.length === 1 && list[0].strong) return { kind: "auto", candidate: list[0] };
  return { kind: "ambiguous", candidates: list };
}

// Which games to look at again when detecting series over the whole collection: every base game without a series, the
// ones a clear match was found for already assigned (in `assigned`, by id) as the loop goes, so later games see them
export function detectSeries(games: SeriesGame[]): { assigned: Map<string, string>; unclear: string[] } {
  const current = games.map((game) => ({ ...game }));
  const byId = new Map(current.map((game) => [game.id, game]));
  const assigned = new Map<string, string>();
  const unclear: string[] = [];
  for (const game of [...current].sort(byRelease)) {
    if (game.series) continue;
    const suggestion = suggestSeries(
      game.title,
      current.filter((other) => other.id !== game.id),
      game.release_date
    );
    if (suggestion.kind === "ambiguous") unclear.push(game.id);
    if (suggestion.kind !== "auto") continue;
    const { name, join } = suggestion.candidate;
    // Only clear if it's clear from every game it pulls in too, or the order games are looked at would decide:
    // "Star Wars Battlefront" sees one "Star Wars" series, "Star Wars Jedi: Survivor" also sees "Star Wars Jedi"
    const clearForAll = join.every(
      (joined) =>
        suggestSeries(
          joined.title,
          current.filter((other) => other.id !== joined.id),
          byId.get(joined.id)!.release_date
        ).kind !== "ambiguous"
    );
    if (!clearForAll) {
      unclear.push(game.id);
      continue;
    }
    for (const id of [game.id, ...join.map((joined) => joined.id)]) {
      byId.get(id)!.series = name;
      assigned.set(id, name);
    }
  }
  // A game left unclear early may have been put in a series by a later, clear match. The rest are asked about with the
  // most candidates first: that's where the real choice is ("Star Wars" or "Star Wars Jedi"), and answering it often
  // settles the others
  const choices = (id: string) => {
    const game = byId.get(id)!;
    const suggestion = suggestSeries(
      game.title,
      current.filter((other) => other.id !== id),
      game.release_date
    );
    return suggestion.kind === "ambiguous" ? suggestion.candidates.length : 1;
  };
  const left = unclear.filter((id) => !assigned.has(id)).map((id) => ({ id, choices: choices(id) }));
  return { assigned, unclear: left.sort((a, b) => b.choices - a.choices).map(({ id }) => id) };
}

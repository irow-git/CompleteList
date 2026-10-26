// A title without a leading "The " or "A ", which is how titles are sorted and grouped ("The Witcher 3" goes under W).
// The database does the same in SQL (sortableTitle in electron/db/games.ts)
export const titleWithoutArticle = (title: string) => title.trim().replace(/^(the|a)\s+/i, "");

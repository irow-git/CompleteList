import { and, asc, eq, isNull } from "drizzle-orm";
import type { SelectItem, SelectList } from "../../src/interfaces";
import { DEFAULT_SELECT_ITEMS, isSelectList, normalizeSelectItem, SELECT_LISTS, selectItemId } from "../../src/lib/selectItems";
import type { Db } from ".";
import { selectItems } from "./schema";

// Both dropdowns' options: the built-in ones first, then the added ones in the order they were added
export function listSelectItems(db: Db): Record<SelectList, SelectItem[]> {
  const rows = db.select().from(selectItems).where(isNull(selectItems.deleted_at)).orderBy(asc(selectItems.created_at), asc(selectItems.id)).all();
  const lists = Object.fromEntries(
    SELECT_LISTS.map((list) => [list, DEFAULT_SELECT_ITEMS[list].map((value) => ({ id: selectItemId(list, value), value, removable: false }))])
  ) as Record<SelectList, SelectItem[]>;
  for (const row of rows) {
    if (isSelectList(row.list)) lists[row.list].push({ id: row.id, value: row.value, removable: true });
  }
  return lists;
}

// Adds options to a list, in order, or brings back removed ones. Values the list already has (ignoring case) are
// skipped, so importing the same options twice changes nothing
export function addSelectItems(db: Db, list: SelectList, values: string[]) {
  if (!isSelectList(list)) throw new Error(`Unknown list: ${String(list)}`);
  const now = Date.now();
  db.transaction((tx) => {
    const taken = new Set([
      ...DEFAULT_SELECT_ITEMS[list].map((value) => value.toLocaleUpperCase()),
      ...tx
        .select({ value: selectItems.value })
        .from(selectItems)
        .where(and(eq(selectItems.list, list), isNull(selectItems.deleted_at)))
        .all()
        .map((row) => row.value.toLocaleUpperCase()),
    ]);
    values.forEach((raw, index) => {
      const value = normalizeSelectItem(String(raw));
      if (!value || taken.has(value.toLocaleUpperCase())) return;
      taken.add(value.toLocaleUpperCase());
      // A millisecond apart, so options added together keep their order
      const at = new Date(now + index);
      const row = { list, value, created_at: at, updated_at: at, deleted_at: null, dirty: true };
      tx.insert(selectItems)
        .values({ id: selectItemId(list, value), ...row })
        .onConflictDoUpdate({ target: selectItems.id, set: row })
        .run();
    });
  });
}

// Removes an added option. It stays as a tombstone, so the removal reaches the other computers
export function removeSelectItem(db: Db, id: string) {
  const now = new Date();
  db.update(selectItems)
    .set({ deleted_at: now, updated_at: now, dirty: true })
    .where(and(eq(selectItems.id, String(id)), isNull(selectItems.deleted_at)))
    .run();
}

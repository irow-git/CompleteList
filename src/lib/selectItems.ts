import type { SelectList } from "../interfaces";

export const SELECT_LISTS: readonly SelectList[] = ["platform", "tags"];

export const isSelectList = (value: unknown): value is SelectList => SELECT_LISTS.includes(value as SelectList);

// Every computer offers these; they're never stored or synced, and can't be removed
export const DEFAULT_SELECT_ITEMS: Record<SelectList, readonly string[]> = {
  platform: ["PC", "Mobile"],
  tags: ["Tough to beat", "Hardest Difficulty"],
};

export const MAX_SELECT_ITEM_LENGTH = 50;

// Also the Firestore document id, so the value is encoded: ids can't contain "/"
export const selectItemId = (list: SelectList, value: string) => `${list}:${encodeURIComponent(value)}`;

// What an added option is stored as; empty if there's nothing to add
export const normalizeSelectItem = (value: string) => value.trim().slice(0, MAX_SELECT_ITEM_LENGTH);

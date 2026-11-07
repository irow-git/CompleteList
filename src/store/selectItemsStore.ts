import { create } from "zustand";
import { SelectItem, SelectList } from "../interfaces";
import { DEFAULT_SELECT_ITEMS, SELECT_LISTS, selectItemId } from "@/lib/selectItems";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useSyncStore } from "./syncStore";

// Where earlier versions kept the added options, on this computer only: [{ key, value }], keys 1 and 2 being the
// built-in ones. They're moved into the database once, so they sync from then on
const LEGACY_KEYS: Record<SelectList, string> = { platform: "platform-items", tags: "tag-items" };
const LAST_LEGACY_DEFAULT_KEY = 2;

async function importLegacyItems() {
  for (const list of SELECT_LISTS) {
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(LEGACY_KEYS[list]) ?? "null");
    } catch {
      saved = null;
    }
    if (Array.isArray(saved)) {
      const values = saved
        .filter((item) => typeof item?.value === "string" && !(typeof item.key === "number" && item.key <= LAST_LEGACY_DEFAULT_KEY))
        .map((item) => item.value as string);
      if (values.length > 0) await window.api.selectItems.add(list, values);
    }
    try {
      localStorage.removeItem(LEGACY_KEYS[list]);
    } catch {
      // Nothing to clean up then
    }
  }
}

const builtIn = () =>
  Object.fromEntries(
    SELECT_LISTS.map((list) => [list, DEFAULT_SELECT_ITEMS[list].map((value) => ({ id: selectItemId(list, value), value, removable: false }))])
  ) as Record<SelectList, SelectItem[]>;

interface SelectItemsState {
  // The built-in options until the stored ones are loaded
  items: Record<SelectList, SelectItem[]>;
  error?: string;

  load(): Promise<void>;
  add(list: SelectList, value: string): Promise<void>;
  remove(id: string): Promise<void>;
}

let imported: Promise<void> | null = null;
let loading: Promise<void> | null = null;

export const useSelectItemsStore = create<SelectItemsState>()((set) => {
  const fetchItems = async () => {
    try {
      set({ items: await window.api.selectItems.list() });
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    }
  };

  // Every change also refreshes the sync status, whose count of unsynced changes it just moved
  const change = async (action: () => Promise<void>) => {
    set({ error: undefined });
    try {
      await action();
    } catch (error) {
      set({ error: ipcErrorMessage(error) });
    }
    await Promise.all([fetchItems(), useSyncStore.getState().refresh()]);
  };

  return {
    items: builtIn(),

    // Several forms load at once (a game's and its DLCs'), so they share one request
    load: () =>
      (loading ??= (async () => {
        try {
          await (imported ??= importLegacyItems().catch((error) => {
            imported = null; // tried again next time
            throw error;
          }));
        } catch (error) {
          set({ error: ipcErrorMessage(error) });
        }
        await fetchItems();
      })().finally(() => {
        loading = null;
      })),

    add: (list, value) => change(() => window.api.selectItems.add(list, [value])),
    remove: (id) => change(() => window.api.selectItems.remove(id)),
  };
});

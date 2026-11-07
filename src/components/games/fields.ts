import { SortableField } from "@/interfaces";

// Display names for the game fields, shared by the table headers and the card view's sort menu
export const FIELD_LABELS: Record<SortableField, string> = {
  title: "Title",
  platform: "Platform",
  original_copy: "Original",
  free_to_play: "Free",
  completion: "Completion Type",
  release_date: "Release Date",
  last_completion: "Last Completion",
  score: "Score",
  hours: "Hours",
};

// The sort menu's names: the title sort orders by series (a game without one by its title), see electron/db/games.ts
export const SORT_LABELS: Record<SortableField, string> = { ...FIELD_LABELS, title: "Series / Title" };

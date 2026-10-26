import { useShallow } from "zustand/react/shallow";
import { useGamesStore } from "@/store/gamesStore";
import { SearchBox } from "./SearchBox";
import { SortMenu } from "./SortMenu";
import { SyncIndicator } from "./SyncIndicator";
import { forwardRef } from "react";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The controls above the table and card views: collection totals, sync status, sorting and search
export const GameListToolbar = forwardRef<HTMLDivElement>((_, ref) => {
  const { counts, total, search } = useGamesStore(useShallow(({ counts, total, search }) => ({ counts, total, search })));

  return (
    <div ref={ref} className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-chava text-base">
      <span className="font-pixel text-sm">
        {plural(counts.games, "game")} · {plural(counts.dlcs, "DLC")}
        {search && <span className="text-black/55"> · {total} matching</span>}
      </span>
      <SyncIndicator />
      <div className="ml-auto flex items-center gap-4">
        <SortMenu />
        <SearchBox />
      </div>
    </div>
  );
});

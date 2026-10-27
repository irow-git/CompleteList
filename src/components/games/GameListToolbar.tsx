import { useShallow } from "zustand/react/shallow";
import { useGamesStore } from "@/store/gamesStore";
import { SearchBox } from "./SearchBox";
import { SortMenu } from "./SortMenu";
import { SyncIndicator } from "./SyncIndicator";
import { Checkbox } from "@/components/ui/checkbox";
import { forwardRef } from "react";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The controls above the table and card views: collection totals, sync status, whether DLCs are listed on their own,
// sorting and search
// `controls` are extra view-specific ones, shown before the sort menu (e.g. the card view's size slider)
export const GameListToolbar = forwardRef<HTMLDivElement, { controls?: React.ReactNode }>(({ controls }, ref) => {
  const { counts, total, search, separateDlcs, setSeparateDlcs } = useGamesStore(
    useShallow(({ counts, total, search, separateDlcs, setSeparateDlcs }) => ({ counts, total, search, separateDlcs, setSeparateDlcs }))
  );

  return (
    <div ref={ref} className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-chava text-base">
      <span className="font-pixel text-sm">
        {plural(counts.games, "game")} · {plural(counts.dlcs, "DLC")}
        {search && <span className="text-black/55"> · {total} matching</span>}
      </span>
      <SyncIndicator />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
        {controls}
        <div className="flex items-center gap-2" title="List each DLC as an entry of its own, among the games">
          <div className="drop-shadow-[0px_1px_1px_black]">
            <Checkbox id="separate-dlcs" checked={separateDlcs} onCheckedChange={(checked) => setSeparateDlcs(checked === true)} />
          </div>
          <label htmlFor="separate-dlcs" className="cursor-pointer">
            Group by DLC
          </label>
        </div>
        <SortMenu />
        <SearchBox />
      </div>
    </div>
  );
});

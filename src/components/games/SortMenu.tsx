import { useShallow } from "zustand/react/shallow";
import { ChevronDown, ChevronUp, SortVertical } from "pixelarticons/react";
import { GameSort, SortableField } from "@/interfaces";
import { useGamesStore } from "@/store/gamesStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_LABELS } from "./fields";

// Clicking a field cycles it: added ascending (at the end of the list) → descending → removed
const toggle = (sort: GameSort[], field: SortableField): GameSort[] => {
  const current = sort.find((entry) => entry.field === field);
  if (!current) return [...sort, { field, direction: "asc" }];
  if (current.direction === "asc") return sort.map((entry) => (entry.field === field ? { field, direction: "desc" } : entry));
  return sort.filter((entry) => entry.field !== field);
};

// Picks one or more fields to sort by; they apply in the order they were picked
export const SortMenu: React.FC = () => {
  const { sort, setSort } = useGamesStore(useShallow(({ sort, setSort }) => ({ sort, setSort })));

  return (
    <Popover>
      <div className="drop-shadow-[0px_1px_1px_black]">
        <PopoverTrigger className={cn(buttonVariants({ size: "lg" }), "form-control-clip-large min-w-[120px]")}>
          <SortVertical className="size-6" />
          Sort
          {sort.length > 0 && <span className="bg-white px-1.5 font-pixel text-xs leading-5 text-ink">{sort.length}</span>}
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-64 rounded-none border-0 bg-ink p-2 font-chava text-white option-clip">
        <ul>
          {(Object.keys(FIELD_LABELS) as SortableField[]).map((field) => {
            const index = sort.findIndex((entry) => entry.field === field);
            const direction = sort[index]?.direction;
            return (
              <li key={field}>
                <button
                  type="button"
                  aria-pressed={index >= 0}
                  onClick={() => setSort(toggle(sort, field))}
                  className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left hover:bg-sand"
                >
                  <span className="w-5 font-pixel text-xs text-white">{index >= 0 ? index + 1 : ""}</span>
                  <span className="flex-auto">{FIELD_LABELS[field]}</span>
                  {direction === "asc" && <ChevronUp className="size-6" aria-label="ascending" />}
                  {direction === "desc" && <ChevronDown className="size-6" aria-label="descending" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-sand px-2 pt-2 text-sm text-black/55">
          <button
            type="button"
            disabled={sort.length === 0}
            onClick={() => setSort([])}
            className="cursor-pointer text-white hover:underline disabled:cursor-default disabled:opacity-30 disabled:hover:no-underline"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

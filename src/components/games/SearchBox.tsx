import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Close, Search } from "pixelarticons/react";
import { useGamesStore } from "@/store/gamesStore";
import { Input } from "@/components/ui/input";
import { RemoveButton } from "@/components/ui/remove-button";

const SEARCH_DELAY_MS = 500;

export const SearchBox: React.FC = () => {
  const { search, setSearch, seriesFilter, setSeriesFilter } = useGamesStore(
    useShallow(({ search, setSearch, seriesFilter, setSeriesFilter }) => ({ search, setSearch, seriesFilter, setSeriesFilter }))
  );
  const [text, setText] = useState(search);

  // A search set from elsewhere (the series screen clears it) replaces what's typed, instead of being typed back over
  const typed = useRef(search);
  useEffect(() => {
    if (search !== typed.current) {
      typed.current = search;
      setText(search);
    }
  }, [search]);

  // Search once typing pauses rather than on every keystroke
  useEffect(() => {
    if (text === search) return;
    const timer = setTimeout(() => {
      typed.current = text;
      setSearch(text);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, search, setSearch]);

  return (
    <div className="relative w-[360px] drop-shadow-[0px_1px_1px_black]">
      {/* Above the field, in the toolbar's spare space, so it doesn't push the other controls around */}
      {seriesFilter && (
        <div className="absolute bottom-full left-0 mb-2 max-w-full">
          <span
            title={`Only the games of ${seriesFilter}`}
            className="form-control-clip-small flex items-center gap-1.5 bg-ink py-0.5 pr-1.5 pl-2 text-white"
          >
            <span className="font-pixel text-[10px] text-white/65 uppercase">Series</span>
            <span className="min-w-0 truncate font-chava text-sm">{seriesFilter}</span>
            <button
              type="button"
              aria-label={`Show all series, not only ${seriesFilter}`}
              onClick={() => setSeriesFilter(null)}
              className="flex shrink-0 cursor-pointer items-center text-white/65 hover:text-white"
            >
              <Close className="size-4" />
            </button>
          </span>
        </div>
      )}
      {/* z-10: the input's clip-path puts it on its own layer, which would otherwise paint over the icon */}
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-6 -translate-y-1/2 text-black/45" />
      <Input
        type="search"
        size="lg"
        aria-label="Search games"
        placeholder={seriesFilter ? `Search ${seriesFilter}` : "Search games"}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setText("");
          // Backspace with nothing typed takes the tag off, like removing the last tag of a tag input
          if (event.key === "Backspace" && !text && seriesFilter) setSeriesFilter(null);
        }}
        className="form-control-clip-large pr-10 pl-12 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <RemoveButton
          size="lg"
          aria-label="Clear search"
          className="absolute top-1/2 right-4 -translate-y-1/2"
          onClick={() => setText("")}
        />
      )}
    </div>
  );
};

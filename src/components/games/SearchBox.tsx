import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Search } from "pixelarticons/react";
import { useGamesStore } from "@/store/gamesStore";
import { Input } from "@/components/ui/input";
import { RemoveButton } from "@/components/ui/remove-button";

const SEARCH_DELAY_MS = 250;

export const SearchBox: React.FC = () => {
  const { search, setSearch } = useGamesStore(useShallow(({ search, setSearch }) => ({ search, setSearch })));
  const [text, setText] = useState(search);

  // Search once typing pauses rather than on every keystroke
  useEffect(() => {
    if (text === search) return;
    const timer = setTimeout(() => setSearch(text), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, search, setSearch]);

  return (
    <div className="relative w-[360px] drop-shadow-[0px_1px_1px_black]">
      {/* z-10: the input's clip-path puts it on its own layer, which would otherwise paint over the icon */}
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-6 -translate-y-1/2 text-black/45" />
      <Input
        type="search"
        size="lg"
        aria-label="Search games"
        placeholder="Search games"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setText("")}
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Plus, Search } from "pixelarticons/react";
import type { SeriesSummary } from "@/interfaces";
import type { SeriesCandidate } from "@/lib/series";
import { useGamesStore } from "@/store/gamesStore";
import { useSyncStore } from "@/store/syncStore";
import { Cover, coverColor } from "@/components/games/Cover";
import { coverGlowColor, vividHex } from "@/lib/coverColor";
import { SyncIndicator } from "@/components/games/SyncIndicator";
import { SeriesChoice, SeriesChoiceDialog } from "@/components/SeriesChoiceDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RemoveButton } from "@/components/ui/remove-button";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;

// The collage's shape (width / height), and how much of its height a cover takes. Covers keep their 2:3 shape
const COLLAGE_RATIO = 16 / 9;
const COVER_HEIGHT = 0.86;
const COVER_WIDTH = ((COVER_HEIGHT * 2) / 3 / COLLAGE_RATIO) * 100; // in % of the collage's width
// Two covers sit side by side, with a gap between them. From three on they overlap, at least a little
const PAIR_GAP = 3;
const MAX_STEP = COVER_WIDTH * 0.82;
const SIDE_MARGIN = 3;
// Hovering a cover (mouse or pen; touch gets none of this) brings it to the front, lifts it and makes it glow, and the
// covers either side of it move this far apart (in % of the collage's width), at most
const SPREAD = 6;

// Where each of `count` covers goes, left to right, in the order the games are listed: the first at the left edge,
// the second at the right, then the middle outwards, the third on top in the middle and the fourth just beneath it.
// Covers nearer the middle sit higher, so the stack peaks there
function collageSlots(count: number) {
  const center = (count - 1) / 2;
  const middleOut = Array.from({ length: count }, (_, slot) => slot)
    .filter((slot) => count < 3 || (slot !== 0 && slot !== count - 1))
    .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
  const order = count < 3 ? middleOut : [0, count - 1, ...middleOut];

  const step =
    count === 2 ? COVER_WIDTH + PAIR_GAP : count > 2 ? Math.min(MAX_STEP, (100 - COVER_WIDTH - 2 * SIDE_MARGIN) / (count - 1)) : 0;
  const start = (100 - (COVER_WIDTH + step * (count - 1))) / 2;
  const spread = count > 2 ? Math.min(SPREAD, step * 0.6) : 0;
  return order.map((slot, index) => ({
    slot,
    left: start + step * slot,
    spread,
    // Closer to the middle is higher; between two equally close, the game listed first
    zIndex: Math.round((count - Math.abs(slot - center)) * 2) * 10 - index,
  }));
}

// The colour a hovered cover glows in: the cover's own most vivid colour (sampled once, as for the cards' glow), or the
// placeholder's. Only worked out once the cover is first hovered
function useGlowColor(game: SeriesSummary["games"][number], active: boolean) {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!active || color) return;
    const fallback = vividHex(coverColor(game.title));
    if (!game.cover_image) return setColor(fallback);
    let live = true;
    coverGlowColor(game.id, game.cover_image).then((sampled) => live && setColor(sampled ?? fallback));
    return () => {
      live = false;
    };
  }, [active, color, game.id, game.cover_image, game.title]);
  return color;
}

const CollageCover: React.FC<{
  game: SeriesSummary["games"][number];
  left: number;
  zIndex: number;
  hovered: boolean;
  onHover: () => void;
}> = ({ game, left, zIndex, hovered, onHover }) => {
  const glow = useGlowColor(game, hovered);
  return (
    <div
      onPointerEnter={(event) => event.pointerType !== "touch" && onHover()}
      className={cn(
        "absolute transition-[left,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        hovered ? "-translate-y-[3%] scale-105" : "shadow-[0_0_8px_rgba(0,0,0,0.75)]"
      )}
      style={{
        left: `${left}%`,
        width: `${COVER_WIDTH}%`,
        top: `${((1 - COVER_HEIGHT) / 2) * 100}%`,
        height: `${COVER_HEIGHT * 100}%`,
        // Stacking order can't animate: the hovered cover jumps to the front, and the lift and glow ease it in
        zIndex: hovered ? 1000 : zIndex,
        ...(hovered && glow && { boxShadow: `0 0 14px 3px ${glow}, 0 0 6px rgba(0,0,0,0.75)` }),
      }}
    >
      <Cover owner={game.id} image={game.cover_image} title={game.title} className="size-full" />
    </div>
  );
};

// The first few covers (PREVIEW_GAMES in electron/db/series.ts), fanned out and overlapping. A hovered cover comes to
// the front and the others move aside, staying within the card
const Collage: React.FC<{ games: SeriesSummary["games"] }> = ({ games }) => {
  const slots = collageSlots(games.length);
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredSlot = hovered === null ? null : slots[hovered].slot;
  return (
    <div
      onPointerLeave={() => setHovered(null)}
      className="relative aspect-[16/9] overflow-hidden bg-[linear-gradient(0deg,black_0%,var(--color-ink)_100%)]"
    >
      {games.map((game, index) => {
        const { slot, left, spread, zIndex } = slots[index];
        const away = hoveredSlot === null || slot === hoveredSlot ? 0 : Math.sign(slot - hoveredSlot) * spread;
        return (
          <CollageCover
            key={game.id}
            game={game}
            left={Math.min(Math.max(left + away, 0), 100 - COVER_WIDTH)}
            zIndex={zIndex}
            hovered={index === hovered}
            onHover={() => setHovered(index)}
          />
        );
      })}
    </div>
  );
};

const SeriesCard: React.FC<{ series: SeriesSummary; onOpen: () => void }> = ({ series, onOpen }) => (
  <article className="group relative drop-shadow-[1px_2px_3px_black]">
    <button
      type="button"
      onClick={onOpen}
      title={`Show the games of ${series.name}`}
      className="option-clip flex w-full cursor-pointer flex-col bg-white text-left"
    >
      <Collage games={series.games} />
      <div className="flex items-baseline justify-between gap-3 p-3">
        <h3 className="truncate font-pixel text-sm leading-snug">{series.name}</h3>
        <span className="shrink-0 font-chava text-sm text-black/55">
          {series.count} {series.count === 1 ? "game" : "games"}
        </span>
      </div>
    </button>
    <Link
      to={`/series/edit/${encodeURIComponent(series.name)}`}
      aria-label={`Edit ${series.name}`}
      title="Edit"
      className="absolute top-2 right-2 inline-flex size-[26px] items-center justify-center bg-white leading-none opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-sand"
    >
      <Pencil className="size-6 shrink-0" />
    </Link>
  </article>
);

// Going through the games detection couldn't decide for, one at a time
interface Review {
  queue: string[];
  index: number;
  current: { title: string; candidates: SeriesCandidate[] } | null;
  assigned: number;
}

// Where the series screen was left, so coming back to it (say from a series' games) lands in the same place, like the
// card view. Only for as long as the app runs
const remembered = { search: "", scroll: 0 };

const SeriesView: React.FC = () => {
  const navigate = useNavigate();
  const showSeries = useGamesStore((state) => state.showSeries);
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [text, setText] = useState(remembered.search);
  const [search, setSearch] = useState(remembered.search);
  const root = useRef<HTMLDivElement>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Set once the remembered position has been scrolled back to; until then, scrolling isn't recorded
  const restored = useRef(false);

  // <main> is what scrolls. The position is recorded as it changes, and the listener removed while this page is still
  // there (a layout effect): once it's gone, <main> is scrolled back to the top for the next page
  useLayoutEffect(() => {
    const main = root.current?.closest("main");
    if (!main) return;
    const track = () => {
      if (restored.current) remembered.scroll = main.scrollTop;
    };
    main.addEventListener("scroll", track, { passive: true });
    return () => main.removeEventListener("scroll", track);
  }, []);

  // Back to where it was once the series are there to scroll through
  useLayoutEffect(() => {
    if (restored.current || series === null) return;
    restored.current = true;
    const main = root.current?.closest("main");
    if (main) main.scrollTop = remembered.scroll;
  }, [series]);

  // A new search starts at the top
  useEffect(() => {
    if (search === remembered.search) return;
    remembered.search = search;
    remembered.scroll = 0;
    root.current?.closest("main")?.scrollTo({ top: 0 });
  }, [search]);

  const load = useCallback(() => window.api.series.list(search || undefined).then(setSeries), [search]);
  useEffect(() => {
    load();
  }, [load]);

  // Series changes move games around in the lists and count as unsynced changes
  const afterChange = () => Promise.all([load(), useGamesStore.getState().reload(), useSyncStore.getState().refresh()]);

  // Moves on to the next game that still needs a decision, skipping games that got a series meanwhile (from an earlier
  // pick) or no longer match anything. The rest are always asked about, even when the game on its own now looks
  // clear: detection already found it wasn't clear for every game involved
  const advance = async (queue: string[], start: number, assigned: number) => {
    for (let index = start; index < queue.length; index++) {
      const found = await window.api.series.suggestFor(queue[index]);
      if (!found || found.suggestion.kind === "none") continue;
      const candidates = found.suggestion.kind === "auto" ? [found.suggestion.candidate] : found.suggestion.candidates;
      setReview({ queue, index, assigned, current: { title: found.title, candidates } });
      return;
    }
    setReview(null);
    setMessage(assigned > 0 ? `Done: ${assigned} ${assigned === 1 ? "game" : "games"} put in a series.` : "Done: no new series found.");
    await afterChange();
  };

  const detect = async () => {
    setDetecting(true);
    setMessage(null);
    try {
      const { assigned, unclear } = await window.api.series.detect();
      // The clear ones are saved already: show them while the rest are asked about
      if (assigned > 0) await load();
      await advance(unclear, 0, assigned);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setDetecting(false);
    }
  };

  const choose = async ({ name, joinIds }: SeriesChoice) => {
    if (!review) return;
    const id = review.queue[review.index];
    if (name) await window.api.series.assign([id, ...joinIds], name);
    setReview({ ...review, current: null });
    await advance(review.queue, review.index + 1, review.assigned + (name ? 1 + joinIds.length : 0));
  };

  const open = (name: string) => {
    showSeries(name);
    navigate("/card");
  };

  return (
    <div ref={root}>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-chava text-base">
        <span className="font-pixel text-sm">{series ? `${series.length} series` : ""}</span>
        <SyncIndicator />
        {message && <span className="text-black/55">{message}</span>}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
          <div className="drop-shadow-[0px_1px_1px_black]">
            <Button size="lg" className="form-control-clip-large" disabled={detecting} onClick={detect} title="Look for series among the games that have none">
              {detecting ? "Detecting…" : "Detect series"}
            </Button>
          </div>
          <div className="drop-shadow-[0px_1px_1px_black]">
            <Link to="/series/new" className={cn(buttonVariants({ size: "lg" }), "form-control-clip-large")}>
              <Plus className="size-6" />
              New series
            </Link>
          </div>
          <div className="relative w-[360px] drop-shadow-[0px_1px_1px_black]">
            <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-6 -translate-y-1/2 text-black/45" />
            <Input
              type="search"
              size="lg"
              aria-label="Search series"
              placeholder="Search series"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && setText("")}
              className="form-control-clip-large pr-10 pl-12 [&::-webkit-search-cancel-button]:hidden"
            />
            {text && (
              <RemoveButton size="lg" aria-label="Clear search" className="absolute top-1/2 right-4 -translate-y-1/2" onClick={() => setText("")} />
            )}
          </div>
        </div>
      </div>

      {series?.length === 0 ? (
        <p className="py-12 text-center font-pixel text-sm text-black/45">
          {search ? `No series match "${search}"` : "No series yet. Detect series looks for them among your games."}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-6">
          {series?.map((entry) => (
            <SeriesCard key={entry.name} series={entry} onOpen={() => open(entry.name)} />
          ))}
        </div>
      )}

      <SeriesChoiceDialog
        title={review?.current?.title ?? null}
        candidates={review?.current?.candidates ?? []}
        progress={review ? { index: review.index, total: review.queue.length } : undefined}
        cancelLabel="Skip"
        onCancel={() => {
          if (!review) return;
          setReview({ ...review, current: null });
          advance(review.queue, review.index + 1, review.assigned);
        }}
        onStop={async () => {
          const assigned = review?.assigned ?? 0;
          setReview(null);
          setMessage(`Stopped: ${assigned} ${assigned === 1 ? "game" : "games"} put in a series. Detect again to go on.`);
          await afterChange();
        }}
        onChoose={choose}
      />
    </div>
  );
};

export default SeriesView;

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Plus, Search } from "pixelarticons/react";
import type { SeriesSummary } from "@/interfaces";
import type { SeriesCandidate } from "@/lib/series";
import { useGamesStore } from "@/store/gamesStore";
import { useSyncStore } from "@/store/syncStore";
import { Cover } from "@/components/games/Cover";
import { SeriesChoice, SeriesChoiceDialog } from "@/components/SeriesChoiceDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RemoveButton } from "@/components/ui/remove-button";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;

// Up to four covers on a series card: one fills it, two side by side, three as one big and two small, four in a grid
const Collage: React.FC<{ games: SeriesSummary["games"] }> = ({ games }) => {
  const layout = ["grid-cols-1", "grid-cols-2", "grid-cols-2 grid-rows-2", "grid-cols-2 grid-rows-2"][games.length - 1] ?? "grid-cols-1";
  return (
    <div className={cn("grid aspect-[4/3] gap-0.5 bg-black", layout)}>
      {games.map((game, index) => (
        <Cover
          key={game.id}
          owner={game.id}
          image={game.cover_image}
          title={game.title}
          className={cn("size-full", games.length === 3 && index === 0 && "row-span-2")}
        />
      ))}
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

const SeriesView: React.FC = () => {
  const navigate = useNavigate();
  const showSeries = useGamesStore((state) => state.showSeries);
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

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
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 font-chava text-base">
        <span className="font-pixel text-sm">{series ? `${series.length} series` : ""}</span>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
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

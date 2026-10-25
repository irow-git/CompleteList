import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { IGame } from "../interfaces";
import { useGamesStore } from "../store/gamesStore";
import { GameActions } from "@/components/games/GameActions";
import { GameListToolbar } from "@/components/games/GameListToolbar";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Placeholder covers until games have images: the title's first letter on a colour picked from the title,
// so a game keeps the same colour between visits
const COVER_COLORS = ["#47434d", "#7e768a", "#555559", "#6b5d52", "#4e5b63", "#5f4b57", "#3f5246"];

const coverColor = (title: string) => {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
};

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn("bg-white/90 px-1.5 font-pixel text-[10px] leading-5 text-ink", className)}>{children}</span>
);

const GameCard: React.FC<{ game: IGame }> = ({ game }) => {
  const dlcCount = game.DLCs.length;

  return (
    <article className="group relative drop-shadow-[1px_2px_3px_black]">
      <div className="option-clip flex h-full flex-col bg-white">
        <div
          className="relative aspect-[3/4]"
          style={{ background: `linear-gradient(0deg, black 0%, ${coverColor(game.title)} 100%)` }}
        >
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-pixel text-[96px] text-white/85">
            {game.title.trim().charAt(0).toUpperCase()}
          </span>
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {game.service && <Badge className="text-green-700">Service</Badge>}
            {game.free_to_play && <Badge>Free to play</Badge>}
            {!game.service && game.original_copy && <Badge>Original</Badge>}
          </div>
          {dlcCount > 0 && (
            <Badge className="absolute bottom-2 left-2">
              <span title={game.DLCs.map((dlc) => dlc.title).join("\n")}>+{dlcCount} DLC</span>
            </Badge>
          )}
        </div>

        <div className="flex flex-auto flex-col gap-1 p-3 text-left font-chava text-sm">
          <h3 className="line-clamp-2 font-pixel text-sm leading-snug" title={game.title}>
            {game.title}
          </h3>
          <p className="text-black/55">{game.platform.join(" · ")}</p>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <span>{game.completion}</span>
            {game.release_date && <span className="text-black/55">{formatDay(game.release_date).slice(0, 4)}</span>}
          </div>
          {game.last_completion && <p className="text-black/55">Completed {formatDay(game.last_completion)}</p>}
        </div>
      </div>
      <GameActions
        game={game}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      />
    </article>
  );
};

const CardView: React.FC = () => {
  const { games, total, search, status, infinite, loadFirst, loadMore } = useGamesStore(
    useShallow(({ games, total, search, status, infinite, loadFirst, loadMore }) =>
      ({ games, total, search, status, infinite, loadFirst, loadMore }))
  );
  const sentinel = useRef<HTMLDivElement>(null);

  // The table pages through games one page at a time; this view starts at the top and appends as you scroll
  useEffect(() => {
    if (!infinite) loadFirst();
  }, [infinite, loadFirst]);

  // Load the next page when the end of the list comes within reach. The observer is recreated whenever more games
  // arrive: observing reports the current state right away, so a screen tall enough to show them all keeps loading
  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "600px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [games.length, loadMore]);

  const finished = games.length >= total;

  return (
    <>
      <GameListToolbar />
      {games.length === 0 && status !== "loading" ? (
        <p className="py-12 text-center font-pixel text-sm text-black/45">
          {search ? `No games match "${search}"` : "No games yet"}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="py-6 text-center font-pixel text-sm text-black/45">
        {status === "loading" ? "Loading…" : finished && games.length > 0 ? `That's all ${total}` : null}
      </div>
    </>
  );
};

export default CardView;

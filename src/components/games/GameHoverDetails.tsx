import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GameDetails, IGame } from "@/interfaces";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { formatDay } from "@/lib/dates";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { HIGHLIGHTED_TAGS } from "@/lib/tags";
import { formatHours } from "@/lib/hours";
import { ScoreBadge } from "./ScoreBadge";

// Hovering a card for a moment shows everything about the game and its DLCs. Once a panel is open, moving to another
// card switches it almost at once. The pointer can move into the panel to scroll it (long DLC lists)
const OPEN_DELAY = 500;
const SWITCH_DELAY = 120;
const CLOSE_DELAY = 150;

type HoverProps = { onMouseEnter: (event: React.MouseEvent<HTMLElement>) => void; onMouseLeave: () => void };

const HoverContext = createContext<(game: IGame) => HoverProps>(() => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }));

// Spread onto a card: {...useGameHover()(game)}. The panel sits next to the element marked data-hover-anchor inside it,
// or next to the element itself
export const useGameHover = () => useContext(HoverContext);

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn("bg-white px-1.5 font-pixel text-[10px] leading-5 text-ink", className)}>{children}</span>
);

const Facts: React.FC<{ details: GameDetails }> = ({ details }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
    {details.completion && (
      <>
        <dt className="text-black/55">Completion</dt>
        <dd>{details.completion}</dd>
      </>
    )}
    <dt className="text-black/55">Released</dt>
    <dd>{details.release_date ? formatDay(details.release_date) : "—"}</dd>
    <dt className="text-black/55">Last completed</dt>
    <dd>{details.last_completion ? formatDay(details.last_completion) : "—"}</dd>
    {details.score !== null && (
      <>
        <dt className="text-black/55">Score</dt>
        <dd>
          <ScoreBadge score={details.score} />
        </dd>
      </>
    )}
    {details.hours !== null && (
      <>
        <dt className="text-black/55">Hours played</dt>
        <dd>{formatHours(details.hours)}</dd>
      </>
    )}
  </dl>
);

const Labels: React.FC<{ details: GameDetails }> = ({ details }) => {
  const labels = [details.service && "Service", details.free_to_play && "Free to play", !details.service && details.original_copy && "Original", ...details.tags];
  return labels.some(Boolean) ? (
    <div className="flex flex-wrap gap-1">
      {labels.filter(Boolean).map((label) => (
        <Badge
          key={String(label)}
          className={label === "Service" ? "text-green-700" : HIGHLIGHTED_TAGS.has(String(label)) ? "text-red-700" : undefined}
        >
          {label}
        </Badge>
      ))}
    </div>
  ) : null;
};

const GameDetailsPanel: React.FC<{ game: IGame }> = ({ game }) => (
  <div className="flex flex-col gap-3">
    <div className="flex gap-3">
      {game.cover_image && (
        <img src={imageUrl(game.id, game.cover_image, "thumb")} alt="" className="aspect-[2/3] w-[84px] shrink-0 object-cover" onError={(event) => event.currentTarget.remove()} />
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="font-pixel text-sm leading-snug">{game.title}</h3>
        {game.platform.length > 0 && <p className="text-black/65">{game.platform.join(" · ")}</p>}
        <Labels details={game} />
      </div>
    </div>
    <Facts details={game} />
    {game.comment && <p className="border-l-[3px] border-sand-dark pl-2 whitespace-pre-line">{game.comment}</p>}

    {game.DLCs.length > 0 && (
      <section className="flex flex-col gap-2 border-t-2 border-sand-dark pt-3">
        <h4 className="font-pixel text-xs text-black/55">
          {game.DLCs.length} DLC{game.DLCs.length === 1 ? "" : "s"}
        </h4>
        <ul className="flex flex-col gap-3">
          {game.DLCs.map((dlc) => (
            <li key={dlc.id} className="flex flex-col gap-1">
              <span className="flex items-start justify-between gap-2">
                <span className="font-pixel text-xs leading-snug">{dlc.title}</span>
                {dlc.score !== null && <ScoreBadge score={dlc.score} className="shrink-0" />}
              </span>
              <span className="text-black/65">
                {[
                  dlc.completion,
                  dlc.last_completion && `completed ${formatDay(dlc.last_completion)}`,
                  dlc.hours !== null && formatHours(dlc.hours),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Labels details={dlc} />
              {dlc.comment && <span className="text-black/65 whitespace-pre-line">{dlc.comment}</span>}
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

export const GameHoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shown, setShown] = useState<{ game: IGame; anchor: HTMLElement } | null>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  // Radix positions the panel against whatever this returns, i.e. the hovered element's current box
  const anchor = useRef({ getBoundingClientRect: () => shownRef.current?.anchor.getBoundingClientRect() ?? new DOMRect() });

  const cancelTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setShown(null), CLOSE_DELAY);
  };

  const bind = useCallback(
    (game: IGame): HoverProps => ({
      onMouseEnter: (event) => {
        const target = event.currentTarget;
        const element = target.querySelector<HTMLElement>("[data-hover-anchor]") ?? target;
        cancelTimers();
        openTimer.current = window.setTimeout(() => setShown({ game, anchor: element }), shownRef.current ? SWITCH_DELAY : OPEN_DELAY);
      },
      onMouseLeave: () => {
        window.clearTimeout(openTimer.current);
        scheduleClose();
      },
    }),
    []
  );

  // The panel doesn't follow its anchor when the list scrolls, so it closes instead (scrolling the panel itself is fine)
  useEffect(() => {
    if (!shown) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-hover-details]")) return;
      cancelTimers();
      setShown(null);
    };
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [shown]);

  useEffect(() => cancelTimers, []);

  return (
    <HoverContext.Provider value={bind}>
      {children}
      <Popover open={!!shown} onOpenChange={(open) => !open && setShown(null)}>
        <PopoverAnchor virtualRef={anchor} />
        {shown && (
          <PopoverContent
            // A new game remounts the panel, so it's positioned against its own card and fades in again
            key={shown.game.id}
            // Marks the panel, so scrolling inside it isn't taken for the list scrolling (PopoverContent takes no ref
            // on React 18)
            data-hover-details=""
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={16}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            // Moving from the card into the panel keeps it open
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleClose}
            className="option-clip max-h-(--radix-popover-content-available-height) w-[380px] overflow-y-auto overscroll-contain rounded-none border-0 border-t-[5px] border-ink bg-sand-light p-4 text-left font-chava text-sm text-black/88 shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_9px_28px_8px_rgba(0,0,0,0.05)] duration-200"
          >
            <GameDetailsPanel game={shown.game} />
          </PopoverContent>
        )}
      </Popover>
    </HoverContext.Provider>
  );
};

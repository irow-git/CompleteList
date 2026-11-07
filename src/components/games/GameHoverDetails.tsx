import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GameDetails, IGame } from "@/interfaces";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { formatDay } from "@/lib/dates";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { HIGHLIGHTED_TAGS } from "@/lib/tags";
import { formatHours } from "@/lib/hours";
import { ScoreBadge } from "./ScoreBadge";

// Hovering a card for a moment shows everything about the game and its DLCs. Once a panel is open, moving to another
// card switches it almost at once. The pointer can move into the panel to scroll it (long DLC lists).
// Touchscreens have no hover: tapping (or clicking) a card shows its panel straight away, tapping elsewhere closes it.
// Tapping or clicking twice in a row opens the game's own page, with everything the panel has and more
const OPEN_DELAY = 500;
const SWITCH_DELAY = 120;
const CLOSE_DELAY = 150;
// Two taps or clicks closer together than this, in time and distance, are a double tap. Measured from pointerup rather
// than left to dblclick, which touchscreens don't reliably send
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 24;

type HoverProps = {
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
};

const noop = () => {};
const HoverContext = createContext<(game: IGame) => HoverProps>(() => ({
  onPointerMove: noop,
  onPointerLeave: noop,
  onPointerUp: noop,
  onClick: noop,
}));

// Spread onto a card: {...useGameHover()(game)}. The panel sits next to the element marked data-hover-anchor inside it,
// or next to the element itself
export const useGameHover = () => useContext(HoverContext);

// The page a game's details open on: a DLC listed on its own opens its game's, scrolled to it
export const gamePagePath = (game: IGame) => (game.parent ? `/game/${game.parent.id}?dlc=${game.id}` : `/game/${game.id}`);

// Clicks on the card's own buttons and links (edit, delete) aren't for the panel
const onControl = (target: EventTarget) => target instanceof Element && !!target.closest("button, a, [role='button']");

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn("bg-white px-1.5 font-pixel text-[10px] leading-5 text-ink", className)}>{children}</span>
);

export const Facts: React.FC<{ details: GameDetails }> = ({ details }) => (
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

export const Labels: React.FC<{ details: GameDetails }> = ({ details }) => {
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
        <img src={imageUrl(game.id, game.cover_image)} alt="" className="aspect-[2/3] w-[84px] shrink-0 object-cover" onError={(event) => event.currentTarget.remove()} />
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="font-pixel text-sm leading-snug">{game.title}</h3>
        {game.parent && <p className="text-black/65">DLC of {game.parent.title}</p>}
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
  const navigate = useNavigate();
  // anchor: what the panel sits next to; card: the element the props are on (taps there don't count as outside)
  const [shown, setShown] = useState<{ game: IGame; anchor: HTMLElement; card: HTMLElement } | null>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  // Radix positions the panel against whatever this returns, i.e. the hovered element's current box. A card that's no
  // longer on the page (the list reloaded under it) has no box: rather than jump to the window's corner, the panel
  // stays where it was and closes
  const lastBox = useRef(new DOMRect());
  const anchor = useRef({
    getBoundingClientRect: () => {
      const element = shownRef.current?.anchor;
      if (element && !element.isConnected) {
        queueMicrotask(() => setShown((current) => (current?.anchor === element ? null : current)));
        return lastBox.current;
      }
      if (element) lastBox.current = element.getBoundingClientRect();
      return lastBox.current;
    },
  });
  // The game whose panel is about to open
  const pending = useRef<string | null>(null);

  const cancelTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    pending.current = null;
  };
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setShown(null), CLOSE_DELAY);
  };

  const lastUp = useRef<{ id: string; time: number; x: number; y: number } | null>(null);

  const bind = useCallback(
    (game: IGame): HoverProps => {
      const target = (card: HTMLElement) => ({ game, card, anchor: card.querySelector<HTMLElement>("[data-hover-anchor]") ?? card });
      return {
        // Opens once the pointer actually moves over the card. Not on entering it: after a page change the browser
        // reports entering whatever card ends up under a pointer that hasn't moved (opening a series' games lands one
        // right under it), and those reports come with no movement. Touch "hover" only comes with a tap, which the
        // click below handles
        onPointerMove: (event) => {
          if (event.pointerType === "touch" || (event.movementX === 0 && event.movementY === 0)) return;
          if (pending.current === game.id || shownRef.current?.game.id === game.id) {
            window.clearTimeout(closeTimer.current);
            return;
          }
          const card = event.currentTarget;
          cancelTimers();
          pending.current = game.id;
          openTimer.current = window.setTimeout(
            () => {
              pending.current = null;
              // Gone meanwhile, e.g. the list reloaded
              if (card.isConnected) setShown(target(card));
            },
            shownRef.current ? SWITCH_DELAY : OPEN_DELAY
          );
        },
        onPointerLeave: (event) => {
          if (event.pointerType === "touch") return;
          window.clearTimeout(openTimer.current);
          pending.current = null;
          scheduleClose();
        },
        onClick: (event) => {
          if (onControl(event.target)) return;
          cancelTimers();
          if (shownRef.current?.game.id !== game.id) setShown(target(event.currentTarget));
        },
        onPointerUp: (event) => {
          if (onControl(event.target) || event.button !== 0) return;
          const now = performance.now();
          const last = lastUp.current;
          const isDouble =
            last?.id === game.id &&
            now - last.time < DOUBLE_TAP_MS &&
            Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_PX;
          lastUp.current = isDouble ? null : { id: game.id, time: now, x: event.clientX, y: event.clientY };
          if (!isDouble) return;
          cancelTimers();
          setShown(null);
          navigate(gamePagePath(game));
        },
      };
    },
    [navigate]
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
            // Tapping the card it's open for keeps it (that may be the first half of a double tap); anywhere else closes it
            onPointerDownOutside={(event) => {
              if (event.target instanceof Node && shownRef.current?.card.contains(event.target)) event.preventDefault();
            }}
            onCloseAutoFocus={(event) => event.preventDefault()}
            // Moving from the card into the panel keeps it open
            onPointerEnter={() => window.clearTimeout(closeTimer.current)}
            onPointerLeave={(event) => event.pointerType !== "touch" && scheduleClose()}
            className="option-clip max-h-(--radix-popover-content-available-height) w-[380px] overflow-y-auto overscroll-contain rounded-none border-0 border-t-[5px] border-ink bg-sand-light p-4 text-left font-chava text-sm text-black/88 shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_9px_28px_8px_rgba(0,0,0,0.05)] duration-200"
          >
            <GameDetailsPanel game={shown.game} />
          </PopoverContent>
        )}
      </Popover>
    </HoverContext.Provider>
  );
};

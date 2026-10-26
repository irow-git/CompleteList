import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Image } from "pixelarticons/react";
import { IGame } from "../interfaces";
import { useGamesStore } from "../store/gamesStore";
import { GameActions } from "@/components/games/GameActions";
import { GameListToolbar } from "@/components/games/GameListToolbar";
import { GameHoverProvider, useGameHover } from "@/components/games/GameHoverDetails";
import { CardRuler, RulerMenu } from "@/components/games/CardRuler";
import { Slider } from "@/components/ui/slider";
import { formatDay } from "@/lib/dates";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { HIGHLIGHTED_TAGS } from "@/lib/tags";
import { titleWithoutArticle } from "@/lib/titles";

// Games without a cover (or whose image isn't on this computer yet) get a placeholder: the title's first letter on a
// colour picked from the title, so a game keeps the same colour between visits
const COVER_COLORS = ["#47434d", "#7e768a", "#555559", "#6b5d52", "#4e5b63", "#5f4b57", "#3f5246"];

const coverColor = (title: string) => {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
};

// Card width in px, set with the slider (like GOG's) and remembered on this computer
const CARD_SIZE_KEY = "card-size";
const CARD_SIZE = { min: 180, max: 400, step: 10, initial: 224 };
// Only this many tags fit on a cover; the rest show as "+N"
const MAX_TAGS = 3;

const savedCardSize = () => {
  try {
    const saved = Number(localStorage.getItem(CARD_SIZE_KEY));
    return saved >= CARD_SIZE.min && saved <= CARD_SIZE.max ? saved : CARD_SIZE.initial;
  } catch {
    return CARD_SIZE.initial;
  }
};

// As many whole lines as fit in the element's height, so text can fill whatever space is left and only then end in
// "…". CSS can only clamp to a fixed number of lines, and the space differs per card (a title takes one line or two)
// and with the size slider, so it's measured
function useFittingLines<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [lines, setLines] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 20;
      setLines(Math.max(1, Math.floor(element.clientHeight / lineHeight)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, lines] as const;
}

const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn("max-w-full truncate bg-white/90 px-1.5 font-pixel text-[10px] leading-5 text-ink", className)}>{children}</span>
);

// A fixed 9/21 card: the 2:3 cover on top (the same ratio the cropper cuts), details in the rest
const GameCard: React.FC<{ game: IGame }> = ({ game }) => {
  const hover = useGameHover();
  const dlcCount = game.DLCs.length;
  // e.g. a cover set on another computer whose file hasn't been synced here
  const [coverMissing, setCoverMissing] = useState(false);
  const showCover = game.cover_image && !coverMissing;
  const hiddenTags = game.tags.length - MAX_TAGS;
  const [completionBox, completionLines] = useFittingLines<HTMLDivElement>();
  const releaseYear = game.release_date && formatDay(game.release_date).slice(0, 4);

  return (
    <article className="group relative aspect-[9/21] drop-shadow-[1px_2px_3px_black]" {...hover(game)}>
      <div className="option-clip flex h-full flex-col bg-white">
        <div
          className="relative aspect-[2/3] shrink-0"
          style={{ background: `linear-gradient(0deg, black 0%, ${coverColor(game.title)} 100%)` }}
        >
          {showCover ? (
            <img
              src={imageUrl(game.cover_image!, "thumb")}
              alt=""
              loading="lazy"
              onError={() => setCoverMissing(true)}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span aria-hidden className="absolute inset-0 flex items-center justify-center font-pixel text-[calc(var(--card-width)*0.45)] text-white/85">
              {titleWithoutArticle(game.title).charAt(0).toUpperCase()}
            </span>
          )}
          <div className="absolute top-2 right-2 left-2 flex flex-col items-start gap-1">
            {game.service && <Badge className="text-green-700">Service</Badge>}
            {game.free_to_play && <Badge>Free to play</Badge>}
            {!game.service && game.original_copy && <Badge>Original</Badge>}
            {game.tags.slice(0, MAX_TAGS).map((tag) => (
              <Badge key={tag} className={HIGHLIGHTED_TAGS.has(tag) ? "text-red-700" : undefined}>
                {tag}
              </Badge>
            ))}
            {hiddenTags > 0 && <Badge>+{hiddenTags}</Badge>}
          </div>
          {dlcCount > 0 && (
            <Badge className="absolute bottom-2 left-2">
              +{dlcCount} DLC
            </Badge>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-3 text-left font-chava text-sm">
          <h3 className="line-clamp-2 shrink-0 font-pixel text-sm leading-snug">{game.title}</h3>
          <p className="truncate text-black/55">{game.platform.join(" · ")}</p>
          {/* The completion gets all the space between the platforms and the dates */}
          <div ref={completionBox} className="min-h-0 flex-1 overflow-hidden leading-5">
            <p className="overflow-hidden" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: completionLines }}>
              {game.completion}
            </p>
          </div>
          {(game.last_completion || releaseYear) && (
            <div className="flex shrink-0 items-end justify-between gap-2 text-black/55">
              <span className="truncate">{game.last_completion && formatDay(game.last_completion)}</span>
              {releaseYear && <span className="shrink-0">{releaseYear}</span>}
            </div>
          )}
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
  const { games, total, search, sort, status, infinite, restoreCards, loadMore, loadUntil } = useGamesStore(
    useShallow(({ games, total, search, sort, status, infinite, restoreCards, loadMore, loadUntil }) =>
      ({ games, total, search, sort, status, infinite, restoreCards, loadMore, loadUntil }))
  );
  const [cardWidth, setCardWidth] = useState(savedCardSize);
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  // The first card in view, which the ruler highlights; and a card the ruler asked for before it was loaded
  const [currentIndex, setCurrentIndex] = useState(0);
  const pendingJump = useRef<number | null>(null);

  const changeCardWidth = (width: number) => {
    setCardWidth(width);
    try {
      localStorage.setItem(CARD_SIZE_KEY, String(width));
    } catch {
      // Not remembered; the size still applies for now
    }
  };

  // The table pages through games one page at a time; this view loads them in pages as you scroll. Coming back to it
  // reloads the pages it had (unless they're still in the store), and the effect below scrolls back to where it was
  useEffect(() => {
    if (!infinite) restoreCards();
  }, [infinite, restoreCards]);

  // <main> is what scrolls (the window doesn't)
  const scroller = () => root.current?.closest("main") ?? null;

  // Cards are in rows, so their bottoms only grow down the list: a binary search finds the first one still in view.
  // The ruler highlights the last card of that row, so a row where a new letter or year starts shows that one
  const firstVisibleIndex = () => {
    const main = scroller();
    const cards = grid.current?.children;
    if (!main || !cards?.length) return 0;
    const top = main.getBoundingClientRect().top + 16;
    let low = 0;
    let high = cards.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (cards[middle].getBoundingClientRect().bottom > top) high = middle;
      else low = middle + 1;
    }
    const rowTop = cards[low].getBoundingClientRect().top;
    while (low + 1 < cards.length && cards[low + 1].getBoundingClientRect().top === rowTop) low++;
    return low;
  };

  const scrollToCard = (index: number) => {
    const main = scroller();
    const card = grid.current?.children[index];
    if (!main || !card) return false;
    main.scrollTop += card.getBoundingClientRect().top - main.getBoundingClientRect().top - 16;
    return true;
  };

  // The ruler can point past the cards loaded so far: those get loaded first, and the effect below finishes the jump
  const jumpTo = (index: number) => {
    if (scrollToCard(index)) return;
    pendingJump.current = index;
    loadUntil(index);
  };

  useLayoutEffect(() => {
    if (pendingJump.current !== null && scrollToCard(pendingJump.current)) pendingJump.current = null;
    setCurrentIndex(firstVisibleIndex());
  }, [games.length]);

  useLayoutEffect(() => {
    const main = scroller();
    if (restored.current || !main || !infinite || status !== "ready") return;
    restored.current = true;
    main.scrollTop = useGamesStore.getState().cardScroll;
  }, [infinite, status]);

  // Remembers the scroll position for next time. Tracked as it changes: by the time this view unmounts, <main> has
  // already lost its content and been scrolled back to the top
  useEffect(() => {
    const main = scroller();
    if (!main) return;
    let position = main.scrollTop;
    let frame = 0;
    const track = () => {
      position = main.scrollTop;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCurrentIndex(firstVisibleIndex()));
    };
    main.addEventListener("scroll", track, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      main.removeEventListener("scroll", track);
      if (restored.current) useGamesStore.getState().setCardScroll(position);
    };
  }, []);

  // A new order or search starts at the top
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    scroller()?.scrollTo({ top: 0 });
  }, [sort, search]);

  // Load the next page when the end of the list comes within reach. The observer is recreated whenever more games
  // arrive: observing reports the current state right away, so a screen tall enough to show them all keeps loading
  useEffect(() => {
    if (!sentinel.current) return;
    // rootMargin only reaches ahead within the root it's given, so the root is <main>
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), {
      root: scroller(),
      rootMargin: "600px",
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [games.length, loadMore]);

  const finished = games.length >= total;

  const sizeSlider = (
    <div className="flex items-center gap-2 text-black/55" title="Card size">
      <Image className="size-6" />
      <Slider
        thumbLabel="Card size"
        min={CARD_SIZE.min}
        max={CARD_SIZE.max}
        step={CARD_SIZE.step}
        value={[cardWidth]}
        onValueChange={([width]) => changeCardWidth(width)}
      />
      <Image className="size-9" />
    </div>
  );

  return (
    <GameHoverProvider>
      <div ref={root}>
        <GameListToolbar
          ref={toolbar}
          controls={
            <>
              {sizeSlider}
              <RulerMenu />
            </>
          }
        />
        {/* After the toolbar, so the toolbar's ref is attached by the time the ruler measures it */}
        <CardRuler currentIndex={currentIndex} onJump={jumpTo} below={toolbar} />
        {games.length === 0 && status !== "loading" ? (
          <p className="py-12 text-center font-pixel text-sm text-black/45">
            {search ? `No games match "${search}"` : "No games yet"}
          </p>
        ) : (
          <div
            ref={grid}
            // Cards are exactly the slider's width; whatever space is left over goes on the left, by the ruler
            className="grid grid-cols-[repeat(auto-fill,var(--card-width))] justify-end gap-4"
            style={{ "--card-width": `${cardWidth}px` } as React.CSSProperties}
          >
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
        <div ref={sentinel} className="py-6 text-center font-pixel text-sm text-black/45">
          {status === "loading" ? "Loading…" : finished && games.length > 0 ? `That's all ${total}` : null}
        </div>
      </div>
    </GameHoverProvider>
  );
};

export default CardView;

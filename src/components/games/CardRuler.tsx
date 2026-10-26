import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Bookmark, ChevronDown, ChevronUp } from "pixelarticons/react";
import { Checkpoint, CheckpointKind, GameSort, SortableField } from "@/interfaces";
import { useGamesStore } from "@/store/gamesStore";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";

// The ruler beside the cards marks where each letter or year starts, like the alphabet in iOS Contacts. It only
// makes sense when the cards are sorted by what it marks, so choosing a ruler sorts the cards; it can also be turned
// off without touching the sort
const RULERS: { kind: CheckpointKind; field: SortableField; label: string }[] = [
  { kind: "letter", field: "title", label: "A–Z" },
  { kind: "release_date", field: "release_date", label: "Released" },
  { kind: "last_completion", field: "last_completion", label: "Completed" },
];

// Which ruler is shown, if any. Kept apart from the sort, since the sort can match a ruler that's turned off
const useRulerStore = create<{
  kind: CheckpointKind | null;
  setKind: (kind: CheckpointKind | null) => void;
  // Whether the rail is on screen right now (a ruler is chosen, the card view is open and there's something to mark)
  shown: boolean;
  setShown: (shown: boolean) => void;
}>((set) => ({
  kind: null,
  setKind: (kind) => set({ kind }),
  shown: false,
  setShown: (shown) => set({ shown }),
}));

// For the layout, which makes room for the rail only while it's there
export const useRulerShown = () => useRulerStore((state) => state.shown);

// The ruler that's shown: the chosen one, as long as the cards are still sorted by it
const useActiveRuler = () => {
  const kind = useRulerStore((state) => state.kind);
  const sort = useGamesStore((state) => state.sort);
  const ruler = RULERS.find((r) => r.kind === kind);
  return ruler && sort[0]?.field === ruler.field ? ruler : undefined;
};

const directionIcon = (direction: GameSort["direction"] | undefined) =>
  direction === "desc" ? <ChevronDown className="size-6" aria-label="descending" /> : <ChevronUp className="size-6" aria-label="ascending" />;

// Toolbar menu, like the sort menu: picking a ruler sorts by it and shows it; picking it again turns it off (the sort
// stays). The arrow next to the chosen one flips the order; games without the date stay last either way
export const RulerMenu: React.FC = () => {
  const { sort, setSort } = useGamesStore(useShallow(({ sort, setSort }) => ({ sort, setSort })));
  const setKind = useRulerStore((state) => state.setKind);
  const active = useActiveRuler();

  return (
    <Popover>
      <div className="drop-shadow-[0px_1px_1px_black]">
        <PopoverTrigger className={cn(buttonVariants({ size: "lg" }), "form-control-clip-large min-w-[120px]")}>
          <Bookmark className="size-6" />
          Ruler
          {active && <span className="bg-white px-1.5 font-pixel text-xs leading-5 text-ink">{active.label}</span>}
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="option-clip w-64 rounded-none border-0 bg-ink p-2 font-chava text-white">
        <ul>
          {RULERS.map((ruler) => {
            const isActive = ruler === active;
            return (
              <li key={ruler.kind} className="flex items-center">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    if (isActive) return setKind(null);
                    setKind(ruler.kind);
                    if (sort[0]?.field !== ruler.field) setSort([{ field: ruler.field, direction: "asc" }]);
                  }}
                  className="flex flex-auto cursor-pointer items-center gap-2 px-2 py-1.5 text-left hover:bg-sand hover:text-ink"
                >
                  <span className="w-5 font-pixel text-xs">{isActive ? "✓" : ""}</span>
                  {ruler.label}
                </button>
                {isActive && (
                  <button
                    type="button"
                    title="Reverse the order"
                    onClick={() => setSort([{ ...sort[0], direction: sort[0].direction === "asc" ? "desc" : "asc" }, ...sort.slice(1)])}
                    className="cursor-pointer px-1 py-1.5 hover:bg-sand hover:text-ink"
                  >
                    {directionIcon(sort[0]?.direction)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-1 border-t border-sand px-2 pt-2 text-sm text-white/65">Choosing a ruler sorts the cards by it</p>
      </PopoverContent>
    </Popover>
  );
};

// Rough height of a label in the rail: letters sit upright, years run vertically (one pixel-font character ≈ 8px)
const labelHeight = (label: string) => (label.length <= 1 ? 18 : label.length * 8 + 8);
const DOT_HEIGHT = 10;
// Space between the ruler and the toolbar above it, and the bottom of the window
const MARGIN = 12;
const displayLabel = (label: string) => label || "—";
const describe = (checkpoint: Checkpoint) => `${checkpoint.label || "No date"} (${checkpoint.count})`;

// Which checkpoints get a label when they don't all fit: every k-th (and always the last), with a dot standing in for
// the ones skipped. Scrubbing still reaches every checkpoint
function visibleCheckpoints(checkpoints: Checkpoint[], height: number) {
  for (let step = 1; ; step++) {
    const shown: (Checkpoint | "dot")[] = [];
    let used = 0;
    checkpoints.forEach((checkpoint, i) => {
      if (i % step === 0 || i === checkpoints.length - 1) {
        shown.push(checkpoint);
        used += labelHeight(checkpoint.label);
      } else if (shown[shown.length - 1] !== "dot") {
        shown.push("dot");
        used += DOT_HEIGHT;
      }
    });
    if (used <= height || step >= checkpoints.length) return shown;
  }
}

export const CardRuler: React.FC<{
  currentIndex: number;
  onJump: (index: number) => void;
  // The ruler starts below this (the toolbar), so it never covers it, however many lines the toolbar wraps onto
  below: React.RefObject<HTMLElement>;
}> = ({ currentIndex, onJump, below }) => {
  const { sort, search, total } = useGamesStore(useShallow(({ sort, search, total }) => ({ sort, search, total })));
  const ruler = useActiveRuler();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [box, setBox] = useState({ left: 0, top: 0, height: 0 });
  const anchor = useRef<HTMLSpanElement>(null);
  const [scrubbing, setScrubbing] = useState<{ checkpoint: Checkpoint; y: number } | null>(null);
  const rail = useRef<HTMLDivElement>(null);

  // Rebuilt whenever what's listed changes; `total` changes with adds and deletes
  useEffect(() => {
    if (!ruler) return setCheckpoints([]);
    let current = true;
    window.api.games.checkpoints({ kind: ruler.kind, sort, search }).then((result) => current && setCheckpoints(result));
    return () => {
      current = false;
    };
  }, [ruler, sort, search, total]);

  // Fixed in <main>'s left padding, right next to the sidebar, from just below the toolbar to near the bottom: it stays
  // put while the cards scroll. Measured, since <main>'s position depends on the sidebar and header, and the toolbar's
  // height on how many lines it wraps onto
  useLayoutEffect(() => {
    const main = anchor.current?.closest("main");
    if (!main) return;
    const measure = () => {
      const rect = main.getBoundingClientRect();
      const offset = 16 + (below.current?.offsetHeight ?? 0) + MARGIN;
      setBox({ left: rect.left + 10, top: rect.top + offset, height: main.clientHeight - offset - MARGIN - 8 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    if (below.current) observer.observe(below.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Only there to find <main> from; the ruler itself is positioned against the window
  const visible = !!ruler && checkpoints.length > 0;
  const setShown = useRulerStore((state) => state.setShown);
  useEffect(() => {
    setShown(visible);
    return () => setShown(false);
  }, [visible, setShown]);

  if (!visible) return <span ref={anchor} hidden />;

  // The checkpoint the cards in view belong to. When it's one of those replaced by a dot, the nearest label shown
  // is highlighted instead
  const current = checkpoints.reduce((found, checkpoint) => (checkpoint.index <= currentIndex ? checkpoint : found), checkpoints[0]);
  const shown = visibleCheckpoints(checkpoints, box.height - 16);
  const labels = shown.filter((item): item is Checkpoint => item !== "dot");
  const position = checkpoints.indexOf(current);
  const active = labels.reduce((nearest, label) =>
    Math.abs(checkpoints.indexOf(label) - position) < Math.abs(checkpoints.indexOf(nearest) - position) ? label : nearest
  );

  // Pressing and dragging along the rail picks the label under the pointer; between two labels (where a dot stands
  // in for skipped checkpoints) it picks proportionally between them, so every checkpoint is reachable
  const pick = (clientY: number) => {
    const box = rail.current!.getBoundingClientRect();
    const labels = [...rail.current!.querySelectorAll<HTMLElement>("[data-checkpoint]")].map((element) => {
      const rect = element.getBoundingClientRect();
      return { position: Number(element.dataset.checkpoint), centre: rect.top + rect.height / 2 };
    });
    const after = labels.findIndex((label) => label.centre > clientY);
    let position: number;
    if (after === -1) position = labels[labels.length - 1].position;
    else if (after === 0) position = labels[0].position;
    else {
      const [above, below] = [labels[after - 1], labels[after]];
      const t = (clientY - above.centre) / (below.centre - above.centre);
      position = Math.round(above.position + t * (below.position - above.position));
    }
    const checkpoint = checkpoints[position];
    if (checkpoint !== scrubbing?.checkpoint) onJump(checkpoint.index);
    setScrubbing({ checkpoint, y: clientY - box.top });
  };

  return (
    <nav aria-label={`Jump to ${ruler.label}`} className="fixed z-10 drop-shadow-[1px_2px_3px_black]" style={{ left: box.left, top: box.top }}>
      <span ref={anchor} hidden />
      <div
        ref={rail}
        style={{ height: box.height }}
        className="option-clip relative flex w-7 cursor-pointer touch-none flex-col items-center justify-around bg-white py-2 select-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event.clientY);
        }}
        onPointerMove={(event) => scrubbing && pick(event.clientY)}
        onPointerUp={() => setScrubbing(null)}
        onPointerCancel={() => setScrubbing(null)}
      >
        {shown.map((item, i) =>
          item === "dot" ? (
            <span key={`dot-${i}`} aria-hidden className="size-1 bg-black/30" />
          ) : (
            <button
              key={`${item.label}-${item.index}`}
              type="button"
              data-checkpoint={checkpoints.indexOf(item)}
              title={describe(item)}
              // Pointer presses are handled by the rail itself; this is for the keyboard
              onClick={(event) => event.detail === 0 && onJump(item.index)}
              aria-current={item === active ? "location" : undefined}
              className={cn(
                "flex w-full shrink-0 items-center justify-center py-0.5 font-pixel text-[10px] leading-none text-ink outline-none focus-visible:underline",
                item.label.length > 1 && "[writing-mode:vertical-rl]",
                item === active && "bg-ink text-white"
              )}
            >
              {displayLabel(item.label)}
            </button>
          )
        )}
      </div>
      {scrubbing && (
        // The checkpoint under the pointer while scrubbing, big enough to read past the finger/pointer
        <div
          aria-hidden
          className="option-clip pointer-events-none absolute left-10 -translate-y-1/2 bg-ink px-3 py-2 font-pixel text-xl whitespace-nowrap text-white"
          style={{ top: scrubbing.y }}
        >
          {scrubbing.checkpoint.label || "No date"}
        </div>
      )}
    </nav>
  );
};

import { useEffect, useState } from "react";
import type { SeriesCandidate } from "@/lib/series";
import { normalizeSeries } from "@/lib/series";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// What the user picked: a series (and the games without one that go into it too), or no series at all
export interface SeriesChoice {
  name: string | null;
  joinIds: string[];
}

type Option = { kind: "candidate"; index: number } | { kind: "custom" } | { kind: "none" };

// How many titles to name before "and N more"
const NAMED = 3;

const listTitles = (games: { title: string }[]) =>
  games.length <= NAMED
    ? games.map((game) => game.title).join(", ")
    : `${games
        .slice(0, NAMED)
        .map((game) => game.title)
        .join(", ")} and ${games.length - NAMED} more`;

const optionClass = (selected: boolean) =>
  cn(
    "flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left",
    selected ? "bg-ink text-white" : "bg-white/60 hover:bg-white"
  );

// Asks which series a game goes into when the guess isn't clear (see suggestSeries in src/lib/series.ts): one of the
// candidates, a name of the user's own, or none. Looks like the delete confirmation, which it's built from
export const SeriesChoiceDialog: React.FC<{
  // The game it's about; the dialog is open while this is set
  title: string | null;
  candidates: SeriesCandidate[];
  // While going through several games (detecting series): which one this is
  progress?: { index: number; total: number };
  // "Cancel" goes back to the form; "Skip" moves on to the next game
  cancelLabel?: string;
  onCancel: () => void;
  // While going through several games: stops there, leaving the rest for next time
  onStop?: () => void;
  onChoose: (choice: SeriesChoice) => void;
}> = ({ title, candidates, progress, cancelLabel = "Cancel", onCancel, onStop, onChoose }) => {
  const [option, setOption] = useState<Option>({ kind: "candidate", index: 0 });
  const [customName, setCustomName] = useState("");

  // Each game starts from the best guess
  useEffect(() => {
    setOption(candidates.length > 0 ? { kind: "candidate", index: 0 } : { kind: "none" });
    setCustomName("");
    // By title rather than the candidates array, which the parent may rebuild on every render
  }, [title, candidates.length]);

  const choice = (): SeriesChoice | null => {
    if (option.kind === "none") return { name: null, joinIds: [] };
    if (option.kind === "custom") {
      const name = normalizeSeries(customName);
      return name ? { name, joinIds: [] } : null;
    }
    // Missing while closed (no candidates), or for the one render before a new game's candidates reset the option
    const candidate = candidates[option.index];
    return candidate ? { name: candidate.name, joinIds: candidate.join.map((game) => game.id) } : null;
  };
  const chosen = choice();

  return (
    <AlertDialog open={title !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="w-[520px]">
        <AlertDialogTitle>Which series is {title} in?</AlertDialogTitle>
        <AlertDialogDescription>
          {progress && (
            <span className="mr-2 font-pixel text-xs text-black/45">
              {progress.index + 1} of {progress.total}
            </span>
          )}
          It looks like it could belong to more than one, or the match isn't clear.
        </AlertDialogDescription>

        <div role="radiogroup" aria-label="Series" className="mt-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {candidates.map((candidate, index) => {
            const selected = option.kind === "candidate" && option.index === index;
            return (
              <button
                key={candidate.name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setOption({ kind: "candidate", index })}
                className={cn(optionClass(selected), "option-clip")}
              >
                <span className="font-pixel text-sm">
                  {candidate.name}
                  {!candidate.existing && <span className={cn("ml-2 text-xs", selected ? "text-white/65" : "text-black/45")}>new</span>}
                </span>
                {candidate.members.length > 0 && (
                  <span className={cn("text-sm", selected ? "text-white/80" : "text-black/65")}>
                    {candidate.members.length} {candidate.members.length === 1 ? "game" : "games"}: {listTitles(candidate.members)}
                  </span>
                )}
                {candidate.join.length > 0 && (
                  <span className={cn("text-sm", selected ? "text-white/80" : "text-black/65")}>
                    {candidate.existing ? "Also joining" : "Together with"}: {listTitles(candidate.join)}
                  </span>
                )}
              </button>
            );
          })}

          <div className={cn(optionClass(option.kind === "custom"), "option-clip")}>
            <button
              type="button"
              role="radio"
              aria-checked={option.kind === "custom"}
              onClick={() => setOption({ kind: "custom" })}
              className="cursor-pointer text-left font-pixel text-sm"
            >
              Another name
            </button>
            <Input
              aria-label="Series name"
              placeholder="Series name"
              maxLength={200}
              value={customName}
              onFocus={() => setOption({ kind: "custom" })}
              onChange={(event) => setCustomName(event.target.value)}
              className="form-control-clip mt-1 text-black/88"
            />
          </div>

          <button
            type="button"
            role="radio"
            aria-checked={option.kind === "none"}
            onClick={() => setOption({ kind: "none" })}
            className={cn(optionClass(option.kind === "none"), "option-clip font-pixel text-sm")}
          >
            No series
          </button>
        </div>

        <AlertDialogFooter>
          {onStop && (
            <button type="button" onClick={onStop} className="mr-auto cursor-pointer text-black/65 underline hover:text-black">
              Stop
            </button>
          )}
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!chosen}
            onClick={(event) => {
              // The parent closes it (by clearing `title`), possibly opening it again for the next game
              event.preventDefault();
              if (chosen) onChoose(chosen);
            }}
          >
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

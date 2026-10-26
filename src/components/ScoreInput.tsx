import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RemoveButton } from "@/components/ui/remove-button";
import { SCORE_MAX, SCORE_MIN, scoreColor, toScore } from "@/lib/score";
import { cn } from "@/lib/utils";

// Where the slider's thumb waits while there's no score
const UNSET_POSITION = 50;

// A score from 1 to 100, picked on the slider or typed into the box, both coloured by the score. Optional: the "×"
// clears it. Typing goes through as soon as it's a valid score; anything out of range is pulled into range on blur
export const ScoreInput: React.FC<{
  id?: string;
  value: number | null;
  onChange: (score: number | null) => void;
  onBlur?: () => void;
}> = ({ id, value, onChange, onBlur }) => {
  // What's typed while the box has focus, which can be briefly out of range (e.g. "0" on the way to "05")
  const [draft, setDraft] = useState<string | null>(null);
  const color = value === null ? undefined : scoreColor(value);

  return (
    <div className="flex items-center gap-4">
      <Input
        id={id}
        size="lg"
        inputMode="numeric"
        placeholder="—"
        maxLength={3}
        className="form-control-clip-large w-[84px] shrink-0 px-0 text-center font-pixel"
        style={color ? { backgroundColor: color } : undefined}
        value={draft ?? (value === null ? "" : String(value))}
        onChange={(event) => {
          const text = event.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(text);
          const score = Number(text);
          if (text === "") onChange(null);
          else if (score >= SCORE_MIN && score <= SCORE_MAX) onChange(score);
        }}
        onBlur={() => {
          if (draft) onChange(toScore(Number(draft)));
          setDraft(null);
          onBlur?.();
        }}
      />
      <Slider
        thumbLabel="Score"
        className={cn("w-auto flex-auto", value === null && "opacity-40")}
        min={SCORE_MIN}
        max={SCORE_MAX}
        step={1}
        color={color}
        value={[value ?? UNSET_POSITION]}
        onValueChange={([score]) => onChange(score)}
        onBlur={onBlur}
      />
      <RemoveButton size="lg" aria-label="Clear score" className={cn("w-6", value === null && "invisible")} onClick={() => onChange(null)} />
    </div>
  );
};

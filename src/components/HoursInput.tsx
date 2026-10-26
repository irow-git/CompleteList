import { useState } from "react";
import { Input } from "@/components/ui/input";
import { MAX_HOURS, toHours } from "@/lib/hours";

// Hours played: only digits and one decimal place can be typed. Optional: an empty box means none
export const HoursInput: React.FC<{
  id?: string;
  value: number | null;
  onChange: (hours: number | null) => void;
  onBlur?: () => void;
}> = ({ id, value, onChange, onBlur }) => {
  // What's typed while the box has focus, e.g. "12." on the way to "12.5", which the number alone can't show
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      id={id}
      size="lg"
      inputMode="decimal"
      placeholder="Enter Hours Played"
      className="form-control-clip-large"
      value={draft ?? (value === null ? "" : String(value))}
      onChange={(event) => {
        const match = event.target.value.replace(/[^\d.]/g, "").match(/^(\d*)(\.?\d?)/)!;
        const text = match[1].slice(0, String(MAX_HOURS).length) + match[2];
        setDraft(text);
        onChange(text === "" || text === "." ? null : toHours(Number(text)));
      }}
      onBlur={() => {
        setDraft(null);
        onBlur?.();
      }}
    />
  );
};

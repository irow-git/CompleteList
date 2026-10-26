import { scoreColor } from "@/lib/score";
import { cn } from "@/lib/utils";

// A score on its colour (red for low, green for high), for the cards, the hover details and the table
export const ScoreBadge: React.FC<{ score: number; className?: string }> = ({ score, className }) => (
  <span
    title={`Score: ${score}`}
    className={cn("inline-block px-1.5 font-pixel text-[10px] leading-5 text-black", className)}
    style={{ backgroundColor: scoreColor(score) }}
  >
    {score}
  </span>
);

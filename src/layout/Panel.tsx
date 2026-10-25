import { cn } from "@/lib/utils";

// The white pixel-cornered card most pages sit in. The card view leaves it out and puts its cards on the background
export const Panel: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <div className="drop-shadow-[1px_2px_3px_black]">
    <div className={cn("clip min-h-[360px] bg-white p-6", className)}>{children}</div>
  </div>
);

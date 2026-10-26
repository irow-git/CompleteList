import { cn } from "@/lib/utils";

type PanelProps = {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  // Take the remaining height of a flex column and scroll inside, instead of growing with the content
  fill?: boolean;
};

// The white pixel-cornered card most pages sit in. The card view leaves it out and puts its cards on the background
export const Panel: React.FC<PanelProps> = ({ className, children, style, fill }) => (
  <div className={cn("drop-shadow-[1px_2px_3px_black]", fill && "flex min-h-0 flex-1 flex-col")}>
    <div className={cn("clip min-h-[360px] bg-white p-6", fill && "min-h-0 flex-1 overflow-auto", className)} style={style}>
      {children}
    </div>
  </div>
);

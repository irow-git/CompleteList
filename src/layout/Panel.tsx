import { cn } from "@/lib/utils";

type PanelProps = {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export const Panel: React.FC<PanelProps> = ({ className, children, style }) => (
  <div className="drop-shadow-[1px_2px_3px_black]">
    <div 
      className={cn("clip min-h-[360px] bg-white p-6", className)}
      style={style}
    >
      {children}
    </div>
  </div>
);
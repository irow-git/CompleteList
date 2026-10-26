import { Link } from "react-router-dom";
import { useRulerShown } from "@/components/games/CardRuler";
import { cn } from "@/lib/utils";

type MainProps = {
  children?: React.ReactNode;
};

// The layout is exactly the window's height and the page itself never scrolls; <main> scrolls when a page is taller.
// That lets the table view give its panel exactly the space that's left, with the pagination fixed underneath
const Main: React.FC<MainProps> = ({ children }) => {
  const rulerShown = useRulerShown();

  return (
    <div className="flex h-screen overflow-hidden bg-sand-light text-sm leading-[normal]">
      <aside className="relative ml-6 flex h-full w-60 shrink-0 flex-col overflow-hidden bg-[linear-gradient(0deg,rgba(0,0,0,1)_0%,rgba(114,108,120,0.99)_100%)] text-white">
        <div className="leading-[1.5714]">
          <div className="mt-10 mb-[50px] inline-block">
            <img className="inline align-baseline drop-shadow-[2px_2px_12px_white]" src="images/logo.png" alt="logo" width={208} draggable={false} />
          </div>

          <nav className="pl-[5px] text-left leading-10">
            <Link to="create">
              <div className="nav-item">Add Game</div>
            </Link>
            <img className="-ml-[3px] mt-5 mb-[5px] inline align-baseline" src="images/line-7.png" alt="line" width={105} draggable={false} />
            <Link to="/">
              <div className="nav-item">Table View</div>
            </Link>
            <Link to="card">
              <div className="nav-item">Card View</div>
            </Link>
            <img className="-ml-[3px] mt-5 mb-[5px] inline align-baseline" src="images/line-7.png" alt="line" width={105} draggable={false} />
            <Link to="settings">
              <div className="nav-item">Settings</div>
            </Link>
          </nav>
        </div>

        {/* The torn bottom edge always sits at the very bottom: this area takes whatever height the nav leaves, and when
            that's less than the image, the image's top is cut off rather than the edge (or the nav being covered) */}
        <div className="flex min-h-0 flex-1 items-end overflow-hidden">
          <img className="block shrink-0" src="images/tear.png" alt="tear" draggable={false} />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-auto flex-col">
        <header className="h-fit text-[2.5em] leading-16 text-transparent [text-shadow:0px_4px_4px_#dedbd3,0_0_0_black,0px_4px_4px_#dedbd3]">
          Complete List - Video Games
        </header>
        {/* Padding rather than margins, so the panels' drop shadows aren't cut off by the scroll area. The left padding
            widens to hold the card view's ruler while it's shown */}
        <main className={cn("flex min-h-0 flex-auto flex-col overflow-y-auto pt-4 pr-6 pb-6 text-black/88", rulerShown ? "pl-12" : "pl-6")}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Main;

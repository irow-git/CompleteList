import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUp } from "pixelarticons/react";
import { useRulerShown } from "@/components/games/CardRuler";
import { cn } from "@/lib/utils";

type MainProps = {
  children?: React.ReactNode;
};

// The layout is exactly the window's height and the page itself never scrolls; <main> scrolls when a page is taller.
// That lets the table view give its panel exactly the space that's left, with the pagination fixed underneath
const Main: React.FC<MainProps> = ({ children }) => {
  const rulerShown = useRulerShown();
  const main = useRef<HTMLElement>(null);
  // The card view gets a "back to top" button under the nav, there once it's scrolled down
  const isCardView = useLocation().pathname === "/card";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const element = main.current;
    if (!isCardView || !element) return;
    const track = () => setScrolled(element.scrollTop > 0);
    track();
    element.addEventListener("scroll", track, { passive: true });
    return () => element.removeEventListener("scroll", track);
  }, [isCardView]);

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
        <main
          ref={main}
          className={cn("flex min-h-0 flex-auto flex-col overflow-y-auto pt-4 pr-6 pb-6 text-black/88", rulerShown ? "pl-12" : "pl-6")}
        >
          {children}
        </main>
      </div>

      {isCardView && (
        // Hidden rather than removed at the top, so the sidebar's bottom edge doesn't move
        <div className={cn("absolute bottom-5 left-5 opacity-30 mt-6 pl-[5px] text-left drop-shadow-[0px_1px_1px_black] hover:opacity-100", !scrolled && "invisible")}>
          <button
            type="button"
            aria-label="Back to top"
            title="Back to top"
            onClick={() => main.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="option-clip inline-flex size-9 cursor-pointer items-center justify-center bg-white text-ink hover:bg-sand"
          >
            <ArrowUp className="size-6" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Main;

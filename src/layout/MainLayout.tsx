import { forwardRef } from "react";
import { Link } from "react-router-dom";

type MainProps = {
  children?: React.ReactNode;
};

const Main = forwardRef<HTMLElement, MainProps>(({ children }, ref) => {
  return (
    <div className="flex min-h-screen bg-sand-light text-sm leading-[normal]">
      <aside className="relative ml-6 h-[920px] w-60 shrink-0 bg-[linear-gradient(0deg,rgba(0,0,0,1)_0%,rgba(114,108,120,0.99)_100%)] text-white">
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

        <img className="relative mt-[82px] inline align-baseline" src="images/tear.png" alt="tear" draggable={false} />
      </aside>

      <div className="flex min-w-0 flex-auto flex-col">
        <header ref={ref} className="h-fit text-[2.5em] leading-16 text-transparent [text-shadow:0px_4px_4px_#dedbd3,0_0_0_black,0px_4px_4px_#dedbd3]">
          Complete List - Video Games
        </header>
        <main className="mx-8 mt-4 mb-6 flex-auto text-black/88">{children}</main>
      </div>
    </div>
  );
});

export default Main;

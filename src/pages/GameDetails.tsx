import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Pencil } from "pixelarticons/react";
import type { IGame } from "@/interfaces";
import { useGamesStore } from "@/store/gamesStore";
import { Panel } from "@/layout/Panel";
import { Cover } from "@/components/games/Cover";
import { Facts, Labels } from "@/components/games/GameHoverDetails";
import { ScoreBadge } from "@/components/games/ScoreBadge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Everything about a game on a page of its own (a double tap or double click on its card): what the hover panel shows,
// bigger, and each DLC with its own cover. ?dlc=<id> scrolls to that DLC and marks it. The header's arrows go back
const GameDetails: React.FC = () => {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const highlighted = params.get("dlc");
  const navigate = useNavigate();
  const showSeries = useGamesStore((state) => state.showSeries);
  const [game, setGame] = useState<IGame | null | undefined>(undefined);
  const highlightedRow = useRef<HTMLLIElement>(null);

  useEffect(() => {
    setGame(undefined);
    window.api.games.get(id).then(setGame);
  }, [id]);

  useEffect(() => {
    if (game && highlighted) highlightedRow.current?.scrollIntoView({ block: "center" });
  }, [game, highlighted]);

  if (game === undefined) return <Panel />;
  if (game === null)
    return (
      <Panel>
        <div className="p-5 text-center font-pixel text-sm text-black/45">Game not found</div>
      </Panel>
    );

  return (
    <Panel>
      <div className="flex flex-col gap-6 p-5 text-left font-chava text-base">
        <div className="flex flex-wrap items-center gap-4">
          <div className="drop-shadow-[0px_1px_1px_black]">
            <Link to={`/edit/${game.id}`} className={cn(buttonVariants({ size: "lg" }), "form-control-clip-large")}>
              <Pencil className="size-6" />
              Edit
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <Cover owner={game.id} image={game.cover_image} title={game.title} className="aspect-[2/3] w-[260px] shrink-0 drop-shadow-[1px_2px_3px_black]" />
          <div className="flex min-w-[280px] flex-1 flex-col gap-3">
            <h2 className="font-pixel text-xl leading-snug">{game.title}</h2>
            {game.series && (
              <p className="text-black/65">
                Series:{" "}
                <button
                  type="button"
                  className="cursor-pointer text-ink underline hover:text-black"
                  title={`Show the games of ${game.series}`}
                  onClick={() => {
                    showSeries(game.series!);
                    navigate("/card");
                  }}
                >
                  {game.series}
                </button>
              </p>
            )}
            {game.platform.length > 0 && <p className="text-black/65">{game.platform.join(" · ")}</p>}
            <Labels details={game} />
            <Facts details={game} />
            {game.comment && <p className="border-l-[3px] border-sand-dark pl-2 whitespace-pre-line">{game.comment}</p>}
          </div>
        </div>

        {game.DLCs.length > 0 && (
          <section className="flex flex-col gap-3 border-t-2 border-sand-dark pt-4">
            <h3 className="font-pixel text-sm text-black/55">
              {game.DLCs.length} DLC{game.DLCs.length === 1 ? "" : "s"}
            </h3>
            <ul className="flex flex-col gap-4">
              {game.DLCs.map((dlc) => {
                const isHighlighted = dlc.id === highlighted;
                return (
                  <li
                    key={dlc.id}
                    ref={isHighlighted ? highlightedRow : undefined}
                    className={cn("option-clip flex gap-4 p-3", isHighlighted ? "bg-sand outline-2 outline-ink" : "bg-sand-light")}
                  >
                    <Cover owner={dlc.id} image={dlc.cover_image} title={dlc.title} className="aspect-[2/3] w-[120px] shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-pixel text-sm leading-snug">{dlc.title}</span>
                        {dlc.score !== null && <ScoreBadge score={dlc.score} className="shrink-0" />}
                      </span>
                      {dlc.platform.length > 0 && <span className="text-black/65">{dlc.platform.join(" · ")}</span>}
                      <Labels details={dlc} />
                      <Facts details={{ ...dlc, score: null }} />
                      {dlc.comment && <p className="border-l-[3px] border-sand-dark pl-2 whitespace-pre-line text-black/65">{dlc.comment}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Panel>
  );
};

export default GameDetails;

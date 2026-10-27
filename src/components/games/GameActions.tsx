import { Link } from "react-router-dom";
import { Pencil, Trash } from "pixelarticons/react";
import { IGame } from "@/interfaces";
import { useGamesStore } from "@/store/gamesStore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const iconButtonClass =
  "inline-flex size-[26px] cursor-pointer items-center justify-center bg-white leading-none hover:bg-sand [&_svg]:size-6";

// Edit and delete (with confirmation) for a game, used by the table rows and the cards. A DLC listed on its own is
// edited on its game's page (DLCs are edited along with their game), and deleting it deletes only the DLC
export const GameActions: React.FC<{ game: IGame; className?: string }> = ({ game, className }) => {
  const removeGame = useGamesStore((state) => state.remove);
  const dlcCount = game.DLCs.length;

  return (
    <span className={cn("inline-flex gap-2", className)}>
      <Link to={`/edit/${game.parent?.id ?? game.id}`} className={iconButtonClass} aria-label={`Edit ${game.title}`} title="Edit">
        <Pencil className="size-6 shrink-0" />
      </Link>
      <AlertDialog>
        <AlertDialogTrigger className={cn(iconButtonClass, "hover:border-destructive hover:text-destructive")} aria-label={`Delete ${game.title}`} title="Delete">
          <Trash className="size-6 shrink-0" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {game.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {game.parent
              ? `The DLC will be removed from ${game.parent.title}.`
              : dlcCount > 0
                ? `Its ${dlcCount} DLC${dlcCount === 1 ? "" : "s"} will be deleted too.`
                : "The game will be removed from your list."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => removeGame(game.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
};

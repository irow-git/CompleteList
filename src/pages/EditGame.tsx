import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AddGameFormValues } from "../components/GameForm";
import { GameEditor } from "../components/GameEditor";
import { IGame } from "../interfaces";
import { useGamesStore } from "@/store/gamesStore";

const EditGame: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const updateGame = useGamesStore((state) => state.update);

  // Loaded from the database rather than the store, since the game doesn't have to be on the current page
  const [game, setGame] = useState<IGame | null | undefined>(undefined);

  useEffect(() => {
    setGame(undefined);
    window.api.games.get(id).then(setGame);
  }, [id]);

  const onFinish = (values: AddGameFormValues) => {
    updateGame({ ...values, id }).then(() => {
      navigate("/");
    });
  };

  if (game === undefined) return null;
  if (game === null) return <div className="p-5 text-center font-pixel text-sm text-black/45">Game not found</div>;

  return <GameEditor key={game.id} defaultValues={game} onSubmit={onFinish} />;
};

export default EditGame;

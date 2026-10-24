import { AddGameFormValues, emptyGameFormValues } from "../components/GameForm";
import { GameEditor } from "../components/GameEditor";
import { useGamesStore } from "@/store/gamesStore";
import { useNavigate } from "react-router-dom";

const AddGame: React.FC = () => {
  const navigate = useNavigate();

  const addGame = useGamesStore((state) => state.add);

  const onFinish = (values: AddGameFormValues) => {
    addGame(values).then(() => {
      navigate('/');
    })
  };

  return <GameEditor defaultValues={{ ...emptyGameFormValues, DLCs: [] }} onSubmit={onFinish} />;
};

export default AddGame;

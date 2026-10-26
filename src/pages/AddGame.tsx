import { AddGameFormValues, emptyGameFormValues } from "../components/GameForm";
import { GameEditor } from "../components/GameEditor";
import { Panel } from "@/layout/Panel";
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

  return (
    <Panel>
      <GameEditor defaultValues={{ ...emptyGameFormValues, id: crypto.randomUUID(), DLCs: [] }} onSubmit={onFinish} />
    </Panel>
  );
};

export default AddGame;

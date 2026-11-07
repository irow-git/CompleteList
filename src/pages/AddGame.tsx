import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddGameFormValues, emptyGameFormValues } from "../components/GameForm";
import { GameEditor } from "../components/GameEditor";
import { SeriesChoice, SeriesChoiceDialog } from "@/components/SeriesChoiceDialog";
import { Panel } from "@/layout/Panel";
import { useGamesStore } from "@/store/gamesStore";
import type { SeriesCandidate } from "@/lib/series";

// A new game's series is worked out from the titles already in the collection when it's saved: a clear match is
// applied as is, an unclear one is asked about first
const AddGame: React.FC = () => {
  const navigate = useNavigate();
  const addGame = useGamesStore((state) => state.add);
  // The submitted form, waiting for the user to pick a series
  const [pending, setPending] = useState<{ values: AddGameFormValues; candidates: SeriesCandidate[] } | null>(null);

  const save = (values: AddGameFormValues, { name, joinIds }: SeriesChoice) =>
    addGame({ ...values, series: name, joinSeries: joinIds }).then(() => navigate(-1));

  const onFinish = async (values: AddGameFormValues) => {
    const suggestion = await window.api.series.suggest(values.title, values.release_date);
    if (suggestion.kind === "none") return save(values, { name: null, joinIds: [] });
    if (suggestion.kind === "auto") {
      const { name, join } = suggestion.candidate;
      return save(values, { name, joinIds: join.map((game) => game.id) });
    }
    setPending({ values, candidates: suggestion.candidates });
  };

  return (
    <Panel>
      <GameEditor defaultValues={{ ...emptyGameFormValues, id: crypto.randomUUID(), DLCs: [] }} onSubmit={onFinish} />
      <SeriesChoiceDialog
        title={pending?.values.title ?? null}
        candidates={pending?.candidates ?? []}
        onCancel={() => setPending(null)}
        onChoose={(choice) => {
          if (!pending) return;
          setPending(null);
          save(pending.values, choice);
        }}
      />
    </Panel>
  );
};

export default AddGame;

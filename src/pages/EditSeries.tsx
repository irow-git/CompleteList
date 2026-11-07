import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Search, Trash } from "pixelarticons/react";
import type { IGame, SeriesMember } from "@/interfaces";
import { sameSeries } from "@/lib/series";
import { formatDay } from "@/lib/dates";
import { useGamesStore } from "@/store/gamesStore";
import { useSyncStore } from "@/store/syncStore";
import { Panel } from "@/layout/Panel";
import { FormItem } from "@/components/FormItem";
import { Cover } from "@/components/games/Cover";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const SEARCH_DELAY_MS = 250;
const PICKER_SIZE = 20;

const year = (date: Date | null) => (date ? formatDay(date).slice(0, 4) : "");

const byRelease = (a: SeriesMember, b: SeriesMember) =>
  (a.release_date?.getTime() ?? Infinity) - (b.release_date?.getTime() ?? Infinity) || a.title.localeCompare(b.title);

const memberOf = (game: IGame): SeriesMember => ({
  id: game.id,
  title: game.title,
  cover_image: game.cover_image,
  release_date: game.release_date,
  series: game.series,
});

// Finds games to add: searches the collection (base games; DLCs go with their game) as you type
const GamePicker: React.FC<{ exclude: Set<string>; current: string; onPick: (game: SeriesMember) => void }> = ({
  exclude,
  current,
  onPick,
}) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [results, setResults] = useState<SeriesMember[]>([]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      // Without a search, games that aren't in a series yet come first
      const request = text.trim()
        ? { page: 0, pageSize: PICKER_SIZE + exclude.size, search: text.trim() }
        : { page: 0, pageSize: PICKER_SIZE + exclude.size, sort: [{ field: "title" as const, direction: "asc" as const }] };
      window.api.games.list(request).then((page) => {
        if (!live) return;
        const games = page.games.map(memberOf).filter((game) => !exclude.has(game.id));
        if (!text.trim()) games.sort((a, b) => Number(!!a.series) - Number(!!b.series));
        setResults(games.slice(0, PICKER_SIZE));
      });
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, text, exclude]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="w-fit drop-shadow-[0px_1px_1px_black]">
        {/* Styled like a Button rather than asChild: Button doesn't forward refs, which the popover needs to place itself */}
        <PopoverTrigger className={cn(buttonVariants({ size: "lg" }), "form-control-clip-large w-[200px]")}>
          <Plus className="size-6" />
          Add games
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="option-clip w-[420px] rounded-none border-0 bg-ink p-2 font-chava text-white">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-5 -translate-y-1/2 text-black/45" />
          <Input
            autoFocus
            type="search"
            aria-label="Search games to add"
            placeholder="Search games"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="form-control-clip w-full pl-10"
          />
        </div>
        {/* A fixed height, however many games are found, so the popover never changes size and stays put */}
        <ul className="h-[min(50vh,360px)] overflow-y-auto">
          {results.length === 0 && <li className="px-2 py-1.5 text-white/65">No games found</li>}
          {results.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => onPick(game)}
                className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left hover:bg-sand hover:text-ink"
              >
                <span className="min-w-0 flex-auto truncate">{game.title}</span>
                {game.series && !sameSeries(game.series, current) && (
                  <span className="shrink-0 bg-white/90 px-1.5 font-pixel text-[10px] leading-5 text-ink" title="Adding it moves it from that series">
                    in {game.series}
                  </span>
                )}
                <span className="shrink-0 text-sm opacity-65">{year(game.release_date)}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

// Edits a series (or makes a new one, at /series/new): its name and which games are in it
const EditSeries: React.FC = () => {
  const { name: param } = useParams();
  const navigate = useNavigate();
  const isNew = param === undefined;
  const [loaded, setLoaded] = useState<"loading" | "found" | "missing">(isNew ? "found" : "loading");
  const [name, setName] = useState("");
  const [members, setMembers] = useState<SeriesMember[]>([]);
  // Picked from another series: waits for the user to confirm moving it
  const [moving, setMoving] = useState<SeriesMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (param === undefined) return;
    setLoaded("loading");
    window.api.series.get(param).then((series) => {
      if (!series) return setLoaded("missing");
      setName(series.name);
      setMembers(series.members);
      setLoaded("found");
    });
  }, [param]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const add = (game: SeriesMember) => setMembers((current) => [...current, game].sort(byRelease));
  const pick = (game: SeriesMember) => {
    if (game.series && !sameSeries(game.series, param)) setMoving(game);
    else add(game);
  };

  // Moving games between series, renaming or deleting one changes those games, so lists reload and sync has work
  const afterChange = () => Promise.all([useGamesStore.getState().reload(), useSyncStore.getState().refresh()]);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("A series needs a name");
    if (members.length === 0) return setError(isNew ? "Add at least one game" : "Add at least one game, or delete the series");
    setSaving(true);
    try {
      await window.api.series.save({ oldName: param ?? null, name, memberIds: members.map((member) => member.id) });
      await afterChange();
      navigate(-1);
    } catch (reason) {
      // IPC errors arrive as "Error invoking remote method '…': Error: <message>"
      setError(String(reason).replace(/^.*Error: /, ""));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!param) return;
    await window.api.series.remove(param);
    await afterChange();
    navigate("/series");
  };

  if (loaded === "loading") return <Panel />;
  if (loaded === "missing")
    return (
      <Panel>
        <div className="p-5 text-center font-pixel text-sm text-black/45">Series not found</div>
      </Panel>
    );

  return (
    <Panel>
      <div className="flex flex-col gap-6 p-5 text-start font-chava text-base">
        <FormItem label="Name" htmlFor="series-name" required error={error ?? undefined}>
          <Input
            id="series-name"
            size="lg"
            maxLength={200}
            placeholder="Series name"
            value={name}
            aria-invalid={!!error}
            onChange={(event) => setName(event.target.value)}
            className="form-control-clip-large max-w-[520px]"
          />
        </FormItem>

        <section>
          <h4 className="mb-3 text-xl leading-[1.4] font-semibold">
            Games <span className="font-normal text-black/45">{members.length}</span>
          </h4>
          {members.length === 0 && <p className="mb-3 text-black/45">No games yet</p>}
          <ul className="mb-4 flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.id} className="flex max-w-[720px] items-center gap-3 bg-sand-light p-2 pr-3 option-clip">
                <Cover owner={member.id} image={member.cover_image} title={member.title} className="aspect-[2/3] w-10 shrink-0" />
                <span className="min-w-0 flex-auto truncate">{member.title}</span>
                <span className="shrink-0 text-black/55">{year(member.release_date)}</span>
                <button
                  type="button"
                  aria-label={`Take ${member.title} out of the series`}
                  title="Remove from the series"
                  onClick={() => setMembers((current) => current.filter((other) => other.id !== member.id))}
                  className="inline-flex size-[26px] shrink-0 cursor-pointer items-center justify-center bg-white hover:text-destructive"
                >
                  <Trash className="size-6" />
                </button>
              </li>
            ))}
          </ul>
          <GamePicker exclude={memberIds} current={param ?? name} onPick={pick} />
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <div className="drop-shadow-[0px_1px_1px_black]">
            <Button size="lg" className="form-control-clip-large w-[200px]" disabled={saving} onClick={save}>
              Save
            </Button>
          </div>
          <div className="drop-shadow-[0px_1px_1px_black]">
            <Button size="lg" className="form-control-clip-large w-[200px]" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
          {!isNew && (
            <AlertDialog>
              <AlertDialogTrigger className="ml-auto cursor-pointer text-black/65 underline hover:text-destructive">Delete series</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Delete {param}?</AlertDialogTitle>
                <AlertDialogDescription>Its games stay in your list, just without a series.</AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive" onClick={remove}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Same look as the delete confirmation */}
      <AlertDialog open={moving !== null} onOpenChange={(open) => !open && setMoving(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Move {moving?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            It's already in {moving?.series}. Adding it here takes it out of that series once you save.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (moving) add(moving);
                setMoving(null);
              }}
            >
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
};

export default EditSeries;

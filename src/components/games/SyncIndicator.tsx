import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Cloud, Reload, WarningDiamond } from "pixelarticons/react";
import { useSyncStore } from "@/store/syncStore";
import { cn } from "@/lib/utils";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Last sync time, unsynced change count and the Sync button. Syncing only ever happens when the button is pressed
export const SyncIndicator: React.FC = () => {
  const { status, running, error, refresh, run } = useSyncStore();
  // Re-render every minute so "5 minutes ago" keeps up
  const [, setTick] = useState(0);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!status) return null;

  if (!status.configured) {
    return (
      <span className="inline-flex items-center gap-2 text-black/55">
        <Cloud className="size-6" />
        Sync is off ·{" "}
        <Link to="/settings" className="text-ink underline">
          Set up
        </Link>
      </span>
    );
  }

  const lastSynced = status.lastSyncedAt ? `Synced ${formatDistanceToNow(status.lastSyncedAt, { addSuffix: true })}` : "Never synced";
  const pending = status.pendingChanges > 0 ? plural(status.pendingChanges, "unsynced change") : "Up to date";

  return (
    <span className="inline-flex items-center gap-3">
      <span className="inline-flex items-center gap-2" aria-live="polite">
        {error ? <WarningDiamond className="size-6 text-error" /> : <Cloud className="size-6" />}
        {running ? "Syncing…" : `${lastSynced} · ${pending}`}
      </span>
      {error && !running && (
        <span className="max-w-[320px] truncate text-error" title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="inline-flex cursor-pointer items-center gap-1 bg-white px-2 py-0.5 hover:bg-sand disabled:cursor-wait disabled:opacity-60"
      >
        <Reload className={cn("size-6", running && "animate-spin")} />
        Sync
      </button>
    </span>
  );
};

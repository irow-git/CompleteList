import { useCallback, useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Cloud, Computer, WarningDiamond } from "pixelarticons/react";
import type { SyncHistoryPage, SyncReport } from "@/interfaces";
import { Button } from "@/components/ui/button";
import { SyncReportDialog } from "@/components/SyncDetailsDialog";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useSyncStore } from "@/store/syncStore";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

// Settings → Sync history: the syncs that changed something, newest first. Each opens its details
export const SyncHistory: React.FC = () => {
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<SyncHistoryPage | null>(null);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<SyncReport | null>(null);
  // A sync finishing while this is shown adds to it
  const latest = useSyncStore((state) => state.report);

  const load = useCallback(async () => {
    try {
      const loaded = await window.api.sync.history(page, PAGE_SIZE);
      // Back a page if this one emptied (the oldest reports are dropped as new ones come in)
      if (loaded.entries.length === 0 && page > 0) setPage(Math.max(0, Math.ceil(loaded.total / PAGE_SIZE) - 1));
      else setHistory(loaded);
      setError(undefined);
    } catch (caught) {
      setError(ipcErrorMessage(caught));
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load, latest]);

  const show = async (id: number) => {
    try {
      const report = await window.api.sync.report(id);
      if (report) setOpen(report);
      else await load(); // dropped meanwhile
    } catch (caught) {
      setError(ipcErrorMessage(caught));
    }
  };

  const pages = history ? Math.max(1, Math.ceil(history.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <h2 className="mb-2 font-pixel text-xl">Sync history</h2>
      <p className="mb-6 max-w-[760px] text-black/65">
        The syncs that changed something, newest first. Open one to see what changed on this computer and in the cloud.
      </p>

      {error && <p className="mb-4 text-error">{error}</p>}

      {history && history.total === 0 ? (
        <p className="text-black/45">No syncs with changes yet.</p>
      ) : (
        history && (
          <>
            <ul className="max-w-[760px] divide-y divide-black/10 border-y border-black/10">
              {history.entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => show(entry.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-2 py-2 text-left hover:bg-black/5"
                    title="Show what this sync changed"
                  >
                    {entry.failed ? (
                      <WarningDiamond className="size-5 shrink-0 text-error" aria-label="Failed" />
                    ) : entry.warnings > 0 ? (
                      <WarningDiamond className="size-5 shrink-0 text-warning" aria-label="Partly synced" />
                    ) : (
                      <Check className="size-5 shrink-0 text-black" aria-label="Complete" />
                    )}
                    <span className={cn("underline decoration-dotted underline-offset-4", entry.failed && "text-error")}>
                      {format(entry.startedAt, "yyyy-MMM-dd HH:mm:ss")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-black/45">{formatDistanceToNow(entry.startedAt, { addSuffix: true })}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-black/65" title="Changes on this computer">
                      <Computer className="size-4" />
                      {entry.localChanges}
                    </span>
                    <span className="inline-flex w-14 items-center gap-1 text-sm text-black/65" title="Changes in the cloud">
                      <Cloud className="size-4" />
                      {entry.cloudChanges}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <div className="mt-4 flex max-w-[760px] items-center justify-end gap-3">
                <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Newer">
                  <ChevronLeft className="size-5" />
                </Button>
                <span className="text-sm tabular-nums">
                  Page {page + 1} of {pages}
                </span>
                <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Older">
                  <ChevronRight className="size-5" />
                </Button>
              </div>
            )}
          </>
        )
      )}

      <SyncReportDialog report={open} open={open !== null} onClose={() => setOpen(null)} />
    </div>
  );
};

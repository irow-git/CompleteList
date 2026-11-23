import { useEffect, useState } from "react";
import { Check, Close, Reload, WarningDiamond } from "pixelarticons/react";
import type { SyncResult } from "@/interfaces";
import { useSyncStore } from "@/store/syncStore";
import { cn } from "@/lib/utils";
import { formatElapsed } from "./SyncDetailsDialog";

// A finished sync's toast goes by itself after this long (unless the pointer is over it); one that failed or has
// warnings stays
const SUCCESS_DISMISS_MS = 8_000;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// What a finished sync did, one line per part that did something
function summary(result: SyncResult, hasWarnings: boolean): string[] {
  const lines: string[] = [];
  if (result.pulled > 0) lines.push(`Downloaded ${plural(result.pulled, "change")}`);
  if (result.pushed > 0) lines.push(`Uploaded ${plural(result.pushed, "change")}`);
  const images = result.images;
  if (images) {
    if (images.uploaded > 0) lines.push(`Uploaded ${plural(images.uploaded, "cover image")}`);
    if (images.downloaded > 0) lines.push(`Downloaded ${plural(images.downloaded, "cover image")}`);
    if (images.deleted > 0) lines.push(`Deleted ${plural(images.deleted, "cover image")} from the cloud`);
    if (images.missing > 0) lines.push(`${plural(images.missing, "cover image")} not in the cloud yet (another computer has to sync first)`);
  }
  // With a part not set up, "up to date" would only be true of the part that ran
  return lines.length > 0 ? lines : [hasWarnings ? "Nothing new to sync" : "Everything was already up to date"];
}

// Opens the details dialog; looks like a link
const DetailsLink: React.FC<{ className?: string; children: React.ReactNode; title?: string }> = ({ className, children, title }) => {
  const openDetails = useSyncStore((state) => state.openDetails);
  return (
    <button
      type="button"
      onClick={openDetails}
      title={title ?? "Show what was synced"}
      className={cn("cursor-pointer text-left underline decoration-dotted underline-offset-4 hover:decoration-solid", className)}
    >
      {children}
    </button>
  );
};

// Top-right corner: what the running sync is doing, step by step, then how it went. The status, error and warnings
// open the details dialog. Closed with its × button
export const SyncToast: React.FC = () => {
  const { toastOpen, running, steps, startedAt, error, report, dismissToast, detailsOpen } = useSyncStore();
  const [now, setNow] = useState(Date.now());
  const [hovered, setHovered] = useState(false);

  // The clock ticks while syncing, so it's clear the sync is still going (and how close it is to the 1 minute limit)
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const result = !running ? (report?.result ?? null) : null;
  const warnings = !running ? (report?.warnings ?? []) : [];
  const autoDismiss = !!result && !error && warnings.length === 0;
  useEffect(() => {
    if (!toastOpen || !autoDismiss || hovered || detailsOpen) return;
    const timer = setTimeout(dismissToast, SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toastOpen, autoDismiss, hovered, detailsOpen, dismissToast]);

  if (!toastOpen) return null;

  const failed = !running && !!error;
  const title = running ? "Syncing…" : failed ? "Sync failed" : warnings.length > 0 ? "Partly synced" : "Sync complete";
  const clock = report ? formatElapsed(report.startedAt, report.finishedAt) : startedAt ? formatElapsed(startedAt, now) : null;

  return (
    <div
      role={failed ? "alert" : "status"}
      aria-live={failed ? "assertive" : "polite"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed top-4 right-4 z-50 w-[360px] max-w-[calc(100vw-32px)] drop-shadow-[1px_2px_3px_black] animate-in fade-in slide-in-from-right-4"
    >
      <div className="form-control-clip bg-white px-4 py-3 text-left text-sm leading-normal text-black/88">
        <div className="flex items-center gap-2">
          {running ? (
            <Reload className="size-6 shrink-0 animate-spin text-black" />
          ) : failed ? (
            <WarningDiamond className="size-6 shrink-0 text-error" />
          ) : warnings.length > 0 ? (
            <WarningDiamond className="size-6 shrink-0 text-warning" />
          ) : (
            <Check className="size-6 shrink-0 text-black" />
          )}
          <span className={cn("flex-1", failed && "text-error")}>{report ? <DetailsLink>{title}</DetailsLink> : title}</span>
          {clock && <span className="text-xs text-faded tabular-nums">{clock}</span>}
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={dismissToast}
            className="flex shrink-0 cursor-pointer items-center justify-center text-black/45 hover:text-black/88"
          >
            <Close className="size-5" />
          </button>
        </div>

        {steps.length > 0 && (
          <ol className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-black/10 pt-2 text-xs">
            {steps.map((step, index) => {
              const current = index === steps.length - 1;
              // The last step is the one in progress while running, and the one that failed if it failed
              const failedHere = current && failed;
              return (
                <li key={index} className={cn("flex items-start gap-2", current && running ? "text-black" : "text-faded", failedHere && "text-error")}>
                  <span className="w-3 shrink-0 text-center">{current && running ? "›" : failedHere ? "×" : "✓"}</span>
                  <span className="min-w-0 flex-1 break-words">{step}</span>
                </li>
              );
            })}
          </ol>
        )}

        {failed && (
          <p className="mt-2 border-t border-black/10 pt-2 text-xs break-words text-error">
            {report ? <DetailsLink title="Show the error and what was synced before it">{error}</DetailsLink> : error}
          </p>
        )}

        {result && !failed && (
          <ul className="mt-2 space-y-1 border-t border-black/10 pt-2 text-xs">
            {summary(result, warnings.length > 0).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {/* What didn't sync because it isn't set up; the rest still did */}
        {warnings.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-black/10 pt-2 text-xs text-warning">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <WarningDiamond className="mt-px size-3.5 shrink-0" />
                <DetailsLink className="min-w-0 flex-1 break-words" title="Show the details">
                  {warning}
                </DetailsLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

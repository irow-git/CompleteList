import { format } from "date-fns";
import { ChevronRight, Cloud, Computer, WarningDiamond } from "pixelarticons/react";
import type { SyncChange, SyncReport } from "@/interfaces";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSyncStore } from "@/store/syncStore";
import { cn } from "@/lib/utils";

export const formatElapsed = (from: Date | number, to: Date | number) => {
  const seconds = Math.max(0, Math.floor((Number(to) - Number(from)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// Like a diff: + added, ~ changed, − deleted
const ACTIONS: Record<SyncChange["action"], { sign: string; label: string; className: string; dot: string }> = {
  added: { sign: "+", label: "Added", className: "bg-added-bg text-added", dot: "bg-added" },
  changed: { sign: "~", label: "Changed", className: "bg-warning-bg text-warning", dot: "bg-warning" },
  deleted: { sign: "−", label: "Deleted", className: "bg-error-bg text-error", dot: "bg-error" },
};

const KINDS: Record<SyncChange["kind"], string> = {
  game: "Game",
  dlc: "DLC",
  cover: "Cover",
  image: "Image",
  option: "Option",
};

const SIDES: Record<SyncChange["side"], { name: string; description: string; icon: React.ReactNode }> = {
  local: { name: "Local", description: "Pulled from the cloud onto this computer", icon: <Computer className="size-6" /> },
  cloud: { name: "Cloud", description: "Pushed from this computer to the cloud", icon: <Cloud className="size-6" /> },
};

// A property's value, or a dash for none. Long ones (comments) scroll within their cell
const Value: React.FC<{ value: string | null; className?: string }> = ({ value, className }) =>
  value === null ? (
    <span className="text-black/35">—</span>
  ) : (
    <span className={cn("block max-h-24 overflow-y-auto px-1 break-words whitespace-pre-wrap", className)}>{value}</span>
  );

// One changed item, as a commit on its side's branch: what happened to it, and its properties' old and new values
const ChangeItem: React.FC<{ change: SyncChange }> = ({ change }) => {
  const action = ACTIONS[change.action];
  const hasFields = change.fields.length > 0;
  // Changes are what's interesting: open. Additions list every property, so they start closed
  const startOpen = change.action === "changed" && change.fields.length <= 8;

  const header = (
    <>
      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center font-pixel text-xs", action.className)} title={action.label}>
        {action.sign}
      </span>
      <span className="w-14 shrink-0 font-pixel text-[10px] text-faded uppercase">{KINDS[change.kind]}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{change.title}</span>
        {change.note && <span className="ml-2 text-sm text-black/55">{change.note}</span>}
      </span>
      {change.kind === "game" || change.kind === "dlc" ? (
        <span className="shrink-0 text-xs text-black/45">
          {change.action === "deleted" ? "deleted" : hasFields ? plural(change.fields.length, "property", "properties") : "no property changes"}
        </span>
      ) : null}
    </>
  );

  return (
    <li className="relative pl-6">
      {/* The commit's dot on the branch line */}
      <span className={cn("absolute top-[9px] left-[3px] size-2.5 border-2 border-sand-light", action.dot)} aria-hidden />
      {hasFields ? (
        <details open={startOpen} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-1 hover:bg-black/5 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 shrink-0 text-black/45 transition-transform group-open:rotate-90" />
            {header}
          </summary>
          <table className="mt-1 mb-2 ml-6 w-[calc(100%-1.5rem)] table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-left font-pixel text-[10px] text-faded uppercase">
                <th className="w-32 pb-1 font-normal">Property</th>
                <th className="pb-1 font-normal">From</th>
                <th className="pb-1 font-normal">To</th>
              </tr>
            </thead>
            <tbody>
              {change.fields.map((field) => (
                <tr key={field.name} className="border-t border-black/10 align-top">
                  <td className="py-1 pr-2 text-black/65">{field.name}</td>
                  <td className="py-1 pr-2">
                    <Value value={field.from} className="bg-error-bg text-error line-through decoration-error/50" />
                  </td>
                  <td className="py-1">
                    <Value value={field.to} className="bg-added-bg text-added" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : (
        <div className="flex items-center gap-2 py-1">
          <span className="size-4 shrink-0" />
          {header}
        </div>
      )}
    </li>
  );
};

// Everything that changed on one side, as a branch with a commit per item
const SideGroup: React.FC<{ side: SyncChange["side"]; changes: SyncChange[] }> = ({ side, changes }) => {
  const { name, description, icon } = SIDES[side];
  const counts = (["added", "changed", "deleted"] as const).map((action) => ({ action, count: changes.filter((change) => change.action === action).length }));

  return (
    <section>
      <header className="flex items-center gap-2 border-b-2 border-ink pb-1">
        {icon}
        <h3 className="font-pixel text-base">{name}</h3>
        <span className="min-w-0 flex-1 truncate text-sm text-black/55">{description}</span>
        {counts
          .filter(({ count }) => count > 0)
          .map(({ action, count }) => (
            <span key={action} className={cn("px-1.5 font-pixel text-[10px]", ACTIONS[action].className)} title={`${count} ${ACTIONS[action].label.toLowerCase()}`}>
              {ACTIONS[action].sign}
              {count}
            </span>
          ))}
      </header>
      {changes.length === 0 ? (
        <p className="py-2 pl-6 text-sm text-black/45">No changes</p>
      ) : (
        // The branch line runs down the left, through each item's dot
        <ul className="relative mt-1 before:absolute before:top-0 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-black/15">
          {changes.map((change, index) => (
            <ChangeItem key={index} change={change} />
          ))}
        </ul>
      )}
    </section>
  );
};

const Notice: React.FC<{ tone: "error" | "warning"; title: string; children: React.ReactNode }> = ({ tone, title, children }) => (
  <div className={cn("flex gap-3 border-l-4 px-3 py-2", tone === "error" ? "border-error bg-error-bg" : "border-warning bg-warning-bg")}>
    <WarningDiamond className={cn("mt-0.5 size-5 shrink-0", tone === "error" ? "text-error" : "text-warning")} />
    <div className="min-w-0 flex-1">
      <p className={cn("font-pixel text-xs", tone === "error" ? "text-error" : "text-warning")}>{title}</p>
      <div className="mt-1 text-sm break-words">{children}</div>
    </div>
  </div>
);

const statusOf = (report: SyncReport) => (report.error ? "Failed" : report.warnings.length > 0 ? "Partly synced" : "Complete");

// A sync in full: its error and warnings, then every change on each side, then its steps
export const SyncReportDialog: React.FC<{ report: SyncReport | null; open: boolean; onClose: () => void }> = ({ report, open, onClose }) => {
  if (!report) return null;

  const local = report.changes.filter((change) => change.side === "local");
  const cloud = report.changes.filter((change) => change.side === "cloud");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[820px] flex-col p-0">
        <div className="border-b border-black/10 px-6 pt-5 pb-3 pr-14">
          <DialogTitle>Sync details</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            {statusOf(report)} · {format(report.startedAt, "yyyy-MMM-dd HH:mm:ss")} · took {formatElapsed(report.startedAt, report.finishedAt)} ·{" "}
            {plural(report.changes.length, "change")}
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {report.error && (
            <Notice tone="error" title={report.failedStep ? `Failed while ${report.failedStep.charAt(0).toLowerCase()}${report.failedStep.slice(1)}` : "Failed"}>
              {report.error}
              {report.changes.length > 0 && <p className="mt-1 text-black/65">The changes below were made before it failed, and were kept.</p>}
            </Notice>
          )}
          {report.warnings.length > 0 && (
            <Notice tone="warning" title={report.warnings.length === 1 ? "Warning" : `${report.warnings.length} warnings`}>
              <ul className="space-y-1">
                {report.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Notice>
          )}

          <SideGroup side="local" changes={local} />
          <SideGroup side="cloud" changes={cloud} />

          <details className="group text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-1 font-pixel text-xs text-faded [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
              Steps ({report.steps.length})
            </summary>
            <ol className="mt-2 ml-5 space-y-0.5 text-black/65">
              {report.steps.map((step, index) => {
                const failedHere = !!report.error && index === report.steps.length - 1;
                return (
                  <li key={index} className={cn(failedHere && "text-error")}>
                    {failedHere ? "× " : "✓ "}
                    {step}
                  </li>
                );
              })}
            </ol>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// The latest sync's, opened from the toast and the toolbar
export const SyncDetailsDialog: React.FC = () => {
  const { report, detailsOpen, closeDetails } = useSyncStore();
  return <SyncReportDialog report={report} open={detailsOpen} onClose={closeDetails} />;
};

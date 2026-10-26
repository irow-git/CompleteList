import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight, ChevronUp, MoreHorizontal } from "pixelarticons/react";
import { PAGE_SIZES, useGamesStore } from "@/store/gamesStore";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const PAGE_CLUSTER = 5;
const MAX_VISIBLE_WITHOUT_ELLIPSIS = 7;

const paginationClassName = (callback: boolean) =>
  cn("size-fit cursor-pointer text-[20px] flex items-center justify-center", callback ? "border-be-3 border-be-gray-400" : "hover:bg-muted");

const arrowClassName = "size-fit cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400";

const PageSizeMenu: React.FC = () => {
  const { pageSize, setPageSize } = useGamesStore(useShallow(({ pageSize, setPageSize }) => ({ pageSize, setPageSize })));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex cursor-pointer items-center gap-1 text-[20px] outline-none"
        aria-label="Games per page"
      >
        {pageSize} per page
        <ChevronUp className="size-6" />
      </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" alignOffset={-20} className="py-2 option-clip min-w-0 rounded-none bg-ink font-pixel">
          <DropdownMenuRadioGroup value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            {PAGE_SIZES.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)} className="rounded-none text-white">
                {size}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    </DropdownMenu>
  );
};

// What's typed only loads once it's committed (Enter or leaving the field), clamped to a real page
const PageInput: React.FC<{ page: number; pageCount: number; onCommit: (page: number) => void }> = ({ page, pageCount, onCommit }) => {
  const [draft, setDraft] = useState(String(page + 1));

  useEffect(() => setDraft(String(page + 1)), [page]);

  const commit = () => {
    const typed = Math.round(Number(draft));
    if (!draft.trim() || Number.isNaN(typed)) return setDraft(String(page + 1));
    const target = Math.min(Math.max(typed, 1), pageCount) - 1;
    setDraft(String(target + 1));
    if (target !== page) onCommit(target);
  };

  return (
    <p className="text-[20px]">
      Page&nbsp;
      <Input
        value={draft}
        max={pageCount}
        min={1}
        aria-label="Page number"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="p-0 text-[20px] w-10 text-center bg-white border-b-3 border-b-solid border-b-gray-400"
      ></Input>
      &nbsp;of {pageCount}
    </p>
  );
};

export const Pagination: React.FC = () => {
  const { page, pageSize, total, loadPage } = useGamesStore(useShallow(({ page, pageSize, total, loadPage }) => ({ page, pageSize, total, loadPage })));

  const [startPage, setStartPage] = useState(0);
  const pageCount = Math.ceil(total / pageSize);
  const halfCluster = Math.floor(PAGE_CLUSTER / 2);

  useEffect(() => {
    if (page <= startPage) {
      setStartPage(Math.max(0, page - halfCluster));
    } else if (page >= startPage + PAGE_CLUSTER - 1) {
      setStartPage(Math.min(Math.max(0, pageCount - PAGE_CLUSTER), page - halfCluster));
    }
  }, [page, pageCount]);

  // With few pages every page gets a button; otherwise a window of PAGE_CLUSTER pages plus the first and last.
  // The window start is clamped here too, since startPage only catches up after the effect above runs
  const compact = pageCount <= MAX_VISIBLE_WITHOUT_ELLIPSIS;
  const windowStart = compact ? 0 : Math.min(startPage, Math.max(0, pageCount - PAGE_CLUSTER));
  const clusterSize = compact ? pageCount : Math.min(PAGE_CLUSTER, pageCount - windowStart);
  const showFirst = windowStart > 0;
  const showLeadingEllipsis = windowStart > 1;
  const showLast = windowStart + clusterSize < pageCount;
  const showTrailingEllipsis = windowStart + clusterSize < pageCount - 1;

  const handlePageClick = (offset: number, isFirst: boolean, isLast: boolean) => {
    loadPage(offset);

    if (isFirst) {
      setStartPage(Math.max(0, offset - halfCluster));
    } else if (isLast) {
      setStartPage(Math.min(Math.max(0, pageCount - PAGE_CLUSTER), offset - halfCluster));
    }
  };

  return (
    <nav aria-label="Pagination" className="h-full justify-between px-8 flex items-center font-pixel text-sm">
      <div className="flex items-center gap-8">
        {!compact && <PageInput page={page} pageCount={pageCount} onCommit={loadPage} />}
        <PageSizeMenu />
      </div>
      {pageCount > 1 && (
        <div className="my-4 gap-4 flex justify-end">
          <button type="button" className={arrowClassName} onClick={() => loadPage(page - 1)} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft className="size-6 mt-1" />
          </button>

          {showFirst && (
            <>
              <button
                type="button"
                aria-current={0 === page ? "page" : undefined}
                onClick={() => {
                  loadPage(0);
                  setStartPage(0); // Reset cluster back to the beginning
                }}
                className={paginationClassName(0 === page)}
              >
                1
              </button>
              {showLeadingEllipsis && <MoreHorizontal className="size-6 flex items-center justify-center mt-[2px]" />}
            </>
          )}

          {Array.from({ length: clusterSize }, (_, index) => {
            const offset = windowStart + index;
            const isFirst = !compact && index === 0;
            const isLast = !compact && index === clusterSize - 1;

            return (
              <button
                key={offset}
                type="button"
                aria-current={offset === page ? "page" : undefined}
                onClick={() => handlePageClick(offset, isFirst, isLast)}
                className={paginationClassName(offset === page)}
              >
                {offset + 1}
              </button>
            );
          })}

          {showLast && (
            <>
              {showTrailingEllipsis && <MoreHorizontal className="size-6 flex items-center justify-center mt-[2px]" />}
              <button
                type="button"
                aria-current={pageCount - 1 === page ? "page" : undefined}
                onClick={() => {
                  loadPage(pageCount - 1);
                  setStartPage(Math.max(0, pageCount - PAGE_CLUSTER)); // Shift cluster to the very end
                }}
                className={paginationClassName(pageCount - 1 === page)}
              >
                {pageCount}
              </button>
            </>
          )}

          <button type="button" className={arrowClassName} onClick={() => loadPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page">
            <ChevronRight className="size-6 mt-1" />
          </button>
        </div>
      )}
    </nav>
  );
};

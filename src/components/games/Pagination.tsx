import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "pixelarticons/react";
import { useGamesStore } from "@/store/gamesStore";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

const PAGE_CLUSTER = 5;
const MAX_VISIBLE_WITHOUT_ELLIPSIS = 7;

const paginationClassName = (callback: boolean) =>
  cn("size-fit cursor-pointer text-[20px] flex items-center justify-center", callback ? "text-[22px] border-be-3 border-be-gray-400" : "hover:bg-muted");

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

  if (pageCount <= 1) return null;

  if (pageCount <= MAX_VISIBLE_WITHOUT_ELLIPSIS) {
    return (
      <nav aria-label="Pagination" className="h-full my-4 flex items-center justify-end gap-4 font-pixel text-sm">
        <button
          type="button"
          className="size-fit cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
          onClick={() => loadPage(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-6" />
        </button>

        {Array.from({ length: pageCount }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-current={index === page ? "page" : undefined}
            onClick={() => loadPage(index)}
            className={paginationClassName(index === page)}
          >
            {index + 1}
          </button>
        ))}

        <button
          type="button"
          className="size-fit cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
          onClick={() => loadPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          <ChevronRight className="size-6" />
        </button>
      </nav>
    );
  }

  const clusterSize = Math.min(PAGE_CLUSTER, pageCount - startPage);
  const showLeadingEllipsis = startPage > 1;
  const showTrailingEllipsis = startPage + clusterSize < pageCount - 1;

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
      <p className="text-[20px]">
        Page&nbsp;
        <Input
          value={page + 1}
          max={pageCount}
          min={1}
          onChange={(e) => loadPage(Number(e.target.value) - 1)}
          type="number"
          className="p-1 w-14 bg-dirty-black border-1 border-solid border-gray-400"
        ></Input>
        &nbsp;of {pageCount}
      </p>
      <div className="my-4 gap-4 flex justify-end">
        <button
          type="button"
          className="size-fit cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
          onClick={() => loadPage(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-6" />
        </button>

        {showLeadingEllipsis && (
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
            <MoreHorizontal className="size-6 flex items-center justify-center mt-1" />
          </>
        )}

        {Array.from({ length: clusterSize }, (_, index) => {
          const offset = startPage + index;
          const isFirst = index === 0;
          const isLast = index === clusterSize - 1;

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

        {showTrailingEllipsis && (
          <>
            <MoreHorizontal className="size-6 flex items-center justify-center mt-1" />
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

        <button
          type="button"
          className="size-fit cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
          onClick={() => loadPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
    </nav>
  );
};

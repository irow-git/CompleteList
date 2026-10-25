import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight } from "pixelarticons/react";
import { useGamesStore } from "@/store/gamesStore";
import { cn } from "@/lib/utils";

// Page buttons for the store's current list, shared by the table and card views
export const Pagination: React.FC = () => {
  const { page, pageSize, total, loadPage } = useGamesStore(
    useShallow(({ page, pageSize, total, loadPage }) => ({ page, pageSize, total, loadPage }))
  );
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount === 0) return null;

  return (
    <nav aria-label="Pagination" className="my-4 flex items-center justify-end gap-2 font-pixel text-sm">
      <button
        type="button"
        className="size-8 cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
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
          className={cn(
            "size-8 cursor-pointer text-[20px]",
            index === page ? "border-be-3 border-be-gray-400 text-ink" : "hover:bg-muted"
          )}
        >
          {index + 1}
        </button>
      ))}
      <button
        type="button"
        className="size-8 cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
        onClick={() => loadPage(page + 1)}
        disabled={page >= pageCount - 1}
        aria-label="Next page"
      >
        <ChevronRight className="size-6" />
      </button>
    </nav>
  );
};

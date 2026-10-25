import React, { Fragment, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { IDLC, IGame, SortableField } from "../interfaces";
import { useShallow } from "zustand/react/shallow";
import { useGamesStore } from "../store/gamesStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { RemoveButton } from "@/components/ui/remove-button";
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
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsVertical,
  Close,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash,
} from "pixelarticons/react";
import { formatDay } from "@/lib/dates";

// How plain values show up in cells; a column that needs something else sets its own `cell`
const renderValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return null;
  // The only Dates on a game are calendar days, which must be read through formatDay (see src/lib/dates.ts)
  if (value instanceof Date) return formatDay(value);
  if (typeof value === "boolean") {
    return value ? <Check className="size-6 text-green-700" aria-label="Yes" /> : <Close className="size-6 text-red-600" aria-label="No" />;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

// Fixed layout so the DLC table's columns line up with its game's (see dlcColumns)
const tableClass = "table-fixed text-[1.2em] leading-[1.5714]";
const headRowClass = "bg-dirty-white hover:bg-dirty-white";
const headClass =
  "relative h-auto p-4 text-center font-semibold whitespace-normal not-last:before:absolute not-last:before:top-1/2 not-last:before:right-0 not-last:before:h-[1.6em] not-last:before:w-px not-last:before:-translate-y-1/2 not-last:before:bg-sand";
const cellClass = "p-4 text-left whitespace-normal";
const iconButtonClass =
  "inline-flex size-[26px] cursor-pointer items-center justify-center bg-white leading-none hover:bg-sand [&_svg]:size-6";

const EXPAND_WIDTH = 48;
const ACTIONS_WIDTH = 112;

const GameActions: React.FC<{ game: IGame }> = ({ game }) => {
  const removeGame = useGamesStore((state) => state.remove);
  const dlcCount = game.DLCs.length;

  return (
    <span className="inline-flex gap-2">
      <Link to={`/edit/${game.id}`} className={iconButtonClass} aria-label={`Edit ${game.title}`} title="Edit">
        <Pencil className="size-6 shrink-0" />
      </Link>
      <AlertDialog>
        <AlertDialogTrigger className={cn(iconButtonClass, "hover:border-destructive hover:text-destructive")} aria-label={`Delete ${game.title}`} title="Delete">
          <Trash className="size-6 shrink-0" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {game.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {dlcCount > 0
              ? `Its ${dlcCount} DLC${dlcCount === 1 ? "" : "s"} will be deleted too.`
              : "The game will be removed from your list."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => removeGame(game.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
};

// The helper checks accessor keys against IGame, so a renamed or misspelled field is a type error
const columnHelper = createColumnHelper<IGame>();

// The game's own fields, shown for base games and, in the expanded row, for their DLCs
const dataColumns = [
  columnHelper.accessor("platform", { header: "Platform", size: 150 }),
  columnHelper.accessor("original_copy", {
    header: "Original Copy",
    size: 140,
    cell: ({ row, getValue }) => (row.original.service ? <p className="text-green-700">Service</p> : renderValue(getValue()))
  }),
  columnHelper.accessor("free_to_play", { header: "Free to play", size: 140 }),
  columnHelper.accessor("title", { header: "Title", minSize: 132 }),
  columnHelper.accessor("completion", { header: "Completion Type", minSize: 132 }),
  columnHelper.accessor("release_date", { header: "Release Date", minSize: 132 }),
  columnHelper.accessor("last_completion", { header: "Last Completion", minSize: 132 }),
];

const columns = [
  columnHelper.display({
    id: "expand",
    size: EXPAND_WIDTH,
    cell: ({ row }) =>
      row.getCanExpand() && (
        <button
          type="button"
          aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
          aria-expanded={row.getIsExpanded()}
          onClick={row.getToggleExpandedHandler()}
          className="inline-flex size-[24px] cursor-pointer items-center justify-center bg-white leading-none hover:bg-sand"
        >
          {row.getIsExpanded() ? <Minus className="size-6" /> : <Plus className="size-6" />}
        </button>
      ),
  }),
  ...dataColumns,
  columnHelper.display({
    id: "actions",
    header: 'Actions',
    size: ACTIONS_WIDTH,
    cell: ({ row }) => <GameActions game={row.original} />,
  }),
];

// Same data columns as the parent table. The expanded cell is indented by the expand column's width and this table
// ends with an empty column as wide as the actions one, so the DLC columns line up under their game's columns.
const dlcColumns = [...dataColumns, columnHelper.display({ id: "spacer", size: ACTIONS_WIDTH })];

// Fixed layout ignores min widths on columns: columns without a `size` just share whatever width is left, equally.
// So the table gets a min-width that leaves each of them at least the largest minSize; any narrower and it scrolls.
const tableMinWidth = (tableColumns: { size?: number; minSize?: number }[]) => {
  const flexible = tableColumns.filter((column) => !column.size);
  const fixedWidth = tableColumns.reduce((sum, column) => sum + (column.size ?? 0), 0);
  return fixedWidth + flexible.length * Math.max(0, ...flexible.map((column) => column.minSize ?? 0));
};

const DlcTable: React.FC<{ dlcs: IDLC[] }> = ({ dlcs }) => {
  // DLCs have no DLCs of their own; the empty list just lets them share the game columns
  const data = useMemo(() => dlcs.map((dlc) => ({ ...dlc, DLCs: [] })), [dlcs]);
  const table = useReactTable({
    data,
    columns: dlcColumns,
    defaultColumn: { cell: ({ getValue }) => renderValue(getValue()) },
    getRowId: (dlc) => dlc.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table className={tableClass} style={{ minWidth: tableMinWidth(dlcColumns) }}>
      <colgroup>
        {dlcColumns.map((column, index) => (
          <col key={index} style={column.size ? { width: column.size } : undefined} />
        ))}
      </colgroup>
      <TableHeader className="option-clip">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className={headRowClass}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={headClass}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className="bg-white">
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className={cellClass}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

// A sortable header is a button that cycles ascending → descending → unsorted; the sorting itself happens in the database
const HeaderContent: React.FC<{ header: Header<IGame, unknown> }> = ({ header }) => {
  const label = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) return label;

  const sorted = header.column.getIsSorted();
  const SortIcon = sorted === "asc" ? ChevronUp : sorted === "desc" ? ChevronDown : ChevronsVertical;
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="inline-flex cursor-pointer items-center gap-1 font-semibold uppercase hover:text-ink"
    >
      {label}
      <SortIcon className={cn("size-6 shrink-0", !sorted && "opacity-30")} />
    </button>
  );
};

const SEARCH_DELAY_MS = 250;

const SearchBox: React.FC = () => {
  const { search, setSearch } = useGamesStore(useShallow(({ search, setSearch }) => ({ search, setSearch })));
  const [text, setText] = useState(search);

  // Search once typing pauses rather than on every keystroke
  useEffect(() => {
    if (text === search) return;
    const timer = setTimeout(() => setSearch(text), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, search, setSearch]);

  return (
    <div className="mb-4 flex justify-end">
      <div className="relative w-[360px] drop-shadow-[0px_1px_1px_black]">
        {/* z-10: the input's clip-path puts it on its own layer, which would otherwise paint over the icon */}
        <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-6 -translate-y-1/2 text-black/45" />
        <Input
          type="search"
          size="lg"
          aria-label="Search games"
          placeholder="Search games"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setText("")}
          className="form-control-clip-large pr-10 pl-12 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <RemoveButton
            size="lg"
            aria-label="Clear search"
            className="absolute top-1/2 right-4 -translate-y-1/2"
            onClick={() => setText("")}
          />
        )}
      </div>
    </div>
  );
};

const TableView: React.FC = () => {

  const { games, page, pageSize, total, sort, search, loadPage, setSort } = useGamesStore(
    useShallow(({ games, page, pageSize, total, sort, search, loadPage, setSort }) =>
      ({ games, page, pageSize, total, sort, search, loadPage, setSort }))
  );
  const sorting: SortingState = sort ? [{ id: sort.field, desc: sort.direction === "desc" }] : [];

  // Paging, sorting and search happen in the database: the store holds one page, and changes ask it for another
  const table = useReactTable({
    data: games,
    columns,
    defaultColumn: { cell: ({ getValue }) => renderValue(getValue()) },
    getRowId: (game) => game.id,
    getRowCanExpand: (row) => row.original.DLCs.length > 0,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
    manualSorting: true,
    // Every column starts ascending (TanStack would otherwise start dates and booleans descending)
    sortDescFirst: false,
    rowCount: total,
    state: { pagination: { pageIndex: page, pageSize }, sorting },
    onSortingChange: (updater) => {
      const [next] = typeof updater === "function" ? updater(sorting) : updater;
      setSort(next ? { field: next.id as SortableField, direction: next.desc ? "desc" : "asc" } : null);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex: page, pageSize }) : updater;
      loadPage(next.pageIndex);
    },
  });

  const { pageIndex } = table.getState().pagination;

  return (
    <div className="font-chava">
      <SearchBox />
      <Table className={tableClass} style={{ minWidth: tableMinWidth(columns) }}>
        <colgroup>
          {columns.map((column, index) => (
            <col key={index} style={column.size ? { width: column.size } : undefined} />
          ))}
        </colgroup>
        <TableHeader className="option-clip">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={headRowClass}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  aria-sort={
                    header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined
                  }
                  className={cn(headClass, header.column.id === "expand" && "before:hidden")}
                >
                  <HeaderContent header={header} />
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-12 text-center font-pixel text-sm text-black/45">
                {search ? `No games match "${search}"` : "No data"}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cellClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {row.getIsExpanded() && (
                  <TableRow className="bg-white hover:bg-white">
                    <TableCell colSpan={columns.length} className="p-0 text-sm" style={{ paddingLeft: EXPAND_WIDTH }}>
                      <DlcTable dlcs={row.original.DLCs} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>

      {table.getPageCount() > 0 && (
        <nav aria-label="Pagination" className="my-4 flex items-center justify-end gap-2 font-pixel text-sm">
          <button
            type="button"
            className="size-8 cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-6" />
          </button>
          {Array.from({ length: table.getPageCount() }, (_, page) => (
            <button
              key={page}
              type="button"
              aria-current={page === pageIndex ? "page" : undefined}
              onClick={() => table.setPageIndex(page)}
              className={cn(
                "size-8 cursor-pointer text-[20px]",
                page === pageIndex ? "border-be-3 border-be-gray-400 text-ink" : "hover:bg-muted"
              )}
            >
              {page + 1}
            </button>
          ))}
          <button
            type="button"
            className="size-8 cursor-pointer disabled:cursor-not-allowed disabled:text-gray-400"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="size-6" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default TableView;

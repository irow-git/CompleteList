import React, { Fragment, useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { IDLC, IGame } from "../interfaces";
import { useShallow } from "zustand/react/shallow";
import { useGamesStore } from "../store/gamesStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Check, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { formatDay } from "@/lib/dates";

// How plain values show up in cells; a column that needs something else sets its own `cell`
const renderValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return null;
  // The only Dates on a game are calendar days, which must be read through formatDay (see src/lib/dates.ts)
  if (value instanceof Date) return formatDay(value);
  if (typeof value === "boolean") {
    return value ? <Check size={18} strokeWidth={3} className="text-green-700" aria-label="Yes" /> : <X size={18} strokeWidth={3} className="text-red-600" aria-label="No" />;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

// Fixed layout so the DLC table's columns line up with its game's (see dlcColumns)
const tableClass = "table-fixed text-[1.2em] leading-[1.5714]";
const headRowClass = "bg-muted hover:bg-muted";
const headClass =
  "relative h-auto p-4 text-center font-semibold whitespace-normal not-last:before:absolute not-last:before:top-1/2 not-last:before:right-0 not-last:before:h-[1.6em] not-last:before:w-px not-last:before:-translate-y-1/2 not-last:before:bg-border";
const cellClass = "p-4 text-left whitespace-normal";
const iconButtonClass =
  "inline-flex size-[26px] cursor-pointer items-center justify-center bg-white leading-none hover:bg-sand [&_svg]:size-4";

const EXPAND_WIDTH = 48;
const ACTIONS_WIDTH = 112;

const GameActions: React.FC<{ game: IGame }> = ({ game }) => {
  const removeGame = useGamesStore((state) => state.remove);
  const dlcCount = game.DLCs.length;

  return (
    <span className="inline-flex gap-2">
      <Link to={`/edit/${game.id}`} className={iconButtonClass} aria-label={`Edit ${game.title}`} title="Edit">
        <Pencil />
      </Link>
      <AlertDialog>
        <AlertDialogTrigger className={cn(iconButtonClass, "hover:border-destructive hover:text-destructive")} aria-label={`Delete ${game.title}`} title="Delete">
          <Trash2 />
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
  columnHelper.accessor("platform", { header: "Platform", size: 132 }),
  columnHelper.accessor("original_copy", {
    header: "Original Copy",
    size: 112,
    cell: ({ row, getValue }) => (row.original.service ? <p className="text-green-700">Service</p> : renderValue(getValue()))
  }),
  columnHelper.accessor("free_to_play", { header: "Free to play", size: 112 }),
  columnHelper.accessor("title", { header: "Title" }),
  columnHelper.accessor("completion", { header: "Completion Type" }),
  columnHelper.accessor("release_date", { header: "Release Date" }),
  columnHelper.accessor("last_completion", { header: "Last Completion" }),
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
          {row.getIsExpanded() ? <Minus size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
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
    <Table className={tableClass}>
      <colgroup>
        {dlcColumns.map((column, index) => (
          <col key={index} style={column.size ? { width: column.size } : undefined} />
        ))}
      </colgroup>
      <TableHeader>
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

const TableView: React.FC = () => {

  const { games, page, pageSize, total, loadPage } = useGamesStore(
    useShallow(({ games, page, pageSize, total, loadPage }) => ({ games, page, pageSize, total, loadPage }))
  );

  // Paging happens in the database: the store holds one page, and changing page asks it for another
  const table = useReactTable({
    data: games,
    columns,
    defaultColumn: { cell: ({ getValue }) => renderValue(getValue()) },
    getRowId: (game) => game.id,
    getRowCanExpand: (row) => row.original.DLCs.length > 0,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination: { pageIndex: page, pageSize } },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex: page, pageSize }) : updater;
      loadPage(next.pageIndex);
    },
  });

  const { pageIndex } = table.getState().pagination;

  return (
    <div className="font-chava">
      <Table className={tableClass}>
        <colgroup>
          {columns.map((column, index) => (
            <col key={index} style={column.size ? { width: column.size } : undefined} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={headRowClass}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(headClass, header.column.id === "expand" && "before:hidden")}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-12 text-center font-pixel text-sm text-black/45">
                No data
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
                  <TableRow className="bg-muted hover:bg-muted">
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
            <ChevronLeft size={22} strokeWidth={4} />
          </button>
          {Array.from({ length: table.getPageCount() }, (_, page) => (
            <button
              key={page}
              type="button"
              aria-current={page === pageIndex ? "page" : undefined}
              onClick={() => table.setPageIndex(page)}
              className={cn(
                "size-8 cursor-pointer text-[18px]",
                page === pageIndex ? "border-be-4 border-be-gray-400 text-ink" : "hover:bg-muted"
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
            <ChevronRight size={22} strokeWidth={4} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default TableView;

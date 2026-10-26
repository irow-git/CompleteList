import React, { Fragment, useEffect, useMemo } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, getExpandedRowModel, useReactTable, type Header, type SortingState } from "@tanstack/react-table";
import { IDLC, IGame, SortableField } from "../interfaces";
import { useShallow } from "zustand/react/shallow";
import { useGamesStore } from "../store/gamesStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, ChevronsVertical, Close, Minus, Plus } from "pixelarticons/react";
import { formatDay } from "@/lib/dates";
import { Panel } from "@/layout/Panel";
import { GameActions } from "@/components/games/GameActions";
import { GameListToolbar } from "@/components/games/GameListToolbar";
import { Pagination } from "@/components/games/Pagination";
import { FIELD_LABELS } from "@/components/games/fields";

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
const EXPAND_WIDTH = 48;
const ACTIONS_WIDTH = 112;

// The helper checks accessor keys against IGame, so a renamed or misspelled field is a type error
const columnHelper = createColumnHelper<IGame>();

// The game's own fields, shown for base games and, in the expanded row, for their DLCs
const dataColumns = [
  columnHelper.accessor("platform", { header: FIELD_LABELS.platform, size: 150 }),
  columnHelper.accessor("original_copy", {
    header: FIELD_LABELS.original_copy,
    size: 140,
    cell: ({ row, getValue }) => (row.original.service ? <p className="text-green-700">Service</p> : renderValue(getValue())),
  }),
  columnHelper.accessor("free_to_play", { header: FIELD_LABELS.free_to_play, size: 140 }),
  columnHelper.accessor("title", { header: FIELD_LABELS.title, minSize: 160 }),
  columnHelper.accessor("completion", { header: FIELD_LABELS.completion, minSize: 160 }),
  columnHelper.accessor("release_date", { header: FIELD_LABELS.release_date, minSize: 160 }),
  columnHelper.accessor("last_completion", { header: FIELD_LABELS.last_completion, minSize: 160 }),
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
    header: "Actions",
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

// A sortable header is a button that cycles ascending → descending → unsorted; shift-click adds the column to the
// current sort instead of replacing it. The sorting itself happens in the database
const HeaderContent: React.FC<{ header: Header<IGame, unknown>; sortCount: number }> = ({ header, sortCount }) => {
  const label = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) return label;

  const sorted = header.column.getIsSorted();
  const SortIcon = sorted === "asc" ? ChevronUp : sorted === "desc" ? ChevronDown : ChevronsVertical;
  return (
    <button
      type="button"
      title="Shift-click to sort by several columns"
      onClick={header.column.getToggleSortingHandler()}
      className="inline-flex cursor-pointer items-center gap-1 font-semibold uppercase hover:text-ink"
    >
      {label}
      <SortIcon className={cn("size-6 shrink-0", !sorted && "opacity-30")} />
      {sorted && sortCount > 1 && <span className="font-pixel text-xs">{header.column.getSortIndex() + 1}</span>}
    </button>
  );
};

const TableView: React.FC = () => {
  const { games, page, pageSize, total, sort, search, infinite, status, loadPage, setSort } = useGamesStore(
    useShallow(({ games, page, pageSize, total, sort, search, infinite, status, loadPage, setSort }) => ({
      games,
      page,
      pageSize,
      total,
      sort,
      search,
      infinite,
      status,
      loadPage,
      setSort,
    })),
  );
  const sorting: SortingState = sort.map(({ field, direction }) => ({ id: field, desc: direction === "desc" }));

  // Coming from the card view the store holds several scrolled-through pages; the table shows one at a time
  useEffect(() => {
    if (infinite || status === "idle") loadPage(0);
  }, [infinite, status, loadPage]);

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
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSort(next.map(({ id, desc }) => ({ field: id as SortableField, direction: desc ? "desc" : "asc" })));
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex: page, pageSize }) : updater;
      loadPage(next.pageIndex);
    },
  });

  return (
    // The panel fills whatever height the toolbar and footer leave and scrolls inside, so the footer never moves
    <div className="flex min-h-0 flex-1 flex-col">
      <GameListToolbar />
      <Panel fill className="font-chava">
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
                    aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined}
                    className={cn(headClass, header.column.id === "expand" && "before:hidden")}
                  >
                    <HeaderContent header={header} sortCount={sorting.length} />
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
      </Panel>
      <div className="mt-4 shrink-0 drop-shadow-[1px_2px_3px_black]">
        <div className="clip bg-white p-6 h-[92px]">
          <Pagination />
        </div>
      </div>
    </div>
  );
};

export default TableView;

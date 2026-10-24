import React, { Fragment } from "react";
import { useSelector } from "react-redux";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { IGame } from "../interfaces";
import { State } from "../store/reducers/rootReducer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Firestore documents carry more fields than IGame declares
type GameRow = IGame & Record<string, any>;

const PAGE_SIZE = 11;

const tableClass = "text-[1.2em] leading-[1.5714]";
const headRowClass = "bg-muted hover:bg-muted";
const headClass =
  "relative h-auto p-4 text-center font-semibold whitespace-normal not-last:before:absolute not-last:before:top-1/2 not-last:before:right-0 not-last:before:h-[1.6em] not-last:before:w-px not-last:before:-translate-y-1/2 not-last:before:bg-border";
const cellClass = "p-4 text-left whitespace-normal";

const ExpandedRow: React.FC = () => {
  const items = [
    { key: "1", label: "Action 1" },
    { key: "2", label: "Action 2" },
  ];

  const data = [];
  for (let i = 0; i < 3; ++i) {
    data.push({
      key: i.toString(),
      date: "2014-12-24 23:12:00",
      name: "This is production name",
      upgradeNum: "Upgraded: 56",
    });
  }

  return (
    <Table className={tableClass}>
      <TableHeader>
        <TableRow className={headRowClass}>
          {["Date", "Name", "Status", "Upgrade Status", "Action"].map((title) => (
            <TableHead key={title} className={headClass}>{title}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.key} className="bg-white">
            <TableCell className={cellClass}>{row.date}</TableCell>
            <TableCell className={cellClass}>{row.name}</TableCell>
            <TableCell className={cellClass}>
              <span className="inline-flex items-center gap-2 font-pixel text-sm">
                <span className="size-1.5 rounded-full bg-green-500" />
                Finished
              </span>
            </TableCell>
            <TableCell className={cellClass}>{row.upgradeNum}</TableCell>
            <TableCell className={cellClass}>
              <span className="inline-flex gap-4">
                <a>Pause</a>
                <a>Stop</a>
                <DropdownMenu>
                  <DropdownMenuTrigger className="cursor-pointer">More</DropdownMenuTrigger>
                  <DropdownMenuContent className="rounded-none font-chava">
                    {items.map((item) => (
                      <DropdownMenuItem key={item.key} className="rounded-none">{item.label}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const columns: ColumnDef<GameRow>[] = [
  {
    id: "expand",
    size: 48,
    cell: ({ row }) => (
      <button
        type="button"
        aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
        aria-expanded={row.getIsExpanded()}
        onClick={row.getToggleExpandedHandler()}
        className="inline-flex size-[17px] cursor-pointer items-center justify-center border bg-white leading-none hover:border-ink"
      >
        {row.getIsExpanded() ? "−" : "+"}
      </button>
    ),
  },
  { accessorKey: "platform", header: "Platform", size: 100 },
  { accessorKey: "original_copy", header: "Original Copy", size: 115 },
  { accessorKey: "free", header: "Free to play", size: 115 },
  { accessorKey: "title", header: "Title" },
  { accessorKey: "completion", header: "Completion Type" },
];

const TableView: React.FC = () => {

  const gamesStore: GameRow[] = useSelector(
    (state: State) => state.gameReducer.games
  );

  const table = useReactTable({
    data: gamesStore,
    columns,
    // Render raw values like antd did (booleans render nothing) instead of TanStack's toString()
    defaultColumn: { cell: ({ getValue }) => getValue() },
    getRowId: (game) => game.id,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  });

  const { pageIndex } = table.getState().pagination;

  console.log("GAMES: ", gamesStore);

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
                    <TableCell colSpan={columns.length} className="p-0 pl-12 text-sm">
                      <ExpandedRow />
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
            className="size-8 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            ‹
          </button>
          {Array.from({ length: table.getPageCount() }, (_, page) => (
            <button
              key={page}
              type="button"
              aria-current={page === pageIndex ? "page" : undefined}
              onClick={() => table.setPageIndex(page)}
              className={cn(
                "size-8 cursor-pointer border border-transparent",
                page === pageIndex ? "border-ink text-ink" : "hover:bg-muted"
              )}
            >
              {page + 1}
            </button>
          ))}
          <button
            type="button"
            className="size-8 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
};

export default TableView;

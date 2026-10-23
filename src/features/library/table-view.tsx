import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, CalendarCheck, Gamepad2, ListChecks, Shapes, Tags, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completionSortKey } from "@/lib/completion";
import { formatTimeToBeat, scoreOf } from "@/lib/igdb-info";
import { useSetEntryCategories, useUpdateEntry } from "@/lib/queries";
import type { LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompletionField } from "@/components/game/completion-field";
import { Cover } from "@/components/game/cover";
import { CategoryPicker, StatusSelect, Tag } from "@/components/game/tags";

const col = createColumnHelper<LibraryEntry>();
const STATUS_ORDER = { playing: 0, backlog: 1, completed: 2 };

/** Same information as the gallery cards; the rest lives on the game page. */
export function TableView({ entries }: { entries: LibraryEntry[] }) {
  const navigate = useNavigate();
  const { mutate: updateEntry } = useUpdateEntry();
  const { mutate: setCategories } = useSetEntryCategories();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      col.accessor("name", {
        header: () => (
          <>
            <Gamepad2 /> Nome
          </>
        ),
        size: 360,
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/game/${row.original.id}`)}
            className="flex w-full items-center gap-2 text-left font-medium hover:underline"
          >
            <Cover url={row.original.coverUrl} name={row.original.name} className="h-8 w-6 shrink-0 rounded-[3px]" />
            <span className="truncate">{row.original.name}</span>
            {scoreOf(row.original) !== null && (
              <span className="shrink-0 font-normal text-muted-foreground">({scoreOf(row.original)})</span>
            )}
          </button>
        ),
      }),
      col.accessor((e) => e.genres.join(", "), {
        id: "genres",
        header: () => (
          <>
            <Shapes /> Gênero
          </>
        ),
        size: 220,
        cell: ({ row }) => (
          <div className="flex gap-1 overflow-hidden px-1">
            {row.original.genres.slice(0, 3).map((g) => (
              <Tag key={g} color={g === "Indie" ? "purple" : "gray"}>
                {g}
              </Tag>
            ))}
          </div>
        ),
      }),
      col.accessor("status", {
        header: () => (
          <>
            <ListChecks /> Status
          </>
        ),
        size: 130,
        sortingFn: (a, b) => STATUS_ORDER[a.original.status] - STATUS_ORDER[b.original.status],
        cell: ({ row }) => (
          <StatusSelect value={row.original.status} onChange={(status) => updateEntry({ entry: row.original, patch: { status } })} />
        ),
      }),
      col.accessor(completionSortKey, {
        id: "completion",
        header: () => (
          <>
            <CalendarCheck /> Zerado em
          </>
        ),
        size: 120,
        cell: ({ row }) => (
          <CompletionField entry={row.original} onPatch={(patch) => updateEntry({ entry: row.original, patch })} />
        ),
      }),
      col.accessor("timeToBeat", {
        header: () => (
          <>
            <Timer /> Tempo
          </>
        ),
        size: 100,
        sortUndefined: "last",
        cell: ({ getValue }) => <span className="px-1 text-muted-foreground">{formatTimeToBeat(getValue()) ?? ""}</span>,
      }),
      col.accessor((e) => e.categoryIds.length, {
        id: "categories",
        header: () => (
          <>
            <Tags /> Categorias
          </>
        ),
        size: 260,
        cell: ({ row }) => (
          <CategoryPicker
            value={row.original.categoryIds}
            placeholder=""
            onChange={(categoryIds) => setCategories({ entryId: row.original.id, categoryIds })}
          />
        ),
      }),
    ],
    [navigate, updateEntry, setCategories],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: table.getTotalSize() }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-y border-border">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  style={{ width: h.getSize() }}
                  className="border-r border-border px-2 py-1.5 text-left font-normal text-muted-foreground last:border-r-0"
                >
                  <button
                    onClick={h.column.getToggleSortingHandler()}
                    className="flex items-center gap-1.5 [&_svg]:size-3.5"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" && <ArrowUp />}
                    {h.column.getIsSorted() === "desc" && <ArrowDown />}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="group border-b border-border hover:bg-accent/50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={cn("border-r border-border px-1 py-0.5 last:border-r-0")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

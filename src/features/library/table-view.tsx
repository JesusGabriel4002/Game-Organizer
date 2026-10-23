import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, CalendarCheck, Clock, Gamepad2, Hash, ListChecks, Monitor, Star, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COMMON_PLATFORMS } from "@/lib/constants";
import { useSetEntryCategories, useUpdateEntry } from "@/lib/queries";
import type { LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Cover } from "@/components/game/cover";
import { DateField, NumberField, RatingField, TextField } from "@/components/game/fields";
import { CategoryPicker, StatusSelect } from "@/components/game/tags";

const col = createColumnHelper<LibraryEntry>();
const STATUS_ORDER = { playing: 0, backlog: 1, completed: 2 };

export function TableView({ entries, platforms }: { entries: LibraryEntry[]; platforms: string[] }) {
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
        size: 320,
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/game/${row.original.id}`)}
            className="flex w-full items-center gap-2 text-left font-medium hover:underline"
          >
            <Cover url={row.original.coverUrl} name={row.original.name} className="h-8 w-6 shrink-0 rounded-[3px]" />
            <span className="truncate">{row.original.name}</span>
          </button>
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
      col.accessor((e) => e.categoryIds.length, {
        id: "categories",
        header: () => (
          <>
            <Tags /> Categorias
          </>
        ),
        size: 220,
        cell: ({ row }) => (
          <CategoryPicker
            value={row.original.categoryIds}
            placeholder=""
            onChange={(categoryIds) => setCategories({ entryId: row.original.id, categoryIds })}
          />
        ),
      }),
      col.accessor("platform", {
        header: () => (
          <>
            <Monitor /> Plataforma
          </>
        ),
        size: 130,
        cell: ({ row }) => (
          <TextField
            value={row.original.platform}
            placeholder=""
            list="platform-options"
            onCommit={(platform) => updateEntry({ entry: row.original, patch: { platform } })}
          />
        ),
      }),
      col.accessor("rating", {
        header: () => (
          <>
            <Star /> Nota
          </>
        ),
        size: 140,
        sortUndefined: "last",
        cell: ({ row }) => (
          <RatingField value={row.original.rating} onCommit={(rating) => updateEntry({ entry: row.original, patch: { rating } })} />
        ),
      }),
      col.accessor("hours", {
        header: () => (
          <>
            <Clock /> Horas
          </>
        ),
        size: 90,
        cell: ({ row }) => (
          <NumberField
            value={row.original.hours}
            placeholder=""
            suffix="h"
            onCommit={(hours) => updateEntry({ entry: row.original, patch: { hours } })}
          />
        ),
      }),
      col.accessor("completedAt", {
        header: () => (
          <>
            <CalendarCheck /> Zerado em
          </>
        ),
        size: 140,
        cell: ({ row }) => (
          <DateField
            value={row.original.completedAt}
            onCommit={(completedAt) =>
              updateEntry({
                entry: row.original,
                patch: completedAt ? { completedAt, status: "completed" } : { completedAt },
              })
            }
          />
        ),
      }),
      col.accessor("releaseYear", {
        header: () => (
          <>
            <Hash /> Ano
          </>
        ),
        size: 70,
        cell: ({ getValue }) => <span className="px-1 text-muted-foreground">{getValue() ?? ""}</span>,
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
      <datalist id="platform-options">
        {[...new Set([...platforms, ...COMMON_PLATFORMS])].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
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

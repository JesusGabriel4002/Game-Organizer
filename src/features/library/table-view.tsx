import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Award,
  CalendarCheck,
  Clock,
  Gamepad2,
  Hash,
  ListChecks,
  Monitor,
  Plus,
  Shapes,
  Star,
  Tags,
  Timer,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { completionSortKey } from "@/lib/completion";
import { COMMON_PLATFORMS } from "@/lib/constants";
import { formatTimeToBeat, scoreOf } from "@/lib/igdb-info";
import { useSetEntryCategories, useUpdateEntry } from "@/lib/queries";
import { useUi } from "@/lib/store";
import type { LibraryEntry } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompletionField } from "@/components/game/completion-field";
import { Cover } from "@/components/game/cover";
import { NumberField, RatingField, TextField } from "@/components/game/fields";
import { CategoryPicker, StatusSelect, Tag } from "@/components/game/tags";

const col = createColumnHelper<LibraryEntry>();
const STATUS_ORDER = { playing: 0, backlog: 1, completed: 2 };

function heading(icon: ReactNode, label: string) {
  return () => (
    <>
      {icon} {label}
    </>
  );
}

/** Optional columns, in the order they're offered by the "+" menu. */
const COLUMN_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  status: { label: "Status", icon: <ListChecks /> },
  completion: { label: "Zerado em", icon: <CalendarCheck /> },
  categories: { label: "Categorias", icon: <Tags /> },
  timeToBeat: { label: "Tempo", icon: <Timer /> },
  genres: { label: "Gênero", icon: <Shapes /> },
  score: { label: "Nota da crítica", icon: <Award /> },
  rating: { label: "Minha nota", icon: <Star /> },
  hours: { label: "Horas jogadas", icon: <Clock /> },
  platform: { label: "Plataforma", icon: <Monitor /> },
  releaseYear: { label: "Lançamento", icon: <Hash /> },
};

function SortableHeader({ header, onRemove }: { header: Header<LibraryEntry, unknown>; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
    disabled: !onRemove,
  });
  return (
    <th
      ref={setNodeRef}
      style={{ width: header.getSize(), transform: CSS.Translate.toString(transform), transition }}
      className={`group/th relative border-r border-border bg-background px-2 py-1.5 text-left font-normal text-muted-foreground ${isDragging ? "z-10 opacity-80 shadow-md" : ""}`}
    >
      <div className="flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          onClick={header.column.getToggleSortingHandler()}
          className={`flex min-w-0 flex-1 items-center gap-1.5 [&_svg]:size-3.5 ${onRemove ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {header.column.getIsSorted() === "asc" && <ArrowUp />}
          {header.column.getIsSorted() === "desc" && <ArrowDown />}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remover coluna"
            className="rounded p-0.5 opacity-0 hover:bg-accent-strong hover:text-foreground group-hover/th:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </th>
  );
}

export function TableView({ entries, platforms }: { entries: LibraryEntry[]; platforms: string[] }) {
  const navigate = useNavigate();
  const { mutate: updateEntry } = useUpdateEntry();
  const { mutate: setCategories } = useSetEntryCategories();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [addOpen, setAddOpen] = useState(false);
  const tableColumns = useUi((s) => s.tableColumns);
  const setTableColumns = useUi((s) => s.setTableColumns);
  // Small threshold so a click on the header still sorts instead of starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const allColumns = useMemo(() => {
    const defs: ColumnDef<LibraryEntry, any>[] = [
      col.accessor("name", {
        header: heading(<Gamepad2 />, "Nome"),
        size: 340,
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
      col.accessor("status", {
        header: heading(COLUMN_LABELS.status.icon, "Status"),
        size: 130,
        sortingFn: (a, b) => STATUS_ORDER[a.original.status] - STATUS_ORDER[b.original.status],
        cell: ({ row }) => (
          <StatusSelect value={row.original.status} onChange={(status) => updateEntry({ entry: row.original, patch: { status } })} />
        ),
      }),
      col.accessor(completionSortKey, {
        id: "completion",
        header: heading(COLUMN_LABELS.completion.icon, "Zerado em"),
        size: 120,
        cell: ({ row }) => <CompletionField entry={row.original} onPatch={(patch) => updateEntry({ entry: row.original, patch })} />,
      }),
      col.accessor((e) => e.categoryIds.length, {
        id: "categories",
        header: heading(COLUMN_LABELS.categories.icon, "Categorias"),
        size: 260,
        cell: ({ row }) => (
          <CategoryPicker
            value={row.original.categoryIds}
            placeholder=""
            onChange={(categoryIds) => setCategories({ entryId: row.original.id, categoryIds })}
          />
        ),
      }),
      col.accessor("timeToBeat", {
        header: heading(COLUMN_LABELS.timeToBeat.icon, "Tempo"),
        size: 100,
        sortUndefined: "last",
        cell: ({ getValue }) => <span className="px-1 text-muted-foreground">{formatTimeToBeat(getValue()) ?? ""}</span>,
      }),
      col.accessor((e) => e.genres.join(", "), {
        id: "genres",
        header: heading(COLUMN_LABELS.genres.icon, "Gênero"),
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
      col.accessor((e) => scoreOf(e) ?? undefined, {
        id: "score",
        header: heading(COLUMN_LABELS.score.icon, "Nota da crítica"),
        size: 130,
        sortUndefined: "last",
        cell: ({ getValue }) => <span className="px-1 text-muted-foreground">{getValue() ?? ""}</span>,
      }),
      col.accessor("rating", {
        header: heading(COLUMN_LABELS.rating.icon, "Minha nota"),
        size: 140,
        sortUndefined: "last",
        cell: ({ row }) => (
          <RatingField value={row.original.rating} onCommit={(rating) => updateEntry({ entry: row.original, patch: { rating } })} />
        ),
      }),
      col.accessor("hours", {
        header: heading(COLUMN_LABELS.hours.icon, "Horas jogadas"),
        size: 120,
        cell: ({ row }) => (
          <NumberField
            value={row.original.hours}
            placeholder=""
            suffix="h"
            onCommit={(hours) => updateEntry({ entry: row.original, patch: { hours } })}
          />
        ),
      }),
      col.accessor("platform", {
        header: heading(COLUMN_LABELS.platform.icon, "Plataforma"),
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
      col.accessor("releaseYear", {
        header: heading(COLUMN_LABELS.releaseYear.icon, "Lançamento"),
        size: 110,
        cell: ({ getValue }) => <span className="px-1 text-muted-foreground">{getValue() ?? ""}</span>,
      }),
    ];
    return new Map(defs.map((d) => [d.id ?? (d as { accessorKey: string }).accessorKey, d]));
  }, [navigate, updateEntry, setCategories]);

  const visibleIds = tableColumns.filter((id) => allColumns.has(id));
  const hiddenIds = Object.keys(COLUMN_LABELS).filter((id) => !visibleIds.includes(id));
  const columns = useMemo(() => ["name", ...visibleIds].map((id) => allColumns.get(id)!), [allColumns, visibleIds.join()]);

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = visibleIds.indexOf(String(active.id));
    const to = visibleIds.indexOf(String(over.id));
    if (from >= 0 && to >= 0) setTableColumns(arrayMove(visibleIds, from, to));
  };

  return (
    <div className="overflow-x-auto">
      <datalist id="platform-options">
        {[...new Set([...platforms, ...COMMON_PLATFORMS])].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: table.getTotalSize() + 40 }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-y border-border">
                <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
                  {hg.headers.map((h) => (
                    <SortableHeader
                      key={h.id}
                      header={h}
                      onRemove={h.column.id === "name" ? undefined : () => setTableColumns(visibleIds.filter((id) => id !== h.column.id))}
                    />
                  ))}
                </SortableContext>
                <th className="w-10 px-1 py-1.5">
                  {hiddenIds.length > 0 && (
                    <Popover open={addOpen} onOpenChange={setAddOpen}>
                      <PopoverTrigger
                        title="Adicionar coluna"
                        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="size-4" />
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-52 p-1">
                        <p className="px-2 py-1 text-xs text-muted-foreground">Adicionar coluna</p>
                        {hiddenIds.map((id) => (
                          <button
                            key={id}
                            onClick={() => {
                              setTableColumns([...visibleIds, id]);
                              if (hiddenIds.length === 1) setAddOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"
                          >
                            {COLUMN_LABELS[id].icon}
                            {COLUMN_LABELS[id].label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="group border-b border-border hover:bg-accent/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-r border-border px-1 py-0.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}

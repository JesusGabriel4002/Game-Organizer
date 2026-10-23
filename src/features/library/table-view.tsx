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
  Award,
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
import { completionSortKey, statusDetail } from "@/lib/completion";
import { COMMON_PLATFORMS } from "@/lib/constants";
import { formatTimeToBeat, scoreOf } from "@/lib/igdb-info";
import { prioritizeLeftmostSort, STATUS_SORT_ORDER } from "@/lib/library-sort";
import { useSetEntryCategories, useUpdateEntry } from "@/lib/queries";
import { useUi } from "@/lib/store";
import type { LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Cover } from "@/components/game/cover";
import { NumberField, RatingField, TextField } from "@/components/game/fields";
import { CATEGORY_TAGS_TWO_LINES, CategoryPicker, StatusSelect, Tag } from "@/components/game/tags";

const col = createColumnHelper<LibraryEntry>();

/** Status then average hours — applied on open, without showing sort arrows. */
const DEFAULT_SORTING: SortingState = [
  { id: "status", desc: false },
  { id: "timeToBeat", desc: false },
];

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
      style={{
        width: header.getSize(),
        maxWidth: header.getSize(),
        transform: CSS.Translate.toString(transform),
        transition: header.column.getIsResizing() ? undefined : transition,
      }}
      className={`group/th relative overflow-hidden border-r border-border bg-background px-2 py-1.5 text-left font-normal text-muted-foreground ${isDragging ? "z-10 opacity-80 shadow-md" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-1 overflow-hidden pr-1">
        <button
          {...attributes}
          {...listeners}
          onClick={header.column.getToggleSortingHandler()}
          className={`flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden [&_svg]:size-3.5 [&_svg]:shrink-0 ${onRemove ? "cursor-grab active:cursor-grabbing" : ""}`}
        >
          <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remover coluna"
            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-accent-strong hover:text-foreground group-hover/th:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => header.column.resetSize()}
          title="Arraste para redimensionar"
          className={`absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/50 ${header.column.getIsResizing() ? "bg-primary/60" : ""}`}
        />
      )}
    </th>
  );
}

export function TableView({
  entries,
  platforms,
  completedOnly = false,
}: {
  entries: LibraryEntry[];
  platforms: string[];
  /** The Zerados list: sorting by Status uses the completion date. */
  completedOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { mutate: updateEntry } = useUpdateEntry();
  const { mutate: setCategories } = useSetEntryCategories();
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [addOpen, setAddOpen] = useState(false);
  const tableColumns = useUi((s) => s.tableColumns);
  const setTableColumns = useUi((s) => s.setTableColumns);
  const columnSizing = useUi((s) => s.tableColumnSizes);
  const setTableColumnSizes = useUi((s) => s.setTableColumnSizes);
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
            title={row.original.name}
            className="flex w-full min-w-0 max-w-full items-center gap-2 text-left font-medium hover:underline"
          >
            <Cover url={row.original.coverUrl} name={row.original.name} className="h-8 w-6 shrink-0 rounded-[3px]" />
            <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              <span className="min-w-0 truncate">{row.original.name}</span>
              {scoreOf(row.original) !== null && (
                <span className="shrink-0 font-normal text-muted-foreground">({scoreOf(row.original)})</span>
              )}
            </span>
          </button>
        ),
      }),
      col.accessor("status", {
        header: heading(COLUMN_LABELS.status.icon, "Status"),
        size: 170,
        // In the Zerados-only list, toggles oldest↔newest by completion date.
        sortingFn: (a, b) =>
          completedOnly
            ? completionSortKey(a.original).localeCompare(completionSortKey(b.original))
            : STATUS_SORT_ORDER[a.original.status] - STATUS_SORT_ORDER[b.original.status],
        cell: ({ row }) => (
          <StatusSelect
            value={row.original.status}
            detail={statusDetail(row.original)}
            onChange={(status) => updateEntry({ entry: row.original, patch: { status } })}
            targetYear={row.original.targetYear}
            onTargetYear={(targetYear) => updateEntry({ entry: row.original, patch: { targetYear } })}
          />
        ),
      }),
      col.display({
        id: "categories",
        header: heading(COLUMN_LABELS.categories.icon, "Categorias"),
        size: 260,
        enableSorting: false,
        cell: ({ row }) => (
          <CategoryPicker
            value={row.original.categoryIds}
            placeholder=""
            wrapAt={2}
            className={cn(
              CATEGORY_TAGS_TWO_LINES,
              "items-start overflow-hidden py-0 [&>div]:h-full [&>div]:content-start [&>div]:overflow-hidden",
            )}
            onChange={(categoryIds) => setCategories({ entryId: row.original.id, categoryIds })}
          />
        ),
      }),
      col.accessor("timeToBeat", {
        header: heading(COLUMN_LABELS.timeToBeat.icon, "Tempo"),
        size: 100,
        sortingFn: (a, b) =>
          (a.original.timeToBeat ?? Number.POSITIVE_INFINITY) - (b.original.timeToBeat ?? Number.POSITIVE_INFINITY),
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
  }, [navigate, updateEntry, setCategories, completedOnly]);

  const visibleIds = tableColumns.filter((id) => allColumns.has(id));
  const hiddenIds = Object.keys(COLUMN_LABELS).filter((id) => !visibleIds.includes(id));
  // Keep every column registered so default sorts (status, tempo) work even if a column is hidden.
  const columnOrder = useMemo(() => ["name", ...visibleIds, ...hiddenIds], [visibleIds.join(), hiddenIds.join()]);
  const columns = useMemo(() => columnOrder.map((id) => allColumns.get(id)!), [allColumns, columnOrder]);
  const columnVisibility = useMemo(
    () => Object.fromEntries(columnOrder.map((id) => [id, id === "name" || visibleIds.includes(id)])),
    [columnOrder, visibleIds.join()],
  );

  const applySorting = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    setSorting((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return prioritizeLeftmostSort(next.slice(0, 2), columnOrder);
    });
  };

  const table = useReactTable({
    data: entries,
    columns,
    defaultColumn: { minSize: 48, maxSize: 640 },
    state: { sorting, columnVisibility, columnOrder, columnSizing },
    onSortingChange: applySorting,
    onColumnSizingChange: (updater) => {
      setTableColumnSizes((prev) => (typeof updater === "function" ? updater(prev) : updater));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableMultiSort: true,
    enableSortingRemoval: true,
    maxMultiSortColCount: 2,
    isMultiSortEvent: () => true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = visibleIds.indexOf(String(active.id));
    const to = visibleIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const nextVisible = arrayMove(visibleIds, from, to);
    setTableColumns(nextVisible);
    // Leftmost of the two active sorts becomes primary after a column move.
    setSorting((prev) => prioritizeLeftmostSort(prev, ["name", ...nextVisible, ...hiddenIds]));
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <datalist id="platform-options">
        {[...new Set([...platforms, ...COMMON_PLATFORMS])].map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: table.getTotalSize() + 40 }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                <SortableContext items={visibleIds} strategy={horizontalListSortingStrategy}>
                  {hg.headers
                    .filter((h) => h.column.getIsVisible())
                    .map((h) => (
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
              <tr key={row.id} className="group h-12 border-b border-border last:border-b-0 hover:bg-accent/50">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                    className="overflow-hidden border-r border-border px-1 py-0.5 align-middle"
                  >
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

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATUS_META } from "@/lib/constants";
import { useCategories, useUpdateEntry } from "@/lib/queries";
import { STATUSES, type Category, type GameStatus, type LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Cover } from "@/components/game/cover";
import { CategoryTags, StatusTag } from "@/components/game/tags";

function Card({ entry, categories, dragging }: { entry: LibraryEntry; categories: Category[]; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 overflow-hidden rounded-md border border-border bg-background p-2 shadow-sm transition-shadow hover:bg-accent/40",
        dragging && "rotate-1 shadow-xl",
      )}
    >
      <Cover url={entry.coverUrl} name={entry.name} className="h-16 w-12 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{entry.name}</p>
        {entry.platform && <p className="text-xs text-muted-foreground">{entry.platform}</p>}
        <CategoryTags ids={entry.categoryIds} categories={categories} max={3} fit />
      </div>
    </div>
  );
}

function DraggableCard({ entry, categories }: { entry: LibraryEntry; categories: Category[] }) {
  const navigate = useNavigate();
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: entry.id, data: entry });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/game/${entry.id}`)}
      className={cn("cursor-pointer touch-none", isDragging && "opacity-30")}
    >
      <Card entry={entry} categories={categories} />
    </div>
  );
}

function Column({ status, entries, categories }: { status: GameStatus; entries: LibraryEntry[]; categories: Category[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn("flex w-72 shrink-0 flex-col rounded-lg p-1.5 transition-colors", isOver ? "bg-accent-strong" : "bg-accent/60")}
    >
      <div className="mb-1.5 flex items-center gap-2 px-1 py-1">
        <StatusTag status={status} />
        <span className="text-sm text-muted-foreground">{entries.length}</span>
      </div>
      <div className="flex min-h-24 flex-col gap-1.5">
        {entries.map((e) => (
          <DraggableCard key={e.id} entry={e} categories={categories} />
        ))}
        {!entries.length && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Arraste jogos para “{STATUS_META[status].label}”
          </p>
        )}
      </div>
    </div>
  );
}

export function BoardView({ entries }: { entries: LibraryEntry[] }) {
  const { data: categories = [] } = useCategories();
  const { mutate: updateEntry } = useUpdateEntry();
  const [active, setActive] = useState<LibraryEntry | null>(null);
  // A small drag distance keeps simple clicks working for opening the game page.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as LibraryEntry) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const entry = e.active.data.current as LibraryEntry | undefined;
    const status = e.over?.id as GameStatus | undefined;
    if (entry && status && entry.status !== status) updateEntry({ entry, patch: { status } });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((s) => (
          <Column key={s} status={s} entries={entries.filter((e) => e.status === s)} categories={categories} />
        ))}
      </div>
      <DragOverlay>{active && <Card entry={active} categories={categories} dragging />}</DragOverlay>
    </DndContext>
  );
}

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { STATUS_META, TAG_COLORS, randomTagColor } from "@/lib/constants";
import { useCategories, useCreateCategory } from "@/lib/queries";
import { STATUSES, type Category, type GameStatus, type TagColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { targetYearOptions } from "@/lib/completion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function Tag({ color, children, className }: { color: TagColor; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 truncate rounded-[4px] px-1.5 text-xs leading-5",
        TAG_COLORS[color].tag,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** `detail` is shown inside the tag, e.g. when a game was finished: "Zerado · 2026". */
export function StatusTag({ status, detail }: { status: GameStatus; detail?: string | null }) {
  const meta = STATUS_META[status];
  return (
    <Tag color={meta.color}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
      {detail && <span className="opacity-70">· {detail}</span>}
    </Tag>
  );
}

export function StatusSelect({
  value,
  onChange,
  detail,
  targetYear,
  onTargetYear,
  className,
}: {
  value: GameStatus;
  onChange: (status: GameStatus) => void;
  detail?: string | null;
  /** When given, games not finished yet get a "Zerar até" year picker in the menu. */
  targetYear?: number | null;
  onTargetYear?: (year: number | null) => void;
  className?: string;
}) {
  const showTarget = onTargetYear && value !== "completed";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none hover:bg-accent", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <StatusTag status={value} detail={detail} />
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        {STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
            <StatusTag status={s} />
            {s === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        {showTarget && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Zerar até</DropdownMenuLabel>
            {[{ value: null, label: "Sem prazo" }, ...targetYearOptions(targetYear ?? null)].map((o) => (
              <DropdownMenuItem key={o.value ?? "none"} onSelect={() => onTargetYear(o.value)}>
                {o.label}
                {(targetYear ?? null) === o.value && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Two tag rows (h-5 + gap-1 + h-5); used so every table row shares the same height. */
export const CATEGORY_TAGS_TWO_LINES = "h-[2.75rem]";

function TagRow({ items }: { items: Category[] }) {
  // shrink-0 + nowrap: tags keep their size; the cell clips what doesn't fit.
  return (
    <div className="flex flex-nowrap gap-1">
      {items.map((c) => (
        <Tag key={c.id} color={c.color} className="max-w-none shrink-0">
          {c.name}
        </Tag>
      ))}
    </div>
  );
}

export function CategoryTags({
  ids,
  categories,
  max,
  className,
  /** From this many tags on, use two rows (2 → one per row; 3+ → first two, then the rest). */
  wrapAt,
}: {
  ids: string[];
  categories: Category[];
  max?: number;
  className?: string;
  wrapAt?: number;
}) {
  const list = ids.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c);
  const shown = max ? list.slice(0, max) : list;
  const extra = max && list.length > max ? list.length - max : 0;
  const split = wrapAt !== undefined && shown.length >= wrapAt;
  // 2 tags → 1+1; 3 or more → 2 on the first row, rest on the second.
  const firstCount = split ? (shown.length === 2 ? 1 : 2) : shown.length;

  return (
    <div className={cn(split ? "flex flex-col gap-1" : "flex flex-nowrap content-start gap-1", className)}>
      {split ? (
        <>
          <TagRow items={shown.slice(0, firstCount)} />
          <TagRow items={shown.slice(firstCount)} />
        </>
      ) : (
        shown.map((c) => (
          <Tag key={c.id} color={c.color} className="max-w-none shrink-0">
            {c.name}
          </Tag>
        ))
      )}
      {extra > 0 && <span className="shrink-0 text-xs text-muted-foreground">+{extra}</span>}
    </div>
  );
}

export function CategoryPicker({
  value,
  onChange,
  className,
  placeholder = "Vazio",
  wrapAt,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  placeholder?: string;
  wrapAt?: number;
}) {
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [query, setQuery] = useState("");
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exact = categories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const create = async () => {
    const name = query.trim();
    if (!name) return;
    const id = await createCategory.mutateAsync({ name, color: randomTagColor() });
    onChange([...value, id]);
    setQuery("");
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn("flex min-h-7 w-full items-center rounded-sm px-1 py-0.5 text-left outline-none hover:bg-accent", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {value.length ? (
          <CategoryTags ids={value} categories={categories} wrapAt={wrapAt} />
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !exact) create();
          }}
          placeholder="Buscar ou criar categoria..."
          className="mb-1 h-8 w-full rounded-sm bg-accent px-2 text-sm outline-none"
        />
        <div className="max-h-60 overflow-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-accent"
            >
              <Tag color={c.color}>{c.name}</Tag>
              {value.includes(c.id) && <Check className="ml-auto size-4 text-muted-foreground" />}
            </button>
          ))}
          {query.trim() && !exact && (
            <button
              onClick={create}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
            >
              <Plus className="size-4 text-muted-foreground" />
              Criar <Tag color="gray">{query.trim()}</Tag>
            </button>
          )}
          {!filtered.length && !query.trim() && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Digite para criar a primeira categoria.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
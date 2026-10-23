import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { STATUS_META, TAG_COLORS, randomTagColor } from "@/lib/constants";
import { useCategories, useCreateCategory } from "@/lib/queries";
import { STATUSES, type Category, type GameStatus, type TagColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  className,
}: {
  value: GameStatus;
  onChange: (status: GameStatus) => void;
  detail?: string | null;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn("flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none hover:bg-accent", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <StatusTag status={value} detail={value === "completed" ? detail : null} />
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        {STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
            <StatusTag status={s} />
            {s === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CategoryTags({ ids, categories, max }: { ids: string[]; categories: Category[]; max?: number }) {
  const list = ids.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c);
  const shown = max ? list.slice(0, max) : list;
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {shown.map((c) => (
        <Tag key={c.id} color={c.color}>
          {c.name}
        </Tag>
      ))}
      {max && list.length > max && <span className="text-xs text-muted-foreground">+{list.length - max}</span>}
    </div>
  );
}

export function CategoryPicker({
  value,
  onChange,
  className,
  placeholder = "Vazio",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  placeholder?: string;
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
          <CategoryTags ids={value} categories={categories} />
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
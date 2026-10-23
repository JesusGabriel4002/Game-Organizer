import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-7 w-full rounded-sm bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground hover:bg-accent focus:bg-accent focus:ring-1 focus:ring-ring";

/** Text input that only commits on blur or Enter, like a Notion property cell. */
export function TextField({
  value,
  onCommit,
  placeholder = "Vazio",
  className,
  list,
}: {
  value: string | null;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commit = () => {
    if (draft !== (value ?? "")) onCommit(draft.trim());
  };
  return (
    <input
      value={draft}
      list={list}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(fieldClass, className)}
    />
  );
}

export function NumberField({
  value,
  onCommit,
  placeholder = "Vazio",
  suffix,
  className,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  const commit = () => {
    const parsed = draft.trim() === "" ? null : Number(draft.replace(",", "."));
    if (parsed !== null && Number.isNaN(parsed)) return setDraft(value?.toString() ?? "");
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        value={draft}
        inputMode="decimal"
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(fieldClass, suffix && "pr-6")}
      />
      {suffix && draft && <span className="pointer-events-none absolute right-1 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

export function DateField({
  value,
  onCommit,
  className,
}: {
  value: string | null;
  onCommit: (value: string | null) => void;
  className?: string;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onCommit(e.target.value || null)}
      className={cn(fieldClass, !value && "text-muted-foreground", "[color-scheme:light] dark:[color-scheme:dark]", className)}
    />
  );
}

/** 0-5 stars. Click the same star again to clear. */
export function RatingField({ value, onCommit }: { value: number | null; onCommit: (value: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center" onMouseLeave={() => setHover(null)} onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          className="cursor-pointer p-0"
          onMouseEnter={() => setHover(i)}
          onClick={() => onCommit(value === i ? null : i)}
          aria-label={`${i} de 5`}
        >
          <Star
            className={cn("size-4", shown >= i ? "text-[#dfab01]" : "text-accent-strong")}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>
      ))}
      {value !== null && <span className="ml-1.5 text-xs text-muted-foreground">{value}/5</span>}
    </div>
  );
}

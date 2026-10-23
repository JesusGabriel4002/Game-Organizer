import { CalendarRange } from "lucide-react";
import { useState } from "react";
import { completionLabel, completionYear, formatFullDate, yearOptions } from "@/lib/completion";
import type { CompletionInput, EntryPatch, LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input, Label, Select } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fieldClass } from "./fields";

const dateInputClass = "[color-scheme:light] dark:[color-scheme:dark]";

/** Year first; exact start/end dates only when the user asks for them. */
export function CompletionEditor({
  value,
  onChange,
  allowEmpty = false,
}: {
  value: { year: number | null; startedAt: string | null; completedAt: string | null };
  onChange: (change: Partial<Omit<CompletionInput, "year">> & { year?: number | null }) => void;
  allowEmpty?: boolean;
}) {
  const [showDates, setShowDates] = useState(!!value.completedAt);

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="completion-year" className="shrink-0">
          Zerado em
        </Label>
        <Select
          id="completion-year"
          value={value.year ?? ""}
          onChange={(e) => onChange({ year: e.target.value ? Number(e.target.value) : null })}
          className="h-7 w-28"
        >
          {allowEmpty && <option value="">Sem ano</option>}
          {yearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      {showDates ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="completion-start">Começou</Label>
            <Input
              id="completion-start"
              type="date"
              value={value.startedAt ?? ""}
              max={value.completedAt ?? undefined}
              onChange={(e) => onChange({ startedAt: e.target.value || null })}
              className={cn("h-7 px-1.5", dateInputClass)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="completion-end">Terminou</Label>
            <Input
              id="completion-end"
              type="date"
              value={value.completedAt ?? ""}
              min={value.startedAt ?? undefined}
              onChange={(e) => {
                const completedAt = e.target.value || null;
                onChange(completedAt ? { completedAt, year: Number(completedAt.slice(0, 4)) } : { completedAt });
              }}
              className={cn("h-7 px-1.5", dateInputClass)}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDates(true)}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <CalendarRange className="size-3.5" />
          Especificar datas
        </button>
      )}
    </div>
  );
}

/** Property cell for a library entry: shows "2026" or the exact date, edits in a popover. */
export function CompletionField({
  entry,
  onPatch,
  detailed = false,
  className,
}: {
  entry: LibraryEntry;
  onPatch: (patch: EntryPatch) => void;
  detailed?: boolean;
  className?: string;
}) {
  const year = completionYear(entry);
  const label = detailed
    ? entry.completedAt
      ? formatFullDate(entry.completedAt)
      : year !== null && `Em ${year}`
    : completionLabel(entry);
  const markCompleted = entry.status === "completed" ? {} : { status: "completed" as const };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className={cn(fieldClass, "text-left", !label && "text-muted-foreground", className)}>
          {label || (detailed ? "Vazio" : "")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" onClick={(e) => e.stopPropagation()}>
        <CompletionEditor
          allowEmpty
          value={{ year, startedAt: entry.startedAt, completedAt: entry.completedAt }}
          onChange={(change) => {
            if (change.year === null) return onPatch({ completedYear: null, completedAt: null });
            const patch: EntryPatch = {};
            if (change.startedAt !== undefined) patch.startedAt = change.startedAt;
            if (change.completedAt !== undefined) Object.assign(patch, { completedAt: change.completedAt }, change.completedAt && markCompleted);
            else if (change.year !== undefined) Object.assign(patch, { completedYear: change.year }, markCompleted);
            onPatch(patch);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

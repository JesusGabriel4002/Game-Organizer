import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LibraryEntry } from "./types";

type Completion = Pick<LibraryEntry, "completedAt" | "completedYear">;

const TARGET_YEARS_AHEAD = 5;

/** "Zerar até" choices: this year and the next few, labelled like "2027 (ano que vem)". */
export function targetYearOptions(current: number | null = null, now = new Date()) {
  const year = now.getFullYear();
  const years = Array.from({ length: TARGET_YEARS_AHEAD + 1 }, (_, i) => year + i);
  // Keep a past target visible so it can still be seen and changed.
  if (current !== null && !years.includes(current)) years.unshift(current);
  return years.map((y) => ({
    value: y,
    label: y === year ? `${y} (este ano)` : y === year + 1 ? `${y} (ano que vem)` : String(y),
  }));
}

/** Text shown inside the status tag: when it was finished, or the year it should be finished by. */
export function statusDetail(e: Completion & Pick<LibraryEntry, "status" | "targetYear">): string | null {
  if (e.status === "completed") return completionLabel(e);
  return e.targetYear ? `até ${e.targetYear}` : null;
}

export function completionYear(e: Completion): number | null {
  return e.completedYear ?? (e.completedAt ? Number(e.completedAt.slice(0, 4)) : null);
}

/** Exact date while it's still that year; afterwards just the year, like "2026". */
export function completionLabel(e: Completion, now = new Date()): string | null {
  const year = completionYear(e);
  if (year === null) return null;
  if (e.completedAt && year === now.getFullYear()) return format(parseISO(e.completedAt), "d 'de' MMM", { locale: ptBR });
  return String(year);
}

export function formatFullDate(date: string) {
  return format(parseISO(date), "d 'de' MMM 'de' yyyy", { locale: ptBR });
}

/** Sorts year-only entries before the dated ones of the same year. */
export function completionSortKey(e: Completion): string {
  return e.completedAt ?? (completionYear(e) !== null ? `${completionYear(e)}-00` : "");
}

export function yearOptions(now = new Date()) {
  const current = now.getFullYear();
  return Array.from({ length: current - 1979 }, (_, i) => current - i);
}

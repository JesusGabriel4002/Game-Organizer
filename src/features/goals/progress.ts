import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Goal, LibraryEntry } from "@/lib/types";

export type GoalState = "done" | "late" | "failed" | "behind" | "active" | "orphan";

export interface GoalProgress {
  state: GoalState;
  current: number;
  target: number;
  percent: number;
  daysLeft: number;
  /** Library entries that count toward the goal. */
  entries: LibraryEntry[];
  hint: string;
}

export function formatDate(date: string) {
  return format(parseISO(date), "d 'de' MMM 'de' yyyy", { locale: ptBR });
}

function inPeriod(date: string | null, start: string | null, end: string) {
  return !!date && (!start || date >= start) && date <= end;
}

export function computeProgress(goal: Goal, library: LibraryEntry[], today = new Date()): GoalProgress {
  const daysLeft = differenceInCalendarDays(parseISO(goal.deadline), today);

  if (goal.type === "count_by_period") {
    const target = Math.max(1, goal.targetCount ?? 1);
    const entries = library.filter(
      (e) =>
        e.status === "completed" &&
        inPeriod(e.completedAt, goal.periodStart, goal.deadline) &&
        (!goal.categoryId || e.categoryIds.includes(goal.categoryId)),
    );
    const current = entries.length;
    const percent = (current / target) * 100;
    const remaining = target - current;

    let state: GoalState = "active";
    let hint = "";
    if (current >= target) {
      state = "done";
      hint = "Meta batida!";
    } else if (daysLeft < 0) {
      state = "failed";
      hint = `Faltaram ${remaining}`;
    } else {
      const start = goal.periodStart ? parseISO(goal.periodStart) : parseISO(goal.createdAt);
      const total = Math.max(1, differenceInCalendarDays(parseISO(goal.deadline), start));
      const elapsed = Math.min(total, Math.max(0, differenceInCalendarDays(today, start)));
      const expected = (elapsed / total) * target;
      const monthsLeft = Math.max(daysLeft / 30.4, 1 / 30.4);
      const perMonth = remaining / monthsLeft;
      hint =
        perMonth >= 1
          ? `Faltam ${remaining} · ~${perMonth.toFixed(1).replace(".", ",")} por mês`
          : `Faltam ${remaining} · 1 a cada ${Math.round(daysLeft / remaining)} dias`;
      if (current + 0.5 < expected) state = "behind";
    }
    return { state, current, target, percent, daysLeft, entries, hint };
  }

  const entry = library.find((e) => e.id === goal.userGameId);
  if (!entry) {
    return { state: "orphan", current: 0, target: 1, percent: 0, daysLeft, entries: [], hint: "Jogo removido da biblioteca" };
  }
  const completed = entry.status === "completed" && !!entry.completedAt;
  const onTime = completed && inPeriod(entry.completedAt, goal.periodStart, goal.deadline);

  if (onTime) return { state: "done", current: 1, target: 1, percent: 100, daysLeft, entries: [entry], hint: `Zerado em ${formatDate(entry.completedAt!)}` };
  if (completed) return { state: "late", current: 1, target: 1, percent: 100, daysLeft, entries: [entry], hint: `Zerado fora do prazo (${formatDate(entry.completedAt!)})` };
  if (daysLeft < 0) return { state: "failed", current: 0, target: 1, percent: 0, daysLeft, entries: [entry], hint: "Prazo encerrado" };

  const percent = entry.status === "playing" ? 50 : 0;
  const hint = entry.status === "playing" ? "Jogando agora" : "Ainda não começou";
  return { state: daysLeft <= 14 ? "behind" : "active", current: 0, target: 1, percent, daysLeft, entries: [entry], hint };
}

export function daysLeftLabel(days: number) {
  if (days < 0) return `Encerrou há ${-days} ${days === -1 ? "dia" : "dias"}`;
  if (days === 0) return "Termina hoje";
  if (days === 1) return "Falta 1 dia";
  return `Faltam ${days} dias`;
}

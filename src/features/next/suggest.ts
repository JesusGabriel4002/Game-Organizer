import { differenceInCalendarDays, parseISO } from "date-fns";
import { computeProgress } from "@/features/goals/progress";
import { scoreOf } from "@/lib/igdb-info";
import type { Goal, LibraryEntry } from "@/lib/types";

export type TimeBudget = "any" | "short" | "medium" | "long";

export const TIME_BUDGETS: Record<TimeBudget, { label: string; test: (hours: number | null) => boolean }> = {
  any: { label: "Qualquer duração", test: () => true },
  short: { label: "Curto (até 10h)", test: (h) => h !== null && h <= 10 },
  medium: { label: "Médio (10 a 30h)", test: (h) => h !== null && h > 10 && h <= 30 },
  long: { label: "Longo (mais de 30h)", test: (h) => h !== null && h > 30 },
};

export interface SuggestFilters {
  budget: TimeBudget;
  categoryId: string | null;
  platform: string | null;
  includePlaying: boolean;
}

export interface Suggestion {
  entry: LibraryEntry;
  score: number;
  reasons: string[];
}

function hoursToBeat(e: LibraryEntry) {
  return e.timeToBeat ? e.timeToBeat / 3600 : null;
}

/**
 * Ranks "Pra zerar" (and optionally "Jogando") games: deadlines and active goals weigh the most, then critic score,
 * how long the game has waited in the list and whether it's short.
 */
export function rankSuggestions(library: LibraryEntry[], goals: Goal[], filters: SuggestFilters, today = new Date()): Suggestion[] {
  const year = today.getFullYear();
  const activeGoals = goals
    .map((g) => ({ goal: g, progress: computeProgress(g, library, today) }))
    .filter(({ progress }) => progress.state === "active" || progress.state === "behind");

  return library
    .filter((e) => e.status === "backlog" || (filters.includePlaying && e.status === "playing"))
    .filter((e) => TIME_BUDGETS[filters.budget].test(hoursToBeat(e)))
    .filter((e) => !filters.categoryId || e.categoryIds.includes(filters.categoryId))
    .filter((e) => !filters.platform || e.platform === filters.platform)
    .map((e) => {
      let score = 1;
      const reasons: string[] = [];

      if (e.status === "playing") {
        score += 1.5;
        reasons.push("Você já começou");
      }
      if (e.targetYear !== null && e.targetYear <= year) {
        score += 3;
        reasons.push(e.targetYear < year ? `Era para zerar até ${e.targetYear}` : `Meta: zerar em ${year}`);
      } else if (e.targetYear === year + 1) {
        score += 1;
        reasons.push(`Meta: zerar até ${e.targetYear}`);
      }

      const goalHits = activeGoals.filter(
        ({ goal }) =>
          goal.userGameId === e.id || (goal.type === "count_by_period" && (!goal.categoryId || e.categoryIds.includes(goal.categoryId))),
      );
      if (goalHits.length) {
        const behind = goalHits.some(({ progress }) => progress.state === "behind");
        score += behind ? 2.5 : 1.5;
        reasons.push(`Conta para a meta “${goalHits[0].goal.title}”${behind ? " (atrasada)" : ""}`);
      }

      const critic = scoreOf(e);
      if (critic !== null) {
        score += Math.max(0, (critic - 60) / 20);
        if (critic >= 85) reasons.push(`Nota ${critic} da crítica`);
      }

      const hours = hoursToBeat(e);
      if (hours !== null && hours <= 12) {
        score += 0.5;
        reasons.push(`Curto: cerca de ${Math.max(1, Math.round(hours))}h`);
      }

      const waitingDays = differenceInCalendarDays(today, parseISO(e.createdAt));
      if (waitingDays > 180) {
        score += Math.min(1, waitingDays / 730);
        reasons.push(waitingDays > 365 ? "Esperando há mais de um ano" : "Esperando há meses");
      }

      return { entry: e, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "pt-BR"));
}

/** Weighted draw: better-ranked games are more likely, but any of them can come up. */
export function drawSuggestion(list: Suggestion[], exclude: string | null, random = Math.random): Suggestion | null {
  const pool = list.length > 1 ? list.filter((s) => s.entry.id !== exclude) : list;
  if (!pool.length) return null;
  const total = pool.reduce((sum, s) => sum + s.score * s.score, 0);
  let pick = random() * total;
  for (const s of pool) {
    pick -= s.score * s.score;
    if (pick <= 0) return s;
  }
  return pool[pool.length - 1];
}

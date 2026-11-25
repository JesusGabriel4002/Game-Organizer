import { computeProgress } from "@/features/goals/progress";
import { completionSortKey, completionYear } from "@/lib/completion";
import type { Category, Goal, LibraryEntry, PlaySession } from "@/lib/types";

export const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function topBy<T>(items: T[], key: (item: T) => string[]): { name: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const item of items) for (const k of key(item)) counts.set(k, (counts.get(k) ?? 0) + 1);
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) if (!best || count > best.count) best = { name, count };
  return best;
}

export interface Recap {
  year: number;
  completed: LibraryEntry[];
  previousYearCount: number;
  started: number;
  /** Logged session time in the year, in minutes. */
  sessionMinutes: number;
  sessionCount: number;
  daysPlayed: number;
  /** Sum of IGDB average time to beat for the games finished in the year, in hours. */
  estimatedHours: number;
  bestMonth: { month: number; count: number } | null;
  favorite: LibraryEntry | null;
  longest: LibraryEntry | null;
  shortest: LibraryEntry | null;
  mostPlayed: { entry: LibraryEntry; minutes: number } | null;
  topCategory: { name: string; count: number } | null;
  topGenre: { name: string; count: number } | null;
  topPlatform: { name: string; count: number } | null;
  goals: { done: number; total: number };
}

export function recapYears(library: LibraryEntry[], sessions: PlaySession[], now = new Date()) {
  const years = new Set<number>([now.getFullYear()]);
  for (const e of library) {
    const y = e.status === "completed" ? completionYear(e) : null;
    if (y) years.add(y);
  }
  for (const s of sessions) years.add(Number(s.playedOn.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

export function buildRecap(
  year: number,
  library: LibraryEntry[],
  sessions: PlaySession[],
  categories: Category[],
  goals: Goal[],
): Recap {
  const completedOf = (y: number) => library.filter((e) => e.status === "completed" && completionYear(e) === y);
  const completed = completedOf(year).sort((a, b) => completionSortKey(a).localeCompare(completionSortKey(b)));
  const yearSessions = sessions.filter((s) => s.playedOn.startsWith(`${year}-`));
  const byId = new Map(library.map((e) => [e.id, e]));

  const perMonth = new Array(12).fill(0);
  for (const e of completed) if (e.completedAt) perMonth[Number(e.completedAt.slice(5, 7)) - 1] += 1;
  const bestCount = Math.max(...perMonth);
  const bestMonth = bestCount > 0 ? { month: perMonth.indexOf(bestCount), count: bestCount } : null;

  const rated = completed.filter((e) => e.rating !== null);
  const favorite = rated.length ? [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] : null;
  const timed = completed.filter((e) => e.timeToBeat);
  const byTime = [...timed].sort((a, b) => (b.timeToBeat ?? 0) - (a.timeToBeat ?? 0));

  const minutesByGame = new Map<string, number>();
  for (const s of yearSessions) minutesByGame.set(s.userGameId, (minutesByGame.get(s.userGameId) ?? 0) + s.minutes);
  let mostPlayed: Recap["mostPlayed"] = null;
  for (const [id, minutes] of minutesByGame) {
    const entry = byId.get(id);
    if (entry && (!mostPlayed || minutes > mostPlayed.minutes)) mostPlayed = { entry, minutes };
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const yearGoals = goals.filter((g) => g.deadline.startsWith(`${year}-`));
  const goalStates = yearGoals.map((g) => computeProgress(g, library).state);

  return {
    year,
    completed,
    previousYearCount: completedOf(year - 1).length,
    started: library.filter((e) => e.startedAt?.startsWith(`${year}-`)).length,
    sessionMinutes: yearSessions.reduce((sum, s) => sum + s.minutes, 0),
    sessionCount: yearSessions.length,
    daysPlayed: new Set(yearSessions.map((s) => s.playedOn)).size,
    estimatedHours: completed.reduce((sum, e) => sum + (e.timeToBeat ?? 0) / 3600, 0),
    bestMonth,
    favorite,
    longest: byTime[0] ?? null,
    shortest: byTime.length > 1 ? byTime[byTime.length - 1] : null,
    mostPlayed,
    topCategory: topBy(completed, (e) => e.categoryIds.map((id) => categoryName.get(id) ?? "").filter(Boolean)),
    topGenre: topBy(completed, (e) => e.genres),
    topPlatform: topBy(completed, (e) => (e.platform ? [e.platform] : [])),
    goals: { done: goalStates.filter((s) => s === "done" || s === "late").length, total: yearGoals.length },
  };
}

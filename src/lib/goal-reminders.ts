import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useEffect, useRef } from "react";
import { computeProgress } from "@/features/goals/progress";
import { getSetting, setSetting } from "./db";
import { useGoals, useLibrary } from "./queries";
import type { Goal, LibraryEntry } from "./types";

export const GOAL_REMINDERS_SETTING = "goalReminders";
const LAST_REMINDER_SETTING = "lastGoalReminder";
const SOON_DAYS = 7;

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lines for today's reminder: goals that are behind or ending soon, and "zerar até" games left for this year. */
export function reminderLines(goals: Goal[], library: LibraryEntry[], today = new Date()): string[] {
  const lines: string[] = [];
  for (const goal of goals) {
    const p = computeProgress(goal, library, today);
    if (p.state !== "active" && p.state !== "behind") continue;
    if (p.daysLeft >= 0 && p.daysLeft <= SOON_DAYS) {
      lines.push(`${goal.title}: ${p.daysLeft === 0 ? "termina hoje" : `faltam ${p.daysLeft} ${p.daysLeft === 1 ? "dia" : "dias"}`} (${p.hint})`);
    } else if (p.state === "behind") {
      lines.push(`${goal.title}: atrasada. ${p.hint}`);
    }
  }
  // From November on, remind about games meant to be finished this year.
  const year = today.getFullYear();
  if (today.getMonth() >= 10) {
    const left = library.filter((e) => e.targetYear === year && e.status !== "completed" && e.status !== "dropped").length;
    if (left) lines.push(`${left} ${left === 1 ? "jogo" : "jogos"} para zerar até o fim de ${year}`);
  }
  return lines;
}

/** At most one Windows notification per day, when there is something to remind. */
export function useGoalReminders() {
  const { data: goals } = useGoals();
  const { data: library } = useLibrary();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !goals || !library) return;
    done.current = true;
    void (async () => {
      try {
        if ((await getSetting(GOAL_REMINDERS_SETTING)) === "off") return;
        const today = localDate();
        if ((await getSetting(LAST_REMINDER_SETTING)) === today) return;
        const lines = reminderLines(goals, library);
        if (!lines.length) return;
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        if (!granted) return;
        sendNotification({
          title: lines.length === 1 ? "Lembrete de meta" : `${lines.length} lembretes de metas`,
          body: lines.slice(0, 4).join("\n"),
        });
        await setSetting(LAST_REMINDER_SETTING, today);
      } catch {
        // Notifications are a nice-to-have; never break the app over them.
      }
    })();
  }, [goals, library]);
}

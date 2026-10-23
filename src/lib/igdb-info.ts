import type { LibraryEntry } from "./types";

type Rated = Pick<LibraryEntry, "criticRating" | "igdbRating">;

/** Press score when there is one, otherwise IGDB's overall score; 0-100. */
export function scoreOf(e: Rated): number | null {
  const score = e.criticRating ?? e.igdbRating;
  return score === null ? null : Math.round(score);
}

/** Metacritic-style bands. */
export function scoreColor(score: number) {
  if (score >= 75) return "bg-[#66cc33] text-black";
  if (score >= 50) return "bg-[#ffcc33] text-black";
  return "bg-[#ff0000] text-white";
}

export function formatTimeToBeat(seconds: number | null): string | null {
  if (!seconds) return null;
  const hours = Math.max(1, Math.round(seconds / 3600));
  return hours === 1 ? "1 hora" : `${hours} horas`;
}

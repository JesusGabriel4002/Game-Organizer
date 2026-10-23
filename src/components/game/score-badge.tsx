import { scoreColor, scoreOf } from "@/lib/igdb-info";
import type { LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Square score seal laid over a cover, like Metacritic's. */
export function ScoreBadge({ entry, className }: { entry: Pick<LibraryEntry, "criticRating" | "igdbRating">; className?: string }) {
  const score = scoreOf(entry);
  if (score === null) return null;
  return (
    <span
      title={entry.criticRating !== null ? "Nota da crítica (IGDB)" : "Nota geral do IGDB"}
      className={cn(
        "absolute left-2 top-2 flex size-9 items-center justify-center rounded-md text-base font-bold shadow-md",
        scoreColor(score),
        className,
      )}
    >
      {score}
    </span>
  );
}

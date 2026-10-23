import type { GameStatus, LibraryEntry } from "./types";

/** Jogando → Pra zerar → Zerado. */
export const STATUS_SORT_ORDER: Record<GameStatus, number> = { playing: 0, backlog: 1, completed: 2 };

/** Default list order: status first, then average hours (higher further down). */
export function defaultLibrarySort(a: LibraryEntry, b: LibraryEntry) {
  return (
    STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status] ||
    (a.timeToBeat ?? Number.POSITIVE_INFINITY) - (b.timeToBeat ?? Number.POSITIVE_INFINITY) ||
    a.name.localeCompare(b.name, "pt-BR")
  );
}

/** Among active sorts, the leftmost column in the table wins as primary. */
export function prioritizeLeftmostSort<T extends { id: string }>(sorting: T[], columnOrder: string[]): T[] {
  return [...sorting].sort((a, b) => {
    const ai = columnOrder.indexOf(a.id);
    const bi = columnOrder.indexOf(b.id);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

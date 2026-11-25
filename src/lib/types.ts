export type GameStatus = "wishlist" | "backlog" | "playing" | "completed" | "dropped";

export const STATUSES: GameStatus[] = ["wishlist", "backlog", "playing", "completed", "dropped"];

/** Statuses where the game was never started, so no start date is filled in. */
export const NOT_STARTED: GameStatus[] = ["wishlist", "backlog"];

/** Statuses that can have a "zerar até" year. */
export const CAN_TARGET: GameStatus[] = ["wishlist", "backlog", "playing"];

export interface LibraryEntry {
  id: string;
  gameId: string;
  igdbId: number | null;
  name: string;
  coverUrl: string | null;
  releaseYear: number | null;
  genres: string[];
  gamePlatforms: string[];
  summary: string | null;
  /** 0-100 from IGDB: press reviews, and the overall score as a fallback. */
  criticRating: number | null;
  igdbRating: number | null;
  /** Average seconds to finish the main story, per IGDB. */
  timeToBeat: number | null;
  status: GameStatus;
  platform: string | null;
  rating: number | null;
  hours: number | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Year the game was finished; `completedAt` is only set when the exact date is known. */
  completedYear: number | null;
  /** Year the user wants to finish the game by. */
  targetYear: number | null;
  notes: string;
  categoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type EntryPatch = Partial<
  Pick<
    LibraryEntry,
    | "status"
    | "platform"
    | "rating"
    | "hours"
    | "startedAt"
    | "completedAt"
    | "completedYear"
    | "targetYear"
    | "notes"
    | "name"
    | "coverUrl"
  >
>;

export interface AddOptions {
  completion?: CompletionInput;
  targetYear?: number | null;
}

export interface CompletionInput {
  year: number;
  startedAt: string | null;
  completedAt: string | null;
}

export type TagColor = "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";

export interface Category {
  id: string;
  name: string;
  color: TagColor;
  icon: string | null;
  createdAt: string;
}

export type GoalType = "game_by_date" | "game_by_year" | "count_by_period";

export interface Goal {
  id: string;
  title: string;
  type: GoalType;
  userGameId: string | null;
  categoryId: string | null;
  targetCount: number | null;
  periodStart: string | null;
  deadline: string;
  createdAt: string;
}

export type GoalInput = Omit<Goal, "id" | "createdAt">;

export interface IgdbGame {
  igdbId: number;
  name: string;
  coverUrl: string | null;
  releaseYear: number | null;
  genres: string[];
  platforms: string[];
  summary: string | null;
}

export interface IgdbDetails {
  igdbId: number;
  criticRating: number | null;
  igdbRating: number | null;
  timeToBeat: number | null;
  tags: string[];
}

export interface IgdbStatus {
  configured: boolean;
  source: "settings" | "env" | "proxy" | null;
  clientIdHint: string | null;
}

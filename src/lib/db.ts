import Database from "@tauri-apps/plugin-sql";
import { matchCategories } from "./auto-categories";
import { newId, nowIso, parseJsonArray } from "./utils";
import type { AddOptions, Category, CompletionInput, EntryPatch, GameStatus, Goal, GoalInput, IgdbDetails, IgdbGame, LibraryEntry, TagColor } from "./types";

const DB_URL = "sqlite:games.db";

let dbPromise: Promise<Database> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).then(async (db) => {
      await db.execute("PRAGMA foreign_keys = ON");
      return db;
    });
  }
  return dbPromise;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- library

interface EntryRow {
  id: string;
  game_id: string;
  igdb_id: number | null;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  genres: string;
  platforms: string;
  summary: string | null;
  critic_rating: number | null;
  igdb_rating: number | null;
  time_to_beat: number | null;
  status: GameStatus;
  platform: string | null;
  rating: number | null;
  hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  completed_year: number | null;
  target_year: number | null;
  notes: string;
  category_ids: string | null;
  created_at: string;
  updated_at: string;
}

const ENTRY_SELECT = `
  SELECT ug.id, ug.game_id, g.igdb_id, g.name, g.cover_url, g.release_year, g.genres, g.platforms, g.summary,
         g.critic_rating, g.igdb_rating, g.time_to_beat, ug.status, ug.platform, ug.rating, ug.hours, ug.started_at, ug.completed_at, ug.completed_year, ug.target_year, ug.notes,
         ug.created_at, ug.updated_at,
         (SELECT group_concat(ugc.category_id) FROM user_game_categories ugc
            JOIN categories c ON c.id = ugc.category_id AND c.deleted_at IS NULL
           WHERE ugc.user_game_id = ug.id AND ugc.deleted_at IS NULL) AS category_ids
    FROM user_games ug
    JOIN games g ON g.id = ug.game_id
   WHERE ug.deleted_at IS NULL`;

function toEntry(r: EntryRow): LibraryEntry {
  return {
    id: r.id,
    gameId: r.game_id,
    igdbId: r.igdb_id,
    name: r.name,
    coverUrl: r.cover_url,
    releaseYear: r.release_year,
    genres: parseJsonArray(r.genres),
    gamePlatforms: parseJsonArray(r.platforms),
    summary: r.summary,
    criticRating: r.critic_rating,
    igdbRating: r.igdb_rating,
    timeToBeat: r.time_to_beat,
    status: r.status,
    platform: r.platform,
    rating: r.rating,
    hours: r.hours,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    completedYear: r.completed_year,
    targetYear: r.target_year,
    notes: r.notes ?? "",
    categoryIds: r.category_ids ? r.category_ids.split(",") : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(`${ENTRY_SELECT} ORDER BY ug.updated_at DESC`);
  return rows.map(toEntry);
}

export async function getEntry(id: string): Promise<LibraryEntry | null> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(`${ENTRY_SELECT} AND ug.id = $1`, [id]);
  return rows[0] ? toEntry(rows[0]) : null;
}

function yearOf(date: string) {
  return Number(date.slice(0, 4));
}

function statusDates(status: GameStatus, completion?: CompletionInput) {
  if (status === "completed" && completion) {
    return {
      started_at: completion.startedAt,
      completed_at: completion.completedAt,
      completed_year: completion.completedAt ? yearOf(completion.completedAt) : completion.year,
    };
  }
  return {
    started_at: status === "backlog" ? null : today(),
    completed_at: status === "completed" ? today() : null,
    completed_year: status === "completed" ? new Date().getFullYear() : null,
  };
}

async function insertUserGame(gameId: string, status: GameStatus, platform: string | null, options: AddOptions = {}) {
  const db = await getDb();
  const id = newId();
  const dates = statusDates(status, options.completion);
  const now = nowIso();
  await db.execute(
    `INSERT INTO user_games (id, game_id, status, platform, started_at, completed_at, completed_year, target_year, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [id, gameId, status, platform, dates.started_at, dates.completed_at, dates.completed_year, options.targetYear ?? null, now],
  );
  return id;
}

/** Returns the library entry id; reuses an existing entry if the game is already in the library. */
export async function addFromIgdb(
  game: IgdbGame,
  status: GameStatus,
  options?: AddOptions,
): Promise<{ id: string; existed: boolean }> {
  const db = await getDb();
  const now = nowIso();
  const existing = await db.select<{ id: string }[]>("SELECT id FROM games WHERE igdb_id = $1", [game.igdbId]);
  let gameId: string;
  if (existing[0]) {
    gameId = existing[0].id;
    await db.execute(
      `UPDATE games SET name = $1, cover_url = $2, release_year = $3, genres = $4, platforms = $5, summary = $6,
              updated_at = $7, deleted_at = NULL WHERE id = $8`,
      [game.name, game.coverUrl, game.releaseYear, JSON.stringify(game.genres), JSON.stringify(game.platforms), game.summary, now, gameId],
    );
    const entry = await db.select<{ id: string }[]>(
      "SELECT id FROM user_games WHERE game_id = $1 AND deleted_at IS NULL",
      [gameId],
    );
    if (entry[0]) return { id: entry[0].id, existed: true };
  } else {
    gameId = newId();
    await db.execute(
      `INSERT INTO games (id, igdb_id, name, cover_url, release_year, genres, platforms, summary, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [gameId, game.igdbId, game.name, game.coverUrl, game.releaseYear, JSON.stringify(game.genres), JSON.stringify(game.platforms), game.summary, now],
    );
  }
  const platform = game.platforms.length === 1 ? game.platforms[0] : null;
  return { id: await insertUserGame(gameId, status, platform, options), existed: false };
}

export async function addManual(name: string, status: GameStatus, options?: AddOptions): Promise<string> {
  const db = await getDb();
  const gameId = newId();
  const now = nowIso();
  await db.execute("INSERT INTO games (id, name, created_at, updated_at) VALUES ($1, $2, $3, $3)", [gameId, name.trim(), now]);
  return insertUserGame(gameId, status, null, options);
}

export async function updateEntry(id: string, patch: EntryPatch, current?: LibraryEntry) {
  const db = await getDb();
  const now = nowIso();
  const cols: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    cols.status = patch.status;
    // Fill in dates automatically on status changes unless the caller set them.
    const setsCompletion = patch.completedAt !== undefined || patch.completedYear !== undefined;
    const hasCompletion = !!current?.completedAt || current?.completedYear != null;
    if (patch.status === "completed" && !setsCompletion && !hasCompletion) {
      cols.completed_at = today();
      cols.completed_year = new Date().getFullYear();
    }
    if (patch.status !== "backlog" && patch.startedAt === undefined && !current?.startedAt) cols.started_at = today();
    if (patch.status !== "completed" && !setsCompletion) {
      cols.completed_at = null;
      cols.completed_year = null;
    }
  }
  if (patch.targetYear !== undefined) cols.target_year = patch.targetYear;
  if (patch.platform !== undefined) cols.platform = patch.platform || null;
  if (patch.rating !== undefined) cols.rating = patch.rating;
  if (patch.hours !== undefined) cols.hours = patch.hours;
  if (patch.startedAt !== undefined) cols.started_at = patch.startedAt || null;
  if (patch.completedYear !== undefined) {
    cols.completed_year = patch.completedYear;
    // An exact date from another year would contradict the new year.
    if (patch.completedAt === undefined && current?.completedAt && yearOf(current.completedAt) !== patch.completedYear) {
      cols.completed_at = null;
    }
  }
  if (patch.completedAt !== undefined) {
    cols.completed_at = patch.completedAt || null;
    if (patch.completedAt) cols.completed_year = yearOf(patch.completedAt);
  }
  if (patch.notes !== undefined) cols.notes = patch.notes;

  const keys = Object.keys(cols);
  if (keys.length) {
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    await db.execute(`UPDATE user_games SET ${sets}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2}`, [
      ...keys.map((k) => cols[k]),
      now,
      id,
    ]);
  }

  if ((patch.name !== undefined || patch.coverUrl !== undefined) && current) {
    await db.execute("UPDATE games SET name = $1, cover_url = $2, updated_at = $3 WHERE id = $4", [
      patch.name?.trim() || current.name,
      patch.coverUrl !== undefined ? patch.coverUrl || null : current.coverUrl,
      now,
      current.gameId,
    ]);
  }
}

const IGDB_REFRESH_DAYS = 30;

/** Library games whose IGDB details were never fetched (`firstSync`) or are getting old. */
export async function listGamesToSync(): Promise<{ igdbId: number; firstSync: boolean }[]> {
  const db = await getDb();
  const staleBefore = new Date(Date.now() - IGDB_REFRESH_DAYS * 86_400_000).toISOString();
  const rows = await db.select<{ igdb_id: number; synced: string | null }[]>(
    `SELECT DISTINCT g.igdb_id, g.igdb_synced_at AS synced FROM games g
       JOIN user_games ug ON ug.game_id = g.id AND ug.deleted_at IS NULL
      WHERE g.igdb_id IS NOT NULL AND (g.igdb_synced_at IS NULL OR g.igdb_synced_at < $1)`,
    [staleBefore],
  );
  return rows.map((r) => ({ igdbId: r.igdb_id, firstSync: r.synced === null }));
}

/** Derived data, so updated_at is left alone and backups don't treat it as a user edit. */
export async function saveGameDetails(details: IgdbDetails[]) {
  const db = await getDb();
  const now = nowIso();
  for (const d of details) {
    await db.execute(
      `UPDATE games SET critic_rating = $1, igdb_rating = $2, time_to_beat = $3, igdb_tags = $4, igdb_synced_at = $5
        WHERE igdb_id = $6`,
      [d.criticRating, d.igdbRating, d.timeToBeat, JSON.stringify(d.tags), now, d.igdbId],
    );
  }
}

/**
 * Adds the built-in categories (Soulslike, Cozy...) that match each game. Only adds: a category the
 * user removed from a game stays removed, and a category the user deleted is never recreated.
 */
export async function applyAutoCategories(igdbIds?: number[]): Promise<number> {
  if (igdbIds && !igdbIds.length) return 0;
  const db = await getDb();
  const filter = igdbIds ? `AND g.igdb_id IN (${igdbIds.map(Number).join(",")})` : "";
  const games = await db.select<{ entry_id: string; name: string; genres: string; igdb_tags: string | null }[]>(
    `SELECT ug.id AS entry_id, g.name, g.genres, g.igdb_tags FROM user_games ug
       JOIN games g ON g.id = ug.game_id
      WHERE ug.deleted_at IS NULL ${filter}`,
  );
  // Active categories win over deleted ones with the same name.
  const existing = await db.select<{ id: string; name: string; deleted_at: string | null }[]>(
    "SELECT id, name, deleted_at FROM categories ORDER BY deleted_at IS NULL",
  );
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  const now = nowIso();
  let added = 0;
  for (const game of games) {
    const tags = [...parseJsonArray(game.igdb_tags), ...parseJsonArray(game.genres)];
    for (const rule of matchCategories(game.name, tags)) {
      let category = byName.get(rule.name.toLowerCase());
      if (category?.deleted_at) continue;
      if (!category) {
        category = { id: await createCategory(rule.name, rule.color), name: rule.name, deleted_at: null };
        byName.set(rule.name.toLowerCase(), category);
      }
      const result = await db.execute(
        `INSERT INTO user_game_categories (user_game_id, category_id, created_at, updated_at) VALUES ($1, $2, $3, $3)
         ON CONFLICT (user_game_id, category_id) DO NOTHING`,
        [game.entry_id, category.id, now],
      );
      added += result.rowsAffected;
    }
  }
  return added;
}

export async function deleteEntry(id: string) {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE user_games SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
  await db.execute("UPDATE user_game_categories SET deleted_at = $1, updated_at = $1 WHERE user_game_id = $2", [now, id]);
}

export async function setEntryCategories(entryId: string, categoryIds: string[]) {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    "UPDATE user_game_categories SET deleted_at = $1, updated_at = $1 WHERE user_game_id = $2 AND deleted_at IS NULL",
    [now, entryId],
  );
  for (const categoryId of categoryIds) {
    await db.execute(
      `INSERT INTO user_game_categories (user_game_id, category_id, created_at, updated_at) VALUES ($1, $2, $3, $3)
       ON CONFLICT (user_game_id, category_id) DO UPDATE SET deleted_at = NULL, updated_at = $3`,
      [entryId, categoryId, now],
    );
  }
}

// ---------------------------------------------------------------- categories

interface CategoryRow {
  id: string;
  name: string;
  color: TagColor;
  icon: string | null;
  created_at: string;
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT id, name, color, icon, created_at FROM categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, icon: r.icon, createdAt: r.created_at }));
}

export async function createCategory(name: string, color: TagColor): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute("INSERT INTO categories (id, name, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)", [
    id,
    name.trim(),
    color,
    now,
  ]);
  return id;
}

export async function updateCategory(id: string, patch: { name?: string; color?: TagColor }) {
  const db = await getDb();
  const now = nowIso();
  if (patch.name !== undefined) await db.execute("UPDATE categories SET name = $1, updated_at = $2 WHERE id = $3", [patch.name.trim(), now, id]);
  if (patch.color !== undefined) await db.execute("UPDATE categories SET color = $1, updated_at = $2 WHERE id = $3", [patch.color, now, id]);
}

export async function deleteCategory(id: string) {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE categories SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
  await db.execute("UPDATE user_game_categories SET deleted_at = $1, updated_at = $1 WHERE category_id = $2", [now, id]);
  await db.execute("UPDATE goals SET category_id = NULL, updated_at = $1 WHERE category_id = $2", [now, id]);
}

// ---------------------------------------------------------------- goals

interface GoalRow {
  id: string;
  title: string;
  type: Goal["type"];
  user_game_id: string | null;
  category_id: string | null;
  target_count: number | null;
  period_start: string | null;
  deadline: string;
  created_at: string;
}

export async function listGoals(): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<GoalRow[]>(
    `SELECT id, title, type, user_game_id, category_id, target_count, period_start, deadline, created_at
       FROM goals WHERE deleted_at IS NULL ORDER BY deadline`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    userGameId: r.user_game_id,
    categoryId: r.category_id,
    targetCount: r.target_count,
    periodStart: r.period_start,
    deadline: r.deadline,
    createdAt: r.created_at,
  }));
}

export async function saveGoal(input: GoalInput, id?: string) {
  const db = await getDb();
  const now = nowIso();
  const values = [input.title.trim(), input.type, input.userGameId, input.categoryId, input.targetCount, input.periodStart, input.deadline];
  if (id) {
    await db.execute(
      `UPDATE goals SET title = $1, type = $2, user_game_id = $3, category_id = $4, target_count = $5, period_start = $6,
              deadline = $7, updated_at = $8 WHERE id = $9`,
      [...values, now, id],
    );
    return id;
  }
  const newGoalId = newId();
  await db.execute(
    `INSERT INTO goals (title, type, user_game_id, category_id, target_count, period_start, deadline, created_at, updated_at, id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)`,
    [...values, now, newGoalId],
  );
  return newGoalId;
}

export async function deleteGoal(id: string) {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE goals SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
}

// ---------------------------------------------------------------- settings

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, nowIso()],
  );
}

// ---------------------------------------------------------------- backup

export const BACKUP_TABLES = ["games", "categories", "user_games", "user_game_categories", "goals"] as const;
type BackupTable = (typeof BACKUP_TABLES)[number];

export interface Backup {
  app: "game-organizer";
  version: 1;
  exportedAt: string;
  tables: Record<BackupTable, Record<string, unknown>[]>;
}

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const tables = {} as Backup["tables"];
  for (const table of BACKUP_TABLES) {
    tables[table] = await db.select<Record<string, unknown>[]>(`SELECT * FROM ${table}`);
  }
  return { app: "game-organizer", version: 1, exportedAt: nowIso(), tables };
}

/** Upserts every row from the backup, keeping whichever copy has the newest updated_at. */
export async function importBackup(backup: Backup) {
  if (backup?.app !== "game-organizer" || !backup.tables) throw new Error("Arquivo de backup inválido.");
  const db = await getDb();
  let imported = 0;
  let skipped = 0;
  for (const table of BACKUP_TABLES) {
    const rows = backup.tables[table] ?? [];
    const conflict = table === "user_game_categories" ? "user_game_id, category_id" : "id";
    for (const row of rows) {
      const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
      if (!cols.length) continue;
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const updates = cols.map((c) => `${c} = excluded.${c}`).join(", ");
      try {
        const result = await db.execute(
          `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
           ON CONFLICT (${conflict}) DO UPDATE SET ${updates} WHERE excluded.updated_at > ${table}.updated_at`,
          cols.map((c) => row[c]),
        );
        imported += result.rowsAffected;
      } catch {
        // e.g. the same IGDB game already exists locally under another id
        skipped += 1;
      }
    }
  }
  return { imported, skipped };
}

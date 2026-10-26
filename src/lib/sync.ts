import { getDb } from "./db";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { enqueueAllLocalRows, getSyncMeta, outboxCount, setApplying, setSyncMeta } from "./sync-meta";
import { nowIso } from "./utils";

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "disabled";

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  pending: number;
  error: string | null;
}

type Listener = (state: SyncState) => void;

const listeners = new Set<Listener>();
let state: SyncState = { status: "disabled", lastSyncAt: null, pending: 0, error: null };
let running: Promise<void> | null = null;
let backoffMs = 0;

const SYNC_TABLES = ["games", "categories", "user_games", "user_game_categories", "goals"] as const;
type SyncTable = (typeof SYNC_TABLES)[number];

const PULL_ORDER: SyncTable[] = ["games", "categories", "user_games", "user_game_categories", "goals"];
const PUSH_ORDER: SyncTable[] = ["games", "categories", "user_games", "user_game_categories", "goals"];

const TABLE_COLUMNS: Record<SyncTable, string[]> = {
  games: ["id", "igdb_id", "name", "cover_url", "cover_local", "release_year", "genres", "platforms", "summary", "created_at", "updated_at", "deleted_at"],
  categories: ["id", "name", "color", "icon", "created_at", "updated_at", "deleted_at"],
  user_games: [
    "id", "game_id", "status", "platform", "rating", "hours", "started_at", "completed_at",
    "completed_year", "target_year", "notes", "created_at", "updated_at", "deleted_at",
  ],
  user_game_categories: ["user_game_id", "category_id", "created_at", "updated_at", "deleted_at"],
  goals: [
    "id", "title", "type", "user_game_id", "category_id", "target_count", "period_start",
    "deadline", "created_at", "updated_at", "deleted_at",
  ],
};

function emit(partial: Partial<SyncState>) {
  state = { ...state, ...partial };
  for (const l of listeners) l(state);
}

export function getSyncState() {
  return state;
}

export function subscribeSync(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshPending() {
  if (!isSupabaseConfigured()) {
    emit({ status: "disabled", pending: 0 });
    return;
  }
  const pending = await outboxCount();
  const lastSyncAt = await getSyncMeta("last_sync_at");
  emit({ pending, lastSyncAt, status: !navigator.onLine ? "offline" : state.status === "syncing" ? "syncing" : pending > 0 ? "idle" : "idle" });
}

async function loadRows(table: SyncTable, pks: string[]): Promise<Record<string, unknown>[]> {
  if (!pks.length) return [];
  const db = await getDb();
  const cols = TABLE_COLUMNS[table];
  if (table === "user_game_categories") {
    const rows: Record<string, unknown>[] = [];
    for (const pk of pks) {
      const [ug, cat] = pk.split("|");
      const found = await db.select<Record<string, unknown>[]>(
        `SELECT ${cols.join(", ")} FROM user_game_categories WHERE user_game_id = $1 AND category_id = $2`,
        [ug, cat],
      );
      if (found[0]) rows.push(found[0]);
    }
    return rows;
  }
  const placeholders = pks.map((_, i) => `$${i + 1}`).join(", ");
  return db.select<Record<string, unknown>[]>(`SELECT ${cols.join(", ")} FROM ${table} WHERE id IN (${placeholders})`, pks);
}

async function pushOutbox() {
  const db = await getDb();
  const batch = await db.select<{ tbl: string; pk: string }[]>(
    "SELECT tbl, pk FROM sync_outbox ORDER BY queued_at ASC LIMIT 500",
  );
  if (!batch.length) return;

  const byTable = new Map<SyncTable, string[]>();
  for (const row of batch) {
    if (!SYNC_TABLES.includes(row.tbl as SyncTable)) continue;
    const list = byTable.get(row.tbl as SyncTable) ?? [];
    list.push(row.pk);
    byTable.set(row.tbl as SyncTable, list);
  }

  const payload: Record<string, Record<string, unknown>[]> = {};
  for (const table of PUSH_ORDER) {
    const pks = byTable.get(table);
    if (!pks?.length) continue;
    payload[table] = await loadRows(table, pks);
  }

  const supabase = getSupabase();
  const { error } = await supabase.rpc("push_changes", { payload } as never);
  if (error) throw new Error(error.message);

  for (const row of batch) {
    await db.execute("DELETE FROM sync_outbox WHERE tbl = $1 AND pk = $2", [row.tbl, row.pk]);
  }
}

function cursorKey(table: SyncTable) {
  return `cursor_${table}`;
}

async function applyRemoteRows(table: SyncTable, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const db = await getDb();
  const cols = TABLE_COLUMNS[table];

  for (const row of rows) {
    // Drop server-only fields before writing locally.
    const local: Record<string, unknown> = {};
    for (const c of cols) local[c] = row[c] ?? null;

    if (table === "games" && local.igdb_id != null) {
      const existing = await db.select<{ id: string }[]>(
        "SELECT id FROM games WHERE igdb_id = $1 AND id != $2",
        [local.igdb_id, local.id],
      );
      for (const dup of existing) {
        await db.execute("UPDATE user_games SET game_id = $1, updated_at = $2 WHERE game_id = $3", [
          local.id,
          nowIso(),
          dup.id,
        ]);
        await db.execute("DELETE FROM games WHERE id = $1", [dup.id]);
      }
    }

    if (table === "user_games") {
      const existing = await db.select<{ id: string }[]>(
        "SELECT id FROM user_games WHERE game_id = $1 AND id != $2 AND deleted_at IS NULL",
        [local.game_id, local.id],
      );
      for (const dup of existing) {
        await db.execute(
          "UPDATE user_game_categories SET user_game_id = $1, updated_at = $2 WHERE user_game_id = $3",
          [local.id, nowIso(), dup.id],
        );
        await db.execute("UPDATE goals SET user_game_id = $1, updated_at = $2 WHERE user_game_id = $3", [
          local.id,
          nowIso(),
          dup.id,
        ]);
        await db.execute(
          "UPDATE user_games SET deleted_at = $1, updated_at = $1 WHERE id = $2",
          [nowIso(), dup.id],
        );
      }
    }

    const conflict = table === "user_game_categories" ? "user_game_id, category_id" : "id";
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const updates = cols
      .filter((c) => c !== "id" && c !== "user_game_id" && c !== "category_id")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");

    await db.execute(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
       ON CONFLICT (${conflict}) DO UPDATE SET ${updates}
       WHERE excluded.updated_at > ${table}.updated_at OR ${table}.updated_at IS NULL`,
      cols.map((c) => local[c]),
    );
  }
}

async function pullChanges() {
  const supabase = getSupabase();
  let pulled = 0;

  await setApplying(true);
  try {
    for (const table of PULL_ORDER) {
      let cursor = (await getSyncMeta(cursorKey(table))) ?? "1970-01-01T00:00:00.000Z";
      for (;;) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .gt("server_updated_at", cursor)
          .order("server_updated_at", { ascending: true })
          .limit(500);
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        if (!rows.length) break;
        await applyRemoteRows(table, rows as Record<string, unknown>[]);
        pulled += rows.length;
        const last = rows[rows.length - 1] as { server_updated_at: string };
        cursor = last.server_updated_at;
        await setSyncMeta(cursorKey(table), cursor);
        if (rows.length < 500) break;
      }
    }
  } finally {
    await setApplying(false);
  }
  return pulled;
}

export async function syncNow(opts?: { force?: boolean }) {
  if (!isSupabaseConfigured()) {
    emit({ status: "disabled" });
    return { pulled: 0 };
  }
  if (!navigator.onLine) {
    emit({ status: "offline" });
    await refreshPending();
    return { pulled: 0 };
  }
  if (running && !opts?.force) return running.then(() => ({ pulled: 0 }));

  const work = (async () => {
    emit({ status: "syncing", error: null });
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        emit({ status: "idle", pending: 0 });
        return;
      }
      await pushOutbox();
      const pulled = await pullChanges();
      const at = nowIso();
      await setSyncMeta("last_sync_at", at);
      backoffMs = 0;
      await refreshPending();
      emit({ status: "idle", lastSyncAt: at, error: null });
      return pulled;
    } catch (err) {
      backoffMs = Math.min(backoffMs ? backoffMs * 2 : 5_000, 60_000);
      emit({
        status: "error",
        error: err instanceof Error ? err.message : "Falha na sincronização",
      });
      await refreshPending();
      throw err;
    } finally {
      running = null;
    }
  })();

  running = work.then(() => undefined).catch(() => undefined);
  const pulled = await work;
  return { pulled: typeof pulled === "number" ? pulled : 0 };
}

export async function markSyncedUser(userId: string) {
  await setSyncMeta("user_id", userId);
}

export async function getSyncedUserId() {
  return getSyncMeta("user_id");
}

export async function uploadLocalLibrary() {
  await enqueueAllLocalRows();
  await refreshPending();
  return syncNow({ force: true });
}

export function nextBackoffMs() {
  return backoffMs;
}

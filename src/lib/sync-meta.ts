import { getDb } from "./db";

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>("SELECT value FROM sync_meta WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSyncMeta(key: string, value: string) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO sync_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function setApplying(on: boolean) {
  await setSyncMeta("applying", on ? "1" : "0");
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM sync_outbox");
  return rows[0]?.n ?? 0;
}

/** Queue every local row for the first upload after login. */
export async function enqueueAllLocalRows() {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO sync_outbox (tbl, pk, queued_at)
     SELECT 'games', id, $1 FROM games
     ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at`,
    [now],
  );
  await db.execute(
    `INSERT INTO sync_outbox (tbl, pk, queued_at)
     SELECT 'categories', id, $1 FROM categories
     ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at`,
    [now],
  );
  await db.execute(
    `INSERT INTO sync_outbox (tbl, pk, queued_at)
     SELECT 'user_games', id, $1 FROM user_games
     ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at`,
    [now],
  );
  await db.execute(
    `INSERT INTO sync_outbox (tbl, pk, queued_at)
     SELECT 'user_game_categories', user_game_id || '|' || category_id, $1 FROM user_game_categories
     ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at`,
    [now],
  );
  await db.execute(
    `INSERT INTO sync_outbox (tbl, pk, queued_at)
     SELECT 'goals', id, $1 FROM goals
     ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at`,
    [now],
  );
}

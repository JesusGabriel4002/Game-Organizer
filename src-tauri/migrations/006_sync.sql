-- Local-first sync: outbox queue filled by triggers, meta for pull cursors and applying flag.
-- SQLite requires separate triggers for INSERT and UPDATE (no "INSERT OR UPDATE").

CREATE TABLE IF NOT EXISTS sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  tbl        TEXT NOT NULL,
  pk         TEXT NOT NULL,
  queued_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tbl, pk)
);

CREATE INDEX IF NOT EXISTS sync_outbox_queued_idx ON sync_outbox (queued_at);

CREATE TRIGGER IF NOT EXISTS games_sync_outbox_ai
AFTER INSERT ON games
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('games', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS games_sync_outbox_au
AFTER UPDATE ON games
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('games', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS categories_sync_outbox_ai
AFTER INSERT ON categories
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('categories', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS categories_sync_outbox_au
AFTER UPDATE ON categories
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('categories', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS user_games_sync_outbox_ai
AFTER INSERT ON user_games
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('user_games', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS user_games_sync_outbox_au
AFTER UPDATE ON user_games
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('user_games', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS user_game_categories_sync_outbox_ai
AFTER INSERT ON user_game_categories
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at)
  VALUES ('user_game_categories', NEW.user_game_id || '|' || NEW.category_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS user_game_categories_sync_outbox_au
AFTER UPDATE ON user_game_categories
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at)
  VALUES ('user_game_categories', NEW.user_game_id || '|' || NEW.category_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS goals_sync_outbox_ai
AFTER INSERT ON goals
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('goals', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS goals_sync_outbox_au
AFTER UPDATE ON goals
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('goals', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

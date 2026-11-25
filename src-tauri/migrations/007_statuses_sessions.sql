-- New statuses ("wishlist", "dropped") and a play session log.
-- SQLite can't change a CHECK constraint in place, so user_games is rebuilt. Its child tables
-- (user_game_categories, goals) are rebuilt too: dropping a parent that is still referenced would
-- fail with foreign keys on, and PRAGMA foreign_keys can't be turned off inside the migration transaction.
-- The sync triggers are recreated at the end, so copying rows doesn't queue anything for upload.

CREATE TABLE user_games_new (
  id             TEXT PRIMARY KEY,
  game_id        TEXT NOT NULL REFERENCES games(id),
  status         TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('wishlist', 'backlog', 'playing', 'completed', 'dropped')),
  platform       TEXT,
  rating         INTEGER CHECK (rating IS NULL OR (rating BETWEEN 0 AND 10)),
  hours          REAL,
  started_at     TEXT,
  completed_at   TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT,
  completed_year INTEGER,
  target_year    INTEGER
);

INSERT INTO user_games_new (id, game_id, status, platform, rating, hours, started_at, completed_at, notes,
                            created_at, updated_at, deleted_at, completed_year, target_year)
SELECT id, game_id, status, platform, rating, hours, started_at, completed_at, notes,
       created_at, updated_at, deleted_at, completed_year, target_year
  FROM user_games;

CREATE TABLE ugc_backup AS SELECT * FROM user_game_categories;
CREATE TABLE goals_backup AS SELECT * FROM goals;

DROP TABLE user_game_categories;
DROP TABLE goals;
DROP TABLE user_games;

ALTER TABLE user_games_new RENAME TO user_games;

CREATE INDEX IF NOT EXISTS idx_user_games_status ON user_games(status);
CREATE INDEX IF NOT EXISTS idx_user_games_completed_at ON user_games(completed_at);

CREATE TABLE user_game_categories (
  user_game_id  TEXT NOT NULL REFERENCES user_games(id),
  category_id   TEXT NOT NULL REFERENCES categories(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT,
  PRIMARY KEY (user_game_id, category_id)
);

INSERT INTO user_game_categories (user_game_id, category_id, created_at, updated_at, deleted_at)
SELECT user_game_id, category_id, created_at, updated_at, deleted_at
  FROM ugc_backup
 WHERE user_game_id IN (SELECT id FROM user_games)
   AND category_id IN (SELECT id FROM categories);

CREATE TABLE goals (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('game_by_date', 'game_by_year', 'count_by_period')),
  user_game_id  TEXT REFERENCES user_games(id),
  category_id   TEXT REFERENCES categories(id),
  target_count  INTEGER,
  period_start  TEXT,
  deadline      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

INSERT INTO goals (id, title, type, user_game_id, category_id, target_count, period_start, deadline, created_at, updated_at, deleted_at)
SELECT id, title, type,
       CASE WHEN user_game_id IN (SELECT id FROM user_games) THEN user_game_id END,
       CASE WHEN category_id IN (SELECT id FROM categories) THEN category_id END,
       target_count, period_start, deadline, created_at, updated_at, deleted_at
  FROM goals_backup;

DROP TABLE ugc_backup;
DROP TABLE goals_backup;

-- ---------------------------------------------------------------- play sessions

CREATE TABLE IF NOT EXISTS play_sessions (
  id            TEXT PRIMARY KEY,
  user_game_id  TEXT NOT NULL REFERENCES user_games(id),
  played_on     TEXT NOT NULL,             -- YYYY-MM-DD
  minutes       INTEGER NOT NULL CHECK (minutes > 0),
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_play_sessions_game ON play_sessions(user_game_id, played_on);

-- ---------------------------------------------------------------- sync triggers

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

CREATE TRIGGER IF NOT EXISTS play_sessions_sync_outbox_ai
AFTER INSERT ON play_sessions
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('play_sessions', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

CREATE TRIGGER IF NOT EXISTS play_sessions_sync_outbox_au
AFTER UPDATE ON play_sessions
WHEN (SELECT value FROM sync_meta WHERE key = 'applying') IS NOT '1'
BEGIN
  INSERT INTO sync_outbox (tbl, pk, queued_at) VALUES ('play_sessions', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT (tbl, pk) DO UPDATE SET queued_at = excluded.queued_at;
END;

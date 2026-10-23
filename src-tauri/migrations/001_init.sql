-- All ids are UUID text so rows can be merged with a cloud replica later.
-- Timestamps are ISO 8601 UTC strings; deleted_at marks soft deletes.

CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  igdb_id       INTEGER UNIQUE,
  name          TEXT NOT NULL,
  cover_url     TEXT,
  cover_local   TEXT,
  release_year  INTEGER,
  genres        TEXT NOT NULL DEFAULT '[]',
  platforms     TEXT NOT NULL DEFAULT '[]',
  summary       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS user_games (
  id            TEXT PRIMARY KEY,
  game_id       TEXT NOT NULL REFERENCES games(id),
  status        TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'playing', 'completed')),
  platform      TEXT,
  rating        INTEGER CHECK (rating IS NULL OR (rating BETWEEN 0 AND 10)),
  hours         REAL,
  started_at    TEXT,
  completed_at  TEXT,
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_games_status ON user_games(status);
CREATE INDEX IF NOT EXISTS idx_user_games_completed_at ON user_games(completed_at);

CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'gray',
  icon          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS user_game_categories (
  user_game_id  TEXT NOT NULL REFERENCES user_games(id),
  category_id   TEXT NOT NULL REFERENCES categories(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT,
  PRIMARY KEY (user_game_id, category_id)
);

CREATE TABLE IF NOT EXISTS goals (
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

CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Extra IGDB data fetched in the background after a game is added.
ALTER TABLE games ADD COLUMN critic_rating REAL;      -- 0-100, average of press reviews
ALTER TABLE games ADD COLUMN igdb_rating REAL;        -- 0-100, IGDB users + critics
ALTER TABLE games ADD COLUMN time_to_beat INTEGER;    -- seconds, "normally" from IGDB
ALTER TABLE games ADD COLUMN igdb_synced_at TEXT;

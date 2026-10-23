-- Lets a game be marked as finished in a given year without an exact date.
ALTER TABLE user_games ADD COLUMN completed_year INTEGER;

UPDATE user_games
   SET completed_year = CAST(substr(completed_at, 1, 4) AS INTEGER)
 WHERE completed_at IS NOT NULL;

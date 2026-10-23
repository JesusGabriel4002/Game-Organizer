-- User ratings move from a 0-10 score to a 0-5 star scale.
UPDATE user_games
   SET rating = CAST(MIN(5, MAX(0, ROUND(rating / 2.0))) AS INTEGER)
 WHERE rating IS NOT NULL;

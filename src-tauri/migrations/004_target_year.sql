-- Year the user wants to finish the game by ("zerar até 2027"). Kept after finishing so yearly goals keep their history.
ALTER TABLE user_games ADD COLUMN target_year INTEGER;

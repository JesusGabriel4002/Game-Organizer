-- Game Organizer v0.4: new statuses ("wishlist", "dropped") and the play session log.
-- Run once in the Supabase SQL Editor after 001_sync.sql. Safe to run again.
-- Nothing is deleted: it only widens the status check, adds a table and replaces push_changes.

-- ---------------------------------------------------------------- user_games.status

ALTER TABLE public.user_games DROP CONSTRAINT IF EXISTS user_games_status_check;
ALTER TABLE public.user_games ADD CONSTRAINT user_games_status_check
  CHECK (status IN ('wishlist', 'backlog', 'playing', 'completed', 'dropped'));

-- ---------------------------------------------------------------- play_sessions

CREATE TABLE IF NOT EXISTS public.play_sessions (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_game_id  text NOT NULL,
  played_on     text NOT NULL,
  minutes       integer NOT NULL CHECK (minutes > 0),
  note          text NOT NULL DEFAULT '',
  created_at    text NOT NULL,
  updated_at    text NOT NULL,
  deleted_at    text,
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS play_sessions_user_server_idx ON public.play_sessions (user_id, server_updated_at);

DROP TRIGGER IF EXISTS play_sessions_force_owner ON public.play_sessions;
CREATE TRIGGER play_sessions_force_owner
  BEFORE INSERT OR UPDATE ON public.play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.force_row_owner();

DROP TRIGGER IF EXISTS play_sessions_server_updated ON public.play_sessions;
CREATE TRIGGER play_sessions_server_updated
  BEFORE INSERT OR UPDATE ON public.play_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

ALTER TABLE public.play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS play_sessions_select ON public.play_sessions;
CREATE POLICY play_sessions_select ON public.play_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS play_sessions_insert ON public.play_sessions;
CREATE POLICY play_sessions_insert ON public.play_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS play_sessions_update ON public.play_sessions;
CREATE POLICY play_sessions_update ON public.play_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.play_sessions FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.play_sessions TO authenticated;

-- ---------------------------------------------------------------- push_changes RPC (now with play_sessions)

CREATE OR REPLACE FUNCTION public.push_changes(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  table_name text;
  rows jsonb;
  row_count integer;
  applied integer := 0;
  skipped integer := 0;
  r jsonb;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid payload';
  END IF;

  FOR table_name, rows IN SELECT * FROM jsonb_each(payload)
  LOOP
    IF table_name NOT IN ('games', 'categories', 'user_games', 'user_game_categories', 'goals', 'play_sessions') THEN
      RAISE EXCEPTION 'invalid table: %', table_name;
    END IF;
    IF jsonb_typeof(rows) <> 'array' THEN
      RAISE EXCEPTION 'rows must be an array for %', table_name;
    END IF;

    row_count := jsonb_array_length(rows);
    IF row_count > 500 THEN
      RAISE EXCEPTION 'too many rows for % (max 500)', table_name;
    END IF;

    FOR r IN SELECT * FROM jsonb_array_elements(rows)
    LOOP
      IF table_name = 'games' THEN
        INSERT INTO public.games AS t (id, user_id, igdb_id, name, cover_url, cover_local, release_year, genres, platforms, summary, created_at, updated_at, deleted_at)
        VALUES (
          r->>'id', uid, NULLIF(r->>'igdb_id','')::integer, r->>'name', r->>'cover_url', r->>'cover_local',
          NULLIF(r->>'release_year','')::integer, COALESCE(r->>'genres','[]'), COALESCE(r->>'platforms','[]'),
          r->>'summary', r->>'created_at', r->>'updated_at', r->>'deleted_at'
        )
        ON CONFLICT (id) DO UPDATE SET
          igdb_id = EXCLUDED.igdb_id, name = EXCLUDED.name, cover_url = EXCLUDED.cover_url,
          cover_local = EXCLUDED.cover_local, release_year = EXCLUDED.release_year, genres = EXCLUDED.genres,
          platforms = EXCLUDED.platforms, summary = EXCLUDED.summary, created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > t.updated_at;
      ELSIF table_name = 'categories' THEN
        INSERT INTO public.categories AS t (id, user_id, name, color, icon, created_at, updated_at, deleted_at)
        VALUES (
          r->>'id', uid, r->>'name', COALESCE(r->>'color','gray'), r->>'icon',
          r->>'created_at', r->>'updated_at', r->>'deleted_at'
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, color = EXCLUDED.color, icon = EXCLUDED.icon,
          created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > t.updated_at;
      ELSIF table_name = 'user_games' THEN
        INSERT INTO public.user_games AS t (
          id, user_id, game_id, status, platform, rating, hours, started_at, completed_at,
          completed_year, target_year, notes, created_at, updated_at, deleted_at
        )
        VALUES (
          r->>'id', uid, r->>'game_id', COALESCE(r->>'status','backlog'), r->>'platform',
          NULLIF(r->>'rating','')::integer, NULLIF(r->>'hours','')::double precision,
          r->>'started_at', r->>'completed_at', NULLIF(r->>'completed_year','')::integer,
          NULLIF(r->>'target_year','')::integer, COALESCE(r->>'notes',''),
          r->>'created_at', r->>'updated_at', r->>'deleted_at'
        )
        ON CONFLICT (id) DO UPDATE SET
          game_id = EXCLUDED.game_id, status = EXCLUDED.status, platform = EXCLUDED.platform,
          rating = EXCLUDED.rating, hours = EXCLUDED.hours, started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at, completed_year = EXCLUDED.completed_year,
          target_year = EXCLUDED.target_year, notes = EXCLUDED.notes, created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > t.updated_at;
      ELSIF table_name = 'user_game_categories' THEN
        INSERT INTO public.user_game_categories AS t (
          user_game_id, category_id, user_id, created_at, updated_at, deleted_at
        )
        VALUES (
          r->>'user_game_id', r->>'category_id', uid,
          r->>'created_at', r->>'updated_at', r->>'deleted_at'
        )
        ON CONFLICT (user_game_id, category_id) DO UPDATE SET
          created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > t.updated_at;
      ELSIF table_name = 'goals' THEN
        INSERT INTO public.goals AS t (
          id, user_id, title, type, user_game_id, category_id, target_count, period_start,
          deadline, created_at, updated_at, deleted_at
        )
        VALUES (
          r->>'id', uid, r->>'title', r->>'type', r->>'user_game_id', r->>'category_id',
          NULLIF(r->>'target_count','')::integer, r->>'period_start', r->>'deadline',
          r->>'created_at', r->>'updated_at', r->>'deleted_at'
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title, type = EXCLUDED.type, user_game_id = EXCLUDED.user_game_id,
          category_id = EXCLUDED.category_id, target_count = EXCLUDED.target_count,
          period_start = EXCLUDED.period_start, deadline = EXCLUDED.deadline,
          created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > t.updated_at;
      ELSIF table_name = 'play_sessions' THEN
        INSERT INTO public.play_sessions AS t (
          id, user_id, user_game_id, played_on, minutes, note, created_at, updated_at, deleted_at
        )
        VALUES (
          r->>'id', uid, r->>'user_game_id', r->>'played_on', NULLIF(r->>'minutes','')::integer,
          COALESCE(r->>'note',''), r->>'created_at', r->>'updated_at', r->>'deleted_at'
        )
        ON CONFLICT (id) DO UPDATE SET
          user_game_id = EXCLUDED.user_game_id, played_on = EXCLUDED.played_on, minutes = EXCLUDED.minutes,
          note = EXCLUDED.note, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at
        WHERE EXCLUDED.updated_at > t.updated_at;
      END IF;

      IF FOUND THEN
        applied := applied + 1;
      ELSE
        skipped := skipped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('applied', applied, 'skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.push_changes(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.push_changes(jsonb) TO authenticated;

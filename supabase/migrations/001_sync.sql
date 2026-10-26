-- Game Organizer cloud schema: per-user mirrors of the local SQLite tables.
-- Paste this into the Supabase SQL Editor (Project → SQL → New query) and run it once.

-- ---------------------------------------------------------------- helpers

CREATE OR REPLACE FUNCTION public.set_server_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.server_updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_row_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  -- Always stamp the authenticated user; ignore any client-supplied user_id.
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------- games (no IGDB-derived cache columns)

CREATE TABLE IF NOT EXISTS public.games (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  igdb_id       integer,
  name          text NOT NULL,
  cover_url     text,
  cover_local   text,
  release_year  integer,
  genres        text NOT NULL DEFAULT '[]',
  platforms     text NOT NULL DEFAULT '[]',
  summary       text,
  created_at    text NOT NULL,
  updated_at    text NOT NULL,
  deleted_at    text,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, igdb_id)
);

CREATE INDEX IF NOT EXISTS games_user_server_idx ON public.games (user_id, server_updated_at);

DROP TRIGGER IF EXISTS games_force_owner ON public.games;
CREATE TRIGGER games_force_owner
  BEFORE INSERT OR UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.force_row_owner();

DROP TRIGGER IF EXISTS games_server_updated ON public.games;
CREATE TRIGGER games_server_updated
  BEFORE INSERT OR UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS games_select ON public.games;
CREATE POLICY games_select ON public.games FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS games_insert ON public.games;
CREATE POLICY games_insert ON public.games FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS games_update ON public.games;
CREATE POLICY games_update ON public.games FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.games FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.games TO authenticated;

-- ---------------------------------------------------------------- categories

CREATE TABLE IF NOT EXISTS public.categories (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  color         text NOT NULL DEFAULT 'gray',
  icon          text,
  created_at    text NOT NULL,
  updated_at    text NOT NULL,
  deleted_at    text,
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_user_server_idx ON public.categories (user_id, server_updated_at);

DROP TRIGGER IF EXISTS categories_force_owner ON public.categories;
CREATE TRIGGER categories_force_owner
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.force_row_owner();

DROP TRIGGER IF EXISTS categories_server_updated ON public.categories;
CREATE TRIGGER categories_server_updated
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS categories_insert ON public.categories;
CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS categories_update ON public.categories;
CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.categories FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.categories TO authenticated;

-- ---------------------------------------------------------------- user_games

CREATE TABLE IF NOT EXISTS public.user_games (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id         text NOT NULL,
  status          text NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'playing', 'completed')),
  platform        text,
  rating          integer CHECK (rating IS NULL OR (rating BETWEEN 0 AND 5)),
  hours           double precision,
  started_at      text,
  completed_at    text,
  completed_year  integer,
  target_year     integer,
  notes           text NOT NULL DEFAULT '',
  created_at      text NOT NULL,
  updated_at      text NOT NULL,
  deleted_at      text,
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_games_user_server_idx ON public.user_games (user_id, server_updated_at);
CREATE INDEX IF NOT EXISTS user_games_game_id_idx ON public.user_games (user_id, game_id);

DROP TRIGGER IF EXISTS user_games_force_owner ON public.user_games;
CREATE TRIGGER user_games_force_owner
  BEFORE INSERT OR UPDATE ON public.user_games
  FOR EACH ROW EXECUTE FUNCTION public.force_row_owner();

DROP TRIGGER IF EXISTS user_games_server_updated ON public.user_games;
CREATE TRIGGER user_games_server_updated
  BEFORE INSERT OR UPDATE ON public.user_games
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_games FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_games_select ON public.user_games;
CREATE POLICY user_games_select ON public.user_games FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_games_insert ON public.user_games;
CREATE POLICY user_games_insert ON public.user_games FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_games_update ON public.user_games;
CREATE POLICY user_games_update ON public.user_games FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_games FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_games TO authenticated;

-- ---------------------------------------------------------------- user_game_categories

CREATE TABLE IF NOT EXISTS public.user_game_categories (
  user_game_id  text NOT NULL,
  category_id   text NOT NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    text NOT NULL,
  updated_at    text NOT NULL,
  deleted_at    text,
  server_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_game_id, category_id)
);

CREATE INDEX IF NOT EXISTS ugc_user_server_idx ON public.user_game_categories (user_id, server_updated_at);

DROP TRIGGER IF EXISTS ugc_force_owner ON public.user_game_categories;
CREATE TRIGGER ugc_force_owner
  BEFORE INSERT OR UPDATE ON public.user_game_categories
  FOR EACH ROW EXECUTE FUNCTION public.force_row_owner();

DROP TRIGGER IF EXISTS ugc_server_updated ON public.user_game_categories;
CREATE TRIGGER ugc_server_updated
  BEFORE INSERT OR UPDATE ON public.user_game_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

ALTER TABLE public.user_game_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ugc_select ON public.user_game_categories;
CREATE POLICY ugc_select ON public.user_game_categories FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS ugc_insert ON public.user_game_categories;
CREATE POLICY ugc_insert ON public.user_game_categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ugc_update ON public.user_game_categories;
CREATE POLICY ugc_update ON public.user_game_categories FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.user_game_categories FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_game_categories TO authenticated;

-- ---------------------------------------------------------------- goals

CREATE TABLE IF NOT EXISTS public.goals (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  type          text NOT NULL CHECK (type IN ('game_by_date', 'game_by_year', 'count_by_period')),
  user_game_id  text,
  category_id   text,
  target_count  integer,
  period_start  text,
  deadline      text NOT NULL,
  created_at    text NOT NULL,
  updated_at    text NOT NULL,
  deleted_at    text,
  server_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_server_idx ON public.goals (user_id, server_updated_at);

DROP TRIGGER IF EXISTS goals_force_owner ON public.goals;
CREATE TRIGGER goals_force_owner
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.force_row_owner();

DROP TRIGGER IF EXISTS goals_server_updated ON public.goals;
CREATE TRIGGER goals_server_updated
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_server_updated_at();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goals_select ON public.goals;
CREATE POLICY goals_select ON public.goals FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS goals_insert ON public.goals;
CREATE POLICY goals_insert ON public.goals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS goals_update ON public.goals;
CREATE POLICY goals_update ON public.goals FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.goals FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.goals TO authenticated;

-- ---------------------------------------------------------------- push_changes RPC

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
    IF table_name NOT IN ('games', 'categories', 'user_games', 'user_game_categories', 'goals') THEN
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

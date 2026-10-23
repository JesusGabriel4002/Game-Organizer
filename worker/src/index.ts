// Cloudflare Worker that proxies IGDB searches so the desktop app never ships the Twitch secret.
// Secrets (set with `npx wrangler secret put`): IGDB_CLIENT_ID, IGDB_CLIENT_SECRET.

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  IGDB_CLIENT_ID: string;
  IGDB_CLIENT_SECRET: string;
  SEARCH_LIMITER?: RateLimiter;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

interface Named {
  name?: string;
  abbreviation?: string;
}

interface RawGame {
  id: number;
  name?: string;
  game_type?: number;
  category?: number;
  version_parent?: number;
  total_rating_count?: number;
  first_release_date?: number;
  summary?: string;
  cover?: { image_id?: string };
  genres?: Named[];
  themes?: Named[];
  platforms?: Named[];
}

interface RawDetails {
  id: number;
  aggregated_rating?: number;
  total_rating?: number;
  keywords?: Named[];
  genres?: Named[];
  themes?: Named[];
  game_modes?: Named[];
  player_perspectives?: Named[];
}

const names = (list?: Named[]) => (list ?? []).flatMap((n) => (n.name ? [n.name] : []));

interface RawTimeToBeat {
  game_id: number;
  hastily?: number;
  normally?: number;
  completely?: number;
}

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_URL = "https://api.igdb.com/v4";
const GAMES_URL = `${IGDB_URL}/games`;
const MAX_DETAIL_IDS = 50;

// Lives as long as the isolate does; a cold start just fetches a new token.
let cachedToken: { value: string; expiresAt: number } | null = null;

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

async function getToken(env: Env, force = false) {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const params = new URLSearchParams({
    client_id: env.IGDB_CLIENT_ID,
    client_secret: env.IGDB_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const res = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch token HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

const FIELDS =
  "fields name,first_release_date,summary,cover.image_id,genres.name,themes.name,platforms.name,platforms.abbreviation," +
  "game_type,category,version_parent,total_rating_count;";
// Main games, remakes and remasters with the most ratings. Keep in sync with POPULAR_FILTER in igdb.rs.
const POPULAR_QUERY = `${FIELDS} where game_type = (0,8,9) & version_parent = null & total_rating_count > 500; sort total_rating_count desc; limit 30;`;

function queryIgdb(env: Env, body: string, token: string, url = GAMES_URL) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Client-ID": env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body,
  });
}

async function queryWithRetry<T>(env: Env, body: string, url = GAMES_URL): Promise<T> {
  let res = await queryIgdb(env, body, await getToken(env), url);
  if (res.status === 401) res = await queryIgdb(env, body, await getToken(env, true), url);
  if (!res.ok) throw new Error(`O IGDB respondeu com erro HTTP ${res.status}.`);
  return (await res.json()) as T;
}

/** Ratings and time to beat for games already in someone's library. */
async function details(env: Env, ctx: Ctx, ids: number[]) {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(`https://igdb-cache.internal/v2/details?ids=${ids.join(",")}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const list = ids.join(",");
    const [games, times] = await Promise.all([
      queryWithRetry<RawDetails[]>(
        env,
        "fields aggregated_rating,total_rating,keywords.name,genres.name,themes.name,game_modes.name,player_perspectives.name; " +
          `where id = (${list}); limit ${MAX_DETAIL_IDS};`,
      ),
      queryWithRetry<RawTimeToBeat[]>(
        env,
        `fields game_id,hastily,normally,completely; where game_id = (${list}); limit ${MAX_DETAIL_IDS};`,
        `${IGDB_URL}/game_time_to_beats`,
      ),
    ]);
    const timeById = new Map(times.map((t) => [t.game_id, t.normally ?? t.hastily ?? t.completely ?? null]));
    const results = ids.map((id) => {
      const g = games.find((x) => x.id === id);
      return {
        igdbId: id,
        criticRating: g?.aggregated_rating ?? null,
        igdbRating: g?.total_rating ?? null,
        timeToBeat: timeById.get(id) ?? null,
        // Lower-cased tags the app matches against its built-in category rules.
        tags: [
          ...new Set(
            [g?.keywords, g?.genres, g?.themes, g?.game_modes, g?.player_perspectives].flatMap((l) => names(l).map((n) => n.toLowerCase())),
          ),
        ],
      };
    });
    const response = json(results, 200, { "Cache-Control": "public, max-age=86400" });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return json({ error: `Falha ao consultar o IGDB: ${(err as Error).message}` }, 502);
  }
}

/** Runs an IGDB query through the edge cache, retrying once with a fresh token. */
async function cachedQuery(env: Env, ctx: Ctx, cacheUrl: string, body: string, shape: (games: RawGame[]) => RawGame[]) {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(cacheUrl);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    let res = await queryIgdb(env, body, await getToken(env));
    if (res.status === 401) res = await queryIgdb(env, body, await getToken(env, true));
    if (!res.ok) return json({ error: `O IGDB respondeu com erro HTTP ${res.status}.` }, 502);
    const results = shape((await res.json()) as RawGame[])
      .map(normalize)
      .filter(Boolean);
    const response = json(results, 200, { "Cache-Control": "public, max-age=86400" });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return json({ error: `Falha ao consultar o IGDB: ${(err as Error).message}` }, 502);
  }
}

// IGDB game types: 0 main, 8 remake, 9 remaster, 10 expanded, 4 standalone expansion rank first;
// DLC/bundles next; ports, forks, mods and updates last.
const TYPE_RANK: Record<number, number> = { 0: 0, 8: 0, 9: 0, 10: 0, 4: 0, 1: 1, 2: 1, 3: 1, 6: 1, 7: 1, 13: 1, 11: 2, 12: 2, 5: 2, 14: 2 };

function rank(raw: RawGame) {
  const type = raw.game_type ?? raw.category ?? 0;
  return (TYPE_RANK[type] ?? 1) + (raw.version_parent ? 1 : 0);
}

/** Keeps IGDB's relevance order inside each tier, but lifts exact names, main games and popular titles to the top. */
function sortResults(games: RawGame[], query: string) {
  const q = query.toLowerCase();
  const exact = (g: RawGame) => Number(g.name?.toLowerCase() === q);
  return games
    .map((g, index) => ({ g, index }))
    .sort((a, b) => {
      const name = exact(b.g) - exact(a.g);
      if (name !== 0) return name;
      const tier = rank(a.g) - rank(b.g);
      if (tier !== 0) return tier;
      const popular = Number((b.g.total_rating_count ?? 0) >= 5) - Number((a.g.total_rating_count ?? 0) >= 5);
      return popular !== 0 ? popular : a.index - b.index;
    })
    .map(({ g }) => g);
}

function normalize(raw: RawGame) {
  if (!raw.name) return null;
  const genres = [...new Set([...(raw.genres ?? []), ...(raw.themes ?? [])].flatMap((g) => (g.name ? [g.name] : [])))];
  return {
    igdbId: raw.id,
    name: raw.name,
    coverUrl: raw.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${raw.cover.image_id}.jpg` : null,
    releaseYear: raw.first_release_date ? new Date(raw.first_release_date * 1000).getUTCFullYear() : null,
    genres,
    platforms: (raw.platforms ?? []).flatMap((p) => (p.abbreviation || p.name ? [p.abbreviation || p.name!] : [])),
    summary: raw.summary ?? null,
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true });
    const isSearch = url.pathname === "/search" && request.method === "POST";
    const isPopular = url.pathname === "/popular" && request.method === "GET";
    const isDetails = url.pathname === "/details" && request.method === "POST";
    if (!isSearch && !isPopular && !isDetails) return json({ error: "Not found" }, 404);
    if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) return json({ error: "Servidor sem chaves do IGDB configuradas." }, 500);

    if (env.SEARCH_LIMITER) {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.SEARCH_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "Muitas buscas seguidas. Aguarde alguns segundos." }, 429);
    }

    if (isPopular) return cachedQuery(env, ctx, "https://igdb-cache.internal/v1/popular", POPULAR_QUERY, (games) => games);

    let body: { query?: unknown; ids?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Corpo inválido." }, 400);
    }

    if (isDetails) {
      const raw = Array.isArray(body?.ids) ? body.ids : [];
      const ids = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
      if (!ids.length) return json([]);
      if (ids.length > MAX_DETAIL_IDS) return json({ error: `Envie no máximo ${MAX_DETAIL_IDS} jogos por vez.` }, 400);
      return details(env, ctx, ids);
    }
    const query = String(body?.query ?? "")
      .replace(/["\\]/g, "")
      .trim()
      .slice(0, 100);
    if (query.length < 2) return json([]);

    return cachedQuery(
      env,
      ctx,
      `https://igdb-cache.internal/v3/search?q=${encodeURIComponent(query.toLowerCase())}`,
      `search "${query}"; ${FIELDS} limit 40;`,
      (games) => sortResults(games, query).slice(0, 20),
    );
  },
};

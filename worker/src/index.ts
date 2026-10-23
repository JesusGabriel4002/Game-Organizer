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

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const GAMES_URL = "https://api.igdb.com/v4/games";

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

function queryIgdb(env: Env, query: string, token: string) {
  return fetch(GAMES_URL, {
    method: "POST",
    headers: {
      "Client-ID": env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body:
      `search "${query}"; ` +
      "fields name,first_release_date,summary,cover.image_id,genres.name,themes.name,platforms.name,platforms.abbreviation," +
      "game_type,category,version_parent,total_rating_count; " +
      "limit 40;",
  });
}

// IGDB game types: 0 main, 8 remake, 9 remaster, 10 expanded, 4 standalone expansion rank first;
// DLC/bundles next; ports, forks, mods and updates last.
const TYPE_RANK: Record<number, number> = { 0: 0, 8: 0, 9: 0, 10: 0, 4: 0, 1: 1, 2: 1, 3: 1, 6: 1, 7: 1, 13: 1, 11: 2, 12: 2, 5: 2, 14: 2 };

function rank(raw: RawGame) {
  const type = raw.game_type ?? raw.category ?? 0;
  return (TYPE_RANK[type] ?? 1) + (raw.version_parent ? 1 : 0);
}

/** Keeps IGDB's relevance order inside each tier, but lifts main games and popular titles to the top. */
function sortResults(games: RawGame[]) {
  return games
    .map((g, index) => ({ g, index }))
    .sort((a, b) => {
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
    if (url.pathname !== "/search" || request.method !== "POST") return json({ error: "Not found" }, 404);
    if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) return json({ error: "Servidor sem chaves do IGDB configuradas." }, 500);

    if (env.SEARCH_LIMITER) {
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      const { success } = await env.SEARCH_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "Muitas buscas seguidas. Aguarde alguns segundos." }, 429);
    }

    let body: { query?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Corpo inválido." }, 400);
    }
    const query = String(body?.query ?? "")
      .replace(/["\\]/g, "")
      .trim()
      .slice(0, 100);
    if (query.length < 2) return json([]);

    const cache = (caches as unknown as { default: Cache }).default;
    const cacheKey = new Request(`https://igdb-cache.internal/v2/search?q=${encodeURIComponent(query.toLowerCase())}`);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    try {
      let res = await queryIgdb(env, query, await getToken(env));
      if (res.status === 401) res = await queryIgdb(env, query, await getToken(env, true));
      if (!res.ok) return json({ error: `O IGDB respondeu com erro HTTP ${res.status}.` }, 502);
      const results = sortResults((await res.json()) as RawGame[])
        .map(normalize)
        .filter(Boolean)
        .slice(0, 20);
      const response = json(results, 200, { "Cache-Control": "public, max-age=86400" });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return json({ error: `Falha ao consultar o IGDB: ${(err as Error).message}` }, 502);
    }
  },
};

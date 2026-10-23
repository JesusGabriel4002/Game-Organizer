use std::{
    fs,
    path::PathBuf,
    time::{Duration, Instant},
};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

const TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";
const GAMES_URL: &str = "https://api.igdb.com/v4/games";
const TIME_TO_BEAT_URL: &str = "https://api.igdb.com/v4/game_time_to_beats";
const CREDENTIALS_FILE: &str = "igdb.json";
/// Public search proxy (see worker/). It holds the Twitch secret server-side, so this URL is safe to commit.
const BUNDLED_PROXY_URL: &str = "https://game-organizer-igdb.contato-jgleiva.workers.dev";

#[derive(Serialize, Deserialize, Clone)]
struct Credentials {
    client_id: String,
    client_secret: String,
}

struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

#[derive(Default)]
pub struct IgdbState {
    token: Mutex<Option<CachedToken>>,
    client: reqwest::Client,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IgdbStatus {
    configured: bool,
    source: Option<&'static str>,
    client_id_hint: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameResult {
    igdb_id: i64,
    name: String,
    cover_url: Option<String>,
    release_year: Option<i32>,
    genres: Vec<String>,
    platforms: Vec<String>,
    summary: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct Named {
    name: Option<String>,
    abbreviation: Option<String>,
}

#[derive(Deserialize)]
struct Cover {
    image_id: Option<String>,
}

#[derive(Deserialize)]
struct RawGame {
    id: i64,
    name: Option<String>,
    game_type: Option<i64>,
    category: Option<i64>,
    version_parent: Option<i64>,
    total_rating_count: Option<i64>,
    first_release_date: Option<i64>,
    cover: Option<Cover>,
    genres: Option<Vec<Named>>,
    themes: Option<Vec<Named>>,
    platforms: Option<Vec<Named>>,
    summary: Option<String>,
}

fn credentials_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Pasta de configuração indisponível: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(CREDENTIALS_FILE))
}

fn load_from_file(app: &AppHandle) -> Option<Credentials> {
    let path = credentials_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn load_from_env() -> Option<Credentials> {
    let client_id = std::env::var("IGDB_CLIENT_ID").ok()?;
    let client_secret = std::env::var("IGDB_CLIENT_SECRET").ok()?;
    if client_id.is_empty() || client_secret.is_empty() {
        return None;
    }
    Some(Credentials { client_id, client_secret })
}

fn load_credentials(app: &AppHandle) -> Option<(Credentials, &'static str)> {
    load_from_file(app)
        .map(|c| (c, "settings"))
        .or_else(|| load_from_env().map(|c| (c, "env")))
}

fn hint(client_id: &str) -> String {
    let tail: String = client_id.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    format!("••••{tail}")
}

#[tauri::command]
pub fn igdb_status(app: AppHandle) -> IgdbStatus {
    match load_credentials(&app) {
        Some((c, source)) => IgdbStatus {
            configured: true,
            source: Some(source),
            client_id_hint: Some(hint(&c.client_id)),
        },
        None => IgdbStatus {
            configured: proxy_url().is_some(),
            source: proxy_url().map(|_| "proxy"),
            client_id_hint: None,
        },
    }
}

fn proxy_url() -> Option<String> {
    std::env::var("IGDB_PROXY_URL")
        .ok()
        .filter(|u| !u.is_empty())
        .or_else(|| (!BUNDLED_PROXY_URL.is_empty()).then(|| BUNDLED_PROXY_URL.to_string()))
}

#[derive(Deserialize)]
struct ProxyError {
    error: String,
}

async fn search_via_proxy(client: &reqwest::Client, base: &str, query: &str) -> Result<Vec<GameResult>, String> {
    let req = client
        .post(format!("{}/search", base.trim_end_matches('/')))
        .json(&serde_json::json!({ "query": query }));
    proxy_request(req).await
}

async fn proxy_request<T: DeserializeOwned>(req: reqwest::RequestBuilder) -> Result<T, String> {
    let res = req.send().await.map_err(|e| format!("Falha de rede ao buscar jogos: {e}"))?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let message = res.json::<ProxyError>().await.map(|e| e.error).unwrap_or_default();
        return Err(if message.is_empty() { format!("O servidor de busca respondeu com erro HTTP {status}.") } else { message });
    }
    res.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn igdb_save_credentials(
    app: AppHandle,
    state: State<'_, IgdbState>,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let creds = Credentials {
        client_id: client_id.trim().to_string(),
        client_secret: client_secret.trim().to_string(),
    };
    if creds.client_id.is_empty() || creds.client_secret.is_empty() {
        return Err("Preencha o Client ID e o Client Secret.".into());
    }
    // Validate before persisting so a typo doesn't get saved.
    let token = fetch_token(&state.client, &creds).await?;
    let json = serde_json::to_string_pretty(&creds).map_err(|e| e.to_string())?;
    fs::write(credentials_path(&app)?, json).map_err(|e| e.to_string())?;
    *state.token.lock().await = Some(token);
    Ok(())
}

#[tauri::command]
pub async fn igdb_clear_credentials(app: AppHandle, state: State<'_, IgdbState>) -> Result<(), String> {
    let path = credentials_path(&app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    *state.token.lock().await = None;
    Ok(())
}

async fn fetch_token(client: &reqwest::Client, creds: &Credentials) -> Result<CachedToken, String> {
    let res = client
        .post(TOKEN_URL)
        .query(&[
            ("client_id", creds.client_id.as_str()),
            ("client_secret", creds.client_secret.as_str()),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| format!("Falha de rede ao autenticar na Twitch: {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "A Twitch recusou as credenciais (HTTP {}). Confira o Client ID e o Secret.",
            res.status().as_u16()
        ));
    }
    let body: TokenResponse = res.json().await.map_err(|e| e.to_string())?;
    // Renew a minute early to avoid using a token that expires mid-request.
    let ttl = body.expires_in.saturating_sub(60);
    Ok(CachedToken {
        access_token: body.access_token,
        expires_at: Instant::now() + Duration::from_secs(ttl),
    })
}

fn escape_query(q: &str) -> String {
    q.replace('\\', "").replace('"', "")
}

fn to_result(raw: RawGame) -> Option<GameResult> {
    let name = raw.name?;
    let cover_url = raw
        .cover
        .and_then(|c| c.image_id)
        .map(|id| format!("https://images.igdb.com/igdb/image/upload/t_cover_big/{id}.jpg"));
    let release_year = raw.first_release_date.map(|ts| (1970.0 + ts as f64 / 31_556_952.0).floor() as i32);
    let mut genres: Vec<String> = raw
        .genres
        .unwrap_or_default()
        .into_iter()
        .chain(raw.themes.unwrap_or_default())
        .filter_map(|g| g.name)
        .collect();
    genres.dedup();
    let platforms = raw
        .platforms
        .unwrap_or_default()
        .into_iter()
        .filter_map(|p| p.abbreviation.or(p.name))
        .collect();
    Some(GameResult {
        igdb_id: raw.id,
        name,
        cover_url,
        release_year,
        genres,
        platforms,
        summary: raw.summary,
    })
}

#[tauri::command]
pub async fn search_games(
    app: AppHandle,
    state: State<'_, IgdbState>,
    query: String,
) -> Result<Vec<GameResult>, String> {
    let query = escape_query(query.trim());
    if query.len() < 2 {
        return Ok(vec![]);
    }
    let Some((creds, _)) = load_credentials(&app) else {
        let base = proxy_url().ok_or("Servidor de busca do IGDB não configurado.")?;
        return search_via_proxy(&state.client, &base, &query).await;
    };

    let body = format!("search \"{query}\"; fields {FIELDS}; limit 40;");
    let mut raw = query_igdb(&state, &creds, body).await?;
    // Stable sort keeps IGDB's relevance order within each tier.
    raw.sort_by_key(|g| (rank(g), (g.total_rating_count.unwrap_or(0) < 5) as u8));
    Ok(raw.into_iter().filter_map(to_result).take(20).collect())
}

/// Well-known games to suggest before the user types anything.
#[tauri::command]
pub async fn popular_games(app: AppHandle, state: State<'_, IgdbState>) -> Result<Vec<GameResult>, String> {
    let Some((creds, _)) = load_credentials(&app) else {
        let base = proxy_url().ok_or("Servidor de busca do IGDB não configurado.")?;
        return proxy_request(state.client.get(format!("{}/popular", base.trim_end_matches('/')))).await;
    };
    let raw = query_igdb(&state, &creds, format!("fields {FIELDS}; {POPULAR_FILTER}")).await?;
    Ok(raw.into_iter().filter_map(to_result).collect())
}

const FIELDS: &str = "name,first_release_date,summary,cover.image_id,genres.name,themes.name,platforms.name,platforms.abbreviation,\
                      game_type,category,version_parent,total_rating_count";
/// Same filter as the worker: main games, remakes and remasters with the most ratings.
const POPULAR_FILTER: &str =
    "where game_type = (0,8,9) & version_parent = null & total_rating_count > 500; sort total_rating_count desc; limit 30;";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameDetails {
    igdb_id: i64,
    critic_rating: Option<f64>,
    igdb_rating: Option<f64>,
    /// Seconds.
    time_to_beat: Option<i64>,
}

#[derive(Deserialize)]
struct RawRatings {
    id: i64,
    aggregated_rating: Option<f64>,
    total_rating: Option<f64>,
}

#[derive(Deserialize)]
struct RawTimeToBeat {
    game_id: i64,
    hastily: Option<i64>,
    normally: Option<i64>,
    completely: Option<i64>,
}

const MAX_DETAIL_IDS: usize = 50;

/// Ratings and average time to beat for up to 50 IGDB games.
#[tauri::command]
pub async fn game_details(app: AppHandle, state: State<'_, IgdbState>, ids: Vec<i64>) -> Result<Vec<GameDetails>, String> {
    let ids: Vec<i64> = ids.into_iter().filter(|id| *id > 0).take(MAX_DETAIL_IDS).collect();
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let Some((creds, _)) = load_credentials(&app) else {
        let base = proxy_url().ok_or("Servidor de busca do IGDB não configurado.")?;
        let req = state
            .client
            .post(format!("{}/details", base.trim_end_matches('/')))
            .json(&serde_json::json!({ "ids": ids }));
        return proxy_request(req).await;
    };

    let list = ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
    let ratings: Vec<RawRatings> = query_igdb_at(
        &state,
        &creds,
        GAMES_URL,
        format!("fields aggregated_rating,total_rating; where id = ({list}); limit {MAX_DETAIL_IDS};"),
    )
    .await?;
    let times: Vec<RawTimeToBeat> = query_igdb_at(
        &state,
        &creds,
        TIME_TO_BEAT_URL,
        format!("fields game_id,hastily,normally,completely; where game_id = ({list}); limit {MAX_DETAIL_IDS};"),
    )
    .await?;
    Ok(ids
        .into_iter()
        .map(|id| {
            let r = ratings.iter().find(|r| r.id == id);
            GameDetails {
                igdb_id: id,
                critic_rating: r.and_then(|r| r.aggregated_rating),
                igdb_rating: r.and_then(|r| r.total_rating),
                time_to_beat: times
                    .iter()
                    .find(|t| t.game_id == id)
                    .and_then(|t| t.normally.or(t.hastily).or(t.completely)),
            }
        })
        .collect())
}

async fn query_igdb(state: &IgdbState, creds: &Credentials, body: String) -> Result<Vec<RawGame>, String> {
    query_igdb_at(state, creds, GAMES_URL, body).await
}

async fn query_igdb_at<T: DeserializeOwned>(state: &IgdbState, creds: &Credentials, url: &str, body: String) -> Result<T, String> {
    let access_token = {
        let mut guard = state.token.lock().await;
        let valid = guard.as_ref().filter(|t| t.expires_at > Instant::now());
        match valid {
            Some(t) => t.access_token.clone(),
            None => {
                let fresh = fetch_token(&state.client, &creds).await?;
                let token = fresh.access_token.clone();
                *guard = Some(fresh);
                token
            }
        }
    };

    let res = state
        .client
        .post(url)
        .header("Client-ID", &creds.client_id)
        .bearer_auth(&access_token)
        .header("Accept", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Falha de rede ao buscar no IGDB: {e}"))?;

    if res.status().as_u16() == 401 {
        *state.token.lock().await = None;
        return Err("Token do IGDB expirado. Tente buscar de novo.".into());
    }
    if !res.status().is_success() {
        return Err(format!("O IGDB respondeu com erro HTTP {}.", res.status().as_u16()));
    }
    res.json().await.map_err(|e| e.to_string())
}

/// Same tiers as the worker: main games/remakes first, DLC/bundles next, ports/forks/mods last.
fn rank(g: &RawGame) -> u8 {
    let tier = match g.game_type.or(g.category).unwrap_or(0) {
        0 | 4 | 8 | 9 | 10 => 0,
        11 | 12 | 5 | 14 => 2,
        _ => 1,
    };
    tier + g.version_parent.is_some() as u8
}

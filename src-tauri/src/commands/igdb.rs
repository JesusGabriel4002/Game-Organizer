use std::{
    fs,
    path::PathBuf,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

const TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";
const GAMES_URL: &str = "https://api.igdb.com/v4/games";
const CREDENTIALS_FILE: &str = "igdb.json";

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

#[derive(Serialize)]
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
        None => IgdbStatus { configured: false, source: None, client_id_hint: None },
    }
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
    let (creds, _) = load_credentials(&app)
        .ok_or("Configure as chaves do IGDB em Configurações para buscar jogos.")?;

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

    let body = format!(
        "search \"{query}\"; \
         fields name,first_release_date,summary,cover.image_id,genres.name,themes.name,platforms.name,platforms.abbreviation; \
         limit 20;"
    );
    let res = state
        .client
        .post(GAMES_URL)
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
    let raw: Vec<RawGame> = res.json().await.map_err(|e| e.to_string())?;
    Ok(raw.into_iter().filter_map(to_result).collect())
}

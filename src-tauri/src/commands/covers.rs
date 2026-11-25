//! Local copies of cover images, so the library still shows covers offline.
//! Files live in `<app data>/covers/<fnv1a64(url)>.<ext>` and are served to the webview via the asset protocol.

use std::{collections::HashMap, fs, path::PathBuf, time::Duration};

use tauri::{AppHandle, Manager};

const MAX_BYTES: usize = 5 * 1024 * 1024;
const PARALLEL: usize = 6;

fn covers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Pasta de dados indisponível: {e}"))?
        .join("covers");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Stable across Rust versions, unlike `DefaultHasher`.
fn fnv1a64(text: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    hash
}

fn extension(url: &str) -> &'static str {
    let path = url.split(['?', '#']).next().unwrap_or("").to_ascii_lowercase();
    if path.ends_with(".png") {
        "png"
    } else if path.ends_with(".webp") {
        "webp"
    } else if path.ends_with(".gif") {
        "gif"
    } else {
        "jpg"
    }
}

fn file_for(dir: &PathBuf, url: &str) -> PathBuf {
    dir.join(format!("{:016x}.{}", fnv1a64(url), extension(url)))
}

async fn download(client: &reqwest::Client, url: &str, path: &PathBuf) -> Result<(), String> {
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status().as_u16()));
    }
    let is_image = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("image/"));
    if !is_image {
        return Err("não é uma imagem".into());
    }
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("tamanho inválido".into());
    }
    // Write to a temp name first so a half-written file is never served.
    let tmp = path.with_extension("part");
    fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Returns `url → local file path` for every cover that is (now) on disk. Missing ones are downloaded;
/// failures are skipped, so the app keeps using the remote URL for those.
#[tauri::command]
pub async fn cache_covers(app: AppHandle, urls: Vec<String>) -> Result<HashMap<String, String>, String> {
    let dir = covers_dir(&app)?;
    let mut result = HashMap::new();
    let mut missing = Vec::new();
    for url in urls {
        if !(url.starts_with("https://") || url.starts_with("http://")) || result.contains_key(&url) {
            continue;
        }
        let path = file_for(&dir, &url);
        if path.exists() {
            result.insert(url, path.to_string_lossy().into_owned());
        } else if !missing.iter().any(|(u, _): &(String, PathBuf)| u == &url) {
            missing.push((url, path));
        }
    }
    if missing.is_empty() {
        return Ok(result);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    for chunk in missing.chunks(PARALLEL) {
        let tasks: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|(url, path)| {
                let client = client.clone();
                tauri::async_runtime::spawn(async move {
                    let ok = download(&client, &url, &path).await.is_ok();
                    (url, path, ok)
                })
            })
            .collect();
        for task in tasks {
            if let Ok((url, path, true)) = task.await {
                result.insert(url, path.to_string_lossy().into_owned());
            }
        }
    }
    Ok(result)
}

/// Removes every cached cover; they are downloaded again as needed.
#[tauri::command]
pub fn clear_cover_cache(app: AppHandle) -> Result<u32, String> {
    let dir = covers_dir(&app)?;
    let mut removed = 0;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        if entry.path().is_file() && fs::remove_file(entry.path()).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

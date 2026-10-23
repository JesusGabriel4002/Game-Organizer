mod commands;

use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:games.db";

/// sqlx checksums the exact SQL text, so line endings must not depend on how the repo was checked out.
fn normalized(sql: &'static str) -> &'static str {
    if sql.contains('\r') {
        Box::leak(sql.replace("\r\n", "\n").into_boxed_str())
    } else {
        sql
    }
}

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init",
        sql: normalized(include_str!("../migrations/001_init.sql")),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::igdb::IgdbState::default())
        .invoke_handler(tauri::generate_handler![
            commands::igdb::igdb_status,
            commands::igdb::igdb_save_credentials,
            commands::igdb::igdb_clear_credentials,
            commands::igdb::search_games,
            commands::files::write_text_file,
            commands::files::read_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

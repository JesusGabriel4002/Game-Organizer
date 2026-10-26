use keyring::Entry;

const SERVICE: &str = "com.gameorganizer.app";
const ACCOUNT: &str = "supabase-session";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("Não foi possível abrir o cofre de credenciais: {e}"))
}

#[tauri::command]
pub fn secure_store_get() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Não foi possível ler a sessão: {e}")),
    }
}

#[tauri::command]
pub fn secure_store_set(value: String) -> Result<(), String> {
    if value.len() > 64_000 {
        return Err("Sessão inválida.".into());
    }
    entry()?
        .set_password(&value)
        .map_err(|e| format!("Não foi possível salvar a sessão: {e}"))
}

#[tauri::command]
pub fn secure_store_clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Não foi possível apagar a sessão: {e}")),
    }
}

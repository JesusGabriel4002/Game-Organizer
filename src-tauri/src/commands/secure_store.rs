use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const UI_FORBIDDEN: u32 = 0x1;
const MAX_SESSION_BYTES: usize = 256_000;

fn session_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Não foi possível abrir a pasta do app: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Não foi possível criar a pasta da sessão: {e}"))?;
    Ok(dir.join("session.bin"))
}

#[cfg(windows)]
fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
    use std::ffi::c_void;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB};

    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: plain.len() as u32,
            pbData: plain.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let ok = CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null_mut::<c_void>(),
            std::ptr::null(),
            UI_FORBIDDEN,
            &mut output,
        );
        if ok == 0 {
            return Err(format!(
                "Não foi possível proteger a sessão ({})",
                std::io::Error::last_os_error()
            ));
        }
        let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut c_void);
        Ok(bytes)
    }
}

#[cfg(windows)]
fn unprotect(sealed: &[u8]) -> Result<Vec<u8>, String> {
    use std::ffi::c_void;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

    unsafe {
        let input = CRYPT_INTEGER_BLOB {
            cbData: sealed.len() as u32,
            pbData: sealed.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };
        let ok = CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null_mut::<c_void>(),
            std::ptr::null(),
            UI_FORBIDDEN,
            &mut output,
        );
        if ok == 0 {
            return Err(format!(
                "Não foi possível ler a sessão ({})",
                std::io::Error::last_os_error()
            ));
        }
        let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut c_void);
        Ok(bytes)
    }
}

#[cfg(not(windows))]
fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
    let _ = plain;
    Err("A sessão protegida só está disponível no Windows.".into())
}

#[cfg(not(windows))]
fn unprotect(sealed: &[u8]) -> Result<Vec<u8>, String> {
    let _ = sealed;
    Err("A sessão protegida só está disponível no Windows.".into())
}

#[tauri::command]
pub fn secure_store_get(app: AppHandle) -> Result<Option<String>, String> {
    let path = session_file(&app)?;
    let sealed = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(format!("Não foi possível ler a sessão: {err}")),
    };
    if sealed.is_empty() {
        return Ok(None);
    }
    let plain = unprotect(&sealed)?;
    String::from_utf8(plain).map(Some).map_err(|_| "Sessão inválida.".into())
}

#[tauri::command]
pub fn secure_store_set(app: AppHandle, value: String) -> Result<(), String> {
    if value.len() > MAX_SESSION_BYTES {
        return Err("Sessão inválida.".into());
    }
    let path = session_file(&app)?;
    let sealed = protect(value.as_bytes())?;
    std::fs::write(&path, sealed).map_err(|e| format!("Não foi possível salvar a sessão: {e}"))
}

#[tauri::command]
pub fn secure_store_clear(app: AppHandle) -> Result<(), String> {
    let path = session_file(&app)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("Não foi possível apagar a sessão: {err}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{protect, unprotect};

    #[test]
    fn roundtrip_keeps_a_session_bigger_than_the_credential_manager() {
        let plain = "sessão-".repeat(4_000);
        assert!(plain.len() > 2_560);
        let sealed = protect(plain.as_bytes()).expect("proteger");
        assert_ne!(sealed, plain.as_bytes());
        let opened = unprotect(&sealed).expect("abrir");
        assert_eq!(opened, plain.as_bytes());
    }
}

use std::fs;

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Não foi possível salvar o arquivo: {e}"))
}

/// Reads UTF-8, falling back to Windows-1252, which is what Excel uses for CSV on pt-BR Windows.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Não foi possível ler o arquivo: {e}"))?;
    Ok(match String::from_utf8(bytes) {
        Ok(text) => text,
        Err(err) => decode_windows_1252(err.as_bytes()),
    })
}

const CP1252_80_9F: [char; 32] = [
    '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8d}', 'Ž', '\u{8f}', '\u{90}', '‘', '’', '“',
    '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u{9d}', 'ž', 'Ÿ',
];

fn decode_windows_1252(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|&b| match b {
            0x80..=0x9f => CP1252_80_9F[(b - 0x80) as usize],
            _ => b as char,
        })
        .collect()
}

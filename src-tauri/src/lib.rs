//! NurSet desktop shell: the window, opening links, and the device name.
//! All data and accounts live on the NurSet server (see `server/`); the
//! frontend talks to it over HTTPS (`src/lib/client.ts`).

/// This computer's name for Settings > Active Sessions.
#[tauri::command]
fn device_name() -> String {
    let host = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "This computer".into());
    let os = match std::env::consts::OS {
        "windows" => "Windows",
        "macos" => "macOS",
        "linux" => "Linux",
        other => other,
    };
    format!("{host} · {os} desktop app")
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![device_name])
        .run(tauri::generate_context!())
        .expect("error while running NurSet");
}

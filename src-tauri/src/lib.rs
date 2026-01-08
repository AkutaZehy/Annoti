use std::fs;
use tauri::AppHandle;

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    println!("正在读取文件: {}", path); // 方便在终端看日志
    fs::read_to_string(&path).map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 2. 注册 Dialog 插件
        .plugin(tauri_plugin_dialog::init())
        // 3. 注册我们的 Command
        .invoke_handler(tauri::generate_handler![read_file_content])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

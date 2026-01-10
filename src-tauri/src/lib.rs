use std::fs::{self, File};
use std::io::Write;
use tauri::AppHandle;

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    println!("正在读取文件: {}", path);
    fs::read_to_string(&path).map_err(|err| err.to_string())
}

#[tauri::command]
fn write_file_content(path: String, content: String) -> Result<(), String> {
    println!("正在写入文件: {}", path);
    let mut file = File::create(&path).map_err(|err| err.to_string())?;
    file.write_all(content.as_bytes()).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    fs::metadata(&path).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 2. 注册 Dialog 插件
        .plugin(tauri_plugin_dialog::init())
        // 3. 注册我们的 Command
        .invoke_handler(tauri::generate_handler![read_file_content, write_file_content, file_exists])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

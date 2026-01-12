use std::fs::{self, File};
use std::io::Write;

mod db;

// ============ 基础文件操作 ============

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

// ============ 数据库初始化 ============

#[tauri::command]
async fn init_db() -> Result<(), String> {
    let _ = db::init_db().map_err(|e| e.to_string())?;
    Ok(())
}

// ============ 用户操作 ============

#[tauri::command]
async fn get_current_user() -> Result<db::UserRecord, String> {
    let conn = db::init_db()?;
    let user = db::get_or_create_user(&conn, "admin".to_string())
        .map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
async fn update_user_name(name: String) -> Result<(), String> {
    let conn = db::init_db()?;
    // 获取当前用户ID
    let user_id = {
        let mut stmt = conn.prepare("SELECT id FROM users LIMIT 1").map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            row.get::<_, String>(0).map_err(|e| e.to_string())?
        } else {
            return Err("User not found".to_string());
        }
    };
    db::update_user_name(&conn, &user_id, &name)?;
    db::update_user_name_in_settings(&name)?;
    Ok(())
}

#[tauri::command]
async fn generate_random_name() -> Result<String, String> {
    Ok(db::generate_random_name())
}

// ============ 文档操作 ============

#[tauri::command]
async fn save_document(path: String, content: String) -> Result<db::DocumentRecord, String> {
    let conn = db::init_db()?;
    db::save_document(&conn, &path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_document(path: String) -> Result<Option<db::DocumentRecord>, String> {
    let conn = db::init_db()?;
    db::get_document_by_path(&conn, &path).map_err(|e| e.to_string())
}

// ============ 注解操作 ============

#[tauri::command]
async fn get_annotations(doc_id: String) -> Result<Vec<db::AnnotationRecord>, String> {
    let conn = db::init_db()?;
    db::get_annotations_by_doc(&conn, &doc_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_annotation(annotation: String) -> Result<(), String> {
    let anno: db::AnnotationRecord = serde_json::from_str(&annotation)
        .map_err(|e| e.to_string())?;
    let conn = db::init_db()?;
    db::add_annotation(&conn, &anno).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_annotation(annotation: String) -> Result<(), String> {
    let anno: db::AnnotationRecord = serde_json::from_str(&annotation)
        .map_err(|e| e.to_string())?;
    let conn = db::init_db()?;
    db::update_annotation(&conn, &anno).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_annotation(id: String) -> Result<(), String> {
    let conn = db::init_db()?;
    db::delete_annotation(&conn, &id).map_err(|e| e.to_string())
}

// ============ 单注解导出/导入 ============

#[tauri::command]
async fn export_annotation(anno_id: String, doc_path: String) -> Result<String, String> {
    let conn = db::init_db()?;
    db::export_annotation(&conn, &anno_id, &doc_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_annotation(json: String) -> Result<String, String> {
    let annotations = db::import_annotation(&json).map_err(|e| e.to_string())?;
    serde_json::to_string(&annotations).map_err(|e| e.to_string())
}

#[tauri::command]
async fn merge_imported_annotations(annotations_json: String, doc_path: String) -> Result<usize, String> {
    let annotations: Vec<db::AnnotationRecord> = serde_json::from_str(&annotations_json)
        .map_err(|e| e.to_string())?;
    let conn = db::init_db()?;

    // 获取文档 ID
    let doc = db::get_document_by_path(&conn, &doc_path)?
        .ok_or_else(|| "Document not found".to_string())?;

    db::merge_imported_annotations(&conn, &annotations, &doc.id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn merge_imported_annotation(annotation_json: String, doc_path: String) -> Result<(), String> {
    let anno: db::AnnotationRecord = serde_json::from_str(&annotation_json)
        .map_err(|e| e.to_string())?;
    let conn = db::init_db()?;

    // 获取文档 ID
    let doc = db::get_document_by_path(&conn, &doc_path)?
        .ok_or_else(|| "Document not found".to_string())?;

    db::merge_imported_annotation(&conn, &anno, &doc.id).map_err(|e| e.to_string())
}

// ============ HTML 导出 ============

#[tauri::command]
async fn export_as_html(doc_id: String, anno_ids: Vec<String>, content: String) -> Result<String, String> {
    let conn = db::init_db()?;
    db::export_as_html(&conn, &doc_id, &anno_ids, &content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_html_file(path: String, html: String) -> Result<(), String> {
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(html.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

// ============ 迁移 ============

#[tauri::command]
async fn migrate_sidecar_files(base_dir: String) -> Result<(), String> {
    let conn = db::init_db()?;
    db::migrate_sidecar_files(&conn, &base_dir).map_err(|e| e.to_string())
}

// ============ 设置 ============

#[tauri::command]
async fn load_settings() -> Result<String, String> {
    let settings = db::load_settings().map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_settings(settings_json: String) -> Result<(), String> {
    let settings: db::SettingsRecord = serde_json::from_str(&settings_json)
        .map_err(|e| e.to_string())?;
    db::save_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_settings_path() -> Result<String, String> {
    Ok(db::get_settings_path().to_string_lossy().to_string())
}

#[tauri::command]
async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer")
            .arg(path)
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============ 路径工具 ============

#[tauri::command]
async fn get_db_path() -> Result<String, String> {
    Ok(db::get_db_path().to_string_lossy().to_string())
}

// ============ UI 设置 ============

#[tauri::command]
async fn load_ui_settings() -> Result<Option<String>, String> {
    let settings = db::load_ui_settings().map_err(|e| e.to_string())?;
    match settings {
        Some(s) => {
            let json = serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?;
            Ok(Some(json))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn save_ui_settings(settings_json: String) -> Result<(), String> {
    let settings: serde_json::Value = serde_json::from_str(&settings_json)
        .map_err(|e| e.to_string())?;
    db::save_ui_settings(&settings).map_err(|e| e.to_string())
}

// ============ 排版配置 ============

#[tauri::command]
async fn get_typography_path() -> Result<String, String> {
    Ok(db::get_typography_path().to_string_lossy().to_string())
}

#[tauri::command]
async fn load_typography_config() -> Result<String, String> {
    let path = db::get_typography_path();
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(content)
    } else {
        // Return default config
        Ok(String::new())
    }
}

#[tauri::command]
async fn save_typography_config(content: String) -> Result<(), String> {
    let path = db::get_typography_path();
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file_content,
            write_file_content,
            file_exists,
            init_db,
            get_current_user,
            update_user_name,
            generate_random_name,
            save_document,
            get_document,
            get_annotations,
            add_annotation,
            update_annotation,
            delete_annotation,
            export_annotation,
            import_annotation,
            merge_imported_annotations,
            merge_imported_annotation,
            export_as_html,
            save_html_file,
            migrate_sidecar_files,
            load_settings,
            save_settings,
            get_settings_path,
            open_path,
            get_db_path,
            load_ui_settings,
            save_ui_settings,
            get_typography_path,
            load_typography_config,
            save_typography_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

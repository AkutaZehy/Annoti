use rusqlite::{params, Connection, Result, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use uuid::Uuid;
use chrono::Utc;
use rand::Rng;

// ============ 类型定义 ============

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserRecord {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DocumentRecord {
    pub id: String,
    pub path: String,
    pub content: String,
    pub checksum: String,
    pub last_modified: i64,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AnnotationRecord {
    pub id: String,
    pub document_id: String,
    pub user_id: String,
    pub user_name: String,
    pub text: String,
    pub note: Option<String>,
    pub note_visible: bool,
    pub note_position_x: f64,
    pub note_position_y: f64,
    pub note_width: f64,
    pub note_height: f64,
    pub highlight_color: String,
    pub highlight_type: String,
    pub anchor_data: String, // JSON 字符串
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize)]
pub struct SettingsRecord {
    pub version: String,
    pub user: UserSettingsRecord,
    pub editor: EditorSettingsRecord,
    pub export: ExportSettingsRecord,
    pub i18n: I18nSettingsRecord,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserSettingsRecord {
    pub id: String,
    pub name: String,
    pub can_reroll: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EditorSettingsRecord {
    pub default_highlight_color: String,
    pub default_highlight_type: String,
    pub font_size: i32,
    pub font_family: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExportSettingsRecord {
    pub default_format: String,
    pub show_notes_by_default: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct I18nSettingsRecord {
    pub language: String,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
pub enum AnnotationPackage {
    // 新格式：批量导入
    Batch(BatchPackage),
    // 旧格式：单个注解（兼容）- 使用 Box 减少内存开销
    Single(Box<SinglePackage>),
}

#[derive(Serialize, Deserialize)]
pub struct BatchPackage {
    pub version: String,
    pub exported_at: i64,
    pub source_document: Option<SourceDocumentInfo>,
    pub annotations: Vec<AnnotationRecord>,
}

#[derive(Serialize, Deserialize)]
pub struct SinglePackage {
    pub version: String,
    pub exported_at: i64,
    pub source_document: Option<SourceDocumentInfo>,
    pub annotation: AnnotationRecord,
}

#[derive(Serialize, Deserialize)]
pub struct SourceDocumentInfo {
    pub name: String,
    pub checksum: String,
}

// ============ 数据库路径 ============

pub fn get_app_data_dir() -> std::path::PathBuf {
    let mut path = if cfg!(target_os = "windows") {
        std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string())
    } else if cfg!(target_os = "macos") {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        format!("{}/Library/Application Support", home)
    } else {
        std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            format!("{}/.local/share", home)
        })
    };
    path.push_str("\\Annoti");
    std::path::PathBuf::from(path)
}

pub fn get_db_path() -> std::path::PathBuf {
    let mut path = get_app_data_dir();
    fs::create_dir_all(&path).ok();
    path.push("data.db");
    path
}

pub fn get_settings_path() -> std::path::PathBuf {
    let mut path = get_app_data_dir();
    fs::create_dir_all(&path).ok();
    path.push("settings.json");
    path
}

// ============ 数据库初始化 ============

pub fn init_db() -> Result<Connection, String> {
    let conn = Connection::open(get_db_path())
        .map_err(|e| e.to_string())?;

    // 创建表
    conn.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            checksum TEXT NOT NULL,
            last_modified INTEGER,
            created_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            text TEXT NOT NULL,
            note TEXT,
            note_visible INTEGER DEFAULT 0,
            note_position_x REAL DEFAULT 0,
            note_position_y REAL DEFAULT 0,
            note_width REAL DEFAULT 280,
            note_height REAL DEFAULT 180,
            highlight_color TEXT DEFAULT '#ffd700',
            highlight_type TEXT DEFAULT 'underline',
            anchor_data TEXT NOT NULL,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY (document_id) REFERENCES documents(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_annotations_doc ON annotations(document_id);
        CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
    "#).map_err(|e| e.to_string())?;

    Ok(conn)
}

// ============ 用户操作 ============

pub fn get_or_create_user(conn: &Connection, name: String) -> Result<UserRecord, String> {
    // 查找现有用户
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM users LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(UserRecord {
            id: row.get(0).map_err(|e| e.to_string())?,
            name: row.get(1).map_err(|e| e.to_string())?,
            created_at: row.get(2).map_err(|e| e.to_string())?,
        });
    }

    // 创建新用户
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)",
        params![id, name, now],
    ).map_err(|e| e.to_string())?;

    Ok(UserRecord { id, name, created_at: now })
}

pub fn update_user_name(conn: &Connection, id: &str, name: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE users SET name = ? WHERE id = ?",
        params![name, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn generate_random_name() -> String {
    const ADJECTIVES: &[&str] = &["Swift", "Bright", "Calm", "Eager", "Gentle", "Happy", "Jolly", "Kind", "Lively", "Nice", "Proud", "Silly", "Witty", "Zesty", "Cool", "Fine", "Bold", "Wild"];
    const NOUNS: &[&str] = &["Panda", "Tiger", "Eagle", "Lion", "Wolf", "Bear", "Fox", "Hawk", "Owl", "Deer", "Rabbit", "Swan", "Dove", "Frog", "Fish", "Whale", "Dolphin", "Shark", "Cat", "Dog"];

    let mut rng = rand::thread_rng();
    let adj = ADJECTIVES[rng.gen_range(0..ADJECTIVES.len())];
    let noun = NOUNS[rng.gen_range(0..NOUNS.len())];
    let num: u32 = rng.gen_range(1000..10000);

    format!("{}{}{}", adj, noun, num)
}

// ============ 文档操作 ============

pub fn get_document_by_path(conn: &Connection, path: &str) -> Result<Option<DocumentRecord>, String> {
    let mut stmt = conn.prepare("SELECT id, path, content, checksum, last_modified, created_at FROM documents WHERE path = ?")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([path]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(DocumentRecord {
            id: row.get(0).map_err(|e| e.to_string())?,
            path: row.get(1).map_err(|e| e.to_string())?,
            content: row.get(2).map_err(|e| e.to_string())?,
            checksum: row.get(3).map_err(|e| e.to_string())?,
            last_modified: row.get(4).map_err(|e| e.to_string())?,
            created_at: row.get(5).map_err(|e| e.to_string())?,
        }))
    } else {
        Ok(None)
    }
}

pub fn save_document(conn: &Connection, path: &str, content: &str) -> Result<DocumentRecord, String> {
    let checksum = compute_checksum(content);
    let now = Utc::now().timestamp_millis();

    // 检查是否存在
    if let Some(existing) = get_document_by_path(conn, path)? {
        // 更新
        conn.execute(
            "UPDATE documents SET content = ?, checksum = ?, last_modified = ? WHERE id = ?",
            params![content, checksum, now, existing.id],
        ).map_err(|e| e.to_string())?;

        return Ok(DocumentRecord {
            id: existing.id,
            path: path.to_string(),
            content: content.to_string(),
            checksum,
            last_modified: now,
            created_at: existing.created_at,
        });
    }

    // 新建
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO documents (id, path, content, checksum, last_modified, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        params![id, path, content, checksum, now, now],
    ).map_err(|e| e.to_string())?;

    Ok(DocumentRecord {
        id,
        path: path.to_string(),
        content: content.to_string(),
        checksum,
        last_modified: now,
        created_at: now,
    })
}

#[allow(dead_code)]
pub fn delete_document(conn: &Connection, doc_id: &str) -> Result<(), String> {
    // 先删除关联的注解
    conn.execute("DELETE FROM annotations WHERE document_id = ?", params![doc_id])
        .map_err(|e| e.to_string())?;

    // 删除文档
    conn.execute("DELETE FROM documents WHERE id = ?", params![doc_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ 注解操作 ============

pub fn get_annotations_by_doc(conn: &Connection, doc_id: &str) -> Result<Vec<AnnotationRecord>, String> {
    let mut stmt = conn.prepare("
        SELECT id, document_id, user_id, user_name, text, note, note_visible,
               note_position_x, note_position_y, note_width, note_height,
               highlight_color, highlight_type, anchor_data, created_at, updated_at
        FROM annotations WHERE document_id = ?
    ").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([doc_id]).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    while let Ok(row) = rows.next() {
        match row {
            Some(r) => {
                results.push(row_to_annotation(r)?);
            }
            None => break,
        }
    }
    Ok(results)
}

pub fn get_annotation_by_id(conn: &Connection, id: &str) -> Result<Option<AnnotationRecord>, String> {
    let mut stmt = conn.prepare("
        SELECT id, document_id, user_id, user_name, text, note, note_visible,
               note_position_x, note_position_y, note_width, note_height,
               highlight_color, highlight_type, anchor_data, created_at, updated_at
        FROM annotations WHERE id = ?
    ").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([id]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row_to_annotation(row)?))
    } else {
        Ok(None)
    }
}

fn row_to_annotation(row: &Row) -> Result<AnnotationRecord, String> {
    Ok(AnnotationRecord {
        id: row.get(0).map_err(|e| e.to_string())?,
        document_id: row.get(1).map_err(|e| e.to_string())?,
        user_id: row.get(2).map_err(|e| e.to_string())?,
        user_name: row.get(3).map_err(|e| e.to_string())?,
        text: row.get(4).map_err(|e| e.to_string())?,
        note: row.get(5).map_err(|e| e.to_string())?,
        note_visible: row.get::<_, i32>(6).map_err(|e| e.to_string())? != 0,
        note_position_x: row.get(7).map_err(|e| e.to_string())?,
        note_position_y: row.get(8).map_err(|e| e.to_string())?,
        note_width: row.get(9).map_err(|e| e.to_string())?,
        note_height: row.get(10).map_err(|e| e.to_string())?,
        highlight_color: row.get(11).map_err(|e| e.to_string())?,
        highlight_type: row.get(12).map_err(|e| e.to_string())?,
        anchor_data: row.get(13).map_err(|e| e.to_string())?,
        created_at: row.get(14).map_err(|e| e.to_string())?,
        updated_at: row.get(15).map_err(|e| e.to_string())?,
    })
}

pub fn add_annotation(conn: &Connection, annotation: &AnnotationRecord) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();

    conn.execute("
        INSERT INTO annotations (
            id, document_id, user_id, user_name, text, note, note_visible,
            note_position_x, note_position_y, note_width, note_height,
            highlight_color, highlight_type, anchor_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ", params![
        annotation.id,
        annotation.document_id,
        annotation.user_id,
        annotation.user_name,
        annotation.text,
        annotation.note,
        if annotation.note_visible { 1 } else { 0 },
        annotation.note_position_x,
        annotation.note_position_y,
        annotation.note_width,
        annotation.note_height,
        annotation.highlight_color,
        annotation.highlight_type,
        annotation.anchor_data,
        annotation.created_at,
        now
    ]).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn update_annotation(conn: &Connection, annotation: &AnnotationRecord) -> Result<(), String> {
    let now = Utc::now().timestamp_millis();

    conn.execute("
        UPDATE annotations SET
            note = ?,
            note_visible = ?,
            note_position_x = ?,
            note_position_y = ?,
            note_width = ?,
            note_height = ?,
            highlight_color = ?,
            highlight_type = ?,
            anchor_data = ?,
            updated_at = ?
        WHERE id = ?
    ", params![
        annotation.note,
        if annotation.note_visible { 1 } else { 0 },
        annotation.note_position_x,
        annotation.note_position_y,
        annotation.note_width,
        annotation.note_height,
        annotation.highlight_color,
        annotation.highlight_type,
        annotation.anchor_data,
        now,
        annotation.id
    ]).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn delete_annotation(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM annotations WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============ 单注解导出/导入 ============

pub fn export_annotation(conn: &Connection, anno_id: &str, doc_path: &str) -> Result<String, String> {
    let annotation = get_annotation_by_id(conn, anno_id)?
        .ok_or_else(|| "Annotation not found".to_string())?;

    let doc = get_document_by_path(conn, doc_path)?
        .ok_or_else(|| "Document not found".to_string())?;

    let package = BatchPackage {
        version: "1.0".to_string(),
        exported_at: Utc::now().timestamp_millis(),
        source_document: Some(SourceDocumentInfo {
            name: std::path::Path::new(&doc.path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            checksum: doc.checksum,
        }),
        annotations: vec![annotation],
    };

    serde_json::to_string_pretty(&package).map_err(|e| e.to_string())
}

pub fn import_annotation(json: &str) -> Result<Vec<AnnotationRecord>, String> {
    let package: AnnotationPackage = serde_json::from_str(json)
        .map_err(|e| e.to_string())?;

    let annotations = match package {
        AnnotationPackage::Batch(batch) => {
            if batch.version != "1.0" {
                return Err("Unsupported version".to_string());
            }
            batch.annotations
        }
        AnnotationPackage::Single(single) => {
            if single.version != "1.0" {
                return Err("Unsupported version".to_string());
            }
            vec![single.annotation]
        }
    };

    // 生成新 ID，避免冲突
    let mut result = Vec::new();
    for mut anno in annotations {
        anno.id = Uuid::new_v4().to_string();
        result.push(anno);
    }

    Ok(result)
}

pub fn merge_imported_annotation(conn: &Connection, annotation: &AnnotationRecord, doc_id: &str) -> Result<(), String> {
    let mut annotation = annotation.clone();
    annotation.document_id = doc_id.to_string();
    annotation.created_at = Utc::now().timestamp_millis();

    add_annotation(conn, &annotation)
}

// 批量导入并去重
pub fn merge_imported_annotations(conn: &Connection, annotations: &[AnnotationRecord], doc_id: &str) -> Result<usize, String> {
    let now = Utc::now().timestamp_millis();
    let mut imported_count = 0;

    // 获取现有的注解文本集合（用于去重）
    let existing_texts: std::collections::HashSet<String> = {
        let mut stmt = conn.prepare("SELECT text FROM annotations WHERE document_id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query([doc_id]).map_err(|e| e.to_string())?;
        let mut texts = std::collections::HashSet::new();
        while let Ok(Some(row)) = rows.next() {
            if let Ok(text) = row.get::<_, String>(0) {
                texts.insert(text);
            }
        }
        texts
    };

    for mut anno in annotations.iter().cloned() {
        // 去重：检查文本是否已存在
        if existing_texts.contains(&anno.text) {
            continue;
        }

        // 生成新 ID
        anno.id = Uuid::new_v4().to_string();
        anno.document_id = doc_id.to_string();
        anno.created_at = now;
        anno.updated_at = now;

        add_annotation(conn, &anno)?;
        imported_count += 1;
    }

    Ok(imported_count)
}

// ============ HTML 导出 ============

pub fn export_as_html(conn: &Connection, doc_id: &str, anno_ids: &[String], content: &str) -> Result<String, String> {
    let doc = {
        let mut stmt = conn.prepare("SELECT id, path FROM documents WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query([doc_id]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            Some(DocumentRecord {
                id: row.get(0).map_err(|e| e.to_string())?,
                path: row.get(1).map_err(|e| e.to_string())?,
                content: content.to_string(),
                checksum: String::new(),
                last_modified: 0,
                created_at: 0,
            })
        } else {
            None
        }
    }.ok_or_else(|| "Document not found".to_string())?;

    let mut annotations = Vec::new();
    for anno_id in anno_ids {
        if let Some(anno) = get_annotation_by_id(conn, anno_id)? {
            annotations.push(anno);
        }
    }

    // 直接使用前端传来的已渲染 HTML，不再重复解析
    let html_content = doc.content.clone();

    // 生成 HTML
    let html = generate_readonly_html(&doc.path, &html_content, &annotations);

    Ok(html)
}

#[allow(dead_code)]
fn markdown_to_html(markdown: &str) -> String {
    // 简化版：实际应集成 marked 或 pulldown-cmark
    let mut html = markdown
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("# ", "<h1>")
        .replace("\n## ", "</h1>\n<h2>")
        .replace("\n### ", "</h2>\n<h3>")
        .replace("\n#### ", "</h3>\n<h4>")
        .replace("\n##### ", "</h4>\n<h5>")
        .replace("\n###### ", "</h5>\n<h6>")
        .replace("\n", "<br>\n");

    // 简单的代码块
    if let Some(start) = html.find("```") {
        if let Some(end) = html[start+3..].find("```") {
            let code_start = start + 3;
            let code_end = start + 3 + end;
            let code = &html[code_start..code_end];
            let before = &html[..code_start];
            let after = &html[code_end + 3..];
            html = format!("{}<pre><code>{}</code></pre>{}", before, code, after);
        }
    }

    // 简单的粗体和斜体
    html = html.replace("**", "<strong>").replace("*", "<em>");

    // 简单的列表
    html = html.replace("- ", "<li>");

    html
}

fn generate_readonly_html(_doc_name: &str, content: &str, annotations: &[AnnotationRecord]) -> String {
    let mut notes_html = String::new();

    for anno in annotations {
        let empty_note = String::new();
        let note_text = anno.note.as_ref().unwrap_or(&empty_note);
        let style = format!(
            "left: {:.0}px; top: {:.0}px; width: {:.0}px; height: {:.0}px;",
            anno.note_position_x, anno.note_position_y,
            anno.note_width, anno.note_height
        );

        notes_html.push_str(&format!(r#"
        <div class="sticky-note" data-anno-id="{}" style="{}">
            <div class="note-header">
                <span class="note-author">{}</span>
                <button class="note-close" onclick="closeNote('{}')">&times;</button>
            </div>
            <div class="note-content">{}</div>
        </div>
        "#,
            anno.id, style,
            escape_html(&anno.user_name),
            anno.id,
            escape_html(note_text)
        ));
    }

    let payload = serde_json::to_string(&annotations).unwrap_or_default();

    // 注意：使用 format! 和 HTML 手动拼接，避免 script 中 {} 出现问题
    let html = format!(r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Annotated</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: system-ui, -apple-system, sans-serif; background: #242424; color: #ddd; font-size: 16px !important; line-height: 1.6 !important; position: relative; }}
        .container {{ max-width: 900px; margin: 0 auto; padding: 20px; }}
        .container h1 {{ font-size: 2em !important; color: #fff !important; margin: 1em 0 0.5em !important; }}
        .container h2 {{ font-size: 1.5em !important; color: #fff !important; margin: 1em 0 0.5em !important; }}
        .container h3 {{ font-size: 1.25em !important; color: #fff !important; margin: 1em 0 0.5em !important; }}
        .container h4 {{ font-size: 1.1em !important; color: #fff !important; margin: 1em 0 0.5em !important; }}
        .container h5 {{ font-size: 1em !important; color: #fff !important; margin: 1em 0 0.5em !important; }}
        .container h6 {{ font-size: 0.9em !important; color: #aaa !important; margin: 1em 0 0.5em !important; }}
        .container p {{ font-size: 1em !important; margin: 0.8em 0 !important; }}
        .container ul, .container ol {{ font-size: 1em !important; margin: 0.8em 0 !important; padding-left: 2em; }}
        .container li {{ font-size: 1em !important; margin: 0.3em 0; }}
        .container blockquote {{ font-size: 1em !important; margin: 0.8em 0; padding-left: 1em; border-left: 3px solid #444; color: #999; }}
        .markdown-body {{ position: relative; }}
        .markdown-body pre {{ background: #1a1a1a; padding: 1em; overflow-x: auto; border-radius: 4px; }}
        .markdown-body code {{ background: #1a1a1a; padding: 0.2em 0.4em; border-radius: 3px; }}
        .doc-highlight {{
            background: rgba(255, 215, 0, 0.3);
            border-bottom: 2px solid gold;
            cursor: pointer;
            padding: 2px 0;
        }}
        .doc-highlight:hover {{ background: rgba(255, 215, 0, 0.5); }}
        .sticky-note {{
            position: absolute;
            background: #fff9c4;
            color: #333;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
        }}
        .note-header {{
            background: #ffd700;
            padding: 4px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 4px 4px 0 0;
            cursor: move;
        }}
        .note-author {{ font-weight: bold; font-size: 12px; }}
        .note-close {{
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
            opacity: 0.7;
        }}
        .note-close:hover {{ opacity: 1; }}
        .note-content {{ padding: 10px; font-size: 14px; white-space: pre-wrap; }}
        .reopen-btn {{
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ffd700;
            color: #333;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
            z-index: 2000;
        }}
        .reopen-btn:hover {{ background: #ffed4a; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Annotated</h1>
        <div class="markdown-body">{}</div>
    </div>
    {}

    <button class="reopen-btn" onclick="showAllNotes()" title="显示所有便签">📝</button>

    <script type="application/json" id="ann-payload">
{}
    </script>

    <script>
        const annotations = JSON.parse(document.getElementById('ann-payload').textContent);

        // 点击高亮滚动到便签
        document.querySelectorAll('.doc-highlight').forEach(function(el) {{
            el.addEventListener('click', function() {{
                const id = el.dataset.annoId;
                const note = document.querySelector('.sticky-note[data-anno-id="' + id + '"]');
                if (note) {{
                    note.style.display = 'block';
                    note.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                    note.style.opacity = '1';
                }}
            }});
        }});

        function closeNote(id) {{
            const note = document.querySelector('.sticky-note[data-anno-id="' + id + '"]');
            if (note) note.style.display = 'none';
        }}

        function showNote(id) {{
            const note = document.querySelector('.sticky-note[data-anno-id="' + id + '"]');
            if (note) {{
                note.style.display = 'block';
                note.style.opacity = '1';
            }}
        }}

        function showAllNotes() {{
            document.querySelectorAll('.sticky-note').forEach(function(note) {{
                note.style.display = 'block';
                note.style.opacity = '1';
            }});
        }}

        // 拖拽功能
        document.querySelectorAll('.sticky-note').forEach(function(note) {{
            let isDragging = false;
            let startX, startY, origX, origY;

            note.querySelector('.note-header').addEventListener('mousedown', function(e) {{
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                origX = note.offsetLeft;
                origY = note.offsetTop;
                note.style.zIndex = 1001;
            }});

            document.addEventListener('mousemove', function(e) {{
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                note.style.left = (origX + dx) + 'px';
                note.style.top = (origY + dy) + 'px';
            }});

            document.addEventListener('mouseup', function() {{
                isDragging = false;
                note.style.zIndex = 1000;
            }});
        }});
    </script>
</body>
</html>"#,
        content,
        notes_html,
        payload
    );

    html
}

fn escape_html(s: &str) -> String {
    s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
}

// ============ 辅助函数 ============

pub fn compute_checksum(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ============ 迁移 ============

pub fn migrate_sidecar_files(conn: &Connection, base_dir: &str) -> Result<(), String> {
    let entries = fs::read_dir(base_dir)
        .map_err(|e| e.to_string())?;

    let mut migrated = 0;
    let mut errors = 0;

    for entry in entries {
        let path = entry.map_err(|e| e.to_string())?.path();

        if !path.is_file() {
            continue;
        }

        // 只处理 .ann 文件
        if path.extension().and_then(|e| e.to_str()) != Some("ann") {
            continue;
        }

        // 获取对应的文档路径
        let ann_path = path.to_string_lossy();
        let doc_path = match ann_path.strip_suffix(".ann") {
            Some(p) => p.to_string(),
            None => continue,
        };

        // 读取注解文件
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => {
                errors += 1;
                continue;
            }
        };

        // 解析注解
        let annotations: Vec<serde_json::Value> = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => {
                errors += 1;
                continue;
            }
        };

        // 确保文档已存在
        if let Ok(Some(_)) = get_document_by_path(conn, &doc_path) {
            // 文档已存在
        } else {
            // 读取文档内容并保存
            if let Ok(doc_content) = fs::read_to_string(&doc_path) {
                let _ = save_document(conn, &doc_path, &doc_content);
            } else {
                errors += 1;
                continue;
            }
        }

        let doc = get_document_by_path(conn, &doc_path)?.unwrap();
        let user = get_or_create_user(conn, "migrated".to_string())?;

        // 导入每个注解
        for anno_json in annotations {
            let mut anno: AnnotationRecord = serde_json::from_value(anno_json)
                .map_err(|e| e.to_string())?;

            // 设置正确的关联
            anno.id = Uuid::new_v4().to_string();
            anno.document_id = doc.id.clone();
            anno.user_id = user.id.clone();
            anno.user_name = user.name.clone();
            anno.highlight_color = "#ffd700".to_string();
            anno.highlight_type = "underline".to_string();

            if let Err(e) = add_annotation(conn, &anno) {
                errors += 1;
                println!("Error importing annotation: {}", e);
                continue;
            }

            migrated += 1;
        }

        // 备份原始文件
        let backup_path = format!("{}.backup.migrated", ann_path);
        let _ = fs::rename(&path, &backup_path);
    }

    println!("Migration complete: {} annotations migrated, {} errors", migrated, errors);
    Ok(())
}

// ============ 设置操作 ============

pub fn load_settings() -> Result<SettingsRecord, String> {
    let path = get_settings_path();

    if !path.exists() {
        // 创建默认设置
        let default_settings = SettingsRecord {
            version: "1.0".to_string(),
            user: UserSettingsRecord {
                id: Uuid::new_v4().to_string(),
                name: "admin".to_string(),
                can_reroll: true,
            },
            editor: EditorSettingsRecord {
                default_highlight_color: "#ffd700".to_string(),
                default_highlight_type: "underline".to_string(),
                font_size: 16,
                font_family: "system-ui".to_string(),
            },
            export: ExportSettingsRecord {
                default_format: "html".to_string(),
                show_notes_by_default: true,
            },
            i18n: I18nSettingsRecord {
                language: "zh-CN".to_string(),
            },
        };

        save_settings(&default_settings)?;
        return Ok(default_settings);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_settings(settings: &SettingsRecord) -> Result<(), String> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_user_name_in_settings(new_name: &str) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.user.name = new_name.to_string();
    save_settings(&settings)?;
    Ok(())
}

// ============ UI 设置操作 ============

pub fn get_ui_settings_path() -> std::path::PathBuf {
    let mut path = get_app_data_dir();
    fs::create_dir_all(&path).ok();
    path.push("ui_settings.json");
    path
}

pub fn load_ui_settings() -> Result<Option<serde_json::Value>, String> {
    let path = get_ui_settings_path();

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_ui_settings(settings: &serde_json::Value) -> Result<(), String> {
    let path = get_ui_settings_path();
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

// ============ 排版配置操作 ============

pub fn get_typography_path() -> std::path::PathBuf {
    let mut path = get_app_data_dir();
    fs::create_dir_all(&path).ok();
    path.push("typography.yaml");
    path
}

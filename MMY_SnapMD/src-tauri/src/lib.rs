use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedDocument {
    path: String,
    name: String,
    content: String,
    base_dir: String,
    kind: String,
    modified_at_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentFileState {
    modified_at_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedImageAsset {
    path: String,
    name: String,
    relative_path: String,
}

struct PreparedImageAsset {
    final_name: String,
    target_path: std::path::PathBuf,
}

#[tauri::command]
fn read_document_file(path: String) -> Result<OpenedDocument, String> {
    let file_path = Path::new(&path);
    let kind = ensure_supported_document(file_path)?;

    let modified_at_ms = modified_at_ms(file_path)?;
    let content =
        std::fs::read_to_string(file_path).map_err(|error| format!("无法读取文件：{error}"))?;
    let name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("untitled")
        .to_string();
    let base_dir = file_path
        .parent()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();

    Ok(OpenedDocument {
        path,
        name,
        content,
        base_dir,
        kind,
        modified_at_ms,
    })
}

#[tauri::command]
fn document_file_state(path: String) -> Result<DocumentFileState, String> {
    let file_path = Path::new(&path);
    ensure_supported_document(file_path)?;

    Ok(DocumentFileState {
        modified_at_ms: modified_at_ms(file_path)?,
    })
}

#[tauri::command]
fn save_document_file(path: String, content: String) -> Result<OpenedDocument, String> {
    let file_path = Path::new(&path);
    ensure_supported_document(file_path)?;

    std::fs::write(file_path, content).map_err(|error| format!("无法保存文件：{error}"))?;
    read_document_file(path)
}

#[tauri::command]
fn save_image_asset(
    document_path: String,
    original_name: String,
    bytes: Vec<u8>,
) -> Result<SavedImageAsset, String> {
    if bytes.is_empty() {
        return Err("图片文件为空".to_string());
    }

    let document_path = Path::new(&document_path);
    let document_kind = ensure_supported_document(document_path)?;
    if document_kind != "markdown" {
        return Err("仅 Markdown 文件支持插入图片".to_string());
    }

    let prepared_asset = prepare_image_asset_target(document_path, &original_name)?;

    std::fs::write(&prepared_asset.target_path, bytes)
        .map_err(|error| format!("无法保存图片：{error}"))?;

    Ok(SavedImageAsset {
        path: prepared_asset.target_path.to_string_lossy().to_string(),
        name: prepared_asset.final_name.clone(),
        relative_path: format!("./assets/{}", prepared_asset.final_name),
    })
}

#[tauri::command]
fn save_image_asset_from_path(
    document_path: String,
    image_path: String,
) -> Result<SavedImageAsset, String> {
    let source_path = Path::new(&image_path);
    if !source_path.exists() {
        return Err("拖入的图片文件不存在".to_string());
    }

    let source_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("image")
        .to_string();
    let prepared_asset = prepare_image_asset_target(Path::new(&document_path), &source_name)?;

    std::fs::copy(source_path, &prepared_asset.target_path)
        .map_err(|error| format!("无法复制图片：{error}"))?;

    Ok(SavedImageAsset {
        path: prepared_asset.target_path.to_string_lossy().to_string(),
        name: prepared_asset.final_name.clone(),
        relative_path: format!("./assets/{}", prepared_asset.final_name),
    })
}

#[tauri::command]
fn launch_files() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|path| ensure_supported_document(Path::new(path)).is_ok())
        .collect()
}

fn ensure_supported_document(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    match extension.as_deref() {
        Some("md" | "markdown") => Ok("markdown".to_string()),
        Some("txt") => Ok("txt".to_string()),
        Some("json") => Ok("json".to_string()),
        Some("csv") => Ok("csv".to_string()),
        Some("yaml" | "yml") => Ok("yaml".to_string()),
        _ => Err("仅支持 .md、.markdown、.txt、.json、.csv、.yaml、.yml 文件".to_string()),
    }
}

fn ensure_supported_image_extension(extension: &str) -> Result<(), String> {
    match extension {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => Ok(()),
        _ => Err("仅支持 png、jpg、jpeg、gif、webp、svg 图片".to_string()),
    }
}

fn prepare_image_asset_target(
    document_path: &Path,
    original_name: &str,
) -> Result<PreparedImageAsset, String> {
    let document_kind = ensure_supported_document(document_path)?;
    if document_kind != "markdown" {
        return Err("仅 Markdown 文件支持插入图片".to_string());
    }

    let document_dir = document_path
        .parent()
        .ok_or_else(|| "无法确定当前文档目录".to_string())?;
    let assets_dir = document_dir.join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|error| format!("无法创建图片目录：{error}"))?;

    let source_name = Path::new(original_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let source_path = Path::new(source_name);
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "图片文件缺少扩展名".to_string())?;

    ensure_supported_image_extension(&extension)?;

    let stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_asset_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "image".to_string());

    let mut final_name = format!("{stem}.{extension}");
    let mut target_path = assets_dir.join(&final_name);
    for index in 1..=9999 {
        if !target_path.exists() {
            break;
        }

        final_name = format!("{stem}-{index}.{extension}");
        target_path = assets_dir.join(&final_name);
    }

    if target_path.exists() {
        return Err("无法生成不重名的图片文件名".to_string());
    }

    Ok(PreparedImageAsset {
        final_name,
        target_path,
    })
}

fn sanitize_asset_stem(value: &str) -> String {
    let normalized = value
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();

    normalized
        .trim_matches('-')
        .chars()
        .take(64)
        .collect::<String>()
}

fn modified_at_ms(path: &Path) -> Result<Option<u64>, String> {
    let modified = std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| format!("无法读取文件状态：{error}"))?;

    Ok(modified
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_document_file,
            document_file_state,
            save_document_file,
            save_image_asset,
            save_image_asset_from_path,
            launch_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running SnapMD");
}

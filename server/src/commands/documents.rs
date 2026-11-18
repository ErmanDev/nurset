use std::path::Path;

use serde::Deserialize;

use super::{optional_text, required_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::files::{self, FileLink};
use crate::models::Document;

/// Largest file accepted by `upload_document`.
const MAX_UPLOAD_BYTES: usize = 25 * 1024 * 1024;
/// Requirement documents: PDF, Word (.docx), and JPG/PNG images.
const ALLOWED_EXTENSIONS: &[&str] = &["pdf", "docx", "jpg", "jpeg", "png"];

/// A one-time link to one of the student's own submitted files.
pub async fn open_document(db: &Db, id: i64) -> AppResult<FileLink> {
    let uid = db.user_id().await?;
    let path: Option<String> = sqlx::query_scalar("SELECT storage_key FROM documents WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(uid)
        .fetch_optional(&db.pool)
        .await?
        .ok_or_else(|| super::not_found("Document", id))?;
    let key = path.ok_or_else(|| AppError::new("This submission has no file attached"))?;
    files::link_to_file(&db.pool, &key).await
}

/// All submitted documents, newest first.
pub async fn list_documents(db: &Db) -> AppResult<Vec<Document>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, Document>(&format!(
        "{} WHERE d.user_id = $1 ORDER BY d.submitted_at DESC, d.id DESC",
        Document::SELECT
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadMeta {
    file_name: String,
    document_type: String,
    title: String,
    notes: Option<String>,
}

/// Saves an uploaded file under `<upload dir>/documents/` and records it as pending review.
///
/// The request body is raw bytes (see `api.uploadDocument`):
/// `[u32 little-endian: metadata length][metadata JSON][file bytes]`.
pub async fn upload_document(db: &Db, body: &[u8]) -> AppResult<Document> {
    let (meta, bytes) = split_upload::<UploadMeta>(body)?;

    let title = required_text(&meta.title, "Document title")?;
    let document_type = required_text(&meta.document_type, "Document type")?;
    let file_name = sanitize_file_name(&meta.file_name)?;

    let extension = Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::new("Unsupported file type. Use PDF, DOCX, JPG, or PNG."));
    }
    if bytes.is_empty() {
        return Err(AppError::new("The selected file is empty"));
    }
    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err(AppError::new("File is larger than 25 MB"));
    }
    let uid = db.user_id().await?;

    let key = files::save(&db.pool, "documents", &file_name, bytes).await?;

    let inserted: Result<i64, sqlx::Error> = sqlx::query_scalar(
        "INSERT INTO documents
            (user_id, requirement_id, file_name, storage_key, file_size, title, document_type, notes)
         VALUES ($1,
            (SELECT id FROM requirements WHERE user_id = $1 AND title = $6 AND status <> 'submitted'
             ORDER BY due_date LIMIT 1),
            $2, $3, $4, $5, $6, $7)
         RETURNING id",
    )
    .bind(uid)
    .bind(&file_name)
    .bind(&key)
    .bind(bytes.len() as i64)
    .bind(&title)
    .bind(&document_type)
    .bind(optional_text(meta.notes))
    .fetch_one(&db.pool)
    .await;
    let id = match inserted {
        Ok(id) => id,
        Err(err) => {
            files::remove(&db.pool, &key).await; // don't leave orphaned files behind
            return Err(err.into());
        }
    };
    Ok(sqlx::query_as::<_, Document>(&format!("{} WHERE d.id = $1", Document::SELECT))
        .bind(id)
        .fetch_one(&db.pool)
        .await?)
}

/// Splits a raw upload body: `[u32 LE metadata length][metadata JSON][file bytes]`.
pub(crate) fn split_upload<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<(T, &[u8]), AppError> {
    let malformed = || AppError::new("Malformed upload");
    if body.len() < 4 {
        return Err(malformed());
    }
    let mut len = [0u8; 4];
    len.copy_from_slice(&body[..4]);
    let meta_end = 4usize
        .checked_add(u32::from_le_bytes(len) as usize)
        .filter(|&end| end <= body.len())
        .ok_or_else(malformed)?;
    let meta: T = serde_json::from_slice(&body[4..meta_end])?;
    Ok((meta, &body[meta_end..]))
}

/// Keeps only the final path component and replaces characters that are
/// unsafe in file names.
pub(crate) fn sanitize_file_name(name: &str) -> Result<String, AppError> {
    let base = Path::new(name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    let cleaned: String = base
        .chars()
        .map(|c| if c.is_alphanumeric() || " ._-()".contains(c) { c } else { '_' })
        .collect();
    let cleaned = cleaned.trim().trim_start_matches('.');
    if cleaned.is_empty() {
        return Err(AppError::new("Invalid file name"));
    }
    // Keep the extension when shortening very long names.
    let max = 120;
    if cleaned.chars().count() <= max {
        return Ok(cleaned.to_string());
    }
    let ext = Path::new(cleaned)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_default();
    let stem: String = cleaned.chars().take(max - ext.chars().count()).collect();
    Ok(format!("{stem}{ext}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pack(meta: &str, file: &[u8]) -> Vec<u8> {
        let mut body = (meta.len() as u32).to_le_bytes().to_vec();
        body.extend_from_slice(meta.as_bytes());
        body.extend_from_slice(file);
        body
    }

    #[test]
    fn splits_metadata_and_file_bytes() {
        let meta = r#"{"fileName":"Café notes.pdf","documentType":"Other","title":"Notes","notes":"line1\nline2"}"#;
        let body = pack(meta, b"%PDF-1.7 data");
        let (parsed, bytes) = split_upload::<UploadMeta>(&body).unwrap();
        assert_eq!(parsed.file_name, "Café notes.pdf");
        assert_eq!(parsed.notes.as_deref(), Some("line1\nline2"));
        assert_eq!(bytes, b"%PDF-1.7 data");
    }

    #[test]
    fn rejects_truncated_body() {
        let mut body = pack(r#"{"fileName":"a.pdf","documentType":"x","title":"t"}"#, b"");
        body.truncate(10);
        assert!(split_upload::<UploadMeta>(&body).is_err());
        assert!(split_upload::<UploadMeta>(&[1, 2]).is_err());
    }

    #[test]
    fn sanitizes_file_names() {
        assert_eq!(sanitize_file_name("../../evil/Drug Study.pdf").unwrap(), "Drug Study.pdf");
        assert_eq!(sanitize_file_name("a<b>:c?.docx").unwrap(), "a_b__c_.docx");
        assert!(sanitize_file_name("...").is_err());
        let long = format!("{}.pdf", "x".repeat(300));
        let cleaned = sanitize_file_name(&long).unwrap();
        assert_eq!(cleaned.chars().count(), 120);
        assert!(cleaned.ends_with(".pdf"));
    }
}

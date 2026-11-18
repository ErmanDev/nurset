//! Uploaded files and one-time download links.
//!
//! Files are stored in PostgreSQL (`stored_files`), so the server needs no
//! persistent disk and files are part of the database's backups. Documents
//! and materials keep the file's key, e.g.
//! `documents/20261118093012123_drug-study.pdf`.
//!
//! "Open" and "export" commands don't return file contents. They return a
//! short-lived link (`/files/<ticket>`) that the desktop app opens in the
//! browser; the ticket is random, expires after a few minutes, and only works
//! for the file it was issued for.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use chrono::Local;
use serde::Serialize;
use sqlx::PgPool;

use crate::error::{AppError, AppResult};

const TICKET_TTL: Duration = Duration::from_secs(5 * 60);

/// Stores bytes and returns their key (`<folder>/<timestamp>_<name>`).
pub async fn save(pool: &PgPool, folder: &str, file_name: &str, bytes: &[u8]) -> AppResult<String> {
    let key = format!("{folder}/{}_{file_name}", Local::now().format("%Y%m%d%H%M%S%3f"));
    sqlx::query("INSERT INTO stored_files (key, data, size) VALUES ($1, $2, $3)")
        .bind(&key)
        .bind(bytes)
        .bind(bytes.len() as i64)
        .execute(pool)
        .await?;
    Ok(key)
}

/// Deletes a stored file (best effort).
pub async fn remove(pool: &PgPool, key: &str) {
    let _ = sqlx::query("DELETE FROM stored_files WHERE key = $1").bind(key).execute(pool).await;
}

/// A stored file's bytes, if it exists.
pub async fn read(pool: &PgPool, key: &str) -> AppResult<Option<Vec<u8>>> {
    Ok(sqlx::query_scalar("SELECT data FROM stored_files WHERE key = $1")
        .bind(key)
        .fetch_optional(pool)
        .await?)
}

/// The original file name: keys are `<folder>/<timestamp>_<name>`.
pub fn original_name(key: &str) -> String {
    let file = key.rsplit('/').next().unwrap_or(key);
    file.split_once('_').map(|(_, name)| name).unwrap_or(file).to_string()
}

// ---------- download tickets ----------

#[derive(Clone)]
pub enum Payload {
    /// A file in `stored_files`, by key.
    Stored(String),
    /// Generated content (e.g. a data export).
    Bytes(Vec<u8>),
}

struct Ticket {
    payload: Payload,
    file_name: String,
    /// Save instead of displaying (exports).
    attachment: bool,
    expires: Instant,
}

fn tickets() -> &'static Mutex<HashMap<String, Ticket>> {
    static TICKETS: OnceLock<Mutex<HashMap<String, Ticket>>> = OnceLock::new();
    TICKETS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn random_token() -> AppResult<String> {
    let mut buf = [0u8; 24];
    getrandom::getrandom(&mut buf).map_err(|e| AppError::new(e.to_string()))?;
    Ok(buf.iter().map(|b| format!("{b:02x}")).collect())
}

/// Link returned to the app; it prefixes the server address.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileLink {
    pub path: String,
}

fn issue(payload: Payload, file_name: String, attachment: bool) -> AppResult<FileLink> {
    let token = random_token()?;
    let mut map = tickets().lock().expect("tickets lock");
    let now = Instant::now();
    map.retain(|_, t| t.expires > now);
    map.insert(token.clone(), Ticket { payload, file_name, attachment, expires: now + TICKET_TTL });
    Ok(FileLink { path: format!("/files/{token}") })
}

/// A link that shows a stored file (opened in the browser or its viewer).
pub async fn link_to_file(pool: &PgPool, key: &str) -> AppResult<FileLink> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stored_files WHERE key = $1)")
        .bind(key)
        .fetch_one(pool)
        .await?;
    if !exists {
        return Err(AppError::new("This file isn't on the NurSet server. Please upload it again."));
    }
    issue(Payload::Stored(key.to_string()), original_name(key), false)
}

/// A link that downloads generated content (e.g. a data export).
pub fn link_to_bytes(bytes: Vec<u8>, file_name: String) -> AppResult<FileLink> {
    issue(Payload::Bytes(bytes), file_name, true)
}

/// Looks up a ticket (usable until it expires, so browsers can retry).
pub fn ticket(token: &str) -> Option<(Payload, String, bool)> {
    let map = tickets().lock().expect("tickets lock");
    let t = map.get(token).filter(|t| t.expires > Instant::now())?;
    Some((t.payload.clone(), t.file_name.clone(), t.attachment))
}

/// Content type from a file name.
pub fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("pdf") => "application/pdf",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("docx") => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Some("doc") => "application/msword",
        Some("pptx") => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        Some("ppt") => "application/vnd.ms-powerpoint",
        Some("json") => "application/json",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_and_types() {
        assert_eq!(original_name("documents/20261118093012123_drug study.pdf"), "drug study.pdf");
        assert_eq!(content_type("Scan.PNG"), "image/png");
        assert_eq!(content_type("notes.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
}

//! Tauri commands, one module per app page. Register new commands in `lib.rs`.

pub mod ai_study;
pub mod auth;
pub mod checklists;
pub mod instructor;
pub mod ci_notes;
pub mod dashboard;
pub mod documents;
pub mod duties;
pub mod duty_checklist;
pub mod events;
pub mod profile;
pub mod progress;
pub mod quick_links;
pub mod requirements;
pub mod settings;
pub mod tasks;

use chrono::{Local, NaiveDate, NaiveTime};

use crate::error::AppError;

/// Today's date in local time.
pub(crate) fn today() -> NaiveDate {
    Local::now().date_naive()
}

/// Format a date as `YYYY-MM-DD` (bound into SQL as `$n::date`).
pub(crate) fn iso(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

// ---------- input validation helpers ----------

/// Trimmed, non-empty text or a "<field> is required" error.
pub(crate) fn required_text(value: &str, field: &str) -> Result<String, AppError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(AppError::new(format!("{field} is required")));
    }
    Ok(value.to_string())
}

/// Trimmed text, with blank strings stored as NULL.
pub(crate) fn optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Validates `YYYY-MM-DD`.
pub(crate) fn valid_date(value: &str, field: &str) -> Result<String, AppError> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d")
        .map(iso)
        .map_err(|_| AppError::new(format!("{field} must be a valid date")))
}

/// Validates `HH:MM` (24-hour).
pub(crate) fn valid_time(value: &str, field: &str) -> Result<String, AppError> {
    NaiveTime::parse_from_str(value.trim(), "%H:%M")
        .map(|t| t.format("%H:%M").to_string())
        .map_err(|_| AppError::new(format!("{field} must be a valid time")))
}

/// "<thing> <id> not found" error.
pub(crate) fn not_found(thing: &str, id: i64) -> AppError {
    AppError::new(format!("{thing} {id} not found"))
}

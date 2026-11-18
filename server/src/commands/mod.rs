//! Tauri commands, one module per app page. Register new commands in `lib.rs`.

pub mod ai_study;
pub mod auth;
pub mod checklists;
pub mod ci_announcements;
pub mod ci_assignments;
pub mod ci_duty_day;
pub mod ci_instructions;
pub mod ci_reviews;
pub mod instructor;
pub mod notifications;
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

/// Error shown when a free account calls a Premium command.
pub(crate) const PREMIUM_REQUIRED: &str =
    "This is a NurSet Premium feature. Upgrade in Settings › Subscription & Billing to use it.";

/// Whether the user has Premium access: an active subscription, or a clinical
/// instructor (staff) account.
pub(crate) async fn is_premium(pool: &sqlx::PgPool, uid: i64) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = $1 AND status = 'active')
             OR EXISTS (SELECT 1 FROM users WHERE id = $1 AND account_type = 'clinical_instructor')",
    )
        .bind(uid)
        .fetch_one(pool)
        .await?)
}

/// The signed-in user's id, if they have Premium (AI Study, Learning Hub, ...).
pub(crate) async fn require_premium(db: &crate::db::Db) -> Result<i64, AppError> {
    let uid = db.user_id().await?;
    if !is_premium(&db.pool, uid).await? {
        return Err(AppError::new(PREMIUM_REQUIRED));
    }
    Ok(uid)
}

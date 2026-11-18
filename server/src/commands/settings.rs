//! Settings page: key/value preferences, profile (Account), data export,
//! account deletion, and the prototype Premium checkout.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{FromRow, PgPool};

use super::{optional_text, required_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, ts, Profile};

/// Settings derived from other tables; the frontend can read but not write them.
/// Appearance settings only Premium accounts can change.
pub(crate) const PREMIUM_KEYS: &[&str] = &["theme", "accent"];

const COMPUTED_KEYS: &[&str] = &["premium_plan", "premium_since", "premium_access"];

const PAYMENT_METHODS: &[&str] = &["gcash", "maya", "card", "bank", "other"];

/// Per-user data for the JSON export: (name, query with `$1` = user id).
const EXPORT_QUERIES: &[(&str, &str)] = &[
    ("profile", "SELECT id, email, full_name, display_name, role, university, student_id, year_level, created_at FROM users WHERE id = $1"),
    ("settings", "SELECT key, value FROM user_settings WHERE user_id = $1"),
    ("duties", "SELECT * FROM duties WHERE user_id = $1"),
    ("duty_readiness", "SELECT r.* FROM duty_readiness r JOIN duties d ON d.id = r.duty_id WHERE d.user_id = $1"),
    ("events", "SELECT * FROM events WHERE user_id = $1"),
    ("requirements", "SELECT * FROM requirements WHERE user_id = $1"),
    ("documents", "SELECT * FROM documents WHERE user_id = $1"),
    ("tasks", "SELECT * FROM tasks WHERE user_id = $1"),
    ("checklists", "SELECT * FROM checklists WHERE user_id = $1"),
    ("checklist_items", "SELECT i.* FROM checklist_items i JOIN checklists c ON c.id = i.checklist_id WHERE c.user_id = $1"),
    ("ci_notes", "SELECT * FROM ci_notes WHERE user_id = $1"),
    ("quizzes", "SELECT * FROM quizzes WHERE user_id = $1"),
    ("quiz_questions", "SELECT qq.* FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id WHERE q.user_id = $1"),
    ("chat_messages", "SELECT * FROM chat_messages WHERE user_id = $1"),
    ("study_activity", "SELECT * FROM study_activity WHERE user_id = $1"),
    ("materials", "SELECT * FROM materials WHERE owner_id = $1"),
    ("material_bookmarks", "SELECT * FROM material_bookmarks WHERE user_id = $1"),
    ("quick_links", "SELECT * FROM quick_links WHERE user_id = $1"),
    ("subscriptions", "SELECT * FROM subscriptions WHERE user_id = $1"),
    ("receipts", "SELECT * FROM receipts WHERE user_id = $1"),
];

// ---------- key/value settings ----------
pub async fn get_settings(db: &Db) -> AppResult<HashMap<String, String>> {
    // Signed out (e.g. on the sign-in screen): use the default appearance.
    let Some(uid) = db.current_user() else { return Ok(HashMap::new()) };
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM user_settings WHERE user_id = $1")
        .bind(uid)
        .fetch_all(&db.pool)
        .await?;
    let mut map: HashMap<String, String> = rows.into_iter().collect();

    // Premium status comes from the subscriptions table.
    let active: Option<(String, String)> = sqlx::query_as(concat!(
        "SELECT plan, ", date!("started_at::date"), " FROM subscriptions WHERE user_id = $1 AND status = 'active'"
    ))
    .bind(uid)
    .fetch_optional(&db.pool)
    .await?;
    if let Some((plan, since)) = active {
        map.insert("premium_plan".into(), plan);
        map.insert("premium_since".into(), since);
    }
    if super::is_premium(&db.pool, uid).await? {
        // Subscribers, and clinical instructors (staff accounts).
        map.insert("premium_access".into(), "1".into());
    } else {
        // Theme and accent are Premium: free accounts get the default look,
        // including after a subscription is cancelled.
        for key in PREMIUM_KEYS {
            map.remove(*key);
        }
    }
    Ok(map)
}

/// Upserts several settings at once.
pub async fn set_settings(db: &Db, values: HashMap<String, String>) -> AppResult<()> {
    for (key, value) in &values {
        if key.is_empty() || key.len() > 64 || COMPUTED_KEYS.contains(&key.as_str()) {
            return Err(AppError::new(format!("Setting \"{key}\" can't be changed")));
        }
        if value.len() > 4000 {
            return Err(AppError::new(format!("Value for \"{key}\" is too long")));
        }
    }
    let uid = db.user_id().await?;
    if values.keys().any(|k| PREMIUM_KEYS.contains(&k.as_str())) && !super::is_premium(&db.pool, uid).await? {
        return Err(AppError::new(super::PREMIUM_REQUIRED));
    }
    let mut tx = db.pool.begin().await?;
    for (key, value) in values {
        sqlx::query(
            "INSERT INTO user_settings (user_id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(uid)
        .bind(key)
        .bind(value)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Reads one numeric setting, falling back to `default`.
pub(crate) async fn setting_i64(pool: &PgPool, uid: i64, key: &str, default: i64) -> i64 {
    sqlx::query_scalar::<_, String>("SELECT value FROM user_settings WHERE user_id = $1 AND key = $2")
        .bind(uid)
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

// ---------- profile ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub full_name: String,
    pub display_name: String,
    pub email: Option<String>,
    pub university: Option<String>,
    pub student_id: Option<String>,
    pub year_level: Option<String>,
}

async fn get_profile(pool: &PgPool, uid: i64) -> AppResult<Profile> {
    Ok(sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(uid)
        .fetch_one(pool)
        .await?)
}
pub async fn update_profile(db: &Db, input: ProfileInput) -> AppResult<Profile> {
    let full_name = required_text(&input.full_name, "Full name")?;
    let display_name = required_text(&input.display_name, "Display name")?;
    let email = optional_text(input.email).ok_or_else(|| AppError::new("Email address is required"))?;
    let valid = email.split_once('@').is_some_and(|(user, domain)| !user.is_empty() && domain.contains('.'));
    if !valid {
        return Err(AppError::new("Enter a valid email address"));
    }
    let uid = db.user_id().await?;
    let result = sqlx::query(
        "UPDATE users SET full_name = $2, display_name = $3, email = $4, university = $5,
             student_id = $6, year_level = $7
         WHERE id = $1",
    )
    .bind(uid)
    .bind(full_name)
    .bind(display_name)
    .bind(email)
    .bind(optional_text(input.university))
    .bind(optional_text(input.student_id))
    .bind(optional_text(input.year_level))
    .execute(&db.pool)
    .await;
    if let Err(sqlx::Error::Database(e)) = &result {
        if e.is_unique_violation() {
            return Err(AppError::new("That email address is already used by another account"));
        }
    }
    result?;
    get_profile(&db.pool, uid).await
}

/// Sets (or clears) the profile picture. The frontend resizes it first.
pub async fn set_avatar(db: &Db, data: Option<String>) -> AppResult<Profile> {
    if let Some(d) = &data {
        let ok_type = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"]
            .iter()
            .any(|prefix| d.starts_with(prefix));
        if !ok_type {
            return Err(AppError::new("Profile picture must be a PNG, JPEG, or WebP image"));
        }
        if d.len() > 700_000 {
            return Err(AppError::new("Profile picture is too large"));
        }
    }
    let uid = db.user_id().await?;
    sqlx::query("UPDATE users SET avatar_url = $2 WHERE id = $1")
        .bind(uid)
        .bind(data)
        .execute(&db.pool)
        .await?;
    get_profile(&db.pool, uid).await
}

// ---------- data export / account deletion ----------

/// All of the user's data as JSON (table name -> rows).
pub(crate) async fn export_json(pool: &PgPool, uid: i64) -> AppResult<Value> {
    let mut tables = Map::new();
    for (name, query) in EXPORT_QUERIES {
        let json: String =
            sqlx::query_scalar(&format!("SELECT COALESCE(json_agg(t), '[]'::json)::text FROM ({query}) t"))
                .bind(uid)
                .fetch_one(pool)
                .await?;
        tables.insert(name.to_string(), serde_json::from_str(&json)?);
    }
    Ok(serde_json::json!({
        "app": "NurSet",
        "exportedAt": Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        "tables": tables,
    }))
}

/// All of the user's data as a downloadable JSON file (one-time link).
pub async fn export_data(db: &Db) -> AppResult<crate::files::FileLink> {
    let uid = db.user_id().await?;
    let export = export_json(&db.pool, uid).await?;
    let name = format!("NurSet-export-{}.json", Local::now().format("%Y%m%d-%H%M%S"));
    crate::files::link_to_bytes(serde_json::to_vec_pretty(&export)?, name)
}

/// Permanently deletes the user (all their rows cascade) and their uploaded
/// files. `confirm` must be "DELETE".
pub async fn reset_all_data(db: &Db, confirm: String) -> AppResult<()> {
    if confirm != "DELETE" {
        return Err(AppError::new("Type DELETE to confirm"));
    }
    let uid = db.user_id().await?;
    let files: Vec<String> = sqlx::query_scalar(
        "SELECT storage_key FROM documents WHERE user_id = $1 AND storage_key IS NOT NULL
         UNION ALL SELECT storage_key FROM materials WHERE owner_id = $1 AND storage_key IS NOT NULL",
    )
    .bind(uid)
    .fetch_all(&db.pool)
    .await?;
    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&db.pool).await?;
    db.forget_user();
    for key in files {
        crate::files::remove(&db.pool, &key).await;
    }
    Ok(())
}

// ---------- prototype premium ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub id: i64,
    pub plan: String,
    pub amount_cents: i32,
    pub method: String,
    pub reference: String,
    pub created_at: String,
}

const RECEIPT_SELECT: &str = concat!(
    "SELECT r.id, r.plan, r.amount_cents, r.method, r.reference, ",
    ts!("r.created_at"), " AS created_at FROM receipts r"
);
pub async fn list_receipts(db: &Db) -> AppResult<Vec<Receipt>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, Receipt>(&format!("{RECEIPT_SELECT} WHERE r.user_id = $1 ORDER BY r.id DESC"))
        .bind(uid)
        .fetch_all(&db.pool)
        .await?)
}

/// Prototype only: records a fictional receipt and starts a subscription.
/// No payment is processed and no payment details are received or stored.
pub async fn activate_premium(db: &Db, plan: String, method: String) -> AppResult<Receipt> {
    let amount: i32 = match plan.as_str() {
        "monthly" => 14_900,
        "yearly" => 129_900,
        _ => return Err(AppError::new("Unknown plan")),
    };
    if !PAYMENT_METHODS.contains(&method.as_str()) {
        return Err(AppError::new("Unknown payment method"));
    }
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let reference = format!("PROTO-{:06X}", nanos % 0xFF_FFFF);
    let uid = db.user_id().await?;

    let mut tx = db.pool.begin().await?;
    sqlx::query(
        "UPDATE subscriptions SET status = 'canceled', canceled_at = now() WHERE user_id = $1 AND status = 'active'",
    )
    .bind(uid)
    .execute(&mut *tx)
    .await?;
    let subscription_id: i64 =
        sqlx::query_scalar("INSERT INTO subscriptions (user_id, plan) VALUES ($1, $2) RETURNING id")
            .bind(uid)
            .bind(&plan)
            .fetch_one(&mut *tx)
            .await?;
    let receipt_id: i64 = sqlx::query_scalar(
        "INSERT INTO receipts (user_id, subscription_id, plan, amount_cents, method, reference)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(uid)
    .bind(subscription_id)
    .bind(&plan)
    .bind(amount)
    .bind(&method)
    .bind(&reference)
    .fetch_one(&mut *tx)
    .await?;
    let receipt = sqlx::query_as::<_, Receipt>(&format!("{RECEIPT_SELECT} WHERE r.id = $1"))
        .bind(receipt_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(receipt)
}
pub async fn cancel_premium(db: &Db) -> AppResult<()> {
    let uid = db.user_id().await?;
    sqlx::query(
        "UPDATE subscriptions SET status = 'canceled', canceled_at = now() WHERE user_id = $1 AND status = 'active'",
    )
    .bind(uid)
    .execute(&db.pool)
    .await?;
    Ok(())
}

//! Quick Links: study materials (Learning Hub, Upload Materials, Student
//! Handbook), announcements, and the "Your Nursing Journey" study stats.

use std::collections::HashSet;
use std::path::Path;

use chrono::{NaiveDate, TimeDelta};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use super::ai_study::log_activity;
use super::documents::{sanitize_file_name, split_upload};
use super::settings::setting_i64;
use super::{iso, not_found, optional_text, required_text, today};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, ts, QuickLink};

const MAX_MATERIAL_BYTES: usize = 20 * 1024 * 1024;
const MATERIAL_EXTENSIONS: &[&str] = &["pdf", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png"];
const KINDS: &[&str] = &["pdf_notes", "presentation", "reviewer", "handbook"];
/// Default study sessions per day for "Today's Study Goal" (Settings › Study Preferences).
const DEFAULT_DAILY_GOAL: i64 = 3;

// ---------- models ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Material {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    /// "pdf_notes" | "presentation" | "reviewer" | "handbook"
    pub kind: String,
    pub file_name: Option<String>,
    pub has_file: bool,
    pub file_size: Option<i64>,
    pub page_count: Option<i32>,
    pub tone: String,
    pub is_sample: bool,
    pub is_mine: bool,
    pub bookmarked: bool,
    pub created_at: String,
}

/// `$1` must be the current user id (for is_mine / bookmarked).
const MATERIAL_SELECT: &str = concat!(
    "SELECT m.id, m.title, m.description, m.kind, m.file_name, m.storage_key IS NOT NULL AS has_file, ",
    "m.file_size, m.page_count, m.tone, m.is_sample, m.owner_id IS NOT DISTINCT FROM $1 AS is_mine, ",
    "EXISTS (SELECT 1 FROM material_bookmarks b WHERE b.material_id = m.id AND b.user_id = $1) AS bookmarked, ",
    ts!("m.created_at"), " AS created_at FROM materials m"
);

/// Materials the user can see: the shared library, their own, and classmates' shared ones.
const VISIBLE: &str = "(m.owner_id IS NULL OR m.owner_id = $1 OR m.is_shared)";

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Announcement {
    pub id: i64,
    /// "important" | "academic" | "reminder"
    pub category: String,
    pub title: String,
    pub body: String,
    pub posted_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyJourney {
    pub sessions_today: i64,
    pub daily_goal: i64,
    /// Consecutive days with study activity, ending today (or yesterday).
    pub streak_days: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MaterialUploadMeta {
    file_name: String,
    title: String,
    kind: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialDetails {
    pub title: String,
    pub kind: String,
    pub description: Option<String>,
}

// ---------- helpers ----------

async fn get_material(pool: &PgPool, uid: i64, id: i64) -> AppResult<Material> {
    sqlx::query_as::<_, Material>(&format!("{MATERIAL_SELECT} WHERE m.id = $2 AND {VISIBLE}"))
        .bind(uid)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| not_found("Material", id))
}

fn check_kind(kind: &str) -> AppResult<()> {
    if KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::new(format!("Unknown material type: {kind}")))
    }
}

fn tone_for(kind: &str) -> &'static str {
    match kind {
        "presentation" => "purple",
        "reviewer" => "pink",
        "handbook" => "blue",
        _ => "green",
    }
}

/// Consecutive days in `days` ending today, or ending yesterday if nothing today yet.
fn streak(days: &HashSet<NaiveDate>, today: NaiveDate) -> i64 {
    let mut day = if days.contains(&today) { today } else { today - TimeDelta::days(1) };
    let mut count = 0;
    while days.contains(&day) {
        count += 1;
        day -= TimeDelta::days(1);
    }
    count
}

// ---------- commands ----------

/// Learning Hub library (everything except handbooks), newest first.
pub async fn list_materials(db: &Db) -> AppResult<Vec<Material>> {
    let uid = super::require_premium(&db).await?; // Premium only
    Ok(sqlx::query_as::<_, Material>(&format!(
        "{MATERIAL_SELECT} WHERE m.kind <> 'handbook' AND {VISIBLE} ORDER BY m.created_at DESC, m.id DESC"
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

/// Saves a study material (or the handbook) under `<upload dir>/materials/`.
/// Body format matches `upload_document`; see `documents::split_upload`.
pub async fn upload_material(db: &Db, body: &[u8]) -> AppResult<Material> {
    super::require_premium(&db).await?; // Premium only
    let (meta, bytes) = split_upload::<MaterialUploadMeta>(body)?;
    let title = required_text(&meta.title, "Title")?;
    check_kind(&meta.kind)?;
    let file_name = sanitize_file_name(&meta.file_name)?;
    let extension = Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !MATERIAL_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::new("Unsupported file type. Use PDF, DOCX, PPTX, JPG, or PNG."));
    }
    if bytes.is_empty() {
        return Err(AppError::new("The selected file is empty"));
    }
    if bytes.len() > MAX_MATERIAL_BYTES {
        return Err(AppError::new("File is larger than 20 MB"));
    }
    let uid = db.user_id().await?;

    let key = crate::files::save(&db.pool, "materials", &file_name, bytes).await?;

    let result: AppResult<(i64, Option<String>)> = async {
        let mut tx = db.pool.begin().await?;
        // Only one handbook per user: replace the previous one.
        let mut old_file = None;
        if meta.kind == "handbook" {
            old_file = sqlx::query_scalar::<_, Option<String>>(
                "DELETE FROM materials WHERE owner_id = $1 AND kind = 'handbook' RETURNING storage_key",
            )
            .bind(uid)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();
        }
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO materials (owner_id, title, description, kind, file_name, storage_key, file_size, tone)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        )
        .bind(uid)
        .bind(&title)
        .bind(optional_text(meta.description.clone()))
        .bind(&meta.kind)
        .bind(&file_name)
        .bind(&key)
        .bind(bytes.len() as i64)
        .bind(tone_for(&meta.kind))
        .fetch_one(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok((id, old_file))
    }
    .await;

    match result {
        Ok((id, old_file)) => {
            if let Some(old) = old_file {
                crate::files::remove(&db.pool, &old).await;
            }
            get_material(&db.pool, uid, id).await
        }
        Err(err) => {
            crate::files::remove(&db.pool, &key).await; // don't leave orphaned files behind
            Err(err)
        }
    }
}
pub async fn update_material(db: &Db, id: i64, input: MaterialDetails) -> AppResult<Material> {
    super::require_premium(&db).await?; // Premium only
    let title = required_text(&input.title, "Title")?;
    check_kind(&input.kind)?;
    let uid = db.user_id().await?;
    let changed = sqlx::query(
        "UPDATE materials SET title = $3, kind = $4, description = $5, tone = $6 WHERE id = $1 AND owner_id = $2",
    )
    .bind(id)
    .bind(uid)
    .bind(title)
    .bind(&input.kind)
    .bind(optional_text(input.description))
    .bind(tone_for(&input.kind))
    .execute(&db.pool)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(AppError::new("Only your own uploads can be edited"));
    }
    get_material(&db.pool, uid, id).await
}

/// Deletes one of your uploads and its stored file.
pub async fn delete_material(db: &Db, id: i64) -> AppResult<()> {
    let uid = super::require_premium(&db).await?; // Premium only
    let deleted: Option<Option<String>> =
        sqlx::query_scalar("DELETE FROM materials WHERE id = $1 AND owner_id = $2 RETURNING storage_key")
            .bind(id)
            .bind(uid)
            .fetch_optional(&db.pool)
            .await?;
    match deleted {
        None => Err(AppError::new("Only your own uploads can be deleted")),
        Some(key) => {
            if let Some(key) = key {
                crate::files::remove(&db.pool, &key).await;
            }
            Ok(())
        }
    }
}
pub async fn set_material_bookmark(db: &Db, id: i64, bookmarked: bool) -> AppResult<Material> {
    let uid = super::require_premium(&db).await?; // Premium only
    get_material(&db.pool, uid, id).await?; // must be visible to this user
    if bookmarked {
        sqlx::query("INSERT INTO material_bookmarks (user_id, material_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(uid)
            .bind(id)
            .execute(&db.pool)
            .await?;
    } else {
        sqlx::query("DELETE FROM material_bookmarks WHERE user_id = $1 AND material_id = $2")
            .bind(uid)
            .bind(id)
            .execute(&db.pool)
            .await?;
    }
    get_material(&db.pool, uid, id).await
}

/// A one-time link to the material's file; records a study session.
pub async fn open_material(db: &Db, id: i64) -> AppResult<crate::files::FileLink> {
    let uid = super::require_premium(&db).await?; // Premium only
    let (title, path): (String, Option<String>) =
        sqlx::query_as(&format!("SELECT m.title, m.storage_key FROM materials m WHERE m.id = $2 AND {VISIBLE}"))
            .bind(uid)
            .bind(id)
            .fetch_optional(&db.pool)
            .await?
            .ok_or_else(|| not_found("Material", id))?;
    let key = path.ok_or_else(|| AppError::new("This sample resource doesn't have a file attached yet"))?;
    let link = crate::files::link_to_file(&db.pool, &key).await?;
    let mut conn = db.pool.acquire().await?;
    log_activity(&mut conn, uid, &format!("{title} Review"), "Opened from Learning Hub", "review", "/quick-links/learning-hub")
        .await?;
    Ok(link)
}
pub async fn get_handbook(db: &Db) -> AppResult<Option<Material>> {
    let uid = super::require_premium(&db).await?; // Premium only
    Ok(sqlx::query_as::<_, Material>(&format!(
        "{MATERIAL_SELECT} WHERE m.owner_id = $1 AND m.kind = 'handbook' LIMIT 1"
    ))
    .bind(uid)
    .fetch_optional(&db.pool)
    .await?)
}
pub async fn list_announcements(db: &Db) -> AppResult<Vec<Announcement>> {
    let uid = db.user_id().await?;
    // School-wide posts, plus posts from the student's instructors to their
    // group (or to all of that instructor's groups).
    Ok(sqlx::query_as::<_, Announcement>(concat!(
        "SELECT a.id, a.category, a.title, a.body, ", date!("a.posted_at"), " AS posted_at
         FROM announcements a
         WHERE a.author_id IS NULL
            OR a.author_id = $1
            OR a.group_id IN (SELECT group_id FROM group_members WHERE student_id = $1)
            OR (a.group_id IS NULL AND a.author_id IN (
                SELECT g.instructor_id FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id
                WHERE gm.student_id = $1))
         ORDER BY a.posted_at DESC, a.id DESC"
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

/// Study sessions = study activity entries (chats, quizzes created, materials
/// opened) plus distinct quizzes answered, per day.
pub async fn get_study_journey(db: &Db) -> AppResult<StudyJourney> {
    let uid = super::require_premium(&db).await?; // Premium only
    let today_date = today();
    let sessions_today: i64 = sqlx::query_scalar(
        "SELECT (SELECT COUNT(*) FROM study_activity WHERE user_id = $1 AND created_at::date = $2::date)
              + (SELECT COUNT(DISTINCT qq.quiz_id) FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id
                 WHERE q.user_id = $1 AND qq.answered_at::date = $2::date)",
    )
    .bind(uid)
    .bind(iso(today_date))
    .fetch_one(&db.pool)
    .await?;
    let days: Vec<String> = sqlx::query_scalar(
        "SELECT to_char(created_at::date, 'YYYY-MM-DD') FROM study_activity WHERE user_id = $1
         UNION
         SELECT to_char(qq.answered_at::date, 'YYYY-MM-DD') FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id
         WHERE q.user_id = $1 AND qq.answered_at IS NOT NULL",
    )
    .bind(uid)
    .fetch_all(&db.pool)
    .await?;
    let days: HashSet<NaiveDate> = days
        .iter()
        .filter_map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .collect();
    let goal = setting_i64(&db.pool, uid, "study_daily_goal", DEFAULT_DAILY_GOAL).await.clamp(1, 20);
    Ok(StudyJourney {
        sessions_today,
        daily_goal: goal,
        streak_days: streak(&days, today_date),
    })
}
pub async fn list_quick_links(db: &Db) -> AppResult<Vec<QuickLink>> {
    let uid = super::require_premium(&db).await?; // Premium only
    Ok(sqlx::query_as::<_, QuickLink>(&format!("{} WHERE q.user_id = $1 ORDER BY q.position", QuickLink::SELECT))
        .bind(uid)
        .fetch_all(&db.pool)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn streak_counts_back_from_today_or_yesterday() {
        let today = d("2026-11-17");
        let days: HashSet<_> = ["2026-11-17", "2026-11-16", "2026-11-15", "2026-11-13"].map(d).into();
        assert_eq!(streak(&days, today), 3);
        let no_today: HashSet<_> = ["2026-11-16", "2026-11-15"].map(d).into();
        assert_eq!(streak(&no_today, today), 2);
        assert_eq!(streak(&HashSet::new(), today), 0);
    }
}

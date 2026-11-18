use serde::Deserialize;
use sqlx::PgPool;

use super::{not_found, optional_text, required_text, valid_date};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::CiNote;

/// Input for `add_ci_note` and `update_ci_note`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CiNoteInput {
    pub title: String,
    pub content: String,
    pub clinical_instructor: Option<String>,
    pub clinical_area: Option<String>,
    /// `YYYY-MM-DD`
    pub note_date: String,
    pub is_important: bool,
    pub duty_id: Option<i64>,
}

struct Valid {
    title: String,
    content: String,
    instructor: Option<String>,
    area: Option<String>,
    date: String,
}

impl CiNoteInput {
    fn validate(&self) -> AppResult<Valid> {
        Ok(Valid {
            title: required_text(&self.title, "Note title")?,
            content: required_text(&self.content, "Note / instruction")?,
            instructor: optional_text(self.clinical_instructor.clone()),
            area: optional_text(self.clinical_area.clone()),
            date: valid_date(&self.note_date, "Date")?,
        })
    }
}

async fn get_note(pool: &PgPool, uid: i64, id: i64) -> AppResult<CiNote> {
    sqlx::query_as::<_, CiNote>(&format!("{} WHERE n.id = $1 AND n.user_id = $2", CiNote::SELECT))
        .bind(id)
        .bind(uid)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| not_found("Note", id))
}

/// All notes, newest instruction first.
pub async fn list_ci_notes(db: &Db) -> AppResult<Vec<CiNote>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, CiNote>(&format!(
        "{} WHERE n.user_id = $1 ORDER BY n.note_date DESC, n.created_at DESC, n.id DESC",
        CiNote::SELECT
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}
pub async fn add_ci_note(db: &Db, input: CiNoteInput) -> AppResult<CiNote> {
    let v = input.validate()?;
    let uid = db.user_id().await?;
    // The (user_id, duty_id) foreign key rejects another user's duty.
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO ci_notes
            (user_id, title, content, clinical_instructor, clinical_area, note_date, is_important, duty_id)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8) RETURNING id",
    )
    .bind(uid)
    .bind(v.title)
    .bind(v.content)
    .bind(v.instructor)
    .bind(v.area)
    .bind(v.date)
    .bind(input.is_important)
    .bind(input.duty_id)
    .fetch_one(&db.pool)
    .await?;
    get_note(&db.pool, uid, id).await
}

/// Replaces a note's details. Pinned state is left unchanged.
pub async fn update_ci_note(db: &Db, id: i64, input: CiNoteInput) -> AppResult<CiNote> {
    let v = input.validate()?;
    let uid = db.user_id().await?;
    let changed = sqlx::query(
        "UPDATE ci_notes SET title = $3, content = $4, clinical_instructor = $5, clinical_area = $6,
             note_date = $7::date, is_important = $8, duty_id = $9
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(uid)
    .bind(v.title)
    .bind(v.content)
    .bind(v.instructor)
    .bind(v.area)
    .bind(v.date)
    .bind(input.is_important)
    .bind(input.duty_id)
    .execute(&db.pool)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(not_found("Note", id));
    }
    get_note(&db.pool, uid, id).await
}
pub async fn set_ci_note_pinned(db: &Db, id: i64, pinned: bool) -> AppResult<CiNote> {
    let uid = db.user_id().await?;
    let changed = sqlx::query("UPDATE ci_notes SET is_pinned = $3 WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(uid)
        .bind(pinned)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if changed == 0 {
        return Err(not_found("Note", id));
    }
    get_note(&db.pool, uid, id).await
}
pub async fn delete_ci_note(db: &Db, id: i64) -> AppResult<()> {
    let uid = db.user_id().await?;
    let deleted = sqlx::query("DELETE FROM ci_notes WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(uid)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Note", id));
    }
    Ok(())
}

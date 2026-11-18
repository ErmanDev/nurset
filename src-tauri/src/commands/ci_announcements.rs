//! Instructor: announcements to their groups.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::State;

use super::instructor::{check_group, instructor_id};
use super::{not_found, required_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::date;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CiAnnouncement {
    pub id: i64,
    /// "important" | "academic" | "reminder"
    pub category: String,
    pub title: String,
    pub body: String,
    pub posted_at: String,
    pub group_id: Option<i64>,
    /// Group name, or "All my groups".
    pub audience: String,
}

const SELECT: &str = concat!(
    "SELECT a.id, a.category, a.title, a.body, ", date!("a.posted_at"), " AS posted_at, a.group_id,
        COALESCE(g.name, 'All my groups') AS audience
     FROM announcements a LEFT JOIN clinical_groups g ON g.id = a.group_id"
);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnouncementInput {
    pub category: String,
    pub title: String,
    pub body: String,
    /// None = all of the instructor's groups.
    pub group_id: Option<i64>,
}

#[tauri::command]
pub async fn list_ci_announcements(db: State<'_, Db>) -> AppResult<Vec<CiAnnouncement>> {
    let ci = instructor_id(&db).await?;
    Ok(sqlx::query_as::<_, CiAnnouncement>(&format!(
        "{SELECT} WHERE a.author_id = $1 ORDER BY a.posted_at DESC, a.id DESC"
    ))
    .bind(ci)
    .fetch_all(&db.pool)
    .await?)
}

#[tauri::command]
pub async fn create_announcement(db: State<'_, Db>, input: AnnouncementInput) -> AppResult<CiAnnouncement> {
    if !matches!(input.category.as_str(), "important" | "academic" | "reminder") {
        return Err(AppError::new(format!("Unknown category: {}", input.category)));
    }
    let title = required_text(&input.title, "Title")?;
    let body = required_text(&input.body, "Message")?;
    let ci = instructor_id(&db).await?;
    if let Some(g) = input.group_id {
        check_group(&db.pool, ci, g).await?;
    }
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO announcements (category, title, body, author_id, group_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(&input.category)
    .bind(title)
    .bind(body)
    .bind(ci)
    .bind(input.group_id)
    .fetch_one(&db.pool)
    .await?;
    Ok(sqlx::query_as::<_, CiAnnouncement>(&format!("{SELECT} WHERE a.id = $1"))
        .bind(id)
        .fetch_one(&db.pool)
        .await?)
}

#[tauri::command]
pub async fn delete_announcement(db: State<'_, Db>, id: i64) -> AppResult<()> {
    let ci = instructor_id(&db).await?;
    let deleted = sqlx::query("DELETE FROM announcements WHERE id = $1 AND author_id = $2")
        .bind(id)
        .bind(ci)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Announcement", id));
    }
    Ok(())
}

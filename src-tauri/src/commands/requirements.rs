use serde::Deserialize;
use tauri::State;

use super::{optional_text, required_text, valid_date};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::Requirement;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRequirement {
    pub title: String,
    /// `YYYY-MM-DD`
    pub due_date: String,
    pub description: Option<String>,
}

#[tauri::command]
pub async fn list_requirements(db: State<'_, Db>) -> AppResult<Vec<Requirement>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, Requirement>(&format!(
        "{} WHERE r.user_id = $1 ORDER BY r.due_date",
        Requirement::SELECT
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

#[tauri::command]
pub async fn add_requirement(db: State<'_, Db>, input: NewRequirement) -> AppResult<Requirement> {
    let title = required_text(&input.title, "Requirement title")?;
    let due_date = valid_date(&input.due_date, "Due date")?;
    let uid = db.user_id().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO requirements (user_id, title, description, due_date)
         VALUES ($1, $2, $3, $4::date) RETURNING id",
    )
    .bind(uid)
    .bind(title)
    .bind(optional_text(input.description))
    .bind(due_date)
    .fetch_one(&db.pool)
    .await?;
    Ok(sqlx::query_as::<_, Requirement>(&format!("{} WHERE r.id = $1", Requirement::SELECT))
        .bind(id)
        .fetch_one(&db.pool)
        .await?)
}

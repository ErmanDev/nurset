use serde::Deserialize;
use tauri::State;

use super::{optional_text, required_text, valid_date, valid_time};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::Event;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewEvent {
    pub title: String,
    pub event_type: String,
    pub event_date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub location: Option<String>,
    pub description: Option<String>,
}

#[tauri::command]
pub async fn list_events(db: State<'_, Db>) -> AppResult<Vec<Event>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, Event>(&format!(
        "{} WHERE e.user_id = $1 ORDER BY e.event_date, e.start_time NULLS LAST",
        Event::SELECT
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

#[tauri::command]
pub async fn add_event(db: State<'_, Db>, input: NewEvent) -> AppResult<Event> {
    let title = required_text(&input.title, "Title")?;
    if !matches!(input.event_type.as_str(), "exam" | "other") {
        return Err(AppError::new(format!("Unknown event type: {}", input.event_type)));
    }
    let date = valid_date(&input.event_date, "Date")?;
    let start = optional_text(input.start_time).map(|t| valid_time(&t, "Start time")).transpose()?;
    let end = optional_text(input.end_time).map(|t| valid_time(&t, "End time")).transpose()?;
    let uid = db.user_id().await?;

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO events
            (user_id, title, event_type, event_date, start_time, end_time, location, description)
         VALUES ($1, $2, $3, $4::date, $5::time, $6::time, $7, $8) RETURNING id",
    )
    .bind(uid)
    .bind(title)
    .bind(input.event_type)
    .bind(date)
    .bind(start)
    .bind(end)
    .bind(optional_text(input.location))
    .bind(optional_text(input.description))
    .fetch_one(&db.pool)
    .await?;
    Ok(sqlx::query_as::<_, Event>(&format!("{} WHERE e.id = $1", Event::SELECT))
        .bind(id)
        .fetch_one(&db.pool)
        .await?)
}

use serde::Deserialize;
use sqlx::PgPool;

use super::{iso, not_found, optional_text, required_text, today, valid_date, valid_time};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::Task;

/// Input for `add_task` and `update_task`. Only `title` is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub category: Option<String>,
    pub duration_minutes: Option<i32>,
    /// `YYYY-MM-DD`; defaults to today.
    pub due_date: Option<String>,
    /// `HH:MM`
    pub due_time: Option<String>,
    /// "high" | "medium" | "low"; defaults to medium.
    pub priority: Option<String>,
    pub subject: Option<String>,
    pub notes: Option<String>,
}

/// Validated, normalized column values.
struct TaskRow {
    title: String,
    category: String,
    duration_minutes: Option<i32>,
    due_date: String,
    due_time: Option<String>,
    priority: String,
    subject: Option<String>,
    notes: Option<String>,
}

impl TaskInput {
    fn validate(self) -> AppResult<TaskRow> {
        let priority = self.priority.unwrap_or_else(|| "medium".into());
        if !matches!(priority.as_str(), "high" | "medium" | "low") {
            return Err(AppError::new(format!("Unknown priority: {priority}")));
        }
        if matches!(self.duration_minutes, Some(m) if m <= 0) {
            return Err(AppError::new("Estimated time must be more than 0 minutes"));
        }
        Ok(TaskRow {
            title: required_text(&self.title, "Task title")?,
            category: optional_text(self.category).unwrap_or_else(|| "Study".into()),
            duration_minutes: self.duration_minutes,
            due_date: match optional_text(self.due_date) {
                Some(d) => valid_date(&d, "Due date")?,
                None => iso(today()),
            },
            due_time: optional_text(self.due_time).map(|t| valid_time(&t, "Due time")).transpose()?,
            priority,
            subject: optional_text(self.subject),
            notes: optional_text(self.notes),
        })
    }
}

async fn get_task(pool: &PgPool, uid: i64, id: i64) -> AppResult<Task> {
    sqlx::query_as::<_, Task>(&format!("{} WHERE t.id = $1 AND t.user_id = $2", Task::SELECT))
        .bind(id)
        .bind(uid)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| not_found("Task", id))
}

/// All tasks, or only those due on `date` (`YYYY-MM-DD`).
pub async fn list_tasks(db: &Db, date: Option<String>) -> AppResult<Vec<Task>> {
    let uid = db.user_id().await?;
    let date = date.map(|d| valid_date(&d, "Date")).transpose()?;
    Ok(sqlx::query_as::<_, Task>(&format!(
        "{} WHERE t.user_id = $1 AND ($2::date IS NULL OR t.due_date = $2::date)
         ORDER BY t.due_date, t.due_time NULLS LAST, t.id",
        Task::SELECT
    ))
    .bind(uid)
    .bind(date)
    .fetch_all(&db.pool)
    .await?)
}
pub async fn add_task(db: &Db, input: TaskInput) -> AppResult<Task> {
    let t = input.validate()?;
    let uid = db.user_id().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO tasks
            (user_id, title, category, duration_minutes, due_date, due_time, priority, subject, notes)
         VALUES ($1, $2, $3, $4, $5::date, $6::time, $7, $8, $9) RETURNING id",
    )
    .bind(uid)
    .bind(t.title)
    .bind(t.category)
    .bind(t.duration_minutes)
    .bind(t.due_date)
    .bind(t.due_time)
    .bind(t.priority)
    .bind(t.subject)
    .bind(t.notes)
    .fetch_one(&db.pool)
    .await?;
    get_task(&db.pool, uid, id).await
}

/// Replaces a task's details. Completion state is left unchanged.
pub async fn update_task(db: &Db, id: i64, input: TaskInput) -> AppResult<Task> {
    let t = input.validate()?;
    let uid = db.user_id().await?;
    let changed = sqlx::query(
        "UPDATE tasks SET title = $3, category = $4, duration_minutes = $5, due_date = $6::date,
             due_time = $7::time, priority = $8, subject = $9, notes = $10
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(uid)
    .bind(t.title)
    .bind(t.category)
    .bind(t.duration_minutes)
    .bind(t.due_date)
    .bind(t.due_time)
    .bind(t.priority)
    .bind(t.subject)
    .bind(t.notes)
    .execute(&db.pool)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(not_found("Task", id));
    }
    get_task(&db.pool, uid, id).await
}
pub async fn delete_task(db: &Db, id: i64) -> AppResult<()> {
    let uid = db.user_id().await?;
    let deleted = sqlx::query("DELETE FROM tasks WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(uid)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Task", id));
    }
    Ok(())
}
pub async fn toggle_task(db: &Db, id: i64, completed: bool) -> AppResult<Task> {
    let uid = db.user_id().await?;
    let changed = sqlx::query(
        "UPDATE tasks SET completed = $3, completed_at = CASE WHEN $3 THEN now() END
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(uid)
    .bind(completed)
    .execute(&db.pool)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(not_found("Task", id));
    }
    get_task(&db.pool, uid, id).await
}

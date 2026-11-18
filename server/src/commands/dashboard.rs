use chrono::{Datelike, TimeDelta};
use serde::Serialize;
use sqlx::FromRow;

use super::{iso, today};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::{ChecklistSummary, CiNote, Duty, Profile, Requirement, Task};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyProgress {
    pub completed: i64,
    pub pending: i64,
    pub overdue: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub profile: Option<Profile>,
    pub next_duty: Option<Duty>,
    pub upcoming_deadlines: Vec<Requirement>,
    pub todays_tasks: Vec<Task>,
    pub duty_bag: Option<ChecklistSummary>,
    pub weekly_progress: WeeklyProgress,
    pub ci_reminder: Option<CiNote>,
}

/// Everything the Home screen needs.
pub async fn get_dashboard(db: &Db) -> AppResult<Dashboard> {
    let uid = db.user_id().await?;
    let pool = &db.pool;

    let today = today();
    let week_start = today - TimeDelta::days(today.weekday().num_days_from_monday() as i64);
    let week_end = week_start + TimeDelta::days(6);
    let (today_s, week_start_s, week_end_s) = (iso(today), iso(week_start), iso(week_end));

    let profile = sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(uid)
        .fetch_optional(pool)
        .await?;

    let next_duty = sqlx::query_as::<_, Duty>(&format!(
        "{} WHERE d.user_id = $1 AND d.duty_date >= $2::date ORDER BY d.duty_date, d.start_time LIMIT 1",
        Duty::SELECT
    ))
    .bind(uid)
    .bind(&today_s)
    .fetch_optional(pool)
    .await?;

    let upcoming_deadlines = sqlx::query_as::<_, Requirement>(&format!(
        "{} WHERE r.user_id = $1 AND r.status <> 'submitted' AND r.due_date >= $2::date
         ORDER BY r.due_date LIMIT 3",
        Requirement::SELECT
    ))
    .bind(uid)
    .bind(&today_s)
    .fetch_all(pool)
    .await?;

    let todays_tasks = sqlx::query_as::<_, Task>(&format!(
        "{} WHERE t.user_id = $1 AND t.due_date = $2::date ORDER BY t.id",
        Task::SELECT
    ))
    .bind(uid)
    .bind(&today_s)
    .fetch_all(pool)
    .await?;

    // Prefer the bag checklist tied to the next duty, otherwise the newest one.
    let duty_bag = sqlx::query_as::<_, ChecklistSummary>(&format!(
        "{} WHERE c.user_id = $1 AND c.kind = 'bag' GROUP BY c.id
         ORDER BY (c.duty_id IS NOT DISTINCT FROM $2) DESC, c.id DESC LIMIT 1",
        ChecklistSummary::SELECT
    ))
    .bind(uid)
    .bind(next_duty.as_ref().map(|d| d.id))
    .fetch_optional(pool)
    .await?;

    let weekly_progress = sqlx::query_as::<_, WeeklyProgress>(
        "SELECT
            COUNT(*) FILTER (WHERE completed AND completed_at::date BETWEEN $2::date AND $3::date) AS completed,
            COUNT(*) FILTER (WHERE NOT completed AND due_date BETWEEN $4::date AND $3::date) AS pending,
            COUNT(*) FILTER (WHERE NOT completed AND due_date < $4::date) AS overdue
         FROM tasks WHERE user_id = $1",
    )
    .bind(uid)
    .bind(&week_start_s)
    .bind(&week_end_s)
    .bind(&today_s)
    .fetch_one(pool)
    .await?;

    let ci_reminder = sqlx::query_as::<_, CiNote>(&format!(
        "{} WHERE n.user_id = $1 AND n.is_important ORDER BY n.note_date DESC, n.created_at DESC LIMIT 1",
        CiNote::SELECT
    ))
    .bind(uid)
    .fetch_optional(pool)
    .await?;

    Ok(Dashboard {
        profile,
        next_duty,
        upcoming_deadlines,
        todays_tasks,
        duty_bag,
        weekly_progress,
        ci_reminder,
    })
}

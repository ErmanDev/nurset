//! Progress page: completion across tasks, requirements, duty preparation and
//! study, for this week / this month / all time.

use chrono::{Datelike, NaiveDate, TimeDelta};
use serde::Serialize;
use sqlx::{FromRow, PgPool};

use super::{iso, today};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, ts, Duty, Ratio};

/// `(start, end)` dates, both `None` for all time.
type Range = (Option<String>, Option<String>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Categories {
    pub tasks: Ratio,
    pub requirements: Ratio,
    pub duty_prep: Ratio,
    pub study: Ratio,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TaskBreakdown {
    pub completed: i64,
    pub pending: i64,
    pub overdue: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RequirementProgress {
    pub id: i64,
    pub title: String,
    pub due_date: String,
    /// "submitted" | "approved" | "in_review" | "needs_revision" | "not_started"
    pub status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttentionItem {
    /// "task" | "requirement" | "duty"
    pub kind: String,
    pub id: i64,
    pub title: String,
    pub date: String,
    /// Extra context, e.g. task category or "2 of 4 checks done".
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct DayCount {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct DutyProgress {
    pub duty: Duty,
    pub bag: Ratio,
    pub rotation: Ratio,
    pub requirements: Ratio,
    pub readiness: Ratio,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyStats {
    pub quizzes_completed: i64,
    pub quizzes_in_progress: i64,
    pub chats: i64,
    /// Average score of completed quizzes, 0–100.
    pub average_score: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RecentItem {
    /// "task" | "quiz"
    pub kind: String,
    pub id: i64,
    pub title: String,
    pub detail: Option<String>,
    pub completed_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressOverview {
    pub range: String,
    pub categories: Categories,
    pub task_breakdown: TaskBreakdown,
    pub requirements: Vec<RequirementProgress>,
    pub attention: Vec<AttentionItem>,
    /// Monday..Sunday of the current week (always this week).
    pub weekly_activity: Vec<DayCount>,
    pub next_duty: Option<DutyProgress>,
    pub study: StudyStats,
    pub recent: Vec<RecentItem>,
}

// ---------- helpers ----------

fn range_bounds(range: &str, today: NaiveDate) -> AppResult<Range> {
    Ok(match range {
        "week" => {
            let start = today - TimeDelta::days(today.weekday().num_days_from_monday() as i64);
            (Some(iso(start)), Some(iso(start + TimeDelta::days(6))))
        }
        "month" => {
            let start = today.with_day(1).unwrap_or(today);
            let next = if start.month() == 12 {
                NaiveDate::from_ymd_opt(start.year() + 1, 1, 1)
            } else {
                NaiveDate::from_ymd_opt(start.year(), start.month() + 1, 1)
            }
            .unwrap_or(today);
            (Some(iso(start)), Some(iso(next - TimeDelta::days(1))))
        }
        "all" => (None, None),
        other => return Err(AppError::new(format!("Unknown range: {other}"))),
    })
}

fn is_done(status: &str) -> bool {
    !matches!(status, "not_started" | "needs_revision")
}

/// Requirements with a derived status from their latest document.
/// `$1` = user id; callers add conditions with `{where}` and optional `{tail}`.
fn requirements_sql(where_sql: &str, tail: &str) -> String {
    format!(
        concat!(
            "SELECT r.id, r.title, ", date!("r.due_date"), " AS due_date,
                CASE
                    WHEN r.status = 'submitted' THEN 'submitted'
                    ELSE CASE (SELECT d.status FROM documents d WHERE d.requirement_id = r.id
                               ORDER BY d.submitted_at DESC, d.id DESC LIMIT 1)
                        WHEN 'approved' THEN 'approved'
                        WHEN 'pending' THEN 'in_review'
                        WHEN 'under_review' THEN 'in_review'
                        WHEN 'needs_revision' THEN 'needs_revision'
                        ELSE 'not_started'
                    END
                END AS status
             FROM requirements r WHERE r.user_id = $1 {} ORDER BY r.due_date {}"
        ),
        where_sql, tail
    )
}

/// Range filter on a date expression, using bind params `$2` (start) and `$3` (end).
fn in_range(col: &str) -> String {
    format!("($2::date IS NULL OR {col} BETWEEN $2::date AND $3::date)")
}

// ---------- command ----------
pub async fn get_progress(db: &Db, range: String) -> AppResult<ProgressOverview> {
    let uid = db.user_id().await?;
    compute(&db.pool, uid, range, today()).await
}

pub(crate) async fn compute(pool: &PgPool, uid: i64, range: String, today_date: NaiveDate) -> AppResult<ProgressOverview> {
    let today_s = iso(today_date);
    let (start, end) = range_bounds(&range, today_date)?;

    // ----- tasks -----
    let tasks = sqlx::query_as::<_, Ratio>(&format!(
        "SELECT COUNT(*) FILTER (WHERE completed) AS done, COUNT(*) AS total
         FROM tasks WHERE user_id = $1 AND {}",
        in_range("due_date")
    ))
    .bind(uid)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    let task_breakdown = sqlx::query_as::<_, TaskBreakdown>(&format!(
        "SELECT COUNT(*) FILTER (WHERE completed) AS completed,
                COUNT(*) FILTER (WHERE NOT completed AND due_date >= $4::date) AS pending,
                COUNT(*) FILTER (WHERE NOT completed AND due_date < $4::date) AS overdue
         FROM tasks WHERE user_id = $1 AND {}",
        in_range("due_date")
    ))
    .bind(uid)
    .bind(&start)
    .bind(&end)
    .bind(&today_s)
    .fetch_one(pool)
    .await?;

    // ----- requirements -----
    let requirements = sqlx::query_as::<_, RequirementProgress>(&requirements_sql(
        &format!("AND {}", in_range("r.due_date")),
        "",
    ))
    .bind(uid)
    .bind(&start)
    .bind(&end)
    .fetch_all(pool)
    .await?;
    let requirements_ratio = Ratio {
        done: requirements.iter().filter(|r| is_done(&r.status)).count() as i64,
        total: requirements.len() as i64,
    };

    // ----- duty preparation: "Before you go" checks on duties in range -----
    let duty_prep = sqlx::query_as::<_, Ratio>(&format!(
        "SELECT COUNT(*) FILTER (WHERE dr.checked) AS done,
                (SELECT COUNT(*) FROM duties d2 WHERE d2.user_id = $1 AND {}) * 4 AS total
         FROM duties d JOIN duty_readiness dr ON dr.duty_id = d.id
         WHERE d.user_id = $1 AND {}",
        in_range("d2.duty_date"),
        in_range("d.duty_date")
    ))
    .bind(uid)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;

    // ----- study -----
    let (study_done, study_total, in_progress, avg): (i64, i64, i64, Option<f64>) = sqlx::query_as(&format!(
        "SELECT
            COUNT(*) FILTER (WHERE q.completed_at IS NOT NULL),
            COUNT(*),
            COUNT(*) FILTER (WHERE q.completed_at IS NULL AND EXISTS (
                SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = q.id AND qq.chosen_index IS NOT NULL)),
            (AVG(100.0 * q.score / NULLIF((SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id), 0))
                FILTER (WHERE q.completed_at IS NOT NULL))::float8
         FROM quizzes q WHERE q.user_id = $1 AND {}",
        in_range("q.created_at::date")
    ))
    .bind(uid)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    let chats: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM study_activity WHERE user_id = $1 AND kind = 'chat' AND {}",
        in_range("created_at::date")
    ))
    .bind(uid)
    .bind(&start)
    .bind(&end)
    .fetch_one(pool)
    .await?;
    let study_stats = StudyStats {
        quizzes_completed: study_done,
        quizzes_in_progress: in_progress,
        chats,
        average_score: avg.map(|a| a.round() as i64),
    };

    // ----- next duty -----
    let next = sqlx::query_as::<_, Duty>(&format!(
        "{} WHERE d.user_id = $1 AND d.duty_date >= $2::date ORDER BY d.duty_date, d.start_time LIMIT 1",
        Duty::SELECT
    ))
    .bind(uid)
    .bind(&today_s)
    .fetch_optional(pool)
    .await?;
    let checklist_ratio = |where_sql: &'static str| {
        format!(
            "SELECT COUNT(i.id) FILTER (WHERE i.checked) AS done, COUNT(i.id) AS total FROM checklist_items i
             WHERE i.checklist_id = (SELECT c.id FROM checklists c WHERE c.user_id = $1 AND {where_sql}
                                     ORDER BY c.id LIMIT 1)"
        )
    };
    let next_duty = match next {
        Some(duty) => {
            let bag = sqlx::query_as::<_, Ratio>(&checklist_ratio("c.kind = 'bag' AND c.duty_id = $2"))
                .bind(uid)
                .bind(duty.id)
                .fetch_one(pool)
                .await?;
            let rotation =
                sqlx::query_as::<_, Ratio>(&checklist_ratio("c.kind = 'rotation' AND lower(c.area) = lower($2)"))
                    .bind(uid)
                    .bind(&duty.area)
                    .fetch_one(pool)
                    .await?;
            let upcoming = sqlx::query_as::<_, RequirementProgress>(&requirements_sql(
                "AND r.due_date >= $2::date",
                "LIMIT 4",
            ))
            .bind(uid)
            .bind(&today_s)
            .fetch_all(pool)
            .await?;
            let readiness = sqlx::query_as::<_, Ratio>(
                "SELECT COUNT(*) FILTER (WHERE checked) AS done, 4::bigint AS total
                 FROM duty_readiness WHERE duty_id = $1",
            )
            .bind(duty.id)
            .fetch_one(pool)
            .await?;
            Some(DutyProgress {
                bag,
                rotation,
                requirements: Ratio {
                    done: upcoming.iter().filter(|r| is_done(&r.status)).count() as i64,
                    total: upcoming.len() as i64,
                },
                readiness,
                duty,
            })
        }
        None => None,
    };

    // ----- needs attention -----
    let overdue_tasks: Vec<(i64, String, String, String)> = sqlx::query_as(concat!(
        "SELECT id, title, ", date!("due_date"), ", category FROM tasks
         WHERE user_id = $1 AND NOT completed AND due_date < $2::date ORDER BY due_date LIMIT 2"
    ))
    .bind(uid)
    .bind(&today_s)
    .fetch_all(pool)
    .await?;
    let mut attention: Vec<AttentionItem> = overdue_tasks
        .into_iter()
        .map(|(id, title, date, category)| AttentionItem {
            kind: "task".into(),
            id,
            title,
            date,
            detail: Some(category),
        })
        .collect();
    let soon = iso(today_date + TimeDelta::days(7));
    let due_soon = sqlx::query_as::<_, RequirementProgress>(&requirements_sql(
        "AND r.due_date BETWEEN $2::date AND $3::date",
        "",
    ))
    .bind(uid)
    .bind(&today_s)
    .bind(&soon)
    .fetch_all(pool)
    .await?;
    for req in due_soon {
        if !is_done(&req.status) && attention.len() < 4 {
            attention.push(AttentionItem {
                kind: "requirement".into(),
                id: req.id,
                title: req.title,
                date: req.due_date,
                detail: Some(req.status),
            });
        }
    }
    if let Some(np) = &next_duty {
        if np.readiness.done < 4 && attention.len() < 4 {
            attention.push(AttentionItem {
                kind: "duty".into(),
                id: np.duty.id,
                title: format!("Prepare {} Duty", np.duty.area),
                date: np.duty.duty_date.clone(),
                detail: Some(format!("{} of 4 checks done", np.readiness.done)),
            });
        }
    }

    // ----- weekly activity (Mon..Sun of this week) -----
    let monday = today_date - TimeDelta::days(today_date.weekday().num_days_from_monday() as i64);
    let weekly_activity = sqlx::query_as::<_, DayCount>(
        "SELECT to_char(g.day, 'YYYY-MM-DD') AS date,
            (SELECT COUNT(*) FROM tasks t WHERE t.user_id = $1 AND t.completed AND t.completed_at::date = g.day)
          + (SELECT COUNT(*) FROM quizzes q WHERE q.user_id = $1 AND q.completed_at::date = g.day) AS count
         FROM (SELECT ($2::date + n) AS day FROM generate_series(0, 6) AS n) g
         ORDER BY g.day",
    )
    .bind(uid)
    .bind(iso(monday))
    .fetch_all(pool)
    .await?;

    // ----- recently completed -----
    let recent = sqlx::query_as::<_, RecentItem>(concat!(
        "SELECT * FROM (
            SELECT 'task' AS kind, id, title, category AS detail, ", ts!("completed_at"), " AS completed_at
            FROM tasks WHERE user_id = $1 AND completed
            UNION ALL
            SELECT 'quiz', id, title, NULL, ", ts!("completed_at"), "
            FROM quizzes WHERE user_id = $1 AND completed_at IS NOT NULL
         ) x ORDER BY completed_at DESC LIMIT 5"
    ))
    .bind(uid)
    .fetch_all(pool)
    .await?;

    Ok(ProgressOverview {
        range,
        categories: Categories {
            tasks,
            requirements: requirements_ratio,
            duty_prep,
            study: Ratio { done: study_done, total: study_total },
        },
        task_breakdown,
        requirements,
        attention,
        weekly_activity,
        next_duty,
        study: study_stats,
        recent,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn week_and_month_bounds() {
        let wed = NaiveDate::from_ymd_opt(2026, 12, 16).unwrap();
        assert_eq!(
            range_bounds("week", wed).unwrap(),
            (Some("2026-12-14".into()), Some("2026-12-20".into()))
        );
        assert_eq!(
            range_bounds("month", wed).unwrap(),
            (Some("2026-12-01".into()), Some("2026-12-31".into()))
        );
        assert_eq!(range_bounds("all", wed).unwrap(), (None, None));
        assert!(range_bounds("year", wed).is_err());
    }

    #[test]
    fn done_statuses() {
        assert!(is_done("in_review"));
        assert!(!is_done("needs_revision"));
        assert!(!is_done("not_started"));
    }
}

//! Instructor: Duty Day (attendance) and Evaluations & Hours.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::instructor::{check_duty, instructor_id, MY_STUDENTS};
use super::{iso, optional_text, today, valid_date, valid_time};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, time};

/// Scheduled shift length in minutes (overnight shifts wrap past midnight).
const SHIFT_MINUTES: &str =
    "((EXTRACT(EPOCH FROM (d.end_time - d.start_time)) / 60)::int + 1440) % 1440";

// ---------- duty day ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DutyDayRow {
    pub duty_id: i64,
    pub student_id: i64,
    pub student_name: String,
    pub group_name: Option<String>,
    pub area: String,
    pub hospital: String,
    pub start_time: String,
    pub end_time: String,
    pub readiness_done: i64,
    /// "present" | "late" | "absent" | "excused"; None = not recorded yet.
    pub attendance: Option<String>,
    pub time_in: Option<String>,
    pub remarks: Option<String>,
}

/// The instructor's students on duty on `date` (default today).
pub async fn get_duty_day(db: &Db, date: Option<String>) -> AppResult<Vec<DutyDayRow>> {
    let ci = instructor_id(&db).await?;
    let day = match date {
        Some(d) => valid_date(&d, "Date")?,
        None => iso(today()),
    };
    Ok(sqlx::query_as::<_, DutyDayRow>(&format!(
        concat!(
            "SELECT d.id AS duty_id, u.id AS student_id, u.full_name AS student_name,
                (SELECT g.name FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id
                 WHERE gm.student_id = u.id AND g.instructor_id = $1 ORDER BY g.id LIMIT 1) AS group_name,
                d.area, d.hospital, ", time!("d.start_time"), " AS start_time, ", time!("d.end_time"), " AS end_time,
                (SELECT COUNT(*) FROM duty_readiness r WHERE r.duty_id = d.id AND r.checked) AS readiness_done,
                a.status AS attendance, ", time!("a.time_in"), " AS time_in, a.remarks
             FROM duties d JOIN users u ON u.id = d.user_id
             LEFT JOIN duty_attendance a ON a.duty_id = d.id
             WHERE d.user_id IN ({}) AND d.duty_date = $2::date
             ORDER BY d.start_time, d.area, u.full_name"
        ),
        MY_STUDENTS
    ))
    .bind(ci)
    .bind(day)
    .fetch_all(&db.pool)
    .await?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttendanceInput {
    pub status: String,
    pub time_in: Option<String>,
    pub remarks: Option<String>,
}
pub async fn set_attendance(db: &Db, duty_id: i64, input: AttendanceInput) -> AppResult<()> {
    if !matches!(input.status.as_str(), "present" | "late" | "absent" | "excused") {
        return Err(AppError::new(format!("Unknown attendance status: {}", input.status)));
    }
    let time_in = optional_text(input.time_in).map(|t| valid_time(&t, "Time in")).transpose()?;
    let ci = instructor_id(&db).await?;
    check_duty(&db.pool, ci, duty_id).await?;
    sqlx::query(
        "INSERT INTO duty_attendance (duty_id, status, time_in, remarks, recorded_by)
         VALUES ($1, $2, $3::time, $4, $5)
         ON CONFLICT (duty_id) DO UPDATE SET status = EXCLUDED.status, time_in = EXCLUDED.time_in,
             remarks = EXCLUDED.remarks, recorded_by = EXCLUDED.recorded_by, recorded_at = now()",
    )
    .bind(duty_id)
    .bind(&input.status)
    .bind(time_in)
    .bind(optional_text(input.remarks))
    .bind(ci)
    .execute(&db.pool)
    .await?;
    Ok(())
}

// ---------- evaluations & hours ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationRow {
    pub duty_id: i64,
    pub student_id: i64,
    pub student_name: String,
    pub group_name: Option<String>,
    pub area: String,
    pub duty_date: String,
    pub start_time: String,
    pub end_time: String,
    pub scheduled_minutes: i32,
    pub attendance: Option<String>,
    pub evaluated: bool,
    pub knowledge: Option<i32>,
    pub skills: Option<i32>,
    pub professionalism: Option<i32>,
    pub communication: Option<i32>,
    pub comments: Option<String>,
    pub verified_minutes: Option<i32>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HoursSummary {
    pub student_id: i64,
    pub student_name: String,
    pub group_name: Option<String>,
    pub completed_duties: i64,
    pub evaluated: i64,
    pub verified_minutes: i64,
    /// Average of all ratings, 1–5.
    pub average_rating: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationsOverview {
    pub duties: Vec<EvaluationRow>,
    pub students: Vec<HoursSummary>,
}

/// Completed duties (today and earlier) of the instructor's students, with
/// evaluations, plus per-student confirmed hours.
pub async fn get_evaluations(db: &Db) -> AppResult<EvaluationsOverview> {
    let ci = instructor_id(&db).await?;
    let today_s = iso(today());
    let duties = sqlx::query_as::<_, EvaluationRow>(&format!(
        concat!(
            "SELECT d.id AS duty_id, u.id AS student_id, u.full_name AS student_name,
                (SELECT g.name FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id
                 WHERE gm.student_id = u.id AND g.instructor_id = $1 ORDER BY g.id LIMIT 1) AS group_name,
                d.area, ", date!("d.duty_date"), " AS duty_date, ", time!("d.start_time"), " AS start_time, ",
            time!("d.end_time"), " AS end_time, {} AS scheduled_minutes,
                a.status AS attendance, e.duty_id IS NOT NULL AS evaluated,
                e.knowledge, e.skills, e.professionalism, e.communication, e.comments, e.verified_minutes
             FROM duties d JOIN users u ON u.id = d.user_id
             LEFT JOIN duty_attendance a ON a.duty_id = d.id
             LEFT JOIN duty_evaluations e ON e.duty_id = d.id
             WHERE d.user_id IN ({}) AND d.duty_date <= $2::date
             ORDER BY d.duty_date DESC, u.full_name LIMIT 200"
        ),
        SHIFT_MINUTES, MY_STUDENTS
    ))
    .bind(ci)
    .bind(&today_s)
    .fetch_all(&db.pool)
    .await?;

    let students = sqlx::query_as::<_, HoursSummary>(&format!(
        "SELECT u.id AS student_id, u.full_name AS student_name,
            (SELECT g.name FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id
             WHERE gm.student_id = u.id AND g.instructor_id = $1 ORDER BY g.id LIMIT 1) AS group_name,
            COUNT(d.id) FILTER (WHERE d.duty_date <= $2::date) AS completed_duties,
            COUNT(e.duty_id) AS evaluated,
            COALESCE(SUM(e.verified_minutes), 0)::bigint AS verified_minutes,
            AVG((e.knowledge + e.skills + e.professionalism + e.communication) / 4.0)::float8 AS average_rating
         FROM users u
         LEFT JOIN duties d ON d.user_id = u.id
         LEFT JOIN duty_evaluations e ON e.duty_id = d.id
         WHERE u.id IN ({MY_STUDENTS})
         GROUP BY u.id ORDER BY u.full_name"
    ))
    .bind(ci)
    .bind(&today_s)
    .fetch_all(&db.pool)
    .await?;

    Ok(EvaluationsOverview { duties, students })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationInput {
    pub knowledge: i32,
    pub skills: i32,
    pub professionalism: i32,
    pub communication: i32,
    pub comments: Option<String>,
    pub verified_minutes: i32,
}
pub async fn save_evaluation(db: &Db, duty_id: i64, input: EvaluationInput) -> AppResult<()> {
    for (label, v) in [
        ("Knowledge", input.knowledge),
        ("Clinical skills", input.skills),
        ("Professionalism", input.professionalism),
        ("Communication", input.communication),
    ] {
        if !(1..=5).contains(&v) {
            return Err(AppError::new(format!("{label} must be rated 1 to 5")));
        }
    }
    if !(0..=1440).contains(&input.verified_minutes) {
        return Err(AppError::new("Confirmed hours must be between 0 and 24"));
    }
    let ci = instructor_id(&db).await?;
    check_duty(&db.pool, ci, duty_id).await?;
    let future: bool = sqlx::query_scalar("SELECT duty_date > CURRENT_DATE FROM duties WHERE id = $1")
        .bind(duty_id)
        .fetch_one(&db.pool)
        .await?;
    if future {
        return Err(AppError::new("You can evaluate a duty once it has taken place"));
    }
    sqlx::query(
        "INSERT INTO duty_evaluations (duty_id, evaluator_id, knowledge, skills, professionalism, communication, comments, verified_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (duty_id) DO UPDATE SET evaluator_id = EXCLUDED.evaluator_id, knowledge = EXCLUDED.knowledge,
             skills = EXCLUDED.skills, professionalism = EXCLUDED.professionalism,
             communication = EXCLUDED.communication, comments = EXCLUDED.comments,
             verified_minutes = EXCLUDED.verified_minutes",
    )
    .bind(duty_id)
    .bind(ci)
    .bind(input.knowledge)
    .bind(input.skills)
    .bind(input.professionalism)
    .bind(input.communication)
    .bind(optional_text(input.comments))
    .bind(input.verified_minutes)
    .execute(&db.pool)
    .await?;
    Ok(())
}

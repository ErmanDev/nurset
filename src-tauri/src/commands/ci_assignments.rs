//! Instructor: Duty Assignments and group Requirements.
//!
//! An assignment is stored once and copied to every group member as a normal
//! duty / requirement (linked by `assignment_id`), so the student pages work
//! unchanged. Editing updates the copies; deleting removes them.

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use tauri::State;

use super::instructor::{check_group, instructor_id, instructor_name};
use super::{not_found, optional_text, required_text, valid_date, valid_time};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::{date, time};

// ---------- duty assignments ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DutyAssignment {
    pub id: i64,
    pub group_id: i64,
    pub group_name: String,
    pub group_color: String,
    pub area: String,
    pub hospital: String,
    pub location: Option<String>,
    pub duty_date: String,
    pub start_time: String,
    pub end_time: String,
    pub notes: Option<String>,
    /// Students who received this duty.
    pub student_count: i64,
}

const ASSIGNMENT_SELECT: &str = concat!(
    "SELECT a.id, a.group_id, g.name AS group_name, g.color AS group_color, a.area, a.hospital, a.location, ",
    date!("a.duty_date"), " AS duty_date, ", time!("a.start_time"), " AS start_time, ",
    time!("a.end_time"), " AS end_time, a.notes,
     (SELECT COUNT(*) FROM duties d WHERE d.assignment_id = a.id) AS student_count
     FROM duty_assignments a JOIN clinical_groups g ON g.id = a.group_id"
);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DutyAssignmentInput {
    pub group_id: i64,
    pub area: String,
    pub hospital: String,
    pub location: Option<String>,
    pub duty_date: String,
    pub start_time: String,
    pub end_time: String,
    pub notes: Option<String>,
}

struct ValidDuty {
    area: String,
    hospital: String,
    location: Option<String>,
    date: String,
    start: String,
    end: String,
    notes: Option<String>,
}

impl DutyAssignmentInput {
    fn validate(self) -> AppResult<ValidDuty> {
        Ok(ValidDuty {
            area: required_text(&self.area, "Clinical area")?,
            hospital: required_text(&self.hospital, "Hospital")?,
            location: optional_text(self.location),
            date: valid_date(&self.duty_date, "Date")?,
            start: valid_time(&self.start_time, "Start time")?,
            end: valid_time(&self.end_time, "End time")?,
            notes: optional_text(self.notes),
        })
    }
}

async fn get_assignment(pool: &PgPool, ci: i64, id: i64) -> AppResult<DutyAssignment> {
    sqlx::query_as::<_, DutyAssignment>(&format!("{ASSIGNMENT_SELECT} WHERE a.id = $1 AND a.instructor_id = $2"))
        .bind(id)
        .bind(ci)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| not_found("Assignment", id))
}

#[tauri::command]
pub async fn list_duty_assignments(db: State<'_, Db>) -> AppResult<Vec<DutyAssignment>> {
    let ci = instructor_id(&db).await?;
    Ok(sqlx::query_as::<_, DutyAssignment>(&format!(
        "{ASSIGNMENT_SELECT} WHERE a.instructor_id = $1 ORDER BY a.duty_date DESC, a.start_time"
    ))
    .bind(ci)
    .fetch_all(&db.pool)
    .await?)
}

/// Creates the assignment and a duty for every current member of the group.
#[tauri::command]
pub async fn create_duty_assignment(db: State<'_, Db>, input: DutyAssignmentInput) -> AppResult<DutyAssignment> {
    let group_id = input.group_id;
    let v = input.validate()?;
    let ci = instructor_id(&db).await?;
    check_group(&db.pool, ci, group_id).await?;
    let ci_name = instructor_name(&db.pool, ci).await?;

    let mut tx = db.pool.begin().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO duty_assignments (instructor_id, group_id, area, hospital, location, duty_date, start_time, end_time, notes)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::time, $8::time, $9) RETURNING id",
    )
    .bind(ci)
    .bind(group_id)
    .bind(&v.area)
    .bind(&v.hospital)
    .bind(&v.location)
    .bind(&v.date)
    .bind(&v.start)
    .bind(&v.end)
    .bind(&v.notes)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO duties (user_id, area, hospital, location, duty_date, start_time, end_time,
                             clinical_instructor, notes, assignment_id)
         SELECT gm.student_id, $2, $3, $4, $5::date, $6::time, $7::time, $8, $9, $1
         FROM group_members gm WHERE gm.group_id = $10",
    )
    .bind(id)
    .bind(&v.area)
    .bind(&v.hospital)
    .bind(&v.location)
    .bind(&v.date)
    .bind(&v.start)
    .bind(&v.end)
    .bind(&ci_name)
    .bind(&v.notes)
    .bind(group_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    get_assignment(&db.pool, ci, id).await
}

/// Updates the assignment and every student's copy (the group can't change).
#[tauri::command]
pub async fn update_duty_assignment(db: State<'_, Db>, id: i64, input: DutyAssignmentInput) -> AppResult<DutyAssignment> {
    let v = input.validate()?;
    let ci = instructor_id(&db).await?;
    get_assignment(&db.pool, ci, id).await?;

    let mut tx = db.pool.begin().await?;
    sqlx::query(
        "UPDATE duty_assignments SET area = $2, hospital = $3, location = $4, duty_date = $5::date,
             start_time = $6::time, end_time = $7::time, notes = $8 WHERE id = $1",
    )
    .bind(id)
    .bind(&v.area)
    .bind(&v.hospital)
    .bind(&v.location)
    .bind(&v.date)
    .bind(&v.start)
    .bind(&v.end)
    .bind(&v.notes)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE duties SET area = $2, hospital = $3, location = $4, duty_date = $5::date,
             start_time = $6::time, end_time = $7::time, notes = $8 WHERE assignment_id = $1",
    )
    .bind(id)
    .bind(&v.area)
    .bind(&v.hospital)
    .bind(&v.location)
    .bind(&v.date)
    .bind(&v.start)
    .bind(&v.end)
    .bind(&v.notes)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    get_assignment(&db.pool, ci, id).await
}

/// Deletes the assignment and the students' copies of the duty.
#[tauri::command]
pub async fn delete_duty_assignment(db: State<'_, Db>, id: i64) -> AppResult<()> {
    let ci = instructor_id(&db).await?;
    let deleted = sqlx::query("DELETE FROM duty_assignments WHERE id = $1 AND instructor_id = $2")
        .bind(id)
        .bind(ci)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Assignment", id));
    }
    Ok(())
}

// ---------- requirement assignments ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RequirementAssignment {
    pub id: i64,
    pub group_id: i64,
    pub group_name: String,
    pub group_color: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: String,
    pub total: i64,
    /// Students with a submission that isn't marked "needs revision".
    pub submitted: i64,
    pub approved: i64,
}

const REQ_ASSIGNMENT_SELECT: &str = concat!(
    "SELECT a.id, a.group_id, g.name AS group_name, g.color AS group_color, a.title, a.description, ",
    date!("a.due_date"), " AS due_date,
     (SELECT COUNT(*) FROM requirements r WHERE r.assignment_id = a.id) AS total,
     (SELECT COUNT(*) FROM requirements r WHERE r.assignment_id = a.id AND EXISTS (
         SELECT 1 FROM documents d WHERE d.requirement_id = r.id AND d.status <> 'needs_revision')) AS submitted,
     (SELECT COUNT(*) FROM requirements r WHERE r.assignment_id = a.id AND EXISTS (
         SELECT 1 FROM documents d WHERE d.requirement_id = r.id AND d.status = 'approved')) AS approved
     FROM requirement_assignments a JOIN clinical_groups g ON g.id = a.group_id"
);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementAssignmentInput {
    pub group_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub due_date: String,
}

#[tauri::command]
pub async fn list_requirement_assignments(db: State<'_, Db>) -> AppResult<Vec<RequirementAssignment>> {
    let ci = instructor_id(&db).await?;
    Ok(sqlx::query_as::<_, RequirementAssignment>(&format!(
        "{REQ_ASSIGNMENT_SELECT} WHERE a.instructor_id = $1 ORDER BY a.due_date, a.id"
    ))
    .bind(ci)
    .fetch_all(&db.pool)
    .await?)
}

/// Creates the requirement for every current member of the group.
#[tauri::command]
pub async fn create_requirement_assignment(
    db: State<'_, Db>,
    input: RequirementAssignmentInput,
) -> AppResult<RequirementAssignment> {
    let title = required_text(&input.title, "Requirement title")?;
    let due = valid_date(&input.due_date, "Due date")?;
    let description = optional_text(input.description);
    let ci = instructor_id(&db).await?;
    check_group(&db.pool, ci, input.group_id).await?;

    let mut tx = db.pool.begin().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO requirement_assignments (instructor_id, group_id, title, description, due_date)
         VALUES ($1, $2, $3, $4, $5::date) RETURNING id",
    )
    .bind(ci)
    .bind(input.group_id)
    .bind(&title)
    .bind(&description)
    .bind(&due)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO requirements (user_id, title, description, due_date, assignment_id)
         SELECT gm.student_id, $2, $3, $4::date, $1 FROM group_members gm WHERE gm.group_id = $5",
    )
    .bind(id)
    .bind(&title)
    .bind(&description)
    .bind(&due)
    .bind(input.group_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    sqlx::query_as::<_, RequirementAssignment>(&format!("{REQ_ASSIGNMENT_SELECT} WHERE a.id = $1"))
        .bind(id)
        .fetch_one(&db.pool)
        .await
        .map_err(Into::into)
}

/// Deletes the requirement for the whole group (submitted documents are kept, unlinked).
#[tauri::command]
pub async fn delete_requirement_assignment(db: State<'_, Db>, id: i64) -> AppResult<()> {
    let ci = instructor_id(&db).await?;
    let deleted = sqlx::query("DELETE FROM requirement_assignments WHERE id = $1 AND instructor_id = $2")
        .bind(id)
        .bind(ci)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Requirement", id));
    }
    Ok(())
}

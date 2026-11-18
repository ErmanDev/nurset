//! Instructor: Instructions, delivered to students as CI notes.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::instructor::{check_group, check_student, instructor_id, instructor_name};
use super::{not_found, optional_text, required_text, valid_date};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, ts};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Instruction {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub clinical_area: Option<String>,
    pub note_date: String,
    pub is_important: bool,
    pub group_id: Option<i64>,
    pub student_id: Option<i64>,
    /// Group name or student name.
    pub audience: String,
    pub recipients: i64,
    pub created_at: String,
}

const INSTRUCTION_SELECT: &str = concat!(
    "SELECT i.id, i.title, i.content, i.clinical_area, ", date!("i.note_date"), " AS note_date, i.is_important,
        i.group_id, i.student_id, COALESCE(g.name, u.full_name) AS audience,
        (SELECT COUNT(*) FROM ci_notes n WHERE n.instruction_id = i.id) AS recipients, ",
    ts!("i.created_at"), " AS created_at
     FROM ci_instructions i
     LEFT JOIN clinical_groups g ON g.id = i.group_id
     LEFT JOIN users u ON u.id = i.student_id"
);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionInput {
    pub title: String,
    pub content: String,
    pub clinical_area: Option<String>,
    pub note_date: String,
    pub is_important: bool,
    /// Exactly one of group / student.
    pub group_id: Option<i64>,
    pub student_id: Option<i64>,
}
pub async fn list_instructions(db: &Db) -> AppResult<Vec<Instruction>> {
    let ci = instructor_id(&db).await?;
    Ok(sqlx::query_as::<_, Instruction>(&format!(
        "{INSTRUCTION_SELECT} WHERE i.instructor_id = $1 ORDER BY i.note_date DESC, i.created_at DESC"
    ))
    .bind(ci)
    .fetch_all(&db.pool)
    .await?)
}

/// Saves the instruction and adds it to each recipient's CI Notes.
pub async fn create_instruction(db: &Db, input: InstructionInput) -> AppResult<Instruction> {
    let title = required_text(&input.title, "Title")?;
    let content = required_text(&input.content, "Instruction")?;
    let note_date = valid_date(&input.note_date, "Date")?;
    let area = optional_text(input.clinical_area);
    let ci = instructor_id(&db).await?;
    match (input.group_id, input.student_id) {
        (Some(g), None) => check_group(&db.pool, ci, g).await?,
        (None, Some(s)) => check_student(&db.pool, ci, s).await?,
        _ => return Err(AppError::new("Choose a group or a student")),
    }
    let name = instructor_name(&db.pool, ci).await?;

    let mut tx = db.pool.begin().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO ci_instructions (instructor_id, group_id, student_id, title, content, clinical_area, note_date, is_important)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8) RETURNING id",
    )
    .bind(ci)
    .bind(input.group_id)
    .bind(input.student_id)
    .bind(&title)
    .bind(&content)
    .bind(&area)
    .bind(&note_date)
    .bind(input.is_important)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO ci_notes (user_id, title, content, clinical_instructor, clinical_area, note_date, is_important, instruction_id)
         SELECT s.id, $2, $3, $4, $5, $6::date, $7, $1
         FROM users s
         WHERE s.id = $8 OR s.id IN (SELECT student_id FROM group_members WHERE group_id = $9)",
    )
    .bind(id)
    .bind(&title)
    .bind(&content)
    .bind(&name)
    .bind(&area)
    .bind(&note_date)
    .bind(input.is_important)
    .bind(input.student_id)
    .bind(input.group_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(sqlx::query_as::<_, Instruction>(&format!("{INSTRUCTION_SELECT} WHERE i.id = $1"))
        .bind(id)
        .fetch_one(&db.pool)
        .await?)
}

/// Deletes the instruction and removes it from students' CI Notes.
pub async fn delete_instruction(db: &Db, id: i64) -> AppResult<()> {
    let ci = instructor_id(&db).await?;
    let deleted = sqlx::query("DELETE FROM ci_instructions WHERE id = $1 AND instructor_id = $2")
        .bind(id)
        .bind(ci)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Instruction", id));
    }
    Ok(())
}

//! Instructor: review students' submitted documents.

use std::path::Path;

use serde::Serialize;
use sqlx::FromRow;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use super::instructor::{instructor_id, instructor_name, MY_STUDENTS};
use super::{not_found, optional_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::ts;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDocument {
    pub document_id: i64,
    pub student_id: i64,
    pub student_name: String,
    pub group_name: Option<String>,
    pub title: String,
    pub document_type: Option<String>,
    pub file_name: String,
    pub notes: Option<String>,
    pub requirement_title: Option<String>,
    /// "pending" | "under_review" | "approved" | "needs_revision"
    pub status: String,
    pub submitted_at: String,
    pub feedback: Option<String>,
    pub feedback_at: Option<String>,
    pub has_file: bool,
}

/// All documents from the instructor's students. `status`: "open" (pending +
/// under review), a single status, or "all".
#[tauri::command]
pub async fn list_reviews(db: State<'_, Db>, status: Option<String>) -> AppResult<Vec<ReviewDocument>> {
    let ci = instructor_id(&db).await?;
    let status = status.unwrap_or_else(|| "open".into());
    let filter = match status.as_str() {
        "all" => "TRUE",
        "open" => "d.status IN ('pending', 'under_review')",
        "pending" | "under_review" | "approved" | "needs_revision" => "d.status = $2",
        other => return Err(AppError::new(format!("Unknown status filter: {other}"))),
    };
    Ok(sqlx::query_as::<_, ReviewDocument>(&format!(
        concat!(
            "SELECT d.id AS document_id, u.id AS student_id, u.full_name AS student_name,
                (SELECT g.name FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id
                 WHERE gm.student_id = u.id AND g.instructor_id = $1 ORDER BY g.id LIMIT 1) AS group_name,
                COALESCE(d.title, d.file_name) AS title, d.document_type, d.file_name, d.notes,
                r.title AS requirement_title, d.status, ",
            ts!("d.submitted_at"), " AS submitted_at, d.feedback, ", ts!("d.feedback_at"), " AS feedback_at,
                d.storage_key IS NOT NULL AS has_file
             FROM documents d JOIN users u ON u.id = d.user_id
             LEFT JOIN requirements r ON r.id = d.requirement_id
             WHERE d.user_id IN ({}) AND ({}) AND ($2 = $2)
             ORDER BY (d.status IN ('pending', 'under_review')) DESC, d.submitted_at"
        ),
        MY_STUDENTS, filter
    ))
    .bind(ci)
    .bind(&status)
    .fetch_all(&db.pool)
    .await?)
}

/// Sets a document's review status. "needs_revision" requires feedback.
#[tauri::command]
pub async fn review_document(
    db: State<'_, Db>,
    id: i64,
    status: String,
    feedback: Option<String>,
) -> AppResult<()> {
    if !matches!(status.as_str(), "under_review" | "approved" | "needs_revision") {
        return Err(AppError::new(format!("Unknown review status: {status}")));
    }
    let feedback = optional_text(feedback);
    if status == "needs_revision" && feedback.is_none() {
        return Err(AppError::new("Tell the student what to revise"));
    }
    let ci = instructor_id(&db).await?;
    let name = instructor_name(&db.pool, ci).await?;
    let changed = sqlx::query(&format!(
        "UPDATE documents SET status = $3, reviewer_id = $1, reviewed_by = $4,
             feedback = COALESCE($5, feedback),
             feedback_at = CASE WHEN $5::text IS NOT NULL THEN now() ELSE feedback_at END
         WHERE id = $2 AND user_id IN ({MY_STUDENTS})"
    ))
    .bind(ci)
    .bind(id)
    .bind(&status)
    .bind(&name)
    .bind(&feedback)
    .execute(&db.pool)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(not_found("Document", id));
    }
    Ok(())
}

/// Opens a student's uploaded file (files are stored on the uploading computer for now).
#[tauri::command]
pub async fn open_review_document(app: AppHandle, db: State<'_, Db>, id: i64) -> AppResult<()> {
    let ci = instructor_id(&db).await?;
    let path: Option<String> = sqlx::query_scalar(&format!(
        "SELECT storage_key FROM documents WHERE id = $2 AND user_id IN ({MY_STUDENTS})"
    ))
    .bind(ci)
    .bind(id)
    .fetch_optional(&db.pool)
    .await?
    .ok_or_else(|| not_found("Document", id))?;
    let path = path.ok_or_else(|| AppError::new("This submission has no file attached"))?;
    if !Path::new(&path).exists() {
        return Err(AppError::new(
            "The file isn't on this computer. Uploaded files will be viewable from anywhere once the NurSet server is set up.",
        ));
    }
    app.opener().open_path(&path, None::<&str>)?;
    Ok(())
}

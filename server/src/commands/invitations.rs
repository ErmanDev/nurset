//! Group invitations, from the student's side.
//!
//! When an instructor adds a student, the membership starts as `pending`. The
//! instructor sees nothing about the student until the student accepts here.

use serde::Serialize;
use sqlx::FromRow;

use super::{instructor, not_found};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::ts;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GroupInvitation {
    pub group_id: i64,
    pub group_name: String,
    pub area: Option<String>,
    pub hospital: Option<String>,
    pub term: Option<String>,
    pub instructor_name: String,
    pub instructor_email: String,
    pub invited_at: String,
}

/// The signed-in student's pending invitations, newest first.
pub async fn list_group_invitations(db: &Db) -> AppResult<Vec<GroupInvitation>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, GroupInvitation>(concat!(
        "SELECT g.id AS group_id, g.name AS group_name, g.area, g.hospital, g.term,
                u.full_name AS instructor_name, u.email::text AS instructor_email, ",
        ts!("m.added_at"), " AS invited_at
         FROM group_memberships m
         JOIN clinical_groups g ON g.id = m.group_id
         JOIN users u ON u.id = g.instructor_id
         WHERE m.student_id = $1 AND m.status = 'pending'
         ORDER BY m.added_at DESC"
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

/// Accepts (joins the group and receives its upcoming duties and open
/// requirements) or declines (the invitation is removed).
pub async fn respond_group_invitation(db: &Db, group_id: i64, accept: bool) -> AppResult<()> {
    let uid = db.user_id().await?;
    if accept {
        let changed = sqlx::query(
            "UPDATE group_memberships SET status = 'active', responded_at = now()
             WHERE group_id = $1 AND student_id = $2 AND status = 'pending'",
        )
        .bind(group_id)
        .bind(uid)
        .execute(&db.pool)
        .await?
        .rows_affected();
        if changed == 0 {
            return Err(not_found("Invitation", group_id));
        }
        instructor::give_group_work(&db.pool, group_id, uid).await?;
    } else {
        let removed = sqlx::query(
            "DELETE FROM group_memberships WHERE group_id = $1 AND student_id = $2 AND status = 'pending'",
        )
        .bind(group_id)
        .bind(uid)
        .execute(&db.pool)
        .await?
        .rows_affected();
        if removed == 0 {
            return Err(not_found("Invitation", group_id));
        }
    }
    Ok(())
}

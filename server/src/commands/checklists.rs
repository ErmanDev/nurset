
use crate::db::Db;
use crate::error::AppResult;
use crate::models::{ChecklistItem, ChecklistSummary};
pub async fn list_checklists(db: &Db) -> AppResult<Vec<ChecklistSummary>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, ChecklistSummary>(&format!(
        "{} WHERE c.user_id = $1 GROUP BY c.id ORDER BY c.id DESC",
        ChecklistSummary::SELECT
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}
pub async fn list_checklist_items(db: &Db, checklist_id: i64) -> AppResult<Vec<ChecklistItem>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, ChecklistItem>(&format!(
        "{} JOIN checklists c ON c.id = i.checklist_id
         WHERE i.checklist_id = $1 AND c.user_id = $2 ORDER BY i.position, i.id",
        ChecklistItem::SELECT
    ))
    .bind(checklist_id)
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

//! Duty Checklist page: duty bag (per duty), rotation reminders (per area),
//! linked requirements, CI reminder, and "Before you go" checks.

use serde::Serialize;
use sqlx::{FromRow, PgConnection};
use tauri::State;

use super::{iso, not_found, required_text, today};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, ChecklistDetail, ChecklistItem, CiNote, Duty};

/// Used when the first duty bag is created and no earlier bag exists to copy.
const DEFAULT_BAG: &[&str] = &[
    "School / Clinical ID",
    "Duty Uniform",
    "Watch",
    "Pen and small notebook",
    "Required forms / Documents",
    "Stethoscope",
    "BP apparatus",
    "Penlight",
    "Bandage scissors",
    "Drug handbook",
    "Assigned clinical materials",
    "Personal essentials",
];

const DEFAULT_ROTATION: &[&str] = &[
    "Review assigned topics",
    "Check clinical requirements",
    "Review CI instructions",
    "Prepare required materials",
    "Review common ward medications",
];

/// Keys for the "Before you go" checks, in display order.
pub const READINESS_KEYS: &[&str] = &["schedule", "requirements", "bag", "ci"];

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RequirementReadiness {
    pub id: i64,
    pub title: String,
    pub due_date: String,
    /// A document has been submitted for it (and isn't waiting on a revision).
    pub ready: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessItem {
    pub key: String,
    pub checked: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DutyPrep {
    /// The duty being prepared for (requested one, else the next upcoming).
    pub duty: Option<Duty>,
    /// Choices for "Change Duty".
    pub upcoming_duties: Vec<Duty>,
    pub bag: Option<ChecklistDetail>,
    /// Choices for the "Current rotation" select.
    pub rotation_areas: Vec<String>,
    pub requirements: Vec<RequirementReadiness>,
    pub ci_reminder: Option<CiNote>,
    pub readiness: Vec<ReadinessItem>,
}

// ---------- helpers ----------

async fn load_checklist(conn: &mut PgConnection, id: i64) -> AppResult<ChecklistDetail> {
    let items = sqlx::query_as::<_, ChecklistItem>(&format!(
        "{} WHERE i.checklist_id = $1 ORDER BY i.position, i.id",
        ChecklistItem::SELECT
    ))
    .bind(id)
    .fetch_all(&mut *conn)
    .await?;
    let (name, kind, duty_id, area): (String, String, Option<i64>, Option<String>) =
        sqlx::query_as("SELECT name, kind, duty_id, area FROM checklists WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *conn)
            .await?;
    Ok(ChecklistDetail { id, name, kind, duty_id, area, items })
}

async fn create_checklist(
    conn: &mut PgConnection,
    uid: i64,
    name: &str,
    kind: &str,
    duty_id: Option<i64>,
    area: Option<&str>,
    labels: &[String],
) -> AppResult<i64> {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO checklists (user_id, name, kind, duty_id, area) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(uid)
    .bind(name)
    .bind(kind)
    .bind(duty_id)
    .bind(area)
    .fetch_one(&mut *conn)
    .await?;
    sqlx::query(
        "INSERT INTO checklist_items (checklist_id, label, position)
         SELECT $1, label, (ord - 1)::int FROM unnest($2::text[]) WITH ORDINALITY AS t(label, ord)",
    )
    .bind(id)
    .bind(labels)
    .execute(&mut *conn)
    .await?;
    Ok(id)
}

/// The duty's bag checklist, created on first use from the user's most recent
/// bag (items unchecked) or the default list.
async fn bag_for_duty(conn: &mut PgConnection, uid: i64, duty_id: i64) -> AppResult<i64> {
    let existing: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM checklists WHERE user_id = $1 AND kind = 'bag' AND duty_id = $2 ORDER BY id LIMIT 1",
    )
    .bind(uid)
    .bind(duty_id)
    .fetch_optional(&mut *conn)
    .await?;
    if let Some(id) = existing {
        return Ok(id);
    }
    let mut labels: Vec<String> = sqlx::query_scalar(
        "SELECT label FROM checklist_items WHERE checklist_id =
            (SELECT id FROM checklists WHERE user_id = $1 AND kind = 'bag' ORDER BY id DESC LIMIT 1)
         ORDER BY position, id",
    )
    .bind(uid)
    .fetch_all(&mut *conn)
    .await?;
    if labels.is_empty() {
        labels = DEFAULT_BAG.iter().map(|s| s.to_string()).collect();
    }
    create_checklist(conn, uid, "Duty Bag Checklist", "bag", Some(duty_id), None, &labels).await
}

/// The area's rotation checklist, created with default reminders on first use.
async fn rotation_for_area(conn: &mut PgConnection, uid: i64, area: &str) -> AppResult<i64> {
    let existing: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM checklists WHERE user_id = $1 AND kind = 'rotation' AND lower(area) = lower($2) LIMIT 1",
    )
    .bind(uid)
    .bind(area)
    .fetch_optional(&mut *conn)
    .await?;
    if let Some(id) = existing {
        return Ok(id);
    }
    let labels: Vec<String> = DEFAULT_ROTATION.iter().map(|s| s.to_string()).collect();
    create_checklist(conn, uid, "Rotation Checklist", "rotation", None, Some(area), &labels).await
}

const ITEM_RETURNING: &str = "RETURNING i.id, i.checklist_id, i.label, i.checked, i.position";

// ---------- commands ----------

/// Everything the Duty Checklist page shows for one duty.
#[tauri::command]
pub async fn get_duty_prep(db: State<'_, Db>, duty_id: Option<i64>) -> AppResult<DutyPrep> {
    let uid = db.user_id().await?;
    let today = iso(today());
    let mut tx = db.pool.begin().await?; // the bag may be created on first view

    let upcoming_duties = sqlx::query_as::<_, Duty>(&format!(
        "{} WHERE d.user_id = $1 AND d.duty_date >= $2::date ORDER BY d.duty_date, d.start_time",
        Duty::SELECT
    ))
    .bind(uid)
    .bind(&today)
    .fetch_all(&mut *tx)
    .await?;

    let duty = match duty_id {
        Some(id) => Some(
            sqlx::query_as::<_, Duty>(&format!("{} WHERE d.id = $1 AND d.user_id = $2", Duty::SELECT))
                .bind(id)
                .bind(uid)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or_else(|| not_found("Duty", id))?,
        ),
        None => upcoming_duties.first().cloned(),
    };

    let bag = match &duty {
        Some(d) => {
            let id = bag_for_duty(&mut tx, uid, d.id).await?;
            Some(load_checklist(&mut tx, id).await?)
        }
        None => None,
    };

    let rotation_areas: Vec<String> = sqlx::query_scalar(
        "SELECT area FROM duties WHERE user_id = $1
         UNION SELECT area FROM checklists WHERE user_id = $1 AND kind = 'rotation'
         ORDER BY 1",
    )
    .bind(uid)
    .fetch_all(&mut *tx)
    .await?;

    let requirements = sqlx::query_as::<_, RequirementReadiness>(concat!(
        "SELECT r.id, r.title, ", date!("r.due_date"), " AS due_date,
            (r.status = 'submitted' OR EXISTS (
                SELECT 1 FROM documents d
                WHERE d.requirement_id = r.id AND d.status <> 'needs_revision')) AS ready
         FROM requirements r
         WHERE r.user_id = $1 AND (r.status = 'submitted' OR r.due_date >= $2::date)
         ORDER BY r.due_date LIMIT 4"
    ))
    .bind(uid)
    .bind(&today)
    .fetch_all(&mut *tx)
    .await?;

    let ci_reminder = sqlx::query_as::<_, CiNote>(&format!(
        "{} WHERE n.user_id = $1 AND n.is_important ORDER BY n.note_date DESC, n.created_at DESC LIMIT 1",
        CiNote::SELECT
    ))
    .bind(uid)
    .fetch_optional(&mut *tx)
    .await?;

    let checked: Vec<(String, bool)> = match &duty {
        Some(d) => {
            sqlx::query_as("SELECT item_key, checked FROM duty_readiness WHERE duty_id = $1")
                .bind(d.id)
                .fetch_all(&mut *tx)
                .await?
        }
        None => Vec::new(),
    };
    let readiness = READINESS_KEYS
        .iter()
        .map(|key| ReadinessItem {
            key: key.to_string(),
            checked: checked.iter().any(|(k, c)| k == key && *c),
        })
        .collect();

    tx.commit().await?;
    Ok(DutyPrep {
        duty,
        upcoming_duties,
        bag,
        rotation_areas,
        requirements,
        ci_reminder,
        readiness,
    })
}

/// Preparation reminders for a rotation area, created with defaults on first use.
#[tauri::command]
pub async fn get_rotation_checklist(db: State<'_, Db>, area: String) -> AppResult<ChecklistDetail> {
    let area = required_text(&area, "Rotation")?;
    let uid = db.user_id().await?;
    let mut tx = db.pool.begin().await?;
    let id = rotation_for_area(&mut tx, uid, &area).await?;
    let checklist = load_checklist(&mut tx, id).await?;
    tx.commit().await?;
    Ok(checklist)
}

#[tauri::command]
pub async fn add_checklist_item(db: State<'_, Db>, checklist_id: i64, label: String) -> AppResult<ChecklistItem> {
    let label = required_text(&label, "Item")?;
    let uid = db.user_id().await?;
    sqlx::query_as::<_, ChecklistItem>(
        "INSERT INTO checklist_items AS i (checklist_id, label, position)
         SELECT c.id, $2, COALESCE((SELECT MAX(position) + 1 FROM checklist_items WHERE checklist_id = c.id), 0)
         FROM checklists c WHERE c.id = $1 AND c.user_id = $3
         RETURNING i.id, i.checklist_id, i.label, i.checked, i.position",
    )
    .bind(checklist_id)
    .bind(label)
    .bind(uid)
    .fetch_optional(&db.pool)
    .await?
    .ok_or_else(|| not_found("Checklist", checklist_id))
}

#[tauri::command]
pub async fn toggle_checklist_item(db: State<'_, Db>, id: i64, checked: bool) -> AppResult<ChecklistItem> {
    let uid = db.user_id().await?;
    sqlx::query_as::<_, ChecklistItem>(&format!(
        "UPDATE checklist_items i SET checked = $2 FROM checklists c
         WHERE i.id = $1 AND c.id = i.checklist_id AND c.user_id = $3 {ITEM_RETURNING}"
    ))
    .bind(id)
    .bind(checked)
    .bind(uid)
    .fetch_optional(&db.pool)
    .await?
    .ok_or_else(|| not_found("Item", id))
}

#[tauri::command]
pub async fn delete_checklist_item(db: State<'_, Db>, id: i64) -> AppResult<()> {
    let uid = db.user_id().await?;
    let deleted = sqlx::query(
        "DELETE FROM checklist_items i USING checklists c
         WHERE i.id = $1 AND c.id = i.checklist_id AND c.user_id = $2",
    )
    .bind(id)
    .bind(uid)
    .execute(&db.pool)
    .await?
    .rows_affected();
    if deleted == 0 {
        return Err(not_found("Item", id));
    }
    Ok(())
}

/// Tick or untick one "Before you go" check for a duty.
#[tauri::command]
pub async fn set_duty_readiness(db: State<'_, Db>, duty_id: i64, key: String, checked: bool) -> AppResult<()> {
    if !READINESS_KEYS.contains(&key.as_str()) {
        return Err(AppError::new(format!("Unknown readiness item: {key}")));
    }
    let uid = db.user_id().await?;
    let written = sqlx::query(
        "INSERT INTO duty_readiness (duty_id, item_key, checked)
         SELECT d.id, $2, $3 FROM duties d WHERE d.id = $1 AND d.user_id = $4
         ON CONFLICT (duty_id, item_key) DO UPDATE SET checked = EXCLUDED.checked",
    )
    .bind(duty_id)
    .bind(key)
    .bind(checked)
    .bind(uid)
    .execute(&db.pool)
    .await?
    .rows_affected();
    if written == 0 {
        return Err(not_found("Duty", duty_id));
    }
    Ok(())
}

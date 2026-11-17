//! Row types shared by the commands. Each type knows its SELECT column list,
//! so queries only add WHERE / ORDER BY clauses.
//!
//! Dates, times, and timestamps are rendered to text in SQL so the frontend
//! keeps getting "YYYY-MM-DD", "HH:MM", and "YYYY-MM-DD HH:MM:SS" (local time —
//! see the session time zone in `db.rs`). Fields serialize as camelCase to match
//! `src/lib/types.ts`.

use serde::Serialize;
use sqlx::FromRow;

/// SQL fragments for the text formats above.
macro_rules! date {
    ($col:literal) => {
        concat!("to_char(", $col, ", 'YYYY-MM-DD')")
    };
}
macro_rules! time {
    ($col:literal) => {
        concat!("to_char(", $col, ", 'HH24:MI')")
    };
}
macro_rules! ts {
    ($col:literal) => {
        concat!("to_char(", $col, ", 'YYYY-MM-DD HH24:MI:SS')")
    };
}
pub(crate) use {date, time, ts};

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: i64,
    pub full_name: String,
    pub display_name: String,
    pub role: String,
    pub avatar_path: Option<String>,
    pub email: Option<String>,
    pub university: Option<String>,
    pub student_id: Option<String>,
    pub year_level: Option<String>,
    /// Small `data:image/...` URL for the profile picture.
    pub avatar_data: Option<String>,
    /// "student" | "clinical_instructor"
    pub account_type: String,
}

impl Profile {
    pub const SELECT: &'static str = "SELECT u.id, u.full_name, u.display_name, u.role, \
         NULL::text AS avatar_path, u.email::text AS email, u.university, u.student_id, \
         u.year_level, u.avatar_url AS avatar_data, u.account_type FROM users u";
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Duty {
    pub id: i64,
    pub area: String,
    pub hospital: String,
    pub location: Option<String>,
    pub duty_date: String,
    pub start_time: String,
    pub end_time: String,
    pub clinical_instructor: Option<String>,
    pub notes: Option<String>,
}

impl Duty {
    pub const SELECT: &'static str = concat!(
        "SELECT d.id, d.area, d.hospital, d.location, ",
        date!("d.duty_date"), " AS duty_date, ",
        time!("d.start_time"), " AS start_time, ",
        time!("d.end_time"), " AS end_time, ",
        "d.clinical_instructor, d.notes FROM duties d"
    );
}

/// Calendar event that isn't a clinical duty (exam, return demo, ...).
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: i64,
    pub title: String,
    /// "exam" | "other"
    pub event_type: String,
    pub event_date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub location: Option<String>,
    pub description: Option<String>,
}

impl Event {
    pub const SELECT: &'static str = concat!(
        "SELECT e.id, e.title, e.event_type, ",
        date!("e.event_date"), " AS event_date, ",
        time!("e.start_time"), " AS start_time, ",
        time!("e.end_time"), " AS end_time, ",
        "e.location, e.description FROM events e"
    );
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Requirement {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub due_date: String,
    pub status: String,
    pub color: String,
}

impl Requirement {
    pub const SELECT: &'static str = concat!(
        "SELECT r.id, r.title, r.description, ",
        date!("r.due_date"), " AS due_date, ",
        "r.status, r.color FROM requirements r"
    );
}

/// A file submitted for instructor review.
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: i64,
    pub requirement_id: Option<i64>,
    pub requirement_title: Option<String>,
    pub file_name: String,
    pub file_path: Option<String>,
    /// "pending" | "under_review" | "approved" | "needs_revision"
    pub status: String,
    pub submitted_at: String,
    pub feedback: Option<String>,
    pub feedback_at: Option<String>,
    pub reviewed_by: Option<String>,
    pub title: Option<String>,
    pub document_type: Option<String>,
    pub notes: Option<String>,
}

impl Document {
    pub const SELECT: &'static str = concat!(
        "SELECT d.id, d.requirement_id, r.title AS requirement_title, d.file_name, ",
        "d.storage_key AS file_path, d.status, ",
        ts!("d.submitted_at"), " AS submitted_at, d.feedback, ",
        ts!("d.feedback_at"), " AS feedback_at, d.reviewed_by, d.title, d.document_type, d.notes ",
        "FROM documents d LEFT JOIN requirements r ON r.id = d.requirement_id"
    );
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub category: String,
    pub duration_minutes: Option<i32>,
    pub due_date: String,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub due_time: Option<String>,
    /// "high" | "medium" | "low"
    pub priority: String,
    pub subject: Option<String>,
    pub notes: Option<String>,
}

impl Task {
    pub const SELECT: &'static str = concat!(
        "SELECT t.id, t.title, t.category, t.duration_minutes, ",
        date!("t.due_date"), " AS due_date, t.completed, ",
        ts!("t.completed_at"), " AS completed_at, ",
        time!("t.due_time"), " AS due_time, ",
        "t.priority, t.subject, t.notes FROM tasks t"
    );
}

/// A checklist with item counts (e.g. "Duty Bag", 9 of 12 ready).
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistSummary {
    pub id: i64,
    pub name: String,
    pub duty_id: Option<i64>,
    pub total: i64,
    pub checked: i64,
}

impl ChecklistSummary {
    /// Callers add `WHERE c.user_id = …` and then `GROUP BY c.id`.
    pub const SELECT: &'static str = "SELECT c.id, c.name, c.duty_id, COUNT(i.id) AS total, \
         COUNT(i.id) FILTER (WHERE i.checked) AS checked \
         FROM checklists c LEFT JOIN checklist_items i ON i.checklist_id = c.id";
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    pub id: i64,
    pub checklist_id: i64,
    pub label: String,
    pub checked: bool,
    pub position: i32,
}

impl ChecklistItem {
    pub const SELECT: &'static str =
        "SELECT i.id, i.checklist_id, i.label, i.checked, i.position FROM checklist_items i";
}

/// A checklist with its items (Duty Checklist page).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistDetail {
    pub id: i64,
    pub name: String,
    /// "bag" | "rotation"
    pub kind: String,
    pub duty_id: Option<i64>,
    pub area: Option<String>,
    pub items: Vec<ChecklistItem>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CiNote {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub is_important: bool,
    pub created_at: String,
    pub clinical_instructor: Option<String>,
    pub clinical_area: Option<String>,
    /// `YYYY-MM-DD` the instruction was given.
    pub note_date: Option<String>,
    pub is_pinned: bool,
    pub duty_id: Option<i64>,
    /// Related duty's area and date, for display.
    pub duty_area: Option<String>,
    pub duty_date: Option<String>,
}

impl CiNote {
    /// Aliased `n` (notes) and `d` (duties): qualify columns in WHERE/ORDER BY.
    pub const SELECT: &'static str = concat!(
        "SELECT n.id, n.title, n.content, n.is_important, ",
        ts!("n.created_at"), " AS created_at, n.clinical_instructor, n.clinical_area, ",
        date!("n.note_date"), " AS note_date, n.is_pinned, n.duty_id, d.area AS duty_area, ",
        date!("d.duty_date"), " AS duty_date ",
        "FROM ci_notes n LEFT JOIN duties d ON d.id = n.duty_id"
    );
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct QuickLink {
    pub id: i64,
    pub label: String,
    pub url: String,
    pub position: i32,
}

impl QuickLink {
    pub const SELECT: &'static str = "SELECT q.id, q.label, q.url, q.position FROM quick_links q";
}

/// `(done, total)` counts.
#[derive(Debug, Default, Serialize, FromRow)]
pub struct Ratio {
    pub done: i64,
    pub total: i64,
}

//! Clinical instructor side: Home dashboard and My Groups.
//!
//! Every command checks that the current user is a clinical instructor, and
//! only reads students who are members of that instructor's own groups.

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use super::{iso, not_found, optional_text, required_text, today};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{date, time, ts, Profile};

const GROUP_COLORS: &[&str] = &["blue", "green", "purple", "amber", "pink", "teal"];

/// The instructor's students (any of their groups). `$1` = instructor id.
pub(crate) const MY_STUDENTS: &str = "SELECT gm.student_id FROM group_members gm
     JOIN clinical_groups g ON g.id = gm.group_id WHERE g.instructor_id = $1";

// ---------- models ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GroupSummary {
    pub id: i64,
    pub name: String,
    pub area: Option<String>,
    pub hospital: Option<String>,
    pub term: Option<String>,
    pub color: String,
    pub member_count: i64,
    /// Earliest upcoming duty among members.
    pub next_duty_date: Option<String>,
    /// Members' documents waiting for review.
    pub pending_reviews: i64,
}

/// `$1` = instructor id, `$2` = today.
const GROUP_SELECT: &str = concat!(
    "SELECT g.id, g.name, g.area, g.hospital, g.term, g.color,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT ", date!("MIN(d.duty_date)"), " FROM duties d
            JOIN group_members gm ON gm.student_id = d.user_id
            WHERE gm.group_id = g.id AND d.duty_date >= $2::date) AS next_duty_date,
        (SELECT COUNT(*) FROM documents doc
            JOIN group_members gm ON gm.student_id = doc.user_id
            WHERE gm.group_id = g.id AND doc.status IN ('pending', 'under_review')) AS pending_reviews
     FROM clinical_groups g WHERE g.instructor_id = $1"
);

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct GroupMember {
    pub student_id: i64,
    pub full_name: String,
    pub email: String,
    pub student_number: Option<String>,
    pub year_level: Option<String>,
    pub avatar_data: Option<String>,
    pub next_duty_id: Option<i64>,
    pub next_duty_date: Option<String>,
    pub next_duty_area: Option<String>,
    /// "Before you go" checks done for the next duty (of 4).
    pub readiness_done: i64,
    pub pending_reviews: i64,
    pub needs_revision: i64,
    pub overdue_tasks: i64,
    pub requirements_done: i64,
    pub requirements_total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupDetail {
    pub group: GroupSummary,
    pub members: Vec<GroupMember>,
    /// Students invited but not yet accepted (only their email is shown).
    pub invitations: Vec<PendingInvite>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PendingInvite {
    pub student_id: i64,
    pub email: String,
    pub invited_at: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CiStats {
    pub students: i64,
    pub groups: i64,
    pub pending_reviews: i64,
    pub on_duty_today: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ReviewItem {
    pub document_id: i64,
    pub student_id: i64,
    pub student_name: String,
    pub title: String,
    pub document_type: Option<String>,
    pub status: String,
    pub submitted_at: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct StudentFlag {
    pub student_id: i64,
    pub student_name: String,
    pub group_id: i64,
    pub group_name: String,
    /// "overdue" | "revision" | "not_ready"
    pub kind: String,
    pub detail: String,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DeadlineSummary {
    pub title: String,
    pub due_date: String,
    pub submitted: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DutyToday {
    pub area: String,
    pub hospital: String,
    pub start_time: String,
    pub end_time: String,
    pub students: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CiDashboard {
    pub profile: Profile,
    pub stats: CiStats,
    pub today_duties: Vec<DutyToday>,
    pub pending_reviews: Vec<ReviewItem>,
    pub attention: Vec<StudentFlag>,
    pub deadlines: Vec<DeadlineSummary>,
    pub groups: Vec<GroupSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupInput {
    pub name: String,
    pub area: Option<String>,
    pub hospital: Option<String>,
    pub term: Option<String>,
    pub color: Option<String>,
}

// ---------- helpers ----------

/// The current user's id, if they're a clinical instructor.
pub(crate) async fn instructor_id(db: &Db) -> AppResult<i64> {
    let uid = db.user_id().await?;
    let kind: String = sqlx::query_scalar("SELECT account_type FROM users WHERE id = $1")
        .bind(uid)
        .fetch_one(&db.pool)
        .await?;
    if kind != "clinical_instructor" {
        return Err(AppError::new("This page is for clinical instructors"));
    }
    Ok(uid)
}

async fn group_summary(pool: &PgPool, ci: i64, id: i64) -> AppResult<GroupSummary> {
    sqlx::query_as::<_, GroupSummary>(&format!("{GROUP_SELECT} AND g.id = $3"))
        .bind(ci)
        .bind(iso(today()))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| not_found("Group", id))
}

async fn list_groups_for(pool: &PgPool, ci: i64) -> AppResult<Vec<GroupSummary>> {
    Ok(sqlx::query_as::<_, GroupSummary>(&format!("{GROUP_SELECT} ORDER BY lower(g.name)"))
        .bind(ci)
        .bind(iso(today()))
        .fetch_all(pool)
        .await?)
}

struct ValidGroup {
    name: String,
    area: Option<String>,
    hospital: Option<String>,
    term: Option<String>,
    color: String,
}

impl GroupInput {
    fn validate(self) -> AppResult<ValidGroup> {
        let color = self.color.unwrap_or_else(|| "blue".into());
        if !GROUP_COLORS.contains(&color.as_str()) {
            return Err(AppError::new(format!("Unknown color: {color}")));
        }
        Ok(ValidGroup {
            name: required_text(&self.name, "Group name")?,
            area: optional_text(self.area),
            hospital: optional_text(self.hospital),
            term: optional_text(self.term),
            color,
        })
    }
}

fn map_unique(err: sqlx::Error) -> AppError {
    match &err {
        sqlx::Error::Database(e) if e.is_unique_violation() => AppError::new("You already have a group with that name"),
        _ => err.into(),
    }
}

// ---------- commands ----------

/// Everything the instructor Home screen needs.
pub async fn get_ci_dashboard(db: &Db) -> AppResult<CiDashboard> {
    let ci = instructor_id(&db).await?;
    let pool = &db.pool;
    let today_s = iso(today());

    let profile = sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(ci)
        .fetch_one(pool)
        .await?;

    let stats = sqlx::query_as::<_, CiStats>(&format!(
        "SELECT
            (SELECT COUNT(DISTINCT student_id) FROM ({MY_STUDENTS}) s) AS students,
            (SELECT COUNT(*) FROM clinical_groups WHERE instructor_id = $1) AS groups,
            (SELECT COUNT(*) FROM documents WHERE user_id IN ({MY_STUDENTS})
                AND status IN ('pending', 'under_review')) AS pending_reviews,
            (SELECT COUNT(DISTINCT user_id) FROM duties WHERE user_id IN ({MY_STUDENTS})
                AND duty_date = $2::date) AS on_duty_today"
    ))
    .bind(ci)
    .bind(&today_s)
    .fetch_one(pool)
    .await?;

    let today_duties = sqlx::query_as::<_, DutyToday>(&format!(
        concat!(
            "SELECT d.area, d.hospital, ", time!("d.start_time"), " AS start_time, ",
            time!("d.end_time"), " AS end_time, COUNT(DISTINCT d.user_id) AS students
             FROM duties d WHERE d.user_id IN ({}) AND d.duty_date = $2::date
             GROUP BY d.area, d.hospital, d.start_time, d.end_time ORDER BY d.start_time"
        ),
        MY_STUDENTS
    ))
    .bind(ci)
    .bind(&today_s)
    .fetch_all(pool)
    .await?;

    let pending_reviews = sqlx::query_as::<_, ReviewItem>(&format!(
        concat!(
            "SELECT doc.id AS document_id, u.id AS student_id, u.full_name AS student_name,
                COALESCE(doc.title, doc.file_name) AS title, doc.document_type, doc.status, ",
            ts!("doc.submitted_at"), " AS submitted_at
             FROM documents doc JOIN users u ON u.id = doc.user_id
             WHERE doc.user_id IN ({}) AND doc.status IN ('pending', 'under_review')
             ORDER BY doc.submitted_at LIMIT 5"
        ),
        MY_STUDENTS
    ))
    .bind(ci)
    .fetch_all(pool)
    .await?;

    // One row per (student, reason); a student in two groups shows the first group.
    let attention = sqlx::query_as::<_, StudentFlag>(&format!(
        "WITH members AS (
            SELECT DISTINCT ON (gm.student_id) gm.student_id, u.full_name, g.id AS group_id, g.name AS group_name
            FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id JOIN users u ON u.id = gm.student_id
            WHERE g.instructor_id = $1 ORDER BY gm.student_id, g.id
         ),
         next_duty AS (
            SELECT DISTINCT ON (d.user_id) d.user_id, d.id, d.duty_date
            FROM duties d WHERE d.user_id IN (SELECT student_id FROM members) AND d.duty_date >= $2::date
            ORDER BY d.user_id, d.duty_date, d.start_time
         ),
         flags AS (
            SELECT m.student_id, 'revision' AS kind, 1 AS rank,
                   COUNT(*) || ' document' || CASE WHEN COUNT(*) > 1 THEN 's' ELSE '' END || ' need revision' AS detail
            FROM members m JOIN documents doc ON doc.user_id = m.student_id AND doc.status = 'needs_revision'
            GROUP BY m.student_id
            UNION ALL
            SELECT m.student_id, 'overdue', 2,
                   COUNT(*) || ' overdue task' || CASE WHEN COUNT(*) > 1 THEN 's' ELSE '' END
            FROM members m JOIN tasks t ON t.user_id = m.student_id AND NOT t.completed AND t.due_date < $2::date
            GROUP BY m.student_id
            UNION ALL
            SELECT nd.user_id, 'not_ready', 3,
                   (SELECT COUNT(*) FROM duty_readiness r WHERE r.duty_id = nd.id AND r.checked)
                   || ' of 4 duty checks done · duty ' ||
                   CASE nd.duty_date - $2::date WHEN 0 THEN 'today' WHEN 1 THEN 'tomorrow'
                        ELSE to_char(nd.duty_date, 'Mon DD') END
            FROM next_duty nd
            WHERE nd.duty_date <= $2::date + 2
              AND (SELECT COUNT(*) FROM duty_readiness r WHERE r.duty_id = nd.id AND r.checked) < 4
         )
         SELECT f.student_id, m.full_name AS student_name, m.group_id, m.group_name, f.kind, f.detail
         FROM flags f JOIN members m ON m.student_id = f.student_id
         ORDER BY f.rank, m.full_name LIMIT 6"
    ))
    .bind(ci)
    .bind(&today_s)
    .fetch_all(pool)
    .await?;

    let deadlines = sqlx::query_as::<_, DeadlineSummary>(&format!(
        concat!(
            "SELECT r.title, ", date!("r.due_date"), " AS due_date,
                COUNT(*) FILTER (WHERE r.status = 'submitted' OR EXISTS (
                    SELECT 1 FROM documents doc WHERE doc.requirement_id = r.id AND doc.status <> 'needs_revision'
                )) AS submitted,
                COUNT(*) AS total
             FROM requirements r
             WHERE r.user_id IN ({}) AND r.due_date BETWEEN $2::date AND $2::date + 14
             GROUP BY r.title, r.due_date ORDER BY r.due_date, r.title LIMIT 5"
        ),
        MY_STUDENTS
    ))
    .bind(ci)
    .bind(&today_s)
    .fetch_all(pool)
    .await?;

    let groups = list_groups_for(pool, ci).await?;

    Ok(CiDashboard { profile, stats, today_duties, pending_reviews, attention, deadlines, groups })
}
pub async fn list_groups(db: &Db) -> AppResult<Vec<GroupSummary>> {
    let ci = instructor_id(&db).await?;
    list_groups_for(&db.pool, ci).await
}

/// A group with each member's preparation status.
pub async fn get_group(db: &Db, id: i64) -> AppResult<GroupDetail> {
    let ci = instructor_id(&db).await?;
    let group = group_summary(&db.pool, ci, id).await?;
    let members = sqlx::query_as::<_, GroupMember>(concat!(
        "WITH m AS (
            SELECT u.* FROM group_members gm JOIN users u ON u.id = gm.student_id WHERE gm.group_id = $1
         ),
         nd AS (
            SELECT DISTINCT ON (d.user_id) d.user_id, d.id, d.duty_date, d.area
            FROM duties d WHERE d.user_id IN (SELECT id FROM m) AND d.duty_date >= $2::date
            ORDER BY d.user_id, d.duty_date, d.start_time
         )
         SELECT m.id AS student_id, m.full_name, m.email::text AS email, m.student_id AS student_number,
            m.year_level, m.avatar_url AS avatar_data,
            nd.id AS next_duty_id, ", date!("nd.duty_date"), " AS next_duty_date, nd.area AS next_duty_area,
            (SELECT COUNT(*) FROM duty_readiness r WHERE r.duty_id = nd.id AND r.checked) AS readiness_done,
            (SELECT COUNT(*) FROM documents d WHERE d.user_id = m.id AND d.status IN ('pending', 'under_review')) AS pending_reviews,
            (SELECT COUNT(*) FROM documents d WHERE d.user_id = m.id AND d.status = 'needs_revision') AS needs_revision,
            (SELECT COUNT(*) FROM tasks t WHERE t.user_id = m.id AND NOT t.completed AND t.due_date < $2::date) AS overdue_tasks,
            (SELECT COUNT(*) FROM requirements r WHERE r.user_id = m.id AND (r.status = 'submitted' OR EXISTS (
                SELECT 1 FROM documents d WHERE d.requirement_id = r.id AND d.status <> 'needs_revision'))) AS requirements_done,
            (SELECT COUNT(*) FROM requirements r WHERE r.user_id = m.id) AS requirements_total
         FROM m LEFT JOIN nd ON nd.user_id = m.id
         ORDER BY m.full_name"
    ))
    .bind(id)
    .bind(iso(today()))
    .fetch_all(&db.pool)
    .await?;
    let invitations = sqlx::query_as::<_, PendingInvite>(concat!(
        "SELECT m.student_id, u.email::text AS email, ", ts!("m.added_at"), " AS invited_at
         FROM group_memberships m JOIN users u ON u.id = m.student_id
         WHERE m.group_id = $1 AND m.status = 'pending' ORDER BY m.added_at DESC"
    ))
    .bind(id)
    .fetch_all(&db.pool)
    .await?;
    Ok(GroupDetail { group, members, invitations })
}
pub async fn create_group(db: &Db, input: GroupInput) -> AppResult<GroupSummary> {
    let g = input.validate()?;
    let ci = instructor_id(&db).await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO clinical_groups (instructor_id, name, area, hospital, term, color)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(ci)
    .bind(g.name)
    .bind(g.area)
    .bind(g.hospital)
    .bind(g.term)
    .bind(g.color)
    .fetch_one(&db.pool)
    .await
    .map_err(map_unique)?;
    group_summary(&db.pool, ci, id).await
}
pub async fn update_group(db: &Db, id: i64, input: GroupInput) -> AppResult<GroupSummary> {
    let g = input.validate()?;
    let ci = instructor_id(&db).await?;
    let changed = sqlx::query(
        "UPDATE clinical_groups SET name = $3, area = $4, hospital = $5, term = $6, color = $7
         WHERE id = $1 AND instructor_id = $2",
    )
    .bind(id)
    .bind(ci)
    .bind(g.name)
    .bind(g.area)
    .bind(g.hospital)
    .bind(g.term)
    .bind(g.color)
    .execute(&db.pool)
    .await
    .map_err(map_unique)?
    .rows_affected();
    if changed == 0 {
        return Err(not_found("Group", id));
    }
    group_summary(&db.pool, ci, id).await
}

/// Deletes the group (students keep their accounts and data).
pub async fn delete_group(db: &Db, id: i64) -> AppResult<()> {
    let ci = instructor_id(&db).await?;
    let deleted = sqlx::query("DELETE FROM clinical_groups WHERE id = $1 AND instructor_id = $2")
        .bind(id)
        .bind(ci)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if deleted == 0 {
        return Err(not_found("Group", id));
    }
    Ok(())
}

/// Invites a student (by email or student ID) to the group. The student
/// must accept before the instructor can see any of their records.
pub async fn add_group_member(db: &Db, group_id: i64, identifier: String) -> AppResult<GroupDetail> {
    let identifier = required_text(&identifier, "Email or student ID")?;
    let ci = instructor_id(&db).await?;
    group_summary(&db.pool, ci, group_id).await?; // must be the instructor's group
    let student: Option<(i64, String)> = sqlx::query_as(
        "SELECT id, account_type FROM users WHERE email = $1::citext OR student_id = $1 ORDER BY id LIMIT 1",
    )
    .bind(&identifier)
    .fetch_optional(&db.pool)
    .await?;
    let student_id = match student {
        None => return Err(AppError::new("No student found with that email or student ID")),
        Some((_, kind)) if kind != "student" => return Err(AppError::new("That account isn't a student account")),
        Some((id, _)) => id,
    };
    let existing: Option<String> =
        sqlx::query_scalar("SELECT status FROM group_memberships WHERE group_id = $1 AND student_id = $2")
            .bind(group_id)
            .bind(student_id)
            .fetch_optional(&db.pool)
            .await?;
    match existing.as_deref() {
        Some("active") => return Err(AppError::new("That student is already in this group")),
        Some(_) => return Err(AppError::new("That student has already been invited")),
        None => {}
    }
    sqlx::query("INSERT INTO group_memberships (group_id, student_id, status) VALUES ($1, $2, 'pending')")
        .bind(group_id)
        .bind(student_id)
        .execute(&db.pool)
        .await?;
    get_group(db, group_id).await
}

/// Gives a student who just joined the group its upcoming duties and open requirements.
pub(crate) async fn give_group_work(pool: &PgPool, group_id: i64, student_id: i64) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO duties (user_id, area, hospital, location, duty_date, start_time, end_time,
                             clinical_instructor, notes, assignment_id)
         SELECT $2, a.area, a.hospital, a.location, a.duty_date, a.start_time, a.end_time, u.full_name, a.notes, a.id
         FROM duty_assignments a JOIN users u ON u.id = a.instructor_id
         WHERE a.group_id = $1 AND a.duty_date >= CURRENT_DATE",
    )
    .bind(group_id)
    .bind(student_id)
    .execute(pool)
    .await?;
    sqlx::query(
        "INSERT INTO requirements (user_id, title, description, due_date, assignment_id)
         SELECT $2, r.title, r.description, r.due_date, r.id
         FROM requirement_assignments r WHERE r.group_id = $1 AND r.due_date >= CURRENT_DATE",
    )
    .bind(group_id)
    .bind(student_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// The instructor's display name (stored on the copies they create).
pub(crate) async fn instructor_name(pool: &PgPool, ci: i64) -> AppResult<String> {
    Ok(sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1").bind(ci).fetch_one(pool).await?)
}

/// Errors unless `group_id` belongs to the instructor.
pub(crate) async fn check_group(pool: &PgPool, ci: i64, group_id: i64) -> AppResult<()> {
    let ok: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM clinical_groups WHERE id = $1 AND instructor_id = $2)")
        .bind(group_id)
        .bind(ci)
        .fetch_one(pool)
        .await?;
    if ok { Ok(()) } else { Err(not_found("Group", group_id)) }
}

/// Errors unless the student is in one of the instructor's groups.
pub(crate) async fn check_student(pool: &PgPool, ci: i64, student_id: i64) -> AppResult<()> {
    let ok: bool = sqlx::query_scalar(&format!("SELECT $2 IN ({MY_STUDENTS})"))
        .bind(ci)
        .bind(student_id)
        .fetch_one(pool)
        .await?;
    if ok { Ok(()) } else { Err(not_found("Student", student_id)) }
}

/// Errors unless the duty belongs to one of the instructor's students.
pub(crate) async fn check_duty(pool: &PgPool, ci: i64, duty_id: i64) -> AppResult<()> {
    let ok: bool = sqlx::query_scalar(&format!(
        "SELECT EXISTS (SELECT 1 FROM duties WHERE id = $2 AND user_id IN ({MY_STUDENTS}))"
    ))
    .bind(ci)
    .bind(duty_id)
    .fetch_one(pool)
    .await?;
    if ok { Ok(()) } else { Err(not_found("Duty", duty_id)) }
}

/// Students in the instructor's groups (for audience pickers).
#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MyStudent {
    pub student_id: i64,
    pub full_name: String,
    pub group_id: i64,
    pub group_name: String,
}
pub async fn list_my_students(db: &Db) -> AppResult<Vec<MyStudent>> {
    let ci = instructor_id(&db).await?;
    Ok(sqlx::query_as::<_, MyStudent>(
        "SELECT DISTINCT ON (u.id) u.id AS student_id, u.full_name, g.id AS group_id, g.name AS group_name
         FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id JOIN users u ON u.id = gm.student_id
         WHERE g.instructor_id = $1 ORDER BY u.id, g.id",
    )
    .bind(ci)
    .fetch_all(&db.pool)
    .await?)
}
pub async fn remove_group_member(db: &Db, group_id: i64, student_id: i64) -> AppResult<GroupDetail> {
    let ci = instructor_id(&db).await?;
    group_summary(&db.pool, ci, group_id).await?;
    sqlx::query("DELETE FROM group_memberships WHERE group_id = $1 AND student_id = $2")
        .bind(group_id)
        .bind(student_id)
        .execute(&db.pool)
        .await?;
    get_group(db, group_id).await
}

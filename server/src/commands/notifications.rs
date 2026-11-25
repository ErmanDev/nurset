//! The top-bar notification bell.
//!
//! Notifications aren't stored: each one is derived from live data (a duty the
//! CI assigned, a requirement due soon, a reviewed document, a new
//! announcement, ...) and has a stable `key`. `notification_reads` remembers
//! which keys the user has read. Settings › Notifications decides which
//! categories show (`notif_*` keys; "In-app notifications" turns the bell off).

use std::collections::HashMap;

use chrono::{Local, NaiveTime};
use serde::Serialize;
use sqlx::FromRow;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::ts;

/// How far back event-style notifications (assignments, announcements, ...) go.
const WINDOW_DAYS: i32 = 14;
const LIMIT: i64 = 40;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    pub key: String,
    /// Settings category: assigned | deadlines | tasks | announcements | learning_hub | study
    pub category: String,
    /// Icon/colour hint: duty | requirement | review_ok | review_fix | instruction | task | announcement | material | study | attendance | evaluation
    pub kind: String,
    pub title: String,
    pub body: String,
    /// App route to open.
    pub link: String,
    pub at: String,
    pub read: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationFeed {
    /// False when "In-app notifications" is off in Settings.
    pub enabled: bool,
    pub unread: usize,
    pub items: Vec<Notification>,
}

/// Each source yields (key, category, kind, title, body, link, at timestamptz).
/// `$1` = user id, `$2` = window in days.
const STUDENT_SOURCES: &str = concat!(
    // An instructor invited the student to a group.
    "SELECT 'invite:' || m.group_id AS key, 'assigned' AS category, 'invitation' AS kind,
            'Group invitation' AS title,
            u.full_name || ' invited you to ' || g.name || '. Accept it on your Home page.' AS body,
            '/' AS link, m.added_at AS at
     FROM group_memberships m JOIN clinical_groups g ON g.id = m.group_id JOIN users u ON u.id = g.instructor_id
     WHERE m.student_id = $1 AND m.status = 'pending'
     UNION ALL ",
    // A CI assigned a duty.
    "SELECT 'duty-assigned:' || d.id, 'assigned', 'duty',
            'New duty assigned',
            d.area || ' · ' || d.hospital || ' on ' || to_char(d.duty_date, 'Dy, Mon FMDD') AS body,
            '/duty-schedule' AS link, d.created_at AS at
     FROM duties d
     WHERE d.user_id = $1 AND d.assignment_id IS NOT NULL AND d.duty_date >= CURRENT_DATE
       AND d.created_at > now() - make_interval(days => $2)
     UNION ALL ",
    // Duty today / tomorrow.
    "SELECT 'duty-soon:' || d.id || ':' || d.duty_date, 'assigned', 'duty',
            CASE WHEN d.duty_date = CURRENT_DATE THEN 'Duty today' ELSE 'Duty tomorrow' END,
            d.area || ' · ' || d.hospital || ', ' || to_char(d.start_time, 'FMHH12:MI AM') || '. Check your duty checklist.',
            '/duty-checklist', CURRENT_DATE::timestamptz
     FROM duties d
     WHERE d.user_id = $1 AND d.duty_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 1
     UNION ALL ",
    // A CI assigned a requirement.
    "SELECT 'req-assigned:' || r.id, 'assigned', 'requirement', 'New requirement',
            r.title || ' · due ' || to_char(r.due_date, 'Mon FMDD'), '/requirements', r.created_at
     FROM requirements r
     WHERE r.user_id = $1 AND r.assignment_id IS NOT NULL AND r.created_at > now() - make_interval(days => $2)
     UNION ALL ",
    // Instruction from a CI (delivered as a CI note).
    "SELECT 'instruction:' || n.id, 'assigned', 'instruction',
            'New instruction' || COALESCE(' from ' || n.clinical_instructor, ''), n.title, '/ci-notes', n.created_at
     FROM ci_notes n
     WHERE n.user_id = $1 AND n.instruction_id IS NOT NULL AND n.created_at > now() - make_interval(days => $2)
     UNION ALL ",
    // A CI reviewed one of my documents.
    "SELECT 'doc:' || dc.id || ':' || dc.status, 'assigned',
            CASE dc.status WHEN 'approved' THEN 'review_ok' ELSE 'review_fix' END,
            CASE dc.status WHEN 'approved' THEN 'Document approved' ELSE 'Revision requested' END,
            '“' || COALESCE(dc.title, dc.file_name) || '”' || COALESCE(' · ' || dc.reviewed_by, '')
              || CASE WHEN dc.status = 'needs_revision' AND dc.feedback IS NOT NULL THEN ': ' || dc.feedback ELSE '' END,
            '/requirements', dc.updated_at
     FROM documents dc
     WHERE dc.user_id = $1 AND dc.reviewer_id IS NOT NULL AND dc.status IN ('approved', 'needs_revision')
       AND dc.updated_at > now() - make_interval(days => $2)
     UNION ALL ",
    // Requirements due within 3 days, or overdue (up to a week).
    "SELECT 'req-due:' || r.id || ':' || r.due_date, 'deadlines', 'requirement',
            CASE WHEN r.due_date < CURRENT_DATE THEN 'Requirement overdue'
                 WHEN r.due_date = CURRENT_DATE THEN 'Requirement due today'
                 WHEN r.due_date = CURRENT_DATE + 1 THEN 'Requirement due tomorrow'
                 ELSE 'Requirement due ' || to_char(r.due_date, 'Dy, Mon FMDD') END,
            r.title, '/requirements', CURRENT_DATE::timestamptz
     FROM requirements r
     WHERE r.user_id = $1 AND r.status <> 'submitted'
       AND r.due_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 3
     UNION ALL ",
    // Unfinished tasks due today or overdue (up to a week).
    "SELECT 'task-due:' || t.id || ':' || t.due_date, 'tasks', 'task',
            CASE WHEN t.due_date < CURRENT_DATE THEN 'Task overdue' ELSE 'Task due today' END,
            t.title || COALESCE(' · ' || to_char(t.due_time, 'FMHH12:MI AM'), ''), '/tasks', CURRENT_DATE::timestamptz
     FROM tasks t
     WHERE t.user_id = $1 AND NOT t.completed AND t.due_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE
     UNION ALL ",
    // Announcements from my instructors (or school-wide).
    "SELECT 'ann:' || a.id, 'announcements', 'announcement',
            CASE a.category WHEN 'important' THEN 'Important announcement' WHEN 'reminder' THEN 'Reminder' ELSE 'New announcement' END,
            a.title, '/announcements', a.created_at
     FROM announcements a
     WHERE a.created_at > now() - make_interval(days => $2)
       AND a.author_id IS DISTINCT FROM $1
       AND (a.author_id IS NULL
            OR a.group_id IN (SELECT group_id FROM group_members WHERE student_id = $1)
            OR (a.group_id IS NULL AND a.author_id IN (
                SELECT g.instructor_id FROM group_members gm JOIN clinical_groups g ON g.id = gm.group_id
                WHERE gm.student_id = $1)))
     UNION ALL ",
    // Materials classmates shared to the Learning Hub.
    "SELECT 'mat:' || m.id, 'learning_hub', 'material', 'New in the Learning Hub', m.title,
            '/quick-links/learning-hub', m.created_at
     FROM materials m
     WHERE m.is_shared AND m.owner_id IS DISTINCT FROM $1 AND m.owner_id IS NOT NULL
       AND m.created_at > now() - make_interval(days => $2)"
);

const CI_SOURCES: &str = concat!(
    // Documents waiting for my review.
    "SELECT 'review:' || dc.id AS key, 'assigned' AS category, 'requirement' AS kind,
            'Document to review' AS title,
            u.full_name || ' submitted “' || COALESCE(dc.title, dc.file_name) || '”' AS body,
            '/ci/reviews' AS link, dc.submitted_at AS at
     FROM documents dc JOIN users u ON u.id = dc.user_id
     WHERE dc.status = 'pending'
       AND dc.user_id IN (SELECT gm.student_id FROM group_members gm
                          JOIN clinical_groups g ON g.id = gm.group_id WHERE g.instructor_id = $1)
     UNION ALL ",
    // Today's duties without attendance.
    "SELECT 'attendance:' || CURRENT_DATE, 'tasks', 'attendance', 'Attendance not taken',
            COUNT(*) || ' student' || CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END || ' on duty today '
              || CASE WHEN COUNT(*) = 1 THEN 'isn''t' ELSE 'aren''t' END || ' marked yet.',
            '/ci/duty-day', CURRENT_DATE::timestamptz
     FROM duties d
     LEFT JOIN duty_attendance da ON da.duty_id = d.id
     WHERE d.duty_date = CURRENT_DATE AND da.duty_id IS NULL
       AND d.user_id IN (SELECT gm.student_id FROM group_members gm
                         JOIN clinical_groups g ON g.id = gm.group_id WHERE g.instructor_id = $1)
     HAVING COUNT(*) > 0
     UNION ALL ",
    // Past duties still to evaluate (last 2 weeks).
    "SELECT 'evaluations:' || CURRENT_DATE, 'deadlines', 'evaluation', 'Evaluations pending',
            COUNT(*) || ' completed dut' || CASE WHEN COUNT(*) = 1 THEN 'y needs' ELSE 'ies need' END || ' your evaluation.',
            '/ci/evaluations', CURRENT_DATE::timestamptz
     FROM duties d
     LEFT JOIN duty_evaluations ev ON ev.duty_id = d.id
     WHERE d.duty_date BETWEEN CURRENT_DATE - $2 AND CURRENT_DATE - 1 AND ev.duty_id IS NULL
       AND d.user_id IN (SELECT gm.student_id FROM group_members gm
                         JOIN clinical_groups g ON g.id = gm.group_id WHERE g.instructor_id = $1)
     HAVING COUNT(*) > 0"
);

/// Settings key per category (all default to on).
const CATEGORY_SETTINGS: &[(&str, &str)] = &[
    ("assigned", "notif_assigned"),
    ("deadlines", "notif_deadlines"),
    ("tasks", "notif_tasks"),
    ("announcements", "notif_announcements"),
    ("learning_hub", "notif_learning_hub"),
    ("study", "notif_study"),
];

fn is_on(settings: &HashMap<String, String>, key: &str) -> bool {
    settings.get(key).map(|v| v != "0").unwrap_or(true)
}
pub async fn list_notifications(db: &Db) -> AppResult<NotificationFeed> {
    let uid = db.user_id().await?;
    let settings: HashMap<String, String> =
        sqlx::query_as::<_, (String, String)>("SELECT key, value FROM user_settings WHERE user_id = $1")
            .bind(uid)
            .fetch_all(&db.pool)
            .await?
            .into_iter()
            .collect();
    if !is_on(&settings, "notif_in_app") {
        return Ok(NotificationFeed { enabled: false, unread: 0, items: vec![] });
    }
    // Learning Hub and study reminders lead to Premium pages.
    let premium = super::is_premium(&db.pool, uid).await?;
    let categories: Vec<String> = CATEGORY_SETTINGS
        .iter()
        .filter(|(category, _)| premium || !matches!(*category, "learning_hub" | "study"))
        .filter(|(_, key)| is_on(&settings, key))
        .map(|(c, _)| c.to_string())
        .collect();

    let account_type: String = sqlx::query_scalar("SELECT account_type FROM users WHERE id = $1")
        .bind(uid)
        .fetch_one(&db.pool)
        .await?;
    let sources = if account_type == "clinical_instructor" { CI_SOURCES } else { STUDENT_SOURCES };
    let sql = format!(
        "SELECT s.key, s.category, s.kind, s.title, s.body, s.link, {at} AS at,
                (nr.key IS NOT NULL) AS read
         FROM ({sources}) AS s
         LEFT JOIN notification_reads nr ON nr.user_id = $1 AND nr.key = s.key
         WHERE s.category = ANY($3)
         ORDER BY s.at DESC, s.key
         LIMIT {LIMIT}",
        at = ts!("s.at"),
    );
    let mut items = sqlx::query_as::<_, Notification>(&sql)
        .bind(uid)
        .bind(WINDOW_DAYS)
        .bind(&categories)
        .fetch_all(&db.pool)
        .await?;

    // Study reminder: nothing studied today and it's past the preferred reminder time.
    if account_type != "clinical_instructor" && categories.iter().any(|c| c == "study") {
        let reminder = settings
            .get("reminder_time")
            .and_then(|t| NaiveTime::parse_from_str(t, "%H:%M").ok())
            .unwrap_or_else(|| NaiveTime::from_hms_opt(19, 0, 0).expect("valid time"));
        let now = Local::now();
        if now.time() >= reminder {
            let studied: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM study_activity WHERE user_id = $1 AND created_at::date = CURRENT_DATE)
                     OR EXISTS (SELECT 1 FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id
                                WHERE q.user_id = $1 AND qq.answered_at::date = CURRENT_DATE)",
            )
            .bind(uid)
            .fetch_one(&db.pool)
            .await?;
            if !studied {
                let key = format!("study:{}", now.date_naive());
                let read: bool = sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM notification_reads WHERE user_id = $1 AND key = $2)",
                )
                .bind(uid)
                .bind(&key)
                .fetch_one(&db.pool)
                .await?;
                let at = now.date_naive().and_time(reminder).format("%Y-%m-%d %H:%M:%S").to_string();
                let study = Notification {
                    key,
                    category: "study".into(),
                    kind: "study".into(),
                    title: "Time for a quick review".into(),
                    body: "You haven't studied today. A 10-question quiz keeps your streak going.".into(),
                    link: "/ai-study/quizlab".into(),
                    at,
                    read,
                };
                let pos = items.iter().position(|n| n.at < study.at).unwrap_or(items.len());
                items.insert(pos, study);
            }
        }
    }

    let unread = items.iter().filter(|n| !n.read).count();
    Ok(NotificationFeed { enabled: true, unread, items })
}

/// Marks the given notifications read, or all current ones when `keys` is `None`.
pub async fn mark_notifications_read(db: &Db, keys: Option<Vec<String>>) -> AppResult<()> {
    let uid = db.user_id().await?;
    let keys = match keys {
        Some(k) => k,
        None => list_notifications(db).await?.items.into_iter().map(|n| n.key).collect(),
    };
    if keys.is_empty() {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO notification_reads (user_id, key) SELECT $1, unnest($2::text[])
         ON CONFLICT (user_id, key) DO NOTHING",
    )
    .bind(uid)
    .bind(&keys)
    .execute(&db.pool)
    .await?;
    // Keep the table small: forget reads older than the notification window.
    sqlx::query("DELETE FROM notification_reads WHERE user_id = $1 AND read_at < now() - interval '60 days'")
        .bind(uid)
        .execute(&db.pool)
        .await?;
    Ok(())
}

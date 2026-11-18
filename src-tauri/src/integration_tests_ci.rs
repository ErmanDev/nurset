//! Instructor tools end-to-end against PostgreSQL (see integration_tests.rs).

use std::time::{SystemTime, UNIX_EPOCH};

use chrono::TimeDelta;
use tauri::Manager;

use crate::commands::*;
use crate::commands::{iso, today};
use crate::db::Db;
use crate::integration_tests::app_with_test_user;

#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn instructor_tools_reach_students() {
    let (app, s1) = app_with_test_user().await;
    let st = || app.state::<Db>();
    let pool = st().pool.clone();
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let new_user = |suffix: &'static str, kind: &'static str| {
        let pool = pool.clone();
        let email = format!("test-{nanos}-{suffix}@nurset.local");
        async move {
            let id: i64 = sqlx::query_scalar(
                "INSERT INTO users (email, full_name, display_name, account_type) VALUES ($1, $2, $2, $3) RETURNING id",
            )
            .bind(&email)
            .bind(format!("User {suffix}"))
            .bind(kind)
            .fetch_one(&pool)
            .await
            .unwrap();
            (id, email)
        }
    };
    let (s2, _) = new_user("s2", "student").await;
    let (s3, s3_email) = new_user("s3", "student").await;
    let (outsider, _) = new_user("out", "student").await;
    let (ci, _) = new_user("ci", "clinical_instructor").await;
    let today_s = iso(today());
    let tomorrow = iso(today() + TimeDelta::days(1));
    let as_user = |id: i64| app.state::<Db>().set_user(id);

    // Group with s1 + s2.
    as_user(ci);
    let group = instructor::create_group(st(), serde_json::from_value(serde_json::json!({ "name": "Tools Group" })).unwrap())
        .await
        .unwrap();
    for sid in [s1, s2] {
        sqlx::query("INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)")
            .bind(group.id)
            .bind(sid)
            .execute(&pool)
            .await
            .unwrap();
    }
    assert_eq!(instructor::list_my_students(st()).await.unwrap().len(), 2);

    // ----- duty assignments -----
    let duty_input = |date: &str, start: &str| {
        serde_json::from_value::<ci_assignments::DutyAssignmentInput>(serde_json::json!({
            "groupId": group.id, "area": "Medical Ward", "hospital": "Test Hospital",
            "dutyDate": date, "startTime": start, "endTime": "15:00", "notes": "Bring BP apparatus"
        }))
        .unwrap()
    };
    let today_duty = ci_assignments::create_duty_assignment(st(), duty_input(&today_s, "07:00")).await.unwrap();
    let upcoming = ci_assignments::create_duty_assignment(st(), duty_input(&tomorrow, "07:00")).await.unwrap();
    assert_eq!(today_duty.student_count, 2);
    let moved = ci_assignments::update_duty_assignment(st(), upcoming.id, duty_input(&tomorrow, "06:00")).await.unwrap();
    assert_eq!(moved.start_time, "06:00");
    as_user(s1);
    let s1_duties = duties::list_duties(st()).await.unwrap();
    assert!(s1_duties.iter().any(|d| d.start_time == "06:00" && d.clinical_instructor.as_deref() == Some("User ci")));

    // ----- requirements + backfill for a student added later -----
    as_user(ci);
    let req = ci_assignments::create_requirement_assignment(
        st(),
        serde_json::from_value(serde_json::json!({ "groupId": group.id, "title": "Drug Study", "dueDate": tomorrow })).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!((req.total, req.submitted), (2, 0));
    let detail = instructor::add_group_member(st(), group.id, s3_email.clone()).await.unwrap();
    assert_eq!(detail.members.len(), 3);
    as_user(s3);
    assert_eq!(duties::list_duties(st()).await.unwrap().len(), 2, "gets today's and tomorrow's duties");
    assert_eq!(requirements::list_requirements(st()).await.unwrap().len(), 1, "gets open requirement");

    // ----- reviews -----
    let s1_req: i64 = sqlx::query_scalar("SELECT id FROM requirements WHERE user_id = $1 AND assignment_id = $2")
        .bind(s1)
        .bind(req.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let doc: i64 = sqlx::query_scalar(
        "INSERT INTO documents (user_id, requirement_id, file_name, title) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(s1)
    .bind(s1_req)
    .bind("ds.pdf")
    .bind("Drug Study")
    .fetch_one(&pool)
    .await
    .unwrap();
    as_user(ci);
    assert_eq!(ci_reviews::list_reviews(st(), None).await.unwrap().len(), 1);
    assert!(ci_reviews::review_document(st(), doc, "needs_revision".into(), None).await.is_err(), "needs feedback");
    ci_reviews::review_document(st(), doc, "needs_revision".into(), Some("Add references".into())).await.unwrap();
    assert!(ci_reviews::list_reviews(st(), None).await.unwrap().is_empty(), "no longer open");
    assert_eq!(ci_reviews::list_reviews(st(), Some("all".into())).await.unwrap().len(), 1);
    assert_eq!(ci_reviews::list_reviews(st(), Some("needs_revision".into())).await.unwrap().len(), 1);
    ci_reviews::review_document(st(), doc, "approved".into(), None).await.unwrap();
    let reqs = ci_assignments::list_requirement_assignments(st()).await.unwrap();
    assert_eq!((reqs[0].total, reqs[0].submitted, reqs[0].approved), (3, 1, 1));
    as_user(s1);
    let my_doc = documents::list_documents(st()).await.unwrap().remove(0);
    assert_eq!(
        (my_doc.status.as_str(), my_doc.feedback.as_deref(), my_doc.reviewed_by.as_deref()),
        ("approved", Some("Add references"), Some("User ci"))
    );

    // ----- instructions -----
    as_user(ci);
    let note_input = |group_id: Option<i64>, student_id: Option<i64>| {
        serde_json::from_value::<ci_instructions::InstructionInput>(serde_json::json!({
            "title": "Bring drug study", "content": "Bring it tomorrow.", "noteDate": today_s,
            "isImportant": true, "groupId": group_id, "studentId": student_id
        }))
        .unwrap()
    };
    let to_group = ci_instructions::create_instruction(st(), note_input(Some(group.id), None)).await.unwrap();
    assert_eq!(to_group.recipients, 3);
    let to_one = ci_instructions::create_instruction(st(), note_input(None, Some(s2))).await.unwrap();
    assert_eq!(to_one.recipients, 1);
    assert!(ci_instructions::create_instruction(st(), note_input(None, Some(outsider))).await.is_err(), "not my student");
    assert!(ci_instructions::create_instruction(st(), note_input(None, None)).await.is_err());
    as_user(s2);
    assert_eq!(ci_notes::list_ci_notes(st()).await.unwrap().len(), 2);
    as_user(ci);
    ci_instructions::delete_instruction(st(), to_one.id).await.unwrap();
    as_user(s2);
    assert_eq!(ci_notes::list_ci_notes(st()).await.unwrap().len(), 1);

    // ----- duty day + evaluations -----
    as_user(ci);
    let day = ci_duty_day::get_duty_day(st(), None).await.unwrap();
    assert_eq!(day.len(), 3, "s1, s2, and s3 (who joined today) are on duty");
    let duty_id = day[0].duty_id;
    ci_duty_day::set_attendance(
        st(),
        duty_id,
        serde_json::from_value(serde_json::json!({ "status": "late", "timeIn": "07:20", "remarks": "Traffic" })).unwrap(),
    )
    .await
    .unwrap();
    let day = ci_duty_day::get_duty_day(st(), Some(today_s.clone())).await.unwrap();
    let row = day.iter().find(|r| r.duty_id == duty_id).unwrap();
    assert_eq!((row.attendance.as_deref(), row.time_in.as_deref()), (Some("late"), Some("07:20")));

    let eval = |minutes: i32| {
        serde_json::from_value::<ci_duty_day::EvaluationInput>(serde_json::json!({
            "knowledge": 4, "skills": 5, "professionalism": 4, "communication": 3,
            "comments": "Good work", "verifiedMinutes": minutes
        }))
        .unwrap()
    };
    ci_duty_day::save_evaluation(st(), duty_id, eval(460)).await.unwrap();
    ci_duty_day::save_evaluation(st(), duty_id, eval(480)).await.unwrap(); // update
    let future_duty: i64 = sqlx::query_scalar("SELECT id FROM duties WHERE assignment_id = $1 LIMIT 1")
        .bind(upcoming.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(ci_duty_day::save_evaluation(st(), future_duty, eval(480)).await.is_err(), "future duty");
    let overview = ci_duty_day::get_evaluations(st()).await.unwrap();
    assert_eq!(overview.duties.len(), 3);
    assert!(overview.duties.iter().all(|d| d.scheduled_minutes == 480));
    let total: i64 = overview.students.iter().map(|s| s.verified_minutes).sum();
    assert_eq!(total, 480);

    // ----- announcements -----
    let ann = |group_id: Option<i64>| {
        serde_json::from_value::<ci_announcements::AnnouncementInput>(serde_json::json!({
            "category": "reminder", "title": "Skills lab", "body": "Bring gloves.", "groupId": group_id
        }))
        .unwrap()
    };
    let a1 = ci_announcements::create_announcement(st(), ann(Some(group.id))).await.unwrap();
    ci_announcements::create_announcement(st(), ann(None)).await.unwrap();
    assert_eq!(a1.audience, "Tools Group");
    assert_eq!(ci_announcements::list_ci_announcements(st()).await.unwrap().len(), 2);
    let count = |list: Vec<quick_links::Announcement>| list.into_iter().filter(|a| a.title == "Skills lab").count();
    as_user(s3);
    assert_eq!(count(quick_links::list_announcements(st()).await.unwrap()), 2);
    as_user(outsider);
    assert_eq!(count(quick_links::list_announcements(st()).await.unwrap()), 0, "outsider sees none");
    // ----- notification bell -----
    as_user(s1);
    let feed = notifications::list_notifications(st()).await.unwrap();
    assert!(feed.enabled);
    let has = |feed: &notifications::NotificationFeed, prefix: &str| feed.items.iter().any(|n| n.key.starts_with(prefix));
    for prefix in ["duty-assigned:", "duty-soon:", "req-assigned:", "instruction:", "doc:", "ann:"] {
        assert!(has(&feed, prefix), "student sees {prefix} — got {:?}", feed.items.iter().map(|n| &n.key).collect::<Vec<_>>());
    }
    assert_eq!(feed.unread, feed.items.len());
    let first = feed.items[0].key.clone();
    notifications::mark_notifications_read(st(), Some(vec![first.clone()])).await.unwrap();
    let feed = notifications::list_notifications(st()).await.unwrap();
    assert!(feed.items.iter().any(|n| n.key == first && n.read));
    assert_eq!(feed.unread, feed.items.len() - 1);
    // Category switched off in Settings › Notifications.
    settings::set_settings(st(), [("notif_announcements".to_string(), "0".to_string())].into()).await.unwrap();
    assert!(!has(&notifications::list_notifications(st()).await.unwrap(), "ann:"));
    notifications::mark_notifications_read(st(), None).await.unwrap();
    assert_eq!(notifications::list_notifications(st()).await.unwrap().unread, 0);
    settings::set_settings(st(), [("notif_in_app".to_string(), "0".to_string())].into()).await.unwrap();
    let off = notifications::list_notifications(st()).await.unwrap();
    assert!(!off.enabled && off.items.is_empty());
    // The instructor gets attendance (today's duty unmarked) and runs the CI queries.
    as_user(ci);
    let ci_feed = notifications::list_notifications(st()).await.unwrap();
    assert!(has(&ci_feed, "attendance:"), "got {:?}", ci_feed.items.iter().map(|n| &n.key).collect::<Vec<_>>());

    as_user(ci);
    ci_announcements::delete_announcement(st(), a1.id).await.unwrap();

    // ----- deleting an assignment removes students' copies -----
    ci_assignments::delete_duty_assignment(st(), upcoming.id).await.unwrap();
    as_user(s3);
    assert_eq!(duties::list_duties(st()).await.unwrap().len(), 1, "only today's duty remains");
    as_user(s1);
    assert!(instructor::list_groups(st()).await.is_err(), "students are blocked");

    for id in [ci, s1, s2, s3, outsider] {
        sqlx::query("DELETE FROM users WHERE id = $1").bind(id).execute(&pool).await.unwrap();
    }
}

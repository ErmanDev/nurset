//! End-to-end checks of the Tauri commands against a real PostgreSQL
//! (runtime type checks only happen when queries run).
//!
//!   pnpm db:up && pnpm db:migrate
//!   cargo test -- --ignored        (from server/)
//!
//! Each run creates a throwaway user and deletes it (with all its rows) at the end.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::TimeDelta;

use crate::commands::*;
use crate::commands::{iso, today};
use crate::db::{Db, DEFAULT_DATABASE_URL};

pub(crate) async fn app_with_test_user() -> (Db, i64) {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    let db = Db::connect_lazy(&url).expect("pool");
    // Tests run in parallel and the clock can repeat, so add a per-process counter.
    static NEXT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let uid: i64 = sqlx::query_scalar(
        "INSERT INTO users (email, full_name, display_name) VALUES ($1, 'Test Student', 'Tester') RETURNING id",
    )
    .bind(format!("test-{nanos}-{n}@nurset.local"))
    .fetch_one(&db.pool)
    .await
    .expect("insert test user — is the database running and migrated?");
    db.set_user(uid);
    (db, uid)
}

#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn every_command_works_against_postgres() {
    let (db, uid) = app_with_test_user().await;
    let st = || &db;
    let today_s = iso(today());
    let tomorrow = iso(today() + TimeDelta::days(1));

    // ----- profile -----
    let profile = profile::get_profile(st()).await.unwrap().unwrap();
    assert_eq!(profile.display_name, "Tester");

    // ----- duties & events -----
    let duty = duties::add_duty(
        st(),
        serde_json::from_value(serde_json::json!({
            "area": "Medical Ward", "hospital": "Test Hospital", "location": "3F",
            "dutyDate": tomorrow, "startTime": "07:00", "endTime": "15:00",
            "clinicalInstructor": "CI Test", "notes": null
        }))
        .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!((duty.start_time.as_str(), duty.duty_date.as_str()), ("07:00", tomorrow.as_str()));
    assert_eq!(duties::list_duties(st()).await.unwrap().len(), 1);
    let event = events::add_event(
        st(),
        serde_json::from_value(serde_json::json!({
            "title": "Exam", "eventType": "exam", "eventDate": tomorrow,
            "startTime": "09:00", "endTime": null, "location": null, "description": null
        }))
        .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(event.end_time, None);
    assert_eq!(events::list_events(st()).await.unwrap().len(), 1);

    // ----- requirements -----
    let req = requirements::add_requirement(
        st(),
        serde_json::from_value(serde_json::json!({ "title": "Drug Study", "dueDate": tomorrow })).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(requirements::list_requirements(st()).await.unwrap()[0].id, req.id);
    assert!(documents::list_documents(st()).await.unwrap().is_empty());

    // ----- tasks -----
    let task_input = |title: &str| {
        serde_json::from_value::<tasks::TaskInput>(serde_json::json!({
            "title": title, "category": "Study", "priority": "high", "dueDate": today_s,
            "dueTime": "20:00", "durationMinutes": 30, "subject": "Pharmacology"
        }))
        .unwrap()
    };
    let t1 = tasks::add_task(st(), task_input("Read chapter")).await.unwrap();
    let t2 = tasks::add_task(st(), task_input("Delete me")).await.unwrap();
    assert_eq!(t1.due_time.as_deref(), Some("20:00"));
    let done = tasks::toggle_task(st(), t1.id, true).await.unwrap();
    assert!(done.completed && done.completed_at.is_some());
    let renamed = tasks::update_task(st(), t1.id, task_input("Read chapter 5")).await.unwrap();
    assert!(renamed.completed, "update keeps completion");
    tasks::delete_task(st(), t2.id).await.unwrap();
    assert_eq!(tasks::list_tasks(st(), Some(today_s.clone())).await.unwrap().len(), 1);
    assert_eq!(tasks::list_tasks(st(), None).await.unwrap().len(), 1);

    // ----- dashboard -----
    let dash = dashboard::get_dashboard(st()).await.unwrap();
    assert_eq!(dash.next_duty.as_ref().map(|d| d.id), Some(duty.id));
    assert_eq!(dash.todays_tasks.len(), 1);
    assert_eq!(dash.weekly_progress.completed, 1);

    // ----- duty checklist -----
    let prep = duty_checklist::get_duty_prep(st(), None).await.unwrap();
    let bag = prep.bag.expect("bag created on first view");
    assert_eq!(bag.items.len(), 12);
    assert_eq!(prep.readiness.len(), 4);
    let item = duty_checklist::add_checklist_item(st(), bag.id, "Hand sanitizer".into()).await.unwrap();
    assert_eq!(item.position, 12);
    assert!(duty_checklist::toggle_checklist_item(st(), item.id, true).await.unwrap().checked);
    duty_checklist::delete_checklist_item(st(), item.id).await.unwrap();
    duty_checklist::set_duty_readiness(st(), duty.id, "schedule".into(), true).await.unwrap();
    let rotation = duty_checklist::get_rotation_checklist(st(), "Medical Ward".into()).await.unwrap();
    assert_eq!(rotation.items.len(), 5);
    let again = duty_checklist::get_duty_prep(st(), Some(duty.id)).await.unwrap();
    assert_eq!(again.bag.unwrap().id, bag.id, "bag is reused");
    assert!(again.readiness.iter().any(|r| r.key == "schedule" && r.checked));
    assert_eq!(checklists::list_checklists(st()).await.unwrap().len(), 2);
    assert_eq!(checklists::list_checklist_items(st(), bag.id).await.unwrap().len(), 12);

    // ----- CI notes (incl. tenant isolation) -----
    let note_input = |duty_id: Option<i64>| {
        serde_json::from_value::<ci_notes::CiNoteInput>(serde_json::json!({
            "title": "Reminder", "content": "Bring drug study", "clinicalInstructor": "CI Test",
            "clinicalArea": "Medical Ward", "noteDate": today_s, "isImportant": true, "dutyId": duty_id
        }))
        .unwrap()
    };
    let note = ci_notes::add_ci_note(st(), note_input(Some(duty.id))).await.unwrap();
    assert_eq!(note.duty_area.as_deref(), Some("Medical Ward"));
    assert!(ci_notes::set_ci_note_pinned(st(), note.id, true).await.unwrap().is_pinned);
    ci_notes::update_ci_note(st(), note.id, note_input(None)).await.unwrap();
    let other_duty: Option<i64> = sqlx::query_scalar("SELECT id FROM duties WHERE user_id <> $1 LIMIT 1")
        .bind(uid)
        .fetch_optional(&st().pool)
        .await
        .unwrap();
    if let Some(foreign) = other_duty {
        assert!(ci_notes::add_ci_note(st(), note_input(Some(foreign))).await.is_err(), "another user's duty");
    }
    assert_eq!(ci_notes::list_ci_notes(st()).await.unwrap().len(), 1);

    // ----- Premium gating: free accounts are blocked -----
    assert_eq!(ai_study::list_quizzes(st()).await.unwrap_err().to_string(), PREMIUM_REQUIRED);
    assert!(quick_links::list_materials(st()).await.is_err(), "Learning Hub is Premium");
    assert!(quick_links::list_announcements(st()).await.is_ok(), "announcements stay free");
    let theme = HashMap::from([("theme".to_string(), "dark".to_string())]);
    assert!(settings::set_settings(st(), theme.clone()).await.is_err(), "theme is Premium");
    settings::activate_premium(st(), "monthly".into(), "gcash".into()).await.unwrap();
    settings::set_settings(st(), theme).await.unwrap();
    assert_eq!(settings::get_settings(st()).await.unwrap().get("theme").map(String::as_str), Some("dark"));

    // ----- AI study -----
    let created = ai_study::create_quiz(
        st(),
        serde_json::from_value(serde_json::json!({
            "topic": "Pharmacology", "notes": null,
            "questionTypes": ["multiple_choice", "true_false"], "count": 5
        }))
        .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(created.quiz.question_count, 5);
    let quiz = ai_study::get_quiz(st(), created.quiz.id).await.unwrap();
    assert!(quiz.questions.iter().all(|q| q.answer_index.is_none()), "answers hidden");
    let answered = ai_study::answer_question(st(), quiz.questions[0].id, 0).await.unwrap();
    assert!(answered.answer_index.is_some());
    assert!(ai_study::answer_question(st(), quiz.questions[0].id, 0).await.is_err(), "answer once");
    let finished = ai_study::finish_quiz(st(), quiz.quiz.id).await.unwrap();
    assert!(finished.completed_at.is_some() && finished.score.is_some());
    let restarted = ai_study::restart_quiz(st(), quiz.quiz.id).await.unwrap();
    assert_eq!(restarted.quiz.answered_count, 0);
    assert_eq!(ai_study::list_quizzes(st()).await.unwrap().len(), 1);
    let reply = ai_study::send_chat_message(st(), "What is ADPIE?".into(), None).await.unwrap();
    assert_eq!(reply.len(), 2);
    assert_eq!(ai_study::list_chat_messages(st()).await.unwrap().len(), 2);
    assert_eq!(ai_study::list_study_activity(st(), Some(10)).await.unwrap().len(), 2); // quiz + chat
    ai_study::clear_chat(st()).await.unwrap();
    assert!(ai_study::list_chat_messages(st()).await.unwrap().is_empty(), "chat deleted");
    let activity = ai_study::list_study_activity(st(), Some(10)).await.unwrap();
    assert_eq!(activity.len(), 1, "the chat's recent-activity entry is removed too");
    assert!(activity.iter().all(|a| a.kind != "chat"));

    // ----- progress -----
    for range in ["week", "month", "all"] {
        let p = progress::get_progress(st(), range.into()).await.unwrap();
        assert_eq!(p.weekly_activity.len(), 7);
        assert!(p.categories.tasks.done <= p.categories.tasks.total);
        assert!(p.next_duty.is_some());
    }

    // ----- quick links -----
    let materials = quick_links::list_materials(st()).await.unwrap();
    if let Some(m) = materials.first() {
        assert!(quick_links::set_material_bookmark(st(), m.id, true).await.unwrap().bookmarked);
        assert!(!quick_links::set_material_bookmark(st(), m.id, false).await.unwrap().bookmarked);
    }
    quick_links::list_announcements(st()).await.unwrap();
    assert!(quick_links::get_handbook(st()).await.unwrap().is_none());
    assert!(quick_links::list_quick_links(st()).await.unwrap().is_empty());
    let journey = quick_links::get_study_journey(st()).await.unwrap();
    assert!(journey.sessions_today >= 1 && journey.streak_days >= 1);

    // ----- settings -----
    settings::set_settings(st(), HashMap::from([("theme".into(), "dark".into()), ("study_daily_goal".into(), "5".into())]))
        .await
        .unwrap();
    assert!(settings::set_settings(st(), HashMap::from([("premium_plan".into(), "yearly".into())])).await.is_err());
    assert_eq!(quick_links::get_study_journey(st()).await.unwrap().daily_goal, 5);
    let p = settings::update_profile(
        st(),
        serde_json::from_value(serde_json::json!({
            "fullName": "Test Student", "displayName": "Tess", "email": format!("tess-{uid}@nurset.local"),
            "university": "Test U", "studentId": "1", "yearLevel": "4th Year"
        }))
        .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(p.display_name, "Tess");
    let with_avatar = settings::set_avatar(st(), Some("data:image/png;base64,AAAA".into())).await.unwrap();
    assert!(with_avatar.avatar_data.is_some());
    let receipt = settings::activate_premium(st(), "monthly".into(), "gcash".into()).await.unwrap();
    assert_eq!(receipt.amount_cents, 14_900);
    settings::activate_premium(st(), "yearly".into(), "card".into()).await.unwrap(); // replaces monthly
    let s = settings::get_settings(st()).await.unwrap();
    assert_eq!(s.get("premium_plan").map(String::as_str), Some("yearly"));
    assert_eq!(s.get("theme").map(String::as_str), Some("dark"));
    assert_eq!(settings::list_receipts(st()).await.unwrap().len(), 3); // incl. the gating check's
    settings::cancel_premium(st()).await.unwrap();
    let after = settings::get_settings(st()).await.unwrap();
    assert!(!after.contains_key("premium_plan"));
    assert!(!after.contains_key("theme"), "free accounts fall back to the default theme");
    assert!(ai_study::list_quizzes(st()).await.is_err(), "AI Study locks again after cancelling");
    let export = settings::export_json(&st().pool, uid).await.unwrap();
    assert_eq!(export["tables"]["tasks"].as_array().unwrap().len(), 1);
    assert!(export["tables"]["profile"][0].get("password_hash").is_none());

    // ----- cleanup: deleting the user removes everything -----
    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&st().pool).await.unwrap();
    let left: i64 = sqlx::query_scalar(
        "SELECT (SELECT COUNT(*) FROM tasks WHERE user_id = $1) + (SELECT COUNT(*) FROM duties WHERE user_id = $1)",
    )
    .bind(uid)
    .fetch_one(&st().pool)
    .await
    .unwrap();
    assert_eq!(left, 0);
}

#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn instructor_home_and_groups() {
    let (db, student) = app_with_test_user().await;
    let st = || &db;
    let pool = st().pool.clone();
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let student_email = format!("test-{nanos}-student@nurset.local");
    sqlx::query("UPDATE users SET email = $2, student_id = $3 WHERE id = $1")
        .bind(student)
        .bind(&student_email)
        .bind(format!("T-{nanos}"))
        .execute(&pool)
        .await
        .unwrap();

    // Students can't open instructor pages.
    assert!(instructor::list_groups(st()).await.is_err());

    // A duty today with 1 of 4 checks, and an overdue task, for the student.
    let duty_id: i64 = sqlx::query_scalar(
        "INSERT INTO duties (user_id, area, hospital, duty_date, start_time, end_time)
         VALUES ($1, 'Medical Ward', 'Test Hospital', CURRENT_DATE, '07:00', '15:00') RETURNING id",
    )
    .bind(student)
    .fetch_one(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO duty_readiness (duty_id, item_key, checked) VALUES ($1, 'schedule', true)")
        .bind(duty_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO tasks (user_id, title, due_date) VALUES ($1, 'Late', CURRENT_DATE - 3)")
        .bind(student)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO documents (user_id, file_name, status) VALUES ($1, 'x.pdf', 'pending')")
        .bind(student)
        .execute(&pool)
        .await
        .unwrap();

    // Sign in as a fresh instructor, created the way `pnpm db:create-instructor`
    // does it (bcrypt via pgcrypto), so the two hash formats stay compatible.
    let ci_email = format!("test-{nanos}-ci@nurset.local");
    sqlx::query("CREATE EXTENSION IF NOT EXISTS pgcrypto").execute(&pool).await.unwrap();
    let ci: i64 = sqlx::query_scalar(
        "INSERT INTO users (email, password_hash, full_name, display_name, account_type)
         VALUES ($1, crypt('ci-pass-123', gen_salt('bf', 4)), 'Test CI', 'CI Test', 'clinical_instructor') RETURNING id",
    )
    .bind(&ci_email)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(auth::sign_in(st(), ci_email.clone(), "wrong-pass".into(), Some(false), None).await.is_err());
    // Email is case-insensitive.
    let profile = auth::sign_in(st(), ci_email.to_uppercase(), "ci-pass-123".into(), Some(false), None).await.unwrap().profile;
    assert_eq!((profile.id, profile.account_type.as_str()), (ci, "clinical_instructor"));

    let group = instructor::create_group(
        st(),
        serde_json::from_value(serde_json::json!({ "name": "Test Group", "area": "Medical Ward", "color": "green" })).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(group.member_count, 0);
    assert!(instructor::create_group(
        st(),
        serde_json::from_value(serde_json::json!({ "name": "test group" })).unwrap()
    )
    .await
    .is_err(), "duplicate name");

    assert!(instructor::add_group_member(st(), group.id, "nobody@nowhere.test".into()).await.is_err());
    assert!(instructor::add_group_member(st(), group.id, ci_email.clone()).await.is_err(), "not a student");
    // Inviting doesn't reveal anything until the student accepts.
    let invited = instructor::add_group_member(st(), group.id, format!("T-{nanos}")).await.unwrap(); // by student ID
    assert!(invited.members.is_empty(), "pending student isn't a member yet");
    assert_eq!(invited.invitations.len(), 1);
    assert_eq!(invited.invitations[0].email, student_email.to_lowercase());
    assert!(instructor::add_group_member(st(), group.id, student_email.clone()).await.is_err(), "already invited");
    assert_eq!(instructor::get_ci_dashboard(st()).await.unwrap().stats.students, 0);
    assert!(instructor::list_my_students(st()).await.unwrap().is_empty());

    // The student sees the invitation and accepts it.
    st().set_user(student);
    let invites = invitations::list_group_invitations(st()).await.unwrap();
    assert_eq!(invites.len(), 1);
    assert_eq!(invites[0].instructor_name, "Test CI");
    let bell = notifications::list_notifications(st()).await.unwrap();
    assert!(bell.items.iter().any(|n| n.kind == "invitation"));
    invitations::respond_group_invitation(st(), group.id, true).await.unwrap();
    assert!(invitations::list_group_invitations(st()).await.unwrap().is_empty());
    assert!(invitations::respond_group_invitation(st(), group.id, true).await.is_err(), "already accepted");
    st().set_user(ci);

    let detail = instructor::get_group(st(), group.id).await.unwrap();
    assert_eq!((detail.members.len(), detail.invitations.len()), (1, 0));
    let m = &detail.members[0];
    assert_eq!((m.readiness_done, m.overdue_tasks, m.pending_reviews), (1, 1, 1));
    assert!(instructor::add_group_member(st(), group.id, student_email.clone()).await.is_err(), "already in group");

    let dash = instructor::get_ci_dashboard(st()).await.unwrap();
    assert_eq!((dash.stats.students, dash.stats.groups, dash.stats.on_duty_today), (1, 1, 1));
    assert_eq!(dash.stats.pending_reviews, 1);
    assert_eq!(dash.today_duties.len(), 1);
    assert_eq!(dash.pending_reviews.len(), 1);
    let kinds: Vec<&str> = dash.attention.iter().map(|f| f.kind.as_str()).collect();
    assert_eq!(kinds, ["overdue", "not_ready"]);

    let renamed = instructor::update_group(
        st(),
        group.id,
        serde_json::from_value(serde_json::json!({ "name": "Renamed", "color": "purple" })).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!((renamed.name.as_str(), renamed.member_count), ("Renamed", 1));
    let after = instructor::remove_group_member(st(), group.id, student).await.unwrap();
    assert!(after.members.is_empty());
    instructor::delete_group(st(), group.id).await.unwrap();
    assert!(instructor::list_groups(st()).await.unwrap().is_empty());

    for id in [ci, student] {
        sqlx::query("DELETE FROM users WHERE id = $1").bind(id).execute(&pool).await.unwrap();
    }
}

/// Quizlab with Gemini: daily limit falls back to the bank, otherwise AI writes the quiz.
///   cargo test --lib gemini_quizlab_live -- --ignored --nocapture
#[tokio::test]
#[ignore = "calls the Gemini API (needs GEMINI_API_KEY) and the database"]
async fn gemini_quizlab_live() {
    let _ = dotenvy::dotenv();
    assert!(crate::ai::GeminiConfig::from_env().is_some(), "GEMINI_API_KEY in server/.env");
    let (db, uid) = app_with_test_user().await;
    let st = || &db;
    settings::activate_premium(st(), "monthly".into(), "gcash".into()).await.unwrap();
    let input = |topic: &str| -> ai_study::NewQuiz {
        serde_json::from_value(serde_json::json!({
            "topic": topic, "notes": null, "questionTypes": ["multiple_choice", "true_false"], "count": 5
        }))
        .unwrap()
    };

    // Today's AI quota used up: built-in questions + a notice, no Gemini call.
    let limit = crate::ai::daily_quiz_limit();
    for _ in 0..limit {
        sqlx::query("INSERT INTO quizzes (user_id, title, question_types, source) VALUES ($1, 'Used', '{multiple_choice}', 'ai')")
            .bind(uid)
            .execute(&st().pool)
            .await
            .unwrap();
    }
    let capped = ai_study::create_quiz(st(), input("Pharmacology")).await.unwrap();
    assert_eq!(capped.source, "bank");
    assert!(capped.notice.unwrap().contains("today's"));

    // Quota available: Gemini writes it.
    sqlx::query("DELETE FROM quizzes WHERE user_id = $1 AND title = 'Used'").bind(uid).execute(&st().pool).await.unwrap();
    let ai = ai_study::create_quiz(st(), input("Fluid and electrolyte balance")).await.unwrap();
    println!("AI quiz: {} questions, notice {:?}", ai.quiz.question_count, ai.notice);
    assert_eq!(ai.source, "ai");
    assert!(ai.quiz.question_count >= 3);
    let detail = ai_study::get_quiz(st(), ai.quiz.id).await.unwrap();
    for q in &detail.questions {
        println!("  [{}] {}", q.kind, q.prompt);
    }

    // Off-topic is refused, not silently replaced.
    let off = ai_study::create_quiz(st(), input("Video game speedruns")).await;
    assert_eq!(off.err().map(|e| e.to_string()), Some(crate::ai::QUIZ_OFF_TOPIC.to_string()));

    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&st().pool).await.unwrap();
}

/// AI feedback after finishing a quiz: written once, cached, cleared on retake.
///   cargo test --lib gemini_feedback_live -- --ignored --nocapture
#[tokio::test]
#[ignore = "calls the Gemini API (needs GEMINI_API_KEY) and the database"]
async fn gemini_feedback_live() {
    let _ = dotenvy::dotenv();
    assert!(crate::ai::GeminiConfig::from_env().is_some(), "GEMINI_API_KEY in server/.env");
    let (db, uid) = app_with_test_user().await;
    let st = || &db;
    settings::activate_premium(st(), "monthly".into(), "gcash".into()).await.unwrap();
    let created = ai_study::create_quiz(
        st(),
        serde_json::from_value(serde_json::json!({
            "topic": "Cardiac medications", "notes": null, "questionTypes": ["multiple_choice"], "count": 4
        }))
        .unwrap(),
    )
    .await
    .unwrap();
    let quiz = ai_study::get_quiz(st(), created.quiz.id).await.unwrap();
    assert!(ai_study::get_quiz_feedback(st(), quiz.quiz.id).await.is_err(), "not finished yet");

    // Answer everything with the first choice (some right, likely some wrong).
    for q in &quiz.questions {
        ai_study::answer_question(st(), q.id, 0).await.unwrap();
    }
    ai_study::finish_quiz(st(), quiz.quiz.id).await.unwrap();

    let fb = ai_study::get_quiz_feedback(st(), quiz.quiz.id).await.unwrap();
    println!("source {} | {}\nstrengths {:?}\nreview {:?}\nnext {:?}", fb.source, fb.summary, fb.strengths, fb.review_topics, fb.next_steps);
    assert_eq!(fb.source, "ai");
    assert!(!fb.summary.is_empty() && !fb.next_steps.is_empty());

    // Cached: same text without another AI call.
    let again = ai_study::get_quiz_feedback(st(), quiz.quiz.id).await.unwrap();
    assert_eq!(again.summary, fb.summary);

    // Retake clears it.
    ai_study::restart_quiz(st(), quiz.quiz.id).await.unwrap();
    let cleared: Option<serde_json::Value> = sqlx::query_scalar("SELECT feedback FROM quizzes WHERE id = $1")
        .bind(quiz.quiz.id)
        .fetch_one(&st().pool)
        .await
        .unwrap();
    assert!(cleared.is_none());

    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&st().pool).await.unwrap();
}

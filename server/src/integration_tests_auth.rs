//! Accounts and sessions against the live database (see integration_tests.rs).

use std::time::{SystemTime, UNIX_EPOCH};

use crate::commands::auth;
use crate::db::{Db, DEFAULT_DATABASE_URL, SIGNED_OUT};

fn register_input(email: &str, password: &str) -> auth::RegisterInput {
    serde_json::from_value(serde_json::json!({
        "firstName": " Ana Marie ",
        "middleName": "Test",
        "lastName": "Dela Cruz",
        "email": email,
        "password": password,
        "university": "Test University",
        "yearLevel": "3rd Year",
        "studentId": null,
        "remember": false,
        "device": "TESTPC · Windows desktop app",
    }))
    .unwrap()
}

fn url() -> String {
    std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string())
}

/// A fresh request context, like the server builds for each HTTP request.
async fn request(pool: &sqlx::PgPool, token: Option<&str>) -> Db {
    let db = Db::from_pool(pool.clone());
    if let Some(t) = token {
        if let Some((uid, sid)) = auth::resolve_token(pool, t).await.unwrap() {
            db.start_session(uid, sid);
        }
    }
    db
}

#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn register_sign_in_and_sessions() {
    let pool = Db::connect_lazy(&url()).expect("pool").pool;
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let email = format!("Test-{nanos}-auth@NurSet.local");

    // Signed out: commands refuse, current_session is empty.
    let anon = request(&pool, None).await;
    assert!(auth::current_session(&anon).await.unwrap().is_none());
    assert_eq!(crate::commands::tasks::list_tasks(&anon, None).await.unwrap_err().to_string(), SIGNED_OUT);

    // Register -> a token; email stored lower-case; device label recorded.
    assert!(auth::register(&anon, register_input(&email, "short")).await.is_err());
    let signed = auth::register(&anon, register_input(&email, "first-pass-1")).await.unwrap();
    let uid = signed.profile.id;
    assert_eq!(signed.profile.account_type, "student");
    assert_eq!(signed.profile.display_name, "Ana Marie");
    assert_eq!(signed.profile.full_name, "Ana Marie Test Dela Cruz");
    assert_eq!(signed.profile.email.as_deref(), Some(email.to_lowercase().as_str()));
    let dup = auth::register(&request(&pool, None).await, register_input(&email.to_uppercase(), "other-pass-1")).await;
    assert!(dup.unwrap_err().to_string().contains("already exists"));

    // The token signs later requests in; signing out ends it.
    let me = request(&pool, Some(&signed.token)).await;
    assert_eq!(auth::current_session(&me).await.unwrap().unwrap().id, uid);
    let security = auth::get_security(&me).await.unwrap();
    assert_eq!(security.sessions[0].device, "TESTPC · Windows desktop app");
    auth::sign_out(&me).await.unwrap();
    assert!(auth::current_session(&request(&pool, Some(&signed.token)).await).await.unwrap().is_none());

    // Wrong password, then right.
    let anon = request(&pool, None).await;
    assert!(auth::sign_in(&anon, email.clone(), "nope-nope".into(), Some(false), None).await.is_err());
    let again = auth::sign_in(&anon, email.clone(), "first-pass-1".into(), Some(true), None).await.unwrap();
    assert_eq!(again.profile.id, uid);
    let me = request(&pool, Some(&again.token)).await;

    // Another device; ending it from here makes its token useless.
    let (other_id, other_token) = auth::create_session(&pool, uid, true, "OTHER").await.unwrap();
    assert!(auth::end_sessions(&me, me.current_session()).await.is_err(), "can't end the current session here");
    auth::end_sessions(&me, Some(other_id)).await.unwrap();
    assert_eq!(auth::resolve_token(&pool, &other_token).await.unwrap(), None);

    // Changing the password ends other sessions but keeps this one.
    let (_, kept_token) = auth::create_session(&pool, uid, true, "KEPT").await.unwrap();
    assert!(auth::resolve_token(&pool, &kept_token).await.unwrap().is_some());
    assert!(auth::change_password(&me, "wrong-current".into(), "second-pass-2".into()).await.is_err());
    auth::change_password(&me, "first-pass-1".into(), "second-pass-2".into()).await.unwrap();
    assert_eq!(auth::resolve_token(&pool, &kept_token).await.unwrap(), None);
    assert!(auth::resolve_token(&pool, &again.token).await.unwrap().is_some());
    assert!(auth::get_security(&me).await.unwrap().password_changed_at.is_some());
    let anon = request(&pool, None).await;
    assert!(auth::sign_in(&anon, email.clone(), "first-pass-1".into(), Some(false), None).await.is_err());
    auth::sign_in(&anon, email.clone(), "second-pass-2".into(), Some(false), None).await.unwrap();

    // Clinical instructors can register themselves; student-only fields are dropped.
    let mut ci_input = register_input(&format!("test-{nanos}-ci-reg@nurset.local"), "ci-pass-1234");
    ci_input.account_type = Some("clinical_instructor".into());
    ci_input.year_level = Some("4th Year".into());
    let ci = auth::register(&request(&pool, None).await, ci_input).await.unwrap().profile;
    assert_eq!((ci.account_type.as_str(), ci.role.as_str()), ("clinical_instructor", "Clinical Instructor"));
    assert_eq!(ci.year_level, None);
    let mut bad = register_input(&format!("test-{nanos}-bad@nurset.local"), "bad-pass-1234");
    bad.account_type = Some("admin".into());
    assert!(auth::register(&request(&pool, None).await, bad).await.is_err(), "unknown role");

    for id in [uid, ci.id] {
        sqlx::query("DELETE FROM users WHERE id = $1").bind(id).execute(&pool).await.unwrap();
    }
}

/// "Keep me signed in" = 30-day session; otherwise 12 hours.
#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn session_lengths() {
    let pool = Db::connect_lazy(&url()).expect("pool").pool;
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let email = format!("test-{nanos}-remember@nurset.local");
    let anon = request(&pool, None).await;
    let uid = auth::register(&anon, register_input(&email, "first-pass-1")).await.unwrap().profile.id;
    let hours = |token: String| {
        let pool = pool.clone();
        async move {
            let (_, sid) = auth::resolve_token(&pool, &token).await.unwrap().unwrap();
            sqlx::query_scalar::<_, f64>(
                "SELECT EXTRACT(EPOCH FROM (expires_at - created_at))::float8 / 3600 FROM sessions WHERE id = $1",
            )
            .bind(sid)
            .fetch_one(&pool)
            .await
            .unwrap()
        }
    };
    let long = auth::sign_in(&anon, email.clone(), "first-pass-1".into(), Some(true), None).await.unwrap();
    let short = auth::sign_in(&request(&pool, None).await, email.clone(), "first-pass-1".into(), Some(false), None)
        .await
        .unwrap();
    assert!((hours(long.token).await - 720.0).abs() < 0.1);
    assert!((hours(short.token).await - 12.0).abs() < 0.1);
    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&pool).await.unwrap();
}

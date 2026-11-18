//! Accounts and sessions against the live database (see integration_tests.rs).
//! Uses "Keep me signed in" = false so nothing is written to disk.

use std::time::{SystemTime, UNIX_EPOCH};

use tauri::test::mock_app;
use tauri::Manager;

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
    }))
    .unwrap()
}

#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn register_sign_in_and_sessions() {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    let app = mock_app();
    app.manage(Db::connect_lazy(&url).expect("pool"));
    let st = || app.state::<Db>();
    let handle = || app.handle().clone();
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let email = format!("Test-{nanos}-auth@NurSet.local");

    // Signed out: commands refuse, profile/settings are empty.
    assert!(auth::current_session(handle(), st()).await.unwrap().is_none());
    assert_eq!(crate::commands::tasks::list_tasks(st(), None).await.unwrap_err().to_string(), SIGNED_OUT);

    // Register → signed in as a student; email stored lower-case.
    assert!(auth::register(handle(), st(), register_input(&email, "short")).await.is_err());
    let profile = auth::register(handle(), st(), register_input(&email, "first-pass-1")).await.unwrap();
    let uid = profile.id;
    assert_eq!(profile.account_type, "student");
    assert_eq!(profile.display_name, "Ana Marie");
    assert_eq!(profile.full_name, "Ana Marie Test Dela Cruz");
    assert_eq!(profile.year_level.as_deref(), Some("3rd Year"));
    assert_eq!(profile.email.as_deref(), Some(email.to_lowercase().as_str()));
    let dup = auth::register(handle(), st(), register_input(&email.to_uppercase(), "other-pass-1")).await;
    assert!(dup.unwrap_err().to_string().contains("already exists"));
    assert_eq!(auth::current_session(handle(), st()).await.unwrap().unwrap().id, uid);

    // Sign out, then sign in again (wrong password first).
    auth::sign_out(handle(), st()).await.unwrap();
    assert!(auth::current_session(handle(), st()).await.unwrap().is_none());
    assert!(auth::sign_in(handle(), st(), email.clone(), "nope-nope".into(), Some(false)).await.is_err());
    let again = auth::sign_in(handle(), st(), email.clone(), "first-pass-1".into(), Some(false)).await.unwrap();
    assert_eq!(again.id, uid);

    // A second device (saved token) restores; ending it from here signs it out.
    let (other_id, other_token) = auth::create_session(&st().pool, uid, true).await.unwrap();
    let security = auth::get_security(st()).await.unwrap();
    let active: Vec<_> = security.sessions.iter().filter(|s| s.active).collect();
    assert_eq!(active.len(), 2);
    assert!(active[0].current, "current session listed first");
    assert_eq!(security.sessions.iter().filter(|s| !s.active).count(), 1, "the signed-out session is history");
    assert!(auth::end_sessions(st(), security.sessions.iter().find(|s| s.current).map(|s| s.id)).await.is_err());
    auth::end_sessions(st(), Some(other_id)).await.unwrap();
    let probe = Db::connect_lazy(&url).unwrap();
    assert_eq!(auth::restore_token(&probe, &other_token).await.unwrap(), None, "ended session can't restore");

    // Changing the password signs out other sessions but keeps this one.
    let (_, kept_token) = auth::create_session(&st().pool, uid, true).await.unwrap();
    assert_eq!(auth::restore_token(&probe, &kept_token).await.unwrap(), Some(uid), "valid token restores");
    assert!(auth::change_password(st(), "wrong-current".into(), "second-pass-2".into()).await.is_err());
    auth::change_password(st(), "first-pass-1".into(), "second-pass-2".into()).await.unwrap();
    assert_eq!(auth::restore_token(&probe, &kept_token).await.unwrap(), None);
    assert!(auth::current_session(handle(), st()).await.unwrap().is_some());
    assert!(auth::get_security(st()).await.unwrap().password_changed_at.is_some());
    auth::sign_out(handle(), st()).await.unwrap();
    assert!(auth::sign_in(handle(), st(), email.clone(), "first-pass-1".into(), Some(false)).await.is_err());
    auth::sign_in(handle(), st(), email.clone(), "second-pass-2".into(), Some(false)).await.unwrap();

    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&st().pool).await.unwrap();
}

/// "Keep me signed in": the token is saved and restores the session after a restart.
#[tokio::test]
#[ignore = "needs the PostgreSQL database (pnpm db:up && pnpm db:migrate)"]
async fn keep_me_signed_in_restores_after_restart() {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    let app = mock_app();
    app.manage(Db::connect_lazy(&url).expect("pool"));
    let st = || app.state::<Db>();
    let handle = || app.handle().clone();
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let email = format!("test-{nanos}-remember@nurset.local");
    let uid = auth::register(handle(), st(), register_input(&email, "first-pass-1")).await.unwrap().id;

    // Remembered sign-in, then "restart" (forget the in-memory user).
    auth::sign_in(handle(), st(), email.clone(), "first-pass-1".into(), Some(true)).await.unwrap();
    st().forget_user();
    let restored = auth::current_session(handle(), st()).await.unwrap();
    assert_eq!(restored.map(|p| p.id), Some(uid), "remembered session restores");

    // Not remembered: a restart signs you out.
    auth::sign_in(handle(), st(), email.clone(), "first-pass-1".into(), Some(false)).await.unwrap();
    st().forget_user();
    assert!(auth::current_session(handle(), st()).await.unwrap().is_none(), "not remembered");

    auth::sign_out(handle(), st()).await.unwrap();
    sqlx::query("DELETE FROM users WHERE id = $1").bind(uid).execute(&st().pool).await.unwrap();
}

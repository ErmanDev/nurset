//! Accounts and sign-in sessions.
//!
//! Passwords are hashed with bcrypt. Each sign-in creates a `sessions` row; the
//! database keeps only the SHA-256 of the session token. With "Keep me signed
//! in", the raw token is saved to `session.json` in the app's config folder so
//! the next launch can restore it (`current_session`).

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use tauri::{AppHandle, Manager, Runtime, State};

use super::{optional_text, required_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{ts, Profile};

pub const MIN_PASSWORD_LENGTH: usize = 8;
const BCRYPT_COST: u32 = 12;
/// Session length with and without "Keep me signed in".
const REMEMBER_DAYS: i32 = 30;
const SHORT_HOURS: i32 = 12;
const BAD_LOGIN: &str = "Incorrect email, student ID, or password";

// ---------- helpers ----------

// bcrypt is slow on purpose, so it runs on the current runtime's blocking pool.
//
// Both functions double-check their result. bcrypt is deterministic, yet on
// machines with unstable CPUs (seen on an Intel 14th-gen laptop) a long hash
// computation can occasionally come out wrong. A bad stored hash would lock
// the account forever, and a bad check would reject a correct password.

const HASH_ATTEMPTS: usize = 3;

async fn hash_password(password: String) -> AppResult<String> {
    tokio::task::spawn_blocking(move || {
        for _ in 0..HASH_ATTEMPTS {
            let hash = bcrypt::hash(&password, BCRYPT_COST).map_err(|e| AppError::new(e.to_string()))?;
            // Keep it only if it verifies (twice, in case a check itself glitches).
            let ok = (0..2).any(|_| bcrypt::verify(&password, &hash).unwrap_or(false));
            if ok {
                return Ok(hash);
            }
        }
        Err(AppError::new("Couldn't secure your password. Please try again."))
    })
    .await
    .map_err(|e| AppError::new(e.to_string()))?
}

/// `Ok(false)` only for a wrong password; a failed check is an error, not a rejection.
async fn verify_password(password: String, hash: String) -> AppResult<bool> {
    tokio::task::spawn_blocking(move || (0..2).any(|_| bcrypt::verify(&password, &hash).unwrap_or(false)))
        .await
        .map_err(|e| AppError::new(e.to_string()))
}

fn check_new_password(password: &str) -> AppResult<()> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err(AppError::new(format!("Use at least {MIN_PASSWORD_LENGTH} characters for your password")));
    }
    if password.len() > 72 {
        // bcrypt only uses the first 72 bytes.
        return Err(AppError::new("Use a password of at most 72 characters"));
    }
    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn new_token() -> AppResult<String> {
    let mut buf = [0u8; 32];
    getrandom::getrandom(&mut buf).map_err(|e| AppError::new(e.to_string()))?;
    Ok(hex(&buf))
}

fn token_hash(token: &str) -> String {
    hex(&Sha256::digest(token.as_bytes()))
}

fn device_name() -> String {
    let host = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "This computer".into());
    let os = match std::env::consts::OS {
        "windows" => "Windows",
        "macos" => "macOS",
        "linux" => "Linux",
        other => other,
    };
    format!("{host} · {os} desktop app")
}

fn session_file<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(app.path().app_config_dir()?.join("session.json"))
}

#[derive(Serialize, Deserialize)]
struct SavedSession {
    token: String,
}

fn save_token<R: Runtime>(app: &AppHandle<R>, token: &str) -> AppResult<()> {
    let path = session_file(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(path, serde_json::to_vec(&SavedSession { token: token.to_string() })?)?;
    Ok(())
}

pub(crate) fn clear_saved_token<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(path) = session_file(app) {
        let _ = fs::remove_file(path);
    }
}

async fn profile(pool: &PgPool, uid: i64) -> AppResult<Profile> {
    Ok(sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(uid)
        .fetch_one(pool)
        .await?)
}

/// Inserts a session row for `uid`; returns its id and the raw token.
pub(crate) async fn create_session(pool: &PgPool, uid: i64, remember: bool) -> AppResult<(i64, String)> {
    let token = new_token()?;
    let expires = if remember {
        format!("now() + interval '{REMEMBER_DAYS} days'")
    } else {
        format!("now() + interval '{SHORT_HOURS} hours'")
    };
    let session_id: i64 = sqlx::query_scalar(&format!(
        "INSERT INTO sessions (user_id, token_hash, device, expires_at) VALUES ($1, $2, $3, {expires}) RETURNING id"
    ))
    .bind(uid)
    .bind(token_hash(&token))
    .bind(device_name())
    .fetch_one(pool)
    .await?;
    Ok((session_id, token))
}

/// Signs in through a saved token if its session is still valid.
pub(crate) async fn restore_token(db: &Db, token: &str) -> AppResult<Option<i64>> {
    let found: Option<(i64, i64)> = sqlx::query_as(
        "UPDATE sessions SET last_seen_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
         RETURNING id, user_id",
    )
    .bind(token_hash(token))
    .fetch_optional(&db.pool)
    .await?;
    Ok(found.map(|(sid, uid)| {
        db.start_session(uid, sid);
        uid
    }))
}

/// Creates a session for `uid`, signs them in, and (if `remember`) saves the token.
async fn begin_session<R: Runtime>(app: &AppHandle<R>, db: &Db, uid: i64, remember: bool) -> AppResult<Profile> {
    // End the session this app was using, if any.
    if let Some(old) = db.current_session() {
        sqlx::query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL")
            .bind(old)
            .execute(&db.pool)
            .await?;
    }
    let (session_id, token) = create_session(&db.pool, uid, remember).await?;
    if remember {
        save_token(app, &token)?;
    } else {
        clear_saved_token(app);
    }
    db.start_session(uid, session_id);
    profile(&db.pool, uid).await
}

// ---------- commands ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInput {
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub email: String,
    pub password: String,
    pub university: Option<String>,
    pub year_level: Option<String>,
    pub student_id: Option<String>,
    #[serde(default)]
    pub remember: bool,
}

/// Creates a nursing-student account and signs it in. Clinical instructor
/// accounts are created by an administrator (`pnpm db:create-instructor`).
#[tauri::command]
pub async fn register<R: Runtime>(app: AppHandle<R>, db: State<'_, Db>, input: RegisterInput) -> AppResult<Profile> {
    let first_name = required_text(&input.first_name, "First name")?;
    let last_name = required_text(&input.last_name, "Last name")?;
    // Stored as one full name ("Juan Santos Dela Cruz"); the first name is the display name.
    let full_name = [Some(first_name.clone()), optional_text(input.middle_name), Some(last_name)]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" ");
    let email = required_text(&input.email, "Email")?.to_lowercase();
    let valid = email.split_once('@').is_some_and(|(user, domain)| !user.is_empty() && domain.contains('.'));
    if !valid {
        return Err(AppError::new("Enter a valid email address"));
    }
    check_new_password(&input.password)?;
    let display_name = first_name;
    let hash = hash_password(input.password).await?;

    let result = sqlx::query_scalar::<_, i64>(
        "INSERT INTO users (email, password_hash, password_changed_at, full_name, display_name,
                            university, year_level, student_id, account_type, role)
         VALUES ($1, $2, now(), $3, $4, $5, $6, $7, 'student', 'Nursing Student') RETURNING id",
    )
    .bind(&email)
    .bind(hash)
    .bind(&full_name)
    .bind(display_name)
    .bind(optional_text(input.university))
    .bind(optional_text(input.year_level))
    .bind(optional_text(input.student_id))
    .fetch_one(&db.pool)
    .await;
    let uid = match result {
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            return Err(AppError::new("An account with that email already exists. Sign in instead."));
        }
        other => other?,
    };
    begin_session(&app, &db, uid, input.remember).await
}

#[derive(FromRow)]
struct LoginRow {
    id: i64,
    password_hash: Option<String>,
}

/// Signs in by email or student ID and password.
#[tauri::command]
pub async fn sign_in<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, Db>,
    identifier: String,
    password: String,
    remember: Option<bool>,
) -> AppResult<Profile> {
    let identifier = identifier.trim();
    if identifier.is_empty() {
        return Err(AppError::new("Enter your email or student ID"));
    }
    if password.is_empty() {
        return Err(AppError::new("Enter your password"));
    }
    let rows = sqlx::query_as::<_, LoginRow>(
        "SELECT id, password_hash FROM users WHERE email = $1::citext OR student_id = $1 ORDER BY id LIMIT 5",
    )
    .bind(identifier)
    .fetch_all(&db.pool)
    .await?;
    for row in rows {
        if let Some(hash) = row.password_hash {
            if verify_password(password.clone(), hash).await? {
                return begin_session(&app, &db, row.id, remember.unwrap_or(true)).await;
            }
        }
    }
    Err(AppError::new(BAD_LOGIN))
}

/// Ends the current session and forgets the saved token.
#[tauri::command]
pub async fn sign_out<R: Runtime>(app: AppHandle<R>, db: State<'_, Db>) -> AppResult<()> {
    if let Some(id) = db.current_session() {
        sqlx::query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL")
            .bind(id)
            .execute(&db.pool)
            .await?;
    }
    db.forget_user();
    clear_saved_token(&app);
    Ok(())
}

/// The signed-in user's profile, restoring a saved session if needed.
/// `None` means nobody is signed in.
#[tauri::command]
pub async fn current_session<R: Runtime>(app: AppHandle<R>, db: State<'_, Db>) -> AppResult<Option<Profile>> {
    if let Some(uid) = db.current_user() {
        // Still valid? (It may have been ended from another device.)
        let alive = match db.current_session() {
            None => true,
            Some(sid) => sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now())",
            )
            .bind(sid)
            .fetch_one(&db.pool)
            .await?,
        };
        if alive {
            return Ok(Some(profile(&db.pool, uid).await?));
        }
        db.forget_user();
        clear_saved_token(&app);
        return Ok(None);
    }

    let Ok(bytes) = fs::read(session_file(&app)?) else { return Ok(None) };
    let Ok(saved) = serde_json::from_slice::<SavedSession>(&bytes) else {
        clear_saved_token(&app);
        return Ok(None);
    };
    match restore_token(&db, &saved.token).await? {
        Some(uid) => Ok(Some(profile(&db.pool, uid).await?)),
        None => {
            clear_saved_token(&app);
            Ok(None)
        }
    }
}

/// Changes the password after checking the current one. Other sessions are ended.
#[tauri::command]
pub async fn change_password(db: State<'_, Db>, current: String, new_password: String) -> AppResult<()> {
    let uid = db.user_id().await?;
    check_new_password(&new_password)?;
    let hash: Option<String> = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(uid)
        .fetch_one(&db.pool)
        .await?;
    let ok = match hash {
        Some(h) => verify_password(current, h).await?,
        None => false,
    };
    if !ok {
        return Err(AppError::new("Your current password is incorrect"));
    }
    let new_hash = hash_password(new_password).await?;
    sqlx::query("UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1")
        .bind(uid)
        .bind(new_hash)
        .execute(&db.pool)
        .await?;
    sqlx::query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND id IS DISTINCT FROM $2")
        .bind(uid)
        .bind(db.current_session())
        .execute(&db.pool)
        .await?;
    Ok(())
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: i64,
    pub device: String,
    pub created_at: String,
    pub last_seen_at: String,
    pub ended_at: Option<String>,
    pub active: bool,
    pub current: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityOverview {
    pub password_changed_at: Option<String>,
    pub sessions: Vec<SessionInfo>,
}

/// Recent sign-ins (active ones first) and when the password last changed.
#[tauri::command]
pub async fn get_security(db: State<'_, Db>) -> AppResult<SecurityOverview> {
    let uid = db.user_id().await?;
    let sessions = sqlx::query_as::<_, SessionInfo>(concat!(
        "SELECT id, device, ", ts!("created_at"), " AS created_at, ", ts!("last_seen_at"), " AS last_seen_at, ",
        "CASE WHEN revoked_at IS NOT NULL THEN ", ts!("revoked_at"),
        " WHEN expires_at <= now() THEN ", ts!("expires_at"), " END AS ended_at, ",
        "(revoked_at IS NULL AND expires_at > now()) AS active, ",
        "id IS NOT DISTINCT FROM $2 AS current ",
        "FROM sessions WHERE user_id = $1 ",
        "ORDER BY (id IS NOT DISTINCT FROM $2) DESC, (revoked_at IS NULL AND expires_at > now()) DESC, created_at DESC ",
        "LIMIT 20"
    ))
    .bind(uid)
    .bind(db.current_session())
    .fetch_all(&db.pool)
    .await?;
    let password_changed_at: Option<String> =
        sqlx::query_scalar(concat!("SELECT ", ts!("password_changed_at"), " FROM users WHERE id = $1"))
            .bind(uid)
            .fetch_one(&db.pool)
            .await?;
    Ok(SecurityOverview { password_changed_at, sessions })
}

/// Signs out one other session, or every other session when `id` is `None`.
#[tauri::command]
pub async fn end_sessions(db: State<'_, Db>, id: Option<i64>) -> AppResult<()> {
    let uid = db.user_id().await?;
    let current = db.current_session();
    if id.is_some() && id == current {
        return Err(AppError::new("Use Log out to end this session"));
    }
    sqlx::query(
        "UPDATE sessions SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL AND id IS DISTINCT FROM $2 AND ($3::bigint IS NULL OR id = $3)",
    )
    .bind(uid)
    .bind(current)
    .bind(id)
    .execute(&db.pool)
    .await?;
    Ok(())
}

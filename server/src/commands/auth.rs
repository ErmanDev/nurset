//! Accounts and sign-in sessions.
//!
//! Passwords are hashed with bcrypt. Signing in creates a `sessions` row and
//! returns a random bearer token to the desktop app; the database keeps only
//! its SHA-256. The app sends the token in `Authorization: Bearer ...` and the
//! server resolves it per request (`resolve_token`). "Keep me signed in" sets
//! a 30-day session; otherwise it lasts 12 hours.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};

use super::{optional_text, required_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{ts, Profile};

pub const MIN_PASSWORD_LENGTH: usize = 8;
const BCRYPT_COST: u32 = 12;
/// Session length with and without "Keep me signed in".
const REMEMBER_DAYS: i32 = 30;
const SHORT_HOURS: i32 = 12;
pub const BAD_LOGIN: &str = "Incorrect email, student ID, or password";

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

/// Device label shown in Settings > Active Sessions (sent by the app).
fn device_label(device: Option<String>) -> String {
    let d: String = device.unwrap_or_default().trim().chars().take(80).collect();
    if d.is_empty() { "NurSet desktop app".into() } else { d }
}

async fn profile(pool: &PgPool, uid: i64) -> AppResult<Profile> {
    Ok(sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(uid)
        .fetch_one(pool)
        .await?)
}

/// Inserts a session row for `uid`; returns its id and the raw token.
pub(crate) async fn create_session(pool: &PgPool, uid: i64, remember: bool, device: &str) -> AppResult<(i64, String)> {
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
    .bind(device)
    .fetch_one(pool)
    .await?;
    Ok((session_id, token))
}

/// The (user id, session id) for a valid bearer token. Refreshes
/// `last_seen_at` at most every few minutes.
pub(crate) async fn resolve_token(pool: &PgPool, token: &str) -> AppResult<Option<(i64, i64)>> {
    let found: Option<(i64, i64)> = sqlx::query_as(
        "SELECT user_id, id FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()",
    )
    .bind(token_hash(token))
    .fetch_optional(pool)
    .await?;
    if let Some((_, sid)) = found {
        sqlx::query("UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'")
            .bind(sid)
            .execute(pool)
            .await?;
    }
    Ok(found)
}

/// Returned by `register` and `sign_in`: the profile and the bearer token.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedIn {
    pub profile: Profile,
    pub token: String,
}

/// Creates a session for `uid` and returns it with the profile.
async fn begin_session(db: &Db, uid: i64, remember: bool, device: Option<String>) -> AppResult<SignedIn> {
    let (session_id, token) = create_session(&db.pool, uid, remember, &device_label(device)).await?;
    db.start_session(uid, session_id);
    Ok(SignedIn { profile: profile(&db.pool, uid).await?, token })
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
    /// Device label for Active Sessions, e.g. "WINTER · Windows desktop app".
    #[serde(default)]
    pub device: Option<String>,
    /// "student" (default) or "clinical_instructor".
    #[serde(default)]
    pub account_type: Option<String>,
}

/// Creates a nursing-student or clinical-instructor account and signs it in.
/// Instructors only see a student's records after the student accepts their
/// group invitation (see `invitations`).
pub async fn register(db: &Db, input: RegisterInput) -> AppResult<SignedIn> {
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
    let instructor = match input.account_type.as_deref().unwrap_or("student") {
        "student" => false,
        "clinical_instructor" => true,
        _ => return Err(AppError::new("Choose Nursing Student or Clinical Instructor")),
    };
    // Year level and student ID only apply to students.
    let (role, year_level, student_number) = if instructor {
        ("Clinical Instructor", None, None)
    } else {
        ("Nursing Student", optional_text(input.year_level), optional_text(input.student_id))
    };
    let hash = hash_password(input.password).await?;

    let result = sqlx::query_scalar::<_, i64>(
        "INSERT INTO users (email, password_hash, password_changed_at, full_name, display_name,
                            university, year_level, student_id, account_type, role)
         VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    )
    .bind(&email)
    .bind(hash)
    .bind(&full_name)
    .bind(display_name)
    .bind(optional_text(input.university))
    .bind(year_level)
    .bind(student_number)
    .bind(if instructor { "clinical_instructor" } else { "student" })
    .bind(role)
    .fetch_one(&db.pool)
    .await;
    let uid = match result {
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            return Err(AppError::new("An account with that email already exists. Sign in instead."));
        }
        other => other?,
    };
    begin_session(db, uid, input.remember, input.device).await
}

#[derive(FromRow)]
struct LoginRow {
    id: i64,
    password_hash: Option<String>,
}

/// Signs in by email or student ID and password.
pub async fn sign_in(
    db: &Db,
    identifier: String,
    password: String,
    remember: Option<bool>,
    device: Option<String>,
) -> AppResult<SignedIn> {
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
                return begin_session(db, row.id, remember.unwrap_or(true), device).await;
            }
        }
    }
    Err(AppError::new(BAD_LOGIN))
}

/// Ends the current session.
pub async fn sign_out(db: &Db) -> AppResult<()> {
    if let Some(id) = db.current_session() {
        sqlx::query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL")
            .bind(id)
            .execute(&db.pool)
            .await?;
    }
    db.forget_user();
    Ok(())
}

/// The signed-in user's profile (the server already checked the token), or
/// `None` when the request has no valid session.
pub async fn current_session(db: &Db) -> AppResult<Option<Profile>> {
    match db.current_user() {
        Some(uid) => Ok(Some(profile(&db.pool, uid).await?)),
        None => Ok(None),
    }
}

/// Changes the password after checking the current one. Other sessions are ended.
pub async fn change_password(db: &Db, current: String, new_password: String) -> AppResult<()> {
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
pub async fn get_security(db: &Db) -> AppResult<SecurityOverview> {
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
pub async fn end_sessions(db: &Db, id: Option<i64>) -> AppResult<()> {
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

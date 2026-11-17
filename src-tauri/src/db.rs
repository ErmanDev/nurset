//! PostgreSQL connection pool and the current user.
//!
//! The schema lives in `database/postgres/migrations` and is applied with
//! `pnpm db:migrate` (the app doesn't migrate on its own).

use std::sync::Mutex;
use std::time::Duration;

use chrono::Local;
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::Executor;

use crate::error::AppResult;

/// Local Docker database from `database/postgres/docker-compose.yml`.
pub const DEFAULT_DATABASE_URL: &str = "postgres://nurset:nurset_dev@localhost:5433/nurset";

/// Used when the database has no users yet.
const DEFAULT_EMAIL: &str = "student@nurset.local";

pub struct Db {
    pub pool: PgPool,
    /// Signed-in user (set by `sign_in`). Before anyone signs in this is the
    /// first student in the database, created on demand if needed.
    user: Mutex<Option<i64>>,
}

/// The machine's UTC offset as "+08:00", so the session's dates/times
/// (CURRENT_DATE, timestamps rendered as text) are in local time.
fn local_utc_offset() -> String {
    let secs = Local::now().offset().local_minus_utc();
    let sign = if secs < 0 { '-' } else { '+' };
    let secs = secs.abs();
    format!("{sign}{:02}:{:02}", secs / 3600, (secs % 3600) / 60)
}

impl Db {
    /// Creates the pool without connecting, so the app still opens (and
    /// shows a helpful error) when the database isn't running.
    pub fn connect_lazy(url: &str) -> AppResult<Self> {
        let tz = local_utc_offset();
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(5))
            .after_connect(move |conn, _meta| {
                let sql = format!("SET TIME ZONE INTERVAL '{tz}' HOUR TO MINUTE");
                Box::pin(async move {
                    conn.execute(sql.as_str()).await?;
                    Ok(())
                })
            })
            .connect_lazy(url)?;
        Ok(Self { pool, user: Mutex::new(None) })
    }

    /// Act as a specific user (sign-in, tests).
    pub fn set_user(&self, user_id: i64) {
        *self.user.lock().expect("user lock") = Some(user_id);
    }

    /// The current user's id.
    pub async fn user_id(&self) -> AppResult<i64> {
        if let Some(id) = *self.user.lock().expect("user lock") {
            return Ok(id);
        }
        let existing: Option<i64> = sqlx::query_scalar("SELECT id FROM users WHERE account_type = 'student' ORDER BY id LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;
        let id = match existing {
            Some(id) => id,
            None => {
                sqlx::query_scalar(
                    "INSERT INTO users (email, full_name, display_name)
                     VALUES ($1, 'Nursing Student', 'Student') RETURNING id",
                )
                .bind(DEFAULT_EMAIL)
                .fetch_one(&self.pool)
                .await?
            }
        };
        *self.user.lock().expect("user lock") = Some(id);
        Ok(id)
    }

    /// Forget the cached user (after the account is deleted).
    pub fn forget_user(&self) {
        *self.user.lock().expect("user lock") = None;
    }
}

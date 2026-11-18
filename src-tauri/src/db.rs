//! PostgreSQL connection pool and the current user.
//!
//! The schema lives in `database/postgres/migrations` and is applied with
//! `pnpm db:migrate` (the app doesn't migrate on its own).

use std::sync::Mutex;
use std::time::Duration;

use chrono::Local;
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::Executor;

use crate::error::{AppError, AppResult};

/// Local Docker database from `database/postgres/docker-compose.yml`.
pub const DEFAULT_DATABASE_URL: &str = "postgres://nurset:nurset_dev@localhost:5433/nurset";

/// Error text the frontend recognises to send the user back to the sign-in screen.
pub const SIGNED_OUT: &str = "You're signed out. Please sign in again.";

pub struct Db {
    pub pool: PgPool,
    /// Signed-in user and their session row (set by `sign_in`, `register`, or
    /// a restored "Keep me signed in" session).
    user: Mutex<Option<Signed>>,
}

#[derive(Clone, Copy)]
struct Signed {
    user_id: i64,
    session_id: Option<i64>,
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

    /// Act as a specific user (tests; sign-in uses `start_session`).
    #[cfg(test)]
    pub fn set_user(&self, user_id: i64) {
        *self.user.lock().expect("user lock") = Some(Signed { user_id, session_id: None });
    }

    /// Marks `user_id` as signed in through session `session_id`.
    pub fn start_session(&self, user_id: i64, session_id: i64) {
        *self.user.lock().expect("user lock") = Some(Signed { user_id, session_id: Some(session_id) });
    }

    /// The signed-in user, or an error asking them to sign in.
    pub async fn user_id(&self) -> AppResult<i64> {
        self.current_user().ok_or_else(|| AppError::new(SIGNED_OUT))
    }

    /// The signed-in user, if any.
    pub fn current_user(&self) -> Option<i64> {
        self.user.lock().expect("user lock").map(|s| s.user_id)
    }

    /// The current session row, if signed in through one.
    pub fn current_session(&self) -> Option<i64> {
        self.user.lock().expect("user lock").and_then(|s| s.session_id)
    }

    /// Signs out locally (after sign-out or account deletion).
    pub fn forget_user(&self) {
        *self.user.lock().expect("user lock") = None;
    }
}

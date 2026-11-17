use serde::{Serialize, Serializer};

/// Error type returned by every Tauri command. Serialized as a plain string
/// so the frontend receives a readable message in the rejected promise.
#[derive(Debug)]
pub struct AppError(String);

impl AppError {
    pub fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for AppError {}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::PoolTimedOut | sqlx::Error::Io(_) | sqlx::Error::Tls(_) => Self::new(
                "Can't reach the NurSet database. Make sure Docker Desktop is running, then run `pnpm db:up`.",
            ),
            sqlx::Error::Database(db) if db.code().as_deref() == Some("42P01") => {
                Self::new("The NurSet database isn't set up yet. Run `pnpm db:migrate`.")
            }
            _ => Self(err.to_string()),
        }
    }
}

/// Plain conversions for the other error types the commands use.
macro_rules! from_display {
    ($($t:ty),* $(,)?) => {
        $(impl From<$t> for AppError {
            fn from(err: $t) -> Self {
                Self(err.to_string())
            }
        })*
    };
}
from_display!(std::io::Error, serde_json::Error, tauri::Error, tauri_plugin_opener::Error);

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

pub type AppResult<T> = Result<T, AppError>;

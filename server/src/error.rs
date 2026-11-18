use serde::{Serialize, Serializer};

/// Error type returned by every command. Sent to the app as `{"error": message}`.
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

/// Start of the message sent when the database can't be used (HTTP 503).
pub const DATABASE_DOWN: &str = "NurSet can't reach its database right now.";

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::PoolTimedOut | sqlx::Error::Io(_) | sqlx::Error::Tls(_) => {
                Self::new(format!("{DATABASE_DOWN} Please try again in a moment."))
            }
            sqlx::Error::Database(db) if db.code().as_deref() == Some("42P01") => {
                Self::new(format!("{DATABASE_DOWN} (the database schema is missing; run the migrations)."))
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
from_display!(std::io::Error, serde_json::Error);

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

pub type AppResult<T> = Result<T, AppError>;

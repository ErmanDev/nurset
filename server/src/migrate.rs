//! Applies the SQL migrations in `database/postgres/migrations` on startup.
//!
//! Same bookkeeping as `pnpm db:migrate` (database/postgres/scripts/migrate.mjs):
//! each file runs once, in a transaction, and is recorded in
//! `schema_migrations` by file name. A PostgreSQL advisory lock keeps two
//! server instances from migrating at the same time.

use sqlx::PgPool;

use crate::error::AppResult;

/// Every migration, in order. Add new files here (the build embeds them).
const MIGRATIONS: &[(&str, &str)] = &[
    ("0001_init.sql", include_str!("../../database/postgres/migrations/0001_init.sql")),
    ("0002_clinical_groups.sql", include_str!("../../database/postgres/migrations/0002_clinical_groups.sql")),
    ("0003_instructor_tools.sql", include_str!("../../database/postgres/migrations/0003_instructor_tools.sql")),
    ("0004_sessions.sql", include_str!("../../database/postgres/migrations/0004_sessions.sql")),
    ("0005_notification_reads.sql", include_str!("../../database/postgres/migrations/0005_notification_reads.sql")),
    ("0006_quiz_source.sql", include_str!("../../database/postgres/migrations/0006_quiz_source.sql")),
    ("0007_quiz_feedback.sql", include_str!("../../database/postgres/migrations/0007_quiz_feedback.sql")),
    ("0008_stored_files.sql", include_str!("../../database/postgres/migrations/0008_stored_files.sql")),
    ("0009_group_invitations.sql", include_str!("../../database/postgres/migrations/0009_group_invitations.sql")),
];

/// Arbitrary constant identifying NurSet's migration lock.
const LOCK_ID: i64 = 7_413_202_611;

/// Applies pending migrations; returns the names applied.
pub async fn run(pool: &PgPool) -> AppResult<Vec<&'static str>> {
    let mut conn = pool.acquire().await?;
    sqlx::query("SELECT pg_advisory_lock($1)").bind(LOCK_ID).execute(&mut *conn).await?;
    let result = apply(&mut conn).await;
    let _ = sqlx::query("SELECT pg_advisory_unlock($1)").bind(LOCK_ID).execute(&mut *conn).await;
    result
}

async fn apply(conn: &mut sqlx::PgConnection) -> AppResult<Vec<&'static str>> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version     TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )
    .execute(&mut *conn)
    .await?;
    let applied: Vec<String> = sqlx::query_scalar("SELECT version FROM schema_migrations").fetch_all(&mut *conn).await?;

    let mut done = Vec::new();
    for (name, sql) in MIGRATIONS {
        if applied.iter().any(|v| v == name) {
            continue;
        }
        let mut tx = sqlx::Connection::begin(&mut *conn).await?;
        sqlx::raw_sql(sql).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO schema_migrations (version) VALUES ($1)").bind(name).execute(&mut *tx).await?;
        tx.commit().await?;
        done.push(*name);
    }
    Ok(done)
}

#[cfg(test)]
mod tests {
    use super::MIGRATIONS;

    /// Every file in the migrations folder is listed, in order.
    #[test]
    fn all_migration_files_are_embedded() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../database/postgres/migrations");
        let mut files: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok()?.file_name().into_string().ok())
            .filter(|n| n.ends_with(".sql"))
            .collect();
        files.sort();
        let listed: Vec<&str> = MIGRATIONS.iter().map(|(n, _)| *n).collect();
        assert_eq!(files, listed, "add new migration files to MIGRATIONS in server/src/migrate.rs");
    }
}

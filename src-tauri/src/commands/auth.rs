use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::Profile;

/// Signs in by email or student ID and makes that account the current user.
///
/// TODO(auth): verify the password against `users.password_hash` (argon2) and
/// issue a session once the API server exists. For now any password is accepted
/// so student and clinical-instructor accounts can be tried out.
#[tauri::command]
pub async fn sign_in(db: State<'_, Db>, identifier: String) -> AppResult<Profile> {
    let identifier = identifier.trim();
    if identifier.is_empty() {
        return Err(AppError::new("Enter your email or student ID"));
    }
    let profile = sqlx::query_as::<_, Profile>(&format!(
        "{} WHERE u.email = $1::citext OR u.student_id = $1 ORDER BY u.id LIMIT 1",
        Profile::SELECT
    ))
    .bind(identifier)
    .fetch_optional(&db.pool)
    .await?
    .ok_or_else(|| AppError::new("No account found for that email or student ID"))?;
    db.set_user(profile.id);
    Ok(profile)
}

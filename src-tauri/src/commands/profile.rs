use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::Profile;

#[tauri::command]
pub async fn get_profile(db: State<'_, Db>) -> AppResult<Option<Profile>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(uid)
        .fetch_optional(&db.pool)
        .await?)
}


use crate::db::Db;
use crate::error::AppResult;
use crate::models::Profile;
pub async fn get_profile(db: &Db) -> AppResult<Option<Profile>> {
    let Some(uid) = db.current_user() else { return Ok(None) };
    Ok(sqlx::query_as::<_, Profile>(&format!("{} WHERE u.id = $1", Profile::SELECT))
        .bind(uid)
        .fetch_optional(&db.pool)
        .await?)
}

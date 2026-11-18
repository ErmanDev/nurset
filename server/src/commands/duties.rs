use serde::Deserialize;

use super::{optional_text, required_text, valid_date, valid_time};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::Duty;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewDuty {
    pub area: String,
    pub hospital: String,
    pub location: Option<String>,
    pub duty_date: String,
    pub start_time: String,
    pub end_time: String,
    pub clinical_instructor: Option<String>,
    pub notes: Option<String>,
}
pub async fn list_duties(db: &Db) -> AppResult<Vec<Duty>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, Duty>(&format!(
        "{} WHERE d.user_id = $1 ORDER BY d.duty_date, d.start_time",
        Duty::SELECT
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}
pub async fn add_duty(db: &Db, input: NewDuty) -> AppResult<Duty> {
    let area = required_text(&input.area, "Area")?;
    let hospital = required_text(&input.hospital, "Hospital")?;
    let date = valid_date(&input.duty_date, "Date")?;
    let start = valid_time(&input.start_time, "Start time")?;
    let end = valid_time(&input.end_time, "End time")?;
    let uid = db.user_id().await?;

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO duties
            (user_id, area, hospital, location, duty_date, start_time, end_time, clinical_instructor, notes)
         VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::time, $8, $9) RETURNING id",
    )
    .bind(uid)
    .bind(area)
    .bind(hospital)
    .bind(optional_text(input.location))
    .bind(date)
    .bind(start)
    .bind(end)
    .bind(optional_text(input.clinical_instructor))
    .bind(optional_text(input.notes))
    .fetch_one(&db.pool)
    .await?;
    Ok(sqlx::query_as::<_, Duty>(&format!("{} WHERE d.id = $1", Duty::SELECT))
        .bind(id)
        .fetch_one(&db.pool)
        .await?)
}

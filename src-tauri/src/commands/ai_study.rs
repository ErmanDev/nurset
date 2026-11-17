//! AI Study: Quizlab quizzes, the assistant chat, and the activity feed.
//!
//! No AI provider is connected yet: quizzes are built from the built-in
//! `question_bank`, and assistant replies are clearly-labelled placeholders.

use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sqlx::types::Json;
use sqlx::{FromRow, PgConnection, PgPool};
use tauri::State;

use super::{not_found, optional_text, required_text};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::ts;
use crate::question_bank::{self, Rng};

const QUESTION_KINDS: &[&str] = &["multiple_choice", "true_false", "identification", "case_based"];

// ---------- models ----------

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct QuizSummary {
    pub id: i64,
    pub title: String,
    pub question_types: Vec<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub score: Option<i32>,
    pub question_count: i64,
    pub answered_count: i64,
    pub correct_count: i64,
}

const QUIZ_SUMMARY: &str = concat!(
    "SELECT q.id, q.title, q.question_types, ",
    ts!("q.created_at"), " AS created_at, ",
    ts!("q.completed_at"), " AS completed_at, q.score, ",
    "COUNT(qq.id) AS question_count, COUNT(qq.chosen_index) AS answered_count, ",
    "COUNT(qq.id) FILTER (WHERE qq.is_correct) AS correct_count ",
    "FROM quizzes q LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id"
);

/// Raw question row; converted to `QuizQuestion`, which hides the answer
/// until the question has been answered.
#[derive(FromRow)]
struct QuestionRow {
    id: i64,
    position: i32,
    kind: String,
    prompt: String,
    case_text: Option<String>,
    image: Option<String>,
    choices: Json<Vec<String>>,
    hint: Option<String>,
    chosen_index: Option<i32>,
    is_correct: Option<bool>,
    answer_index: i32,
    explanation: Option<String>,
}

const QUESTION_SELECT: &str = "SELECT qq.id, qq.position, qq.kind, qq.prompt, qq.case_text, qq.image, \
     qq.choices, qq.hint, qq.chosen_index, qq.is_correct, qq.answer_index, qq.explanation \
     FROM quiz_questions qq JOIN quizzes q ON q.id = qq.quiz_id";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizQuestion {
    pub id: i64,
    pub position: i32,
    pub kind: String,
    pub prompt: String,
    pub case_text: Option<String>,
    pub image: Option<String>,
    pub choices: Vec<String>,
    pub hint: Option<String>,
    pub chosen_index: Option<i32>,
    pub is_correct: Option<bool>,
    pub answer_index: Option<i32>,
    pub explanation: Option<String>,
}

impl From<QuestionRow> for QuizQuestion {
    fn from(r: QuestionRow) -> Self {
        let answered = r.chosen_index.is_some();
        Self {
            id: r.id,
            position: r.position,
            kind: r.kind,
            prompt: r.prompt,
            case_text: r.case_text,
            image: r.image,
            choices: r.choices.0,
            hint: r.hint,
            chosen_index: r.chosen_index,
            is_correct: r.is_correct,
            answer_index: answered.then_some(r.answer_index),
            explanation: if answered { r.explanation } else { None },
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizDetail {
    pub quiz: QuizSummary,
    pub questions: Vec<QuizQuestion>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedQuiz {
    pub quiz: QuizSummary,
    /// How many questions were asked for (the bank may have fewer).
    pub requested: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewQuiz {
    pub topic: String,
    pub notes: Option<String>,
    pub question_types: Vec<String>,
    pub count: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: i64,
    /// "user" | "assistant"
    pub role: String,
    pub content: String,
    pub attachment: Option<String>,
    pub created_at: String,
}

const CHAT_SELECT: &str = concat!(
    "SELECT m.id, m.role, m.content, m.attachment, ",
    ts!("m.created_at"), " AS created_at FROM chat_messages m"
);

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct StudyActivity {
    pub id: i64,
    pub title: String,
    pub subtitle: Option<String>,
    /// "review" | "quiz" | "care_plan" | "chat"
    pub kind: String,
    pub link: Option<String>,
    pub created_at: String,
}

// ---------- helpers ----------

fn seed_from_clock() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(42)
}

/// Builds a quiz from the question bank. Returns the new quiz id.
pub(crate) async fn insert_quiz(
    conn: &mut PgConnection,
    uid: i64,
    topic: &str,
    notes: Option<&str>,
    kinds: &[String],
    count: usize,
    seed: u64,
) -> AppResult<i64> {
    let picked = question_bank::pick(kinds, topic, count, &mut Rng::new(seed));
    if picked.is_empty() {
        return Err(AppError::new("No practice questions are available for those question types"));
    }
    let quiz_id: i64 = sqlx::query_scalar(
        "INSERT INTO quizzes (user_id, title, source_notes, question_types) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(uid)
    .bind(topic)
    .bind(notes)
    .bind(kinds)
    .fetch_one(&mut *conn)
    .await?;
    for (position, q) in picked.iter().enumerate() {
        sqlx::query(
            "INSERT INTO quiz_questions
                (quiz_id, position, kind, prompt, case_text, image, choices, answer_index, explanation, hint)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(quiz_id)
        .bind(position as i32)
        .bind(q.kind)
        .bind(q.prompt)
        .bind(q.case_text)
        .bind(q.image)
        .bind(Json(q.choices))
        .bind(q.answer as i32)
        .bind(q.explanation)
        .bind(q.hint)
        .execute(&mut *conn)
        .await?;
    }
    Ok(quiz_id)
}

async fn quiz_summary(pool: &PgPool, uid: i64, id: i64) -> AppResult<QuizSummary> {
    sqlx::query_as::<_, QuizSummary>(&format!(
        "{QUIZ_SUMMARY} WHERE q.id = $1 AND q.user_id = $2 GROUP BY q.id"
    ))
    .bind(id)
    .bind(uid)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| not_found("Quiz", id))
}

async fn quiz_detail(pool: &PgPool, uid: i64, id: i64) -> AppResult<QuizDetail> {
    let quiz = quiz_summary(pool, uid, id).await?;
    let questions = sqlx::query_as::<_, QuestionRow>(&format!(
        "{QUESTION_SELECT} WHERE qq.quiz_id = $1 AND q.user_id = $2 ORDER BY qq.position"
    ))
    .bind(id)
    .bind(uid)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(QuizQuestion::from)
    .collect();
    Ok(QuizDetail { quiz, questions })
}

pub(crate) async fn log_activity(
    conn: &mut PgConnection,
    uid: i64,
    title: &str,
    subtitle: &str,
    kind: &str,
    link: &str,
) -> AppResult<()> {
    sqlx::query("INSERT INTO study_activity (user_id, title, subtitle, kind, link) VALUES ($1, $2, $3, $4, $5)")
        .bind(uid)
        .bind(title)
        .bind(subtitle)
        .bind(kind)
        .bind(link)
        .execute(conn)
        .await?;
    Ok(())
}

fn kind_label(kind: &str) -> &'static str {
    match kind {
        "multiple_choice" => "Multiple Choice",
        "true_false" => "True or False",
        "identification" => "Identification",
        "case_based" => "Case-based",
        _ => "Practice",
    }
}

/// Placeholder until an AI provider is connected.
fn placeholder_reply(content: &str, attachment: Option<&str>) -> String {
    let mut reply = String::new();
    if let Some(name) = attachment {
        reply.push_str(&format!("I received your attachment ({name}). "));
    }
    reply.push_str(
        "AI answers aren't connected yet, so this is a placeholder reply. \
         Once NurSet AI is set up, I'll respond to: ",
    );
    let preview: String = content.chars().take(160).collect();
    let ellipsis = if content.chars().count() > 160 { "…" } else { "" };
    reply.push_str(&format!("\u{201c}{preview}{ellipsis}\u{201d}"));
    reply
}

// ---------- commands: activity + quizzes ----------

#[tauri::command]
pub async fn list_study_activity(db: State<'_, Db>, limit: Option<i64>) -> AppResult<Vec<StudyActivity>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, StudyActivity>(concat!(
        "SELECT a.id, a.title, a.subtitle, a.kind, a.link, ",
        ts!("a.created_at"), " AS created_at FROM study_activity a
         WHERE a.user_id = $1 ORDER BY a.created_at DESC, a.id DESC LIMIT $2"
    ))
    .bind(uid)
    .bind(limit.unwrap_or(10).clamp(1, 100))
    .fetch_all(&db.pool)
    .await?)
}

#[tauri::command]
pub async fn list_quizzes(db: State<'_, Db>) -> AppResult<Vec<QuizSummary>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, QuizSummary>(&format!(
        "{QUIZ_SUMMARY} WHERE q.user_id = $1 GROUP BY q.id ORDER BY q.created_at DESC, q.id DESC"
    ))
    .bind(uid)
    .fetch_all(&db.pool)
    .await?)
}

#[tauri::command]
pub async fn create_quiz(db: State<'_, Db>, input: NewQuiz) -> AppResult<CreatedQuiz> {
    let topic = required_text(&input.topic, "Quiz topic")?;
    let kinds: Vec<String> = input
        .question_types
        .into_iter()
        .filter(|k| QUESTION_KINDS.contains(&k.as_str()))
        .collect();
    if kinds.is_empty() {
        return Err(AppError::new("Choose at least one question type"));
    }
    if !(1..=100).contains(&input.count) {
        return Err(AppError::new("Number of questions must be between 1 and 100"));
    }
    let uid = db.user_id().await?;
    let notes = optional_text(input.notes);

    let mut tx = db.pool.begin().await?;
    let id = insert_quiz(&mut tx, uid, &topic, notes.as_deref(), &kinds, input.count as usize, seed_from_clock()).await?;
    let question_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    let types = kinds.iter().map(|k| kind_label(k)).collect::<Vec<_>>().join(", ");
    log_activity(
        &mut tx,
        uid,
        &format!("{topic} Quiz"),
        &format!("{question_count} questions · {types}"),
        "quiz",
        &format!("/ai-study/quiz/{id}"),
    )
    .await?;
    tx.commit().await?;

    Ok(CreatedQuiz { quiz: quiz_summary(&db.pool, uid, id).await?, requested: input.count })
}

#[tauri::command]
pub async fn get_quiz(db: State<'_, Db>, id: i64) -> AppResult<QuizDetail> {
    let uid = db.user_id().await?;
    quiz_detail(&db.pool, uid, id).await
}

/// Records the answer (once) and returns the question with the correct answer revealed.
#[tauri::command]
pub async fn answer_question(db: State<'_, Db>, id: i64, chosen_index: i32) -> AppResult<QuizQuestion> {
    let uid = db.user_id().await?;
    let row = sqlx::query_as::<_, QuestionRow>(&format!("{QUESTION_SELECT} WHERE qq.id = $1 AND q.user_id = $2"))
        .bind(id)
        .bind(uid)
        .fetch_optional(&db.pool)
        .await?
        .ok_or_else(|| not_found("Question", id))?;
    if row.chosen_index.is_some() {
        return Err(AppError::new("This question has already been answered"));
    }
    if chosen_index < 0 || chosen_index as usize >= row.choices.0.len() {
        return Err(AppError::new("Invalid choice"));
    }
    sqlx::query(
        "UPDATE quiz_questions SET chosen_index = $2, is_correct = $3, answered_at = now() WHERE id = $1",
    )
    .bind(id)
    .bind(chosen_index)
    .bind(chosen_index == row.answer_index)
    .execute(&db.pool)
    .await?;
    let updated = sqlx::query_as::<_, QuestionRow>(&format!("{QUESTION_SELECT} WHERE qq.id = $1"))
        .bind(id)
        .fetch_one(&db.pool)
        .await?;
    Ok(updated.into())
}

#[tauri::command]
pub async fn finish_quiz(db: State<'_, Db>, id: i64) -> AppResult<QuizSummary> {
    let uid = db.user_id().await?;
    sqlx::query(
        "UPDATE quizzes SET completed_at = now(),
             score = (SELECT COUNT(*) FILTER (WHERE is_correct) FROM quiz_questions WHERE quiz_id = $1)
         WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(uid)
    .execute(&db.pool)
    .await?;
    quiz_summary(&db.pool, uid, id).await
}

/// Clears all answers so the quiz can be taken again.
#[tauri::command]
pub async fn restart_quiz(db: State<'_, Db>, id: i64) -> AppResult<QuizDetail> {
    let uid = db.user_id().await?;
    let changed = sqlx::query("UPDATE quizzes SET completed_at = NULL, score = NULL WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(uid)
        .execute(&db.pool)
        .await?
        .rows_affected();
    if changed == 0 {
        return Err(not_found("Quiz", id));
    }
    sqlx::query(
        "UPDATE quiz_questions SET chosen_index = NULL, is_correct = NULL, answered_at = NULL WHERE quiz_id = $1",
    )
    .bind(id)
    .execute(&db.pool)
    .await?;
    quiz_detail(&db.pool, uid, id).await
}

// ---------- commands: assistant chat ----------

#[tauri::command]
pub async fn list_chat_messages(db: State<'_, Db>) -> AppResult<Vec<ChatMessage>> {
    let uid = db.user_id().await?;
    Ok(sqlx::query_as::<_, ChatMessage>(&format!("{CHAT_SELECT} WHERE m.user_id = $1 ORDER BY m.id"))
        .bind(uid)
        .fetch_all(&db.pool)
        .await?)
}

/// Saves the user's message and a placeholder assistant reply; returns both.
#[tauri::command]
pub async fn send_chat_message(
    db: State<'_, Db>,
    content: String,
    attachment: Option<String>,
) -> AppResult<Vec<ChatMessage>> {
    let content = required_text(&content, "Message")?;
    let attachment = optional_text(attachment);
    let uid = db.user_id().await?;

    let mut tx = db.pool.begin().await?;
    let first: bool = sqlx::query_scalar("SELECT NOT EXISTS (SELECT 1 FROM chat_messages WHERE user_id = $1)")
        .bind(uid)
        .fetch_one(&mut *tx)
        .await?;
    let user_msg_id: i64 = sqlx::query_scalar(
        "INSERT INTO chat_messages (user_id, role, content, attachment) VALUES ($1, 'user', $2, $3) RETURNING id",
    )
    .bind(uid)
    .bind(&content)
    .bind(&attachment)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'assistant', $2)")
        .bind(uid)
        .bind(placeholder_reply(&content, attachment.as_deref()))
        .execute(&mut *tx)
        .await?;
    if first {
        let subtitle: String = content.chars().take(60).collect();
        log_activity(&mut tx, uid, "AI Assistant Chat", &subtitle, "chat", "/ai-study/chat").await?;
    }
    let messages = sqlx::query_as::<_, ChatMessage>(&format!(
        "{CHAT_SELECT} WHERE m.user_id = $1 AND m.id >= $2 ORDER BY m.id"
    ))
    .bind(uid)
    .bind(user_msg_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(messages)
}

/// Starts a new conversation.
#[tauri::command]
pub async fn clear_chat(db: State<'_, Db>) -> AppResult<()> {
    let uid = db.user_id().await?;
    sqlx::query("DELETE FROM chat_messages WHERE user_id = $1")
        .bind(uid)
        .execute(&db.pool)
        .await?;
    Ok(())
}

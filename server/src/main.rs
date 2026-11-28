//! NurSet API server.
//!
//! The desktop app calls `POST /api/rpc/<command>` with a JSON object of
//! arguments (the same names the app used locally) and an optional
//! `Authorization: Bearer <token>` header from `sign_in` / `register`.
//!
//! Environment (see `server/.env.example`):
//!   DATABASE_URL     PostgreSQL connection string (Render: Internal Database URL)
//!   GEMINI_API_KEY   AI Study; without it the AI features use their fallbacks
//!   PORT             listen port (Render sets it; default 8080)
//!   TZ               time zone for "today", deadlines, and daily limits (Asia/Manila)

mod ai;
mod commands;
mod db;
mod dispatch;
mod error;
mod files;
mod migrate;
mod models;
mod question_bank;
mod rate_limit;

#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod integration_tests_auth;
#[cfg(test)]
mod integration_tests_ci;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::{Body, Bytes};
use axum::extract::{ConnectInfo, DefaultBodyLimit, Path, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

use crate::db::{Db, DEFAULT_DATABASE_URL, SIGNED_OUT};
use crate::error::{AppError, AppResult};
use crate::rate_limit::LoginLimiter;

/// Largest request body (uploads are capped lower by each command).
const MAX_BODY_BYTES: usize = 30 * 1024 * 1024;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    login_limiter: Arc<LoginLimiter>,
}

#[tokio::main]
async fn main() {
    // server/.env when started from the repo root (`pnpm server`), else ./.env.
    if dotenvy::from_path("server/.env").is_err() {
        let _ = dotenvy::dotenv();
    }
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    let pool = Db::connect_lazy(&url).expect("valid DATABASE_URL").pool;
    match migrate::run(&pool).await {
        Ok(applied) if applied.is_empty() => println!("Database schema is up to date."),
        Ok(applied) => println!("Applied migrations: {}", applied.join(", ")),
        // Keep serving: /health reports the problem and requests get a clear error.
        Err(e) => eprintln!("Couldn't run database migrations: {e}"),
    }
    let state = AppState { pool, login_limiter: Arc::default() };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/rpc/{name}", post(rpc))
        .route("/api/upload/document", post(upload_document))
        .route("/api/upload/material", post(upload_material))
        .route("/files/{ticket}", get(download))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind port");
    println!(
        "NurSet server listening on {addr} ({} commands, AI {})",
        dispatch::COMMAND_COUNT,
        if ai::GeminiConfig::from_env().is_some() { "on" } else { "off" },
    );
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown())
        .await
        .expect("server");
}

async fn shutdown() {
    let _ = tokio::signal::ctrl_c().await;
}

/// A per-request context, signed in when the bearer token is valid.
async fn request_db(state: &AppState, headers: &HeaderMap) -> AppResult<Db> {
    let db = Db::from_pool(state.pool.clone());
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|t| !t.is_empty());
    if let Some(token) = token {
        if let Some((uid, sid)) = commands::auth::resolve_token(&db.pool, token).await? {
            db.start_session(uid, sid);
        }
    }
    Ok(db)
}

/// `{"error": message}` with a status the app can act on.
fn error_response(err: AppError) -> Response {
    let message = err.to_string();
    let status = if message == SIGNED_OUT {
        StatusCode::UNAUTHORIZED
    } else if message == dispatch::UNKNOWN_COMMAND {
        StatusCode::NOT_FOUND
    } else if message == commands::PREMIUM_REQUIRED {
        StatusCode::FORBIDDEN
    } else if message.starts_with(error::DATABASE_DOWN) {
        eprintln!("database unavailable");
        StatusCode::SERVICE_UNAVAILABLE
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(json!({ "error": message }))).into_response()
}

fn respond(result: AppResult<Value>) -> Response {
    match result {
        Ok(value) => Json(value).into_response(),
        Err(err) => error_response(err),
    }
}

async fn health(State(state): State<AppState>) -> Response {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&state.pool).await.is_ok();
    let status = if db_ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, Json(json!({ "ok": db_ok, "commands": dispatch::COMMAND_COUNT }))).into_response()
}

/// The caller's IP: the first `X-Forwarded-For` entry (Render's proxy sets it),
/// else the TCP peer. The header can be forged off Render, which only gets
/// around the per-IP limit; the per-account limit still applies.
fn client_ip(headers: &HeaderMap, peer: SocketAddr) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(str::trim)
        .filter(|ip| !ip.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| peer.ip().to_string())
}

async fn rpc(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(name): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let args: Value = if body.is_empty() {
        Value::Null
    } else {
        match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => return error_response(AppError::new("Request body must be JSON")),
        }
    };
    let db = match request_db(&state, &headers).await {
        Ok(db) => db,
        Err(e) => return error_response(e),
    };
    if name == "sign_in" {
        return sign_in(&state, &db, &headers, peer, args).await;
    }
    respond(dispatch::call(&db, &name, args).await)
}

/// `sign_in` with the login rate limit (HTTP 429 once it's reached).
async fn sign_in(state: &AppState, db: &Db, headers: &HeaderMap, peer: SocketAddr, args: Value) -> Response {
    let identifier = args.get("identifier").and_then(Value::as_str).unwrap_or_default().to_string();
    let attempt = match state.login_limiter.begin(&identifier, &client_ip(headers, peer)) {
        Ok(attempt) => attempt,
        Err(wait) => {
            let mut response = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({ "error": rate_limit::too_many_message(wait) })),
            )
                .into_response();
            if let Ok(v) = HeaderValue::from_str(&wait.as_secs().max(1).to_string()) {
                response.headers_mut().insert(header::RETRY_AFTER, v);
            }
            return response;
        }
    };
    let result = dispatch::call(db, "sign_in", args).await;
    match &result {
        Ok(_) => state.login_limiter.succeeded(attempt),
        Err(e) if e.to_string() == commands::auth::BAD_LOGIN => {}
        Err(_) => state.login_limiter.not_counted(attempt),
    }
    respond(result)
}

async fn upload_document(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    match request_db(&state, &headers).await {
        Ok(db) => respond(
            commands::documents::upload_document(&db, &body)
                .await
                .and_then(|d| serde_json::to_value(d).map_err(AppError::from)),
        ),
        Err(e) => error_response(e),
    }
}

async fn upload_material(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    match request_db(&state, &headers).await {
        Ok(db) => respond(
            commands::quick_links::upload_material(&db, &body)
                .await
                .and_then(|m| serde_json::to_value(m).map_err(AppError::from)),
        ),
        Err(e) => error_response(e),
    }
}

/// Serves a one-time download link from an "open" or "export" command.
async fn download(State(state): State<AppState>, Path(ticket): Path<String>) -> Response {
    let Some((payload, name, attachment)) = files::ticket(&ticket) else {
        return (StatusCode::NOT_FOUND, "This link has expired. Go back to NurSet and open the file again.")
            .into_response();
    };
    let bytes = match payload {
        files::Payload::Bytes(b) => b,
        files::Payload::Stored(key) => match files::read(&state.pool, &key).await {
            Ok(Some(b)) => b,
            Ok(None) => return (StatusCode::NOT_FOUND, "File not found").into_response(),
            Err(e) => return error_response(e),
        },
    };
    // RFC 5987 file name so non-ASCII names survive.
    let encoded: String = name
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'.' | b'-' | b'_' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect();
    let disposition = format!("{}; filename*=UTF-8''{encoded}", if attachment { "attachment" } else { "inline" });
    let mut response = Response::new(Body::from(bytes));
    let h = response.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static(files::content_type(&name)));
    if let Ok(v) = HeaderValue::from_str(&disposition) {
        h.insert(header::CONTENT_DISPOSITION, v);
    }
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    h.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    response
}

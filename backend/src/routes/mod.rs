use std::time::Duration;

use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde_json::{json, Value};
use tower_http::timeout::TimeoutLayer;

use crate::state::AppState;

pub mod account;
pub mod admin;
pub mod admin_catalog;
pub mod auth;
pub mod brands;
pub mod cart;
pub mod catalog;
pub mod checkout;
pub mod content;
pub mod documents;
pub mod home;

/// 200 — API и база работают; 503 — база недоступна (healthcheck контейнера / балансировщика).
async fn health(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&state.pool).await.is_ok();
    let status = if db_ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, Json(json!({ "status": if db_ok { "ok" } else { "degraded" }, "db": if db_ok { "ok" } else { "down" }, "version": state.version })))
}

pub fn api() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .merge(home::routes())
        .merge(catalog::routes())
        .merge(brands::routes())
        .merge(content::routes())
        .merge(auth::routes())
        .merge(cart::routes())
        .merge(checkout::routes())
        .merge(account::routes())
        .merge(admin::routes())
        .merge(admin_catalog::routes())
        .merge(documents::routes())
        .layer(TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, Duration::from_secs(30)))
        // импорт каталога: большой файл пишется в базу дольше 30 с
        .merge(admin_catalog::import_routes().layer(TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, Duration::from_secs(600))))
}

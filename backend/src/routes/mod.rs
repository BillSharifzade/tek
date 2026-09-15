use axum::{extract::State, routing::get, Json, Router};
use serde_json::{json, Value};

use crate::{error::AppResult, state::AppState};

pub mod account;
pub mod admin;
pub mod auth;
pub mod brands;
pub mod cart;
pub mod catalog;
pub mod checkout;
pub mod content;
pub mod documents;
pub mod home;

async fn health(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let db: Result<i32, _> = sqlx::query_scalar("SELECT 1").fetch_one(&state.pool).await;
    Ok(Json(json!({
        "status": "ok",
        "db": if db.is_ok() { "ok" } else { "down" },
        "version": state.version,
    })))
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
        .merge(documents::routes())
}

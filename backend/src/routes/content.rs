use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Response,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{error::{AppError, AppResult}, state::AppState};

#[derive(Deserialize)]
pub struct Paging {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl Paging {
    pub fn clamp(&self, default_per: i64) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let per = self.per_page.unwrap_or(default_per).clamp(1, 100);
        (page, per)
    }
}

#[derive(Serialize, sqlx::FromRow)]
struct ProjectListRow {
    slug: String,
    title: String,
    year: String,
    #[sqlx(rename = "project_date")]
    date: chrono::NaiveDate,
    object: String,
    service: String,
    #[sqlx(rename = "image_url")]
    image: Option<String>,
    excerpt: String,
    #[serde(skip)]
    total: i64,
}

async fn projects(State(state): State<AppState>, Query(p): Query<Paging>, headers: HeaderMap) -> AppResult<Response> {
    let (page, per) = p.clamp(12);
    state
        .cached_json(format!("projects:{page}:{per}"), &headers, |state| async move {
            let rows = sqlx::query_as::<_, ProjectListRow>(
                "SELECT slug, title, year, project_date, object, service, image_url, excerpt, count(*) OVER() AS total FROM projects ORDER BY project_date DESC, sort, id LIMIT $1 OFFSET $2",
            )
            .bind(per)
            .bind((page - 1) * per)
            .fetch_all(&state.pool)
            .await?;
            let total = rows.first().map(|r| r.total).unwrap_or(0);
            Ok(json!({ "items": rows, "total": total, "page": page, "per_page": per, "pages": (total + per - 1) / per }))
        })
        .await
}

async fn project(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("project:{slug}"), &headers, |state| async move {
            let row: Option<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, title, year, project_date AS date, object, service, image_url AS image, excerpt, body FROM projects WHERE slug = $1) t",
            )
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await?;
            row.ok_or_else(|| AppError::not_found("Проект не найден"))
        })
        .await
}

async fn news(State(state): State<AppState>, Query(p): Query<Paging>, headers: HeaderMap) -> AppResult<Response> {
    let (page, per) = p.clamp(12);
    state
        .cached_json(format!("news:{page}:{per}"), &headers, |state| async move {
            let rows: Vec<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, title, published_at AS date, excerpt, image_url AS image, count(*) OVER() AS total FROM news ORDER BY published_at DESC, id LIMIT $1 OFFSET $2) t",
            )
            .bind(per)
            .bind((page - 1) * per)
            .fetch_all(&state.pool)
            .await?;
            let total = rows.first().and_then(|r| r.get("total")).and_then(|v| v.as_i64()).unwrap_or(0);
            Ok(json!({ "items": rows, "total": total, "page": page, "pages": (total + per - 1) / per }))
        })
        .await
}

async fn news_item(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("news:{slug}"), &headers, |state| async move {
            let row: Option<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, title, published_at AS date, excerpt, body, image_url AS image FROM news WHERE slug = $1) t",
            )
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await?;
            row.ok_or_else(|| AppError::not_found("Новость не найдена"))
        })
        .await
}

async fn services(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json("services".to_string(), &headers, |state| async move {
            let rows: Vec<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, title, short, body, image_url AS image FROM services ORDER BY sort, id) t",
            )
            .fetch_all(&state.pool)
            .await?;
            Ok(rows)
        })
        .await
}

async fn service(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("service:{slug}"), &headers, |state| async move {
            let row: Option<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, title, short, body, image_url AS image FROM services WHERE slug = $1) t",
            )
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await?;
            row.ok_or_else(|| AppError::not_found("Услуга не найдена"))
        })
        .await
}

async fn page(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("page:{slug}"), &headers, |state| async move {
            let row: Option<Value> = sqlx::query_scalar("SELECT to_jsonb(t) FROM (SELECT slug, title, body_html FROM pages WHERE slug = $1) t")
                .bind(&slug)
                .fetch_optional(&state.pool)
                .await?;
            row.ok_or_else(|| AppError::not_found("Страница не найдена"))
        })
        .await
}

async fn configurators(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json("configurators".to_string(), &headers, |state| async move {
            let rows: Vec<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, name, description, url, image_url AS image FROM configurators ORDER BY id) t",
            )
            .fetch_all(&state.pool)
            .await?;
            Ok(rows)
        })
        .await
}

async fn stores(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json("stores".to_string(), &headers, |state| async move {
            let rows: Vec<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT id, city, name, address, phone, hours, delivery_hint FROM stores ORDER BY sort, id) t",
            )
            .fetch_all(&state.pool)
            .await?;
            Ok(rows)
        })
        .await
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/content/projects", get(projects))
        .route("/content/projects/{slug}", get(project))
        .route("/content/news", get(news))
        .route("/content/news/{slug}", get(news_item))
        .route("/content/services", get(services))
        .route("/content/services/{slug}", get(service))
        .route("/content/pages/{slug}", get(page))
        .route("/content/configurators", get(configurators))
        .route("/content/stores", get(stores))
}

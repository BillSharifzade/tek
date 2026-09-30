use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    auth::OptionalUser,
    error::{AppError, AppResult},
    models::ProductRow,
    services::{
        catalog::{products_by_ids, to_card},
        outbox,
        pricing::PriceCtx,
    },
    state::AppState,
};

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
    brands: Value,
    /// верхние разделы каталога, к которым относятся применённые продукты (фильтр «Продукция»)
    categories: Value,
    #[serde(skip)]
    total: i64,
}

async fn projects(State(state): State<AppState>, Query(p): Query<Paging>, headers: HeaderMap) -> AppResult<Response> {
    let (page, per) = p.clamp(12);
    state
        .cached_json(format!("projects:{page}:{per}"), &headers, |state| async move {
            let rows = sqlx::query_as::<_, ProjectListRow>(
                r#"SELECT p.slug, p.title, p.year, p.project_date, p.object, p.service, p.image_url, p.excerpt,
                          COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name, 'logo', b.logo_url) ORDER BY b.sort, b.id)
                                    FROM project_brands pb JOIN brands b ON b.id = pb.brand_id WHERE pb.project_id = p.id), '[]'::jsonb) AS brands,
                          COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', t.slug, 'name', t.name) ORDER BY t.sort, t.id) FROM (
                                      SELECT DISTINCT tc.id, tc.slug, tc.name, tc.sort
                                      FROM project_products pp JOIN products pr ON pr.id = pp.product_id
                                      JOIN categories c ON c.id = pr.category_id JOIN categories tc ON tc.path = split_part(c.path, '/', 1)
                                      WHERE pp.project_id = p.id) t), '[]'::jsonb) AS categories,
                          count(*) OVER() AS total
                   FROM projects p ORDER BY p.project_date DESC, p.sort, p.id LIMIT $1 OFFSET $2"#,
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
            let row: Option<(i32, Value)> = sqlx::query_as(
                r#"SELECT t.id, to_jsonb(t) - 'id' FROM (
                     SELECT p.id, p.slug, p.title, p.year, p.project_date AS date, p.object, p.service, p.image_url AS image, p.excerpt, p.body,
                            p.photos, p.video_url,
                            COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name, 'logo', b.logo_url) ORDER BY b.sort, b.id)
                                      FROM project_brands pb JOIN brands b ON b.id = pb.brand_id WHERE pb.project_id = p.id), '[]'::jsonb) AS brands
                     FROM projects p WHERE p.slug = $1) t"#,
            )
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await?;
            let (id, mut body) = row.ok_or_else(|| AppError::not_found("Проект не найден"))?;
            // применённые продукты — карточки каталога с прайсовой ценой (ответ кешируется публично)
            let ids: Vec<uuid::Uuid> = sqlx::query_scalar("SELECT product_id FROM project_products WHERE project_id = $1 ORDER BY sort, product_id")
                .bind(id)
                .fetch_all(&state.pool)
                .await?;
            let rows: Vec<ProductRow> = products_by_ids(&state.pool, &ids).await?;
            let ctx = PriceCtx::anonymous();
            body["products"] = json!(rows.iter().map(|p| to_card(p, &ctx)).collect::<Vec<_>>());
            Ok(body)
        })
        .await
}

async fn news(State(state): State<AppState>, Query(p): Query<Paging>, headers: HeaderMap) -> AppResult<Response> {
    let (page, per) = p.clamp(12);
    state
        .cached_json(format!("news:{page}:{per}"), &headers, |state| async move {
            let rows: Vec<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT slug, title, published_at AS date, excerpt, image_url AS image, tags, count(*) OVER() AS total FROM news ORDER BY published_at DESC, id LIMIT $1 OFFSET $2) t",
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
                "SELECT to_jsonb(t) FROM (SELECT slug, title, published_at AS date, excerpt, body, image_url AS image, tags FROM news WHERE slug = $1) t",
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

// ---------- leads (формы «Оставить заявку», обратная связь) ----------

#[derive(Deserialize)]
struct NewLead {
    kind: Option<String>,
    name: String,
    phone: String,
    email: Option<String>,
    note: Option<String>,
    service: Option<String>,
    page: Option<String>,
}

fn clip(s: &str, max: usize) -> String {
    s.trim().chars().take(max).collect()
}

async fn post_lead(State(state): State<AppState>, OptionalUser(user): OptionalUser, Json(b): Json<NewLead>) -> AppResult<Response> {
    let name = clip(&b.name, 120);
    let phone = clip(&b.phone, 40);
    if name.is_empty() {
        return Err(AppError::unprocessable("name_required", "Укажите имя"));
    }
    if phone.chars().filter(|c| c.is_ascii_digit()).count() < 7 {
        return Err(AppError::unprocessable("phone_invalid", "Укажите телефон"));
    }
    let kind = match b.kind.as_deref() {
        Some(k @ ("service" | "feedback" | "question" | "project" | "consultation")) => k.to_string(),
        _ => "feedback".to_string(),
    };
    let email = b.email.as_deref().map(|e| clip(e, 160)).filter(|e| !e.is_empty());
    let note = clip(b.note.as_deref().unwrap_or(""), 4000);
    let service = b.service.as_deref().map(|s| clip(s, 200)).filter(|s| !s.is_empty());
    let page = b.page.as_deref().map(|s| clip(s, 300)).filter(|s| !s.is_empty());

    let mut tx = state.pool.begin().await?;
    let (id, created_at): (i64, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
        "INSERT INTO leads (kind, name, phone, email, note, service, page, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at",
    )
    .bind(&kind)
    .bind(&name)
    .bind(&phone)
    .bind(&email)
    .bind(&note)
    .bind(&service)
    .bind(&page)
    .bind(user.as_ref().map(|u| u.id))
    .fetch_one(&mut *tx)
    .await?;
    let payload = json!({
        "id": id, "kind": kind, "name": name, "phone": phone, "email": email, "note": note,
        "service": service, "page": page, "user_id": user.as_ref().map(|u| u.id), "created_at": created_at,
        // заявку получает закреплённый менеджер клиента, иначе — лид-менеджер (как заказы)
        "assignee": user.as_ref().and_then(|u| u.manager_id).map(|m| m.to_string()).unwrap_or_else(|| "lead_manager".into()),
    });
    outbox::enqueue(&mut tx, "crm", "lead.created", payload).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "created_at": created_at }))).into_response())
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
        .route("/leads", post(post_lead))
}

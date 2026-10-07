//! Панель управления: промокоды, быстрая правка товаров (цены, распродажа, бейджи, снятие с продажи, остатки)
//! и импорт каталога из Excel / CSV (только администратор).

use std::collections::HashMap;

use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, TimeZone, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{AssertSqlSafe, Postgres, QueryBuilder};
use uuid::Uuid;

use super::admin::{double_option, page_params, paged};
use crate::{
    auth::{Admin, Manager},
    error::{AppError, AppResult},
    models::{CouponRow, ProductRow, PRODUCT_SELECT},
    services::{
        catalog::{product_by_id, recount_categories},
        import,
    },
    state::AppState,
};

/// Файл импорта — до 20 МБ (остальной API — до 2 МБ).
pub const IMPORT_BODY_LIMIT: usize = 20 * 1024 * 1024;

// ---------- промокоды ----------

const COUPON_COLS: &str = "code, kind, value, min_total, active, expires_at, usage_limit, used_count";

fn invalid_coupon(msg: impl Into<String>) -> AppError {
    AppError::unprocessable("invalid_coupon", msg)
}

/// Код: 3–32 символа, латиница, цифры, «_» и «-»; хранится в верхнем регистре.
fn coupon_code(raw: &str) -> AppResult<String> {
    let code = raw.trim().to_uppercase();
    let ok = (3..=32).contains(&code.chars().count()) && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !ok {
        return Err(invalid_coupon("Код промокода: 3–32 символа — латинские буквы, цифры, «_» и «-»"));
    }
    Ok(code)
}

/// Срок действия: RFC 3339 (`2026-12-31T23:59:59+05:00`), `2026-12-31T23:59` или `2026-12-31` (до конца дня) — по времени Душанбе.
fn parse_expires(raw: &str) -> AppResult<DateTime<Utc>> {
    let raw = raw.trim();
    let tz = FixedOffset::east_opt(5 * 3600).expect("UTC+5");
    if let Ok(d) = DateTime::parse_from_rfc3339(raw) {
        return Ok(d.with_timezone(&Utc));
    }
    let local = NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M")
        .or_else(|_| NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M:%S"))
        .or_else(|_| NaiveDate::parse_from_str(raw, "%Y-%m-%d").map(|d| d.and_hms_opt(23, 59, 59).expect("valid time")))
        .map_err(|_| invalid_coupon("Срок действия: дата в формате 2026-12-31 или 2026-12-31T23:59:59+05:00"))?;
    tz.from_local_datetime(&local).single().map(|d| d.with_timezone(&Utc)).ok_or_else(|| invalid_coupon("Некорректный срок действия"))
}

fn check_coupon(kind: &str, value: Decimal, min_total: Decimal, usage_limit: Option<i32>) -> AppResult<()> {
    match kind {
        "percent" if value <= Decimal::ZERO || value > Decimal::ONE_HUNDRED => Err(invalid_coupon("Скидка в процентах — больше 0 и не больше 100")),
        "fixed" if value <= Decimal::ZERO => Err(invalid_coupon("Скидка в сомони — больше 0")),
        "percent" | "fixed" => Ok(()),
        _ => Err(invalid_coupon("Тип промокода: percent (процент) или fixed (сумма)")),
    }?;
    if min_total < Decimal::ZERO {
        return Err(invalid_coupon("Минимальная сумма заказа не может быть отрицательной"));
    }
    if usage_limit.is_some_and(|l| l < 1) {
        return Err(invalid_coupon("Лимит использований — не меньше 1 (пусто — без лимита)"));
    }
    Ok(())
}

#[derive(Deserialize)]
struct CouponInput {
    code: Option<String>,
    kind: Option<String>,
    value: Option<Decimal>,
    /// null — 0
    #[serde(default, deserialize_with = "double_option")]
    min_total: Option<Option<Decimal>>,
    active: Option<bool>,
    /// null или пустая строка — без срока
    #[serde(default, deserialize_with = "double_option")]
    expires_at: Option<Option<String>>,
    /// null — без лимита
    #[serde(default, deserialize_with = "double_option")]
    usage_limit: Option<Option<i32>>,
}

fn expires(v: Option<String>) -> AppResult<Option<DateTime<Utc>>> {
    match v.filter(|s| !s.trim().is_empty()) {
        Some(s) => parse_expires(&s).map(Some),
        None => Ok(None),
    }
}

async fn coupon_json(state: &AppState, code: &str) -> AppResult<Value> {
    let row: Option<Value> = sqlx::query_scalar(AssertSqlSafe(format!("SELECT to_jsonb(t) FROM (SELECT {COUPON_COLS} FROM coupons WHERE code = $1) t")))
        .bind(code)
        .fetch_optional(&state.pool)
        .await?;
    row.ok_or_else(|| AppError::not_found("Промокод не найден"))
}

async fn coupons(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(AssertSqlSafe(format!("SELECT to_jsonb(t) FROM (SELECT {COUPON_COLS} FROM coupons ORDER BY active DESC, code) t")))
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows))
}

async fn create_coupon(State(state): State<AppState>, Manager(_m): Manager, Json(b): Json<CouponInput>) -> AppResult<Response> {
    let code = coupon_code(b.code.as_deref().unwrap_or(""))?;
    let kind = b.kind.unwrap_or_default();
    let value = b.value.ok_or_else(|| invalid_coupon("Укажите размер скидки"))?.round_dp(2);
    let min_total = b.min_total.flatten().unwrap_or_default().round_dp(2);
    let usage_limit = b.usage_limit.flatten();
    let expires_at = expires(b.expires_at.flatten())?;
    check_coupon(&kind, value, min_total, usage_limit)?;
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM coupons WHERE upper(code) = $1)").bind(&code).fetch_one(&state.pool).await?;
    if exists {
        return Err(AppError::conflict("coupon_exists", "Промокод с таким кодом уже есть"));
    }
    sqlx::query("INSERT INTO coupons (code, kind, value, min_total, active, expires_at, usage_limit) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(&code)
        .bind(&kind)
        .bind(value)
        .bind(min_total)
        .bind(b.active.unwrap_or(true))
        .bind(expires_at)
        .bind(usage_limit)
        .execute(&state.pool)
        .await?;
    Ok((StatusCode::CREATED, Json(coupon_json(&state, &code).await?)).into_response())
}

async fn update_coupon(State(state): State<AppState>, Manager(_m): Manager, Path(code): Path<String>, Json(b): Json<CouponInput>) -> AppResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    let cur = sqlx::query_as::<_, CouponRow>("SELECT * FROM coupons WHERE upper(code) = upper($1) FOR UPDATE")
        .bind(code.trim())
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Промокод не найден"))?;
    if let Some(c) = &b.code
        && coupon_code(c)? != cur.code.to_uppercase()
    {
        return Err(invalid_coupon("Код промокода изменить нельзя — создайте новый промокод"));
    }
    let kind = b.kind.unwrap_or(cur.kind);
    let value = b.value.map(|v| v.round_dp(2)).unwrap_or(cur.value);
    let min_total = match b.min_total {
        Some(v) => v.unwrap_or_default().round_dp(2),
        None => cur.min_total,
    };
    let usage_limit = b.usage_limit.unwrap_or(cur.usage_limit);
    let expires_at = match b.expires_at {
        Some(v) => expires(v)?,
        None => cur.expires_at,
    };
    check_coupon(&kind, value, min_total, usage_limit)?;
    sqlx::query("UPDATE coupons SET kind = $2, value = $3, min_total = $4, active = $5, expires_at = $6, usage_limit = $7 WHERE code = $1")
        .bind(&cur.code)
        .bind(&kind)
        .bind(value)
        .bind(min_total)
        .bind(b.active.unwrap_or(cur.active))
        .bind(expires_at)
        .bind(usage_limit)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(coupon_json(&state, &cur.code).await?))
}

async fn delete_coupon(State(state): State<AppState>, Manager(_m): Manager, Path(code): Path<String>) -> AppResult<StatusCode> {
    let n = sqlx::query("DELETE FROM coupons WHERE upper(code) = upper($1)").bind(code.trim()).execute(&state.pool).await?.rows_affected();
    if n == 0 {
        return Err(AppError::not_found("Промокод не найден"));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ---------- товары ----------

#[derive(sqlx::FromRow)]
struct AdminListRow {
    total: i64,
    #[sqlx(flatten)]
    product: ProductRow,
}

/// Строка товара в панели, с остатками по всем складам (`stock`) — в том числе у снятых с продажи.
async fn product_rows(state: &AppState, products: &[ProductRow]) -> AppResult<Vec<Value>> {
    let ids: Vec<Uuid> = products.iter().map(|p| p.id).collect();
    let stores: Vec<(i32, String, String)> = sqlx::query_as("SELECT id, city, name FROM stores ORDER BY sort, id").fetch_all(&state.pool).await?;
    let stock: Vec<(Uuid, i32, Decimal)> = sqlx::query_as("SELECT product_id, store_id, qty FROM stock WHERE product_id = ANY($1)").bind(&ids).fetch_all(&state.pool).await?;
    let stock: HashMap<(Uuid, i32), Decimal> = stock.into_iter().map(|(p, s, q)| ((p, s), q)).collect();
    Ok(products
        .iter()
        .map(|p| {
            let mut badges = Vec::new();
            if p.sale_price.is_some() {
                badges.push("sale");
            }
            if p.is_hit {
                badges.push("hit");
            }
            if p.is_new {
                badges.push("new");
            }
            let per_store: Vec<Value> = stores
                .iter()
                .map(|(id, city, name)| json!({ "store_id": id, "city": city, "name": name, "qty": stock.get(&(p.id, *id)).copied().unwrap_or_default() }))
                .collect();
            json!({
                "id": p.id, "code": p.code, "slug": p.slug, "name": p.name,
                "category": { "slug": p.category_slug, "name": p.category_name },
                "brand": p.brand_slug.as_ref().map(|s| json!({ "slug": s, "name": p.brand_name })),
                "unit": p.unit, "list_price": p.list_price, "sale_price": p.sale_price, "pack_qty": p.pack_qty,
                "stock_total": p.stock_total, "stock": per_store,
                "is_active": p.is_active, "is_hit": p.is_hit, "is_new": p.is_new, "badges": badges,
                "image": p.images.first(), "created_at": p.created_at,
            })
        })
        .collect())
}

async fn admin_product(state: &AppState, id: Uuid) -> AppResult<Value> {
    let p = product_by_id(&state.pool, id).await?.ok_or_else(|| AppError::not_found("Товар не найден"))?;
    Ok(product_rows(state, std::slice::from_ref(&p)).await?.remove(0))
}

#[derive(Deserialize)]
struct ProductsQuery {
    q: Option<String>,
    category: Option<String>,
    brand: Option<String>,
    /// 1 — только в продаже, 0 — только снятые
    active: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
}

async fn products(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<ProductsQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let mut qb = QueryBuilder::<Postgres>::new(PRODUCT_SELECT.replacen("SELECT ", "SELECT count(*) OVER() AS total, ", 1));
    qb.push(" WHERE TRUE");
    if let Some(cat) = q.category.as_deref().filter(|s| !s.is_empty()) {
        let path: Option<String> = sqlx::query_scalar("SELECT path FROM categories WHERE slug = $1").bind(cat).fetch_optional(&state.pool).await?;
        match path {
            Some(p) => super::catalog::path_condition(&mut qb, &p),
            None => return Ok(Json(paged(vec![], 0, page, per))),
        }
    }
    if let Some(brand) = q.brand.as_deref().filter(|s| !s.is_empty()) {
        qb.push(" AND b.slug = ").push_bind(brand.to_string());
    }
    match q.active.as_deref() {
        Some("1" | "true") => {
            qb.push(" AND p.is_active");
        }
        Some("0" | "false") => {
            qb.push(" AND NOT p.is_active");
        }
        _ => {}
    }
    let text = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty());
    if let Some(text) = text {
        super::catalog::push_search(&mut qb, text, "p.name || ' ' || p.code || ' ' || COALESCE(b.name, '') || ' ' || c.name");
        qb.push(" ORDER BY (p.code = ").push_bind(text.to_string()).push(") DESC, p.name, p.id");
    } else {
        qb.push(" ORDER BY p.created_at DESC, p.name, p.id");
    }
    qb.push(" LIMIT ").push_bind(per).push(" OFFSET ").push_bind((page - 1) * per);
    let rows: Vec<AdminListRow> = qb.build_query_as().fetch_all(&state.pool).await?;
    let total = rows.first().map(|r| r.total).unwrap_or(0);
    let products: Vec<ProductRow> = rows.into_iter().map(|r| r.product).collect();
    Ok(Json(paged(product_rows(&state, &products).await?, total, page, per)))
}

async fn product(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>) -> AppResult<Json<Value>> {
    Ok(Json(admin_product(&state, id).await?))
}

#[derive(Deserialize)]
struct ProductPatch {
    list_price: Option<Decimal>,
    /// null — снять распродажу
    #[serde(default, deserialize_with = "double_option")]
    sale_price: Option<Option<Decimal>>,
    is_active: Option<bool>,
    is_hit: Option<bool>,
    is_new: Option<bool>,
}

/// Быстрая правка товара: прайс, цена распродажи (ниже прайса), в продаже / снят, бейджи «Хит» и «Новинка».
async fn update_product(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>, Json(b): Json<ProductPatch>) -> AppResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    let (list, sale, active): (Decimal, Option<Decimal>, bool) = sqlx::query_as("SELECT list_price, sale_price, is_active FROM products WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Товар не найден"))?;
    let list = b.list_price.map(|v| v.round_dp(2)).unwrap_or(list);
    let sale = match b.sale_price {
        Some(v) => v.map(|v| v.round_dp(2)),
        None => sale,
    };
    if list <= Decimal::ZERO || list > Decimal::from(10_000_000_000i64) {
        return Err(AppError::unprocessable("invalid_price", "Цена должна быть больше нуля"));
    }
    if sale.is_some_and(|s| s <= Decimal::ZERO || s >= list) {
        return Err(AppError::unprocessable("invalid_price", "Цена распродажи должна быть больше нуля и ниже цены"));
    }
    sqlx::query(
        "UPDATE products SET list_price = $2, sale_price = $3, is_active = COALESCE($4, is_active), is_hit = COALESCE($5, is_hit), is_new = COALESCE($6, is_new) WHERE id = $1",
    )
    .bind(id)
    .bind(list)
    .bind(sale)
    .bind(b.is_active)
    .bind(b.is_hit)
    .bind(b.is_new)
    .execute(&mut *tx)
    .await?;
    if b.is_active.is_some_and(|a| a != active) {
        recount_categories(&mut tx).await?;
    }
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(admin_product(&state, id).await?))
}

#[derive(Deserialize)]
struct StoreQty {
    store_id: i32,
    qty: Decimal,
}

#[derive(Deserialize)]
struct StockInput {
    stores: Vec<StoreQty>,
}

/// Остатки товара по складам — абсолютные значения (то, что можно продать; резерв заказов уже вычтен).
async fn update_stock(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>, Json(b): Json<StockInput>) -> AppResult<Json<Value>> {
    if b.stores.iter().any(|s| s.qty < Decimal::ZERO || s.qty > Decimal::from(1_000_000_000)) {
        return Err(AppError::unprocessable("invalid_qty", "Остаток — от 0"));
    }
    let known: Vec<i32> = sqlx::query_scalar("SELECT id FROM stores").fetch_all(&state.pool).await?;
    if let Some(s) = b.stores.iter().find(|s| !known.contains(&s.store_id)) {
        return Err(AppError::unprocessable("invalid_store", format!("Склад {} не найден", s.store_id)));
    }
    let mut tx = state.pool.begin().await?;
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM products WHERE id = $1)").bind(id).fetch_one(&mut *tx).await?;
    if !exists {
        return Err(AppError::not_found("Товар не найден"));
    }
    // последнее значение склада в списке — итоговое
    let mut by_store: Vec<(i32, Decimal)> = Vec::new();
    for s in &b.stores {
        by_store.retain(|x| x.0 != s.store_id);
        by_store.push((s.store_id, s.qty.round_dp(3)));
    }
    let stores: Vec<i32> = by_store.iter().map(|s| s.0).collect();
    let qtys: Vec<Decimal> = by_store.iter().map(|s| s.1).collect();
    sqlx::query(
        r#"INSERT INTO stock (product_id, store_id, qty) SELECT $1, s, q FROM unnest($2::int[], $3::numeric[]) AS x(s, q)
           ON CONFLICT (product_id, store_id) DO UPDATE SET qty = EXCLUDED.qty"#,
    )
    .bind(id)
    .bind(&stores)
    .bind(&qtys)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(admin_product(&state, id).await?))
}

// ---------- импорт каталога ----------

#[derive(Deserialize)]
struct ImportQuery {
    dry_run: Option<String>,
}

async fn import_catalog(State(state): State<AppState>, Admin(_a): Admin, Query(q): Query<ImportQuery>, mut multipart: Multipart) -> AppResult<Json<import::Summary>> {
    let dry_run = matches!(q.dry_run.as_deref(), Some("1" | "true" | "yes"));
    let read_err = |e: axum::extract::multipart::MultipartError| {
        if e.status() == StatusCode::PAYLOAD_TOO_LARGE {
            AppError::new(StatusCode::PAYLOAD_TOO_LARGE, "payload_too_large", "Файл больше 20 МБ — разделите его на части")
        } else {
            AppError::bad_request("invalid_file", format!("Не удалось прочитать файл: {}", e.body_text()))
        }
    };
    let mut file: Option<(String, axum::body::Bytes)> = None;
    while let Some(field) = multipart.next_field().await.map_err(read_err)? {
        if field.name() == Some("file") {
            let name = field.file_name().unwrap_or("").to_string();
            file = Some((name, field.bytes().await.map_err(read_err)?));
            break;
        }
    }
    let (name, bytes) = file.ok_or_else(|| AppError::unprocessable("file_required", "Приложите файл в поле file (.xlsx или .csv)"))?;
    let table = tokio::task::spawn_blocking(move || import::parse_file(&name, &bytes)).await.map_err(|e| AppError::internal(format!("join: {e}")))??;
    let summary = import::run(&state.pool, table, dry_run).await?;
    if !dry_run {
        state.invalidate_public();
    }
    Ok(Json(summary))
}

async fn import_template(State(state): State<AppState>, Admin(_a): Admin) -> AppResult<Response> {
    let bytes = import::template(&state.pool).await?;
    Ok(super::cart::xlsx_response(bytes, "tek-catalog-import.xlsx"))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/coupons", get(coupons).post(create_coupon))
        .route("/admin/coupons/{code}", put(update_coupon).delete(delete_coupon))
        .route("/admin/products", get(products))
        .route("/admin/products/{id}", get(product).put(update_product))
        .route("/admin/products/{id}/stock", put(update_stock))
        .route("/admin/import/template.xlsx", get(import_template))
}

/// Загрузка файла — отдельно: свой лимит тела (20 МБ) и таймаут (большой каталог пишется дольше 30 с).
pub fn import_routes() -> Router<AppState> {
    Router::new().route("/admin/import/catalog", post(import_catalog)).layer(DefaultBodyLimit::max(IMPORT_BODY_LIMIT))
}

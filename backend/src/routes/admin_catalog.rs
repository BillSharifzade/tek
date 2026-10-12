//! Панель управления: промокоды, быстрая правка товаров (цены, распродажа, бейджи, снятие с продажи, остатки),
//! документы, комплектующие, торговые предложения и страна производства товара, бренды (страны), загрузка файлов
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
        files::{self, Upload},
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

/// Товар в панели: строка списка + документы, комплектующие, торговое предложение (группа, оси, значения, другие
/// исполнения группы), страна производства и страны бренда.
async fn admin_product(state: &AppState, id: Uuid) -> AppResult<Value> {
    let p = product_by_id(&state.pool, id).await?.ok_or_else(|| AppError::not_found("Товар не найден"))?;
    let mut row = product_rows(state, std::slice::from_ref(&p)).await?.remove(0);
    let pool = &state.pool;
    let country_origin: Option<String> = sqlx::query_scalar("SELECT country_origin FROM products WHERE id = $1").bind(id).fetch_one(pool).await?;
    let brand: Option<Value> = sqlx::query_scalar(
        "SELECT to_jsonb(t) FROM (SELECT b.id, b.slug, b.name, b.country_brand, b.country_origin FROM brands b WHERE b.id = $1) t",
    )
    .bind(p.brand_id)
    .fetch_optional(pool)
    .await?;
    let documents: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (SELECT d.id, d.title, d.kind, d.file_name, d.size_kb, d.url, d.file_id IS NOT NULL AS has_file
           FROM product_documents pd JOIN documents d ON d.id = pd.document_id WHERE pd.product_id = $1 ORDER BY d.kind, d.id) t"#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?;
    let accessories: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (SELECT a.group_name AS "group", x.id AS product_id, x.code, x.name, x.is_active
           FROM accessories a JOIN products x ON x.id = a.accessory_id WHERE a.product_id = $1 ORDER BY a.sort, a.group_name, x.name) t"#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?;
    let variant = match p.group_id {
        Some(gid) => {
            let (name, axes): (String, Vec<String>) = sqlx::query_as("SELECT name, axes FROM product_groups WHERE id = $1").bind(gid).fetch_one(pool).await?;
            let siblings: Vec<Value> = sqlx::query_scalar(
                "SELECT to_jsonb(t) FROM (SELECT id, code, name, variant AS values, is_active FROM products WHERE group_id = $1 AND id <> $2 ORDER BY name, code) t",
            )
            .bind(gid)
            .bind(id)
            .fetch_all(pool)
            .await?;
            json!({ "group": name, "axes": axes, "values": p.variant, "siblings": siblings })
        }
        None => Value::Null,
    };
    row["country_origin"] = json!(country_origin);
    row["brand_info"] = json!(brand);
    row["documents"] = json!(documents);
    row["accessories"] = json!(accessories);
    row["variant"] = variant;
    Ok(row)
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
    /// страна производства товара; null — как у бренда
    #[serde(default, deserialize_with = "double_option")]
    country_origin: Option<Option<String>>,
}

/// Название страны: без лишних пробелов, не длиннее 60 символов; пусто — не задана.
fn country(v: Option<String>) -> AppResult<Option<String>> {
    let v = v.map(|s| s.split_whitespace().collect::<Vec<_>>().join(" ")).filter(|s| !s.is_empty());
    if v.as_ref().is_some_and(|s| s.chars().count() > 60) {
        return Err(AppError::unprocessable("invalid_country", "Страна — не длиннее 60 символов"));
    }
    Ok(v)
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
    if let Some(c) = b.country_origin {
        sqlx::query("UPDATE products SET country_origin = $2 WHERE id = $1").bind(id).bind(country(c)?).execute(&mut *tx).await?;
    }
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

// ---------- документы, комплектующие, торговые предложения товара ----------

async fn product_exists(conn: &mut sqlx::PgConnection, id: Uuid) -> AppResult<()> {
    let ok: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM products WHERE id = $1)").bind(id).fetch_one(conn).await?;
    if ok { Ok(()) } else { Err(AppError::not_found("Товар не найден")) }
}

#[derive(Deserialize)]
struct DocLinksInput {
    document_ids: Vec<i32>,
}

/// Документы товара — из общей библиотеки документов (один сертификат можно привязать к разным товарам).
async fn product_documents(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>, Json(b): Json<DocLinksInput>) -> AppResult<Json<Value>> {
    let mut ids = b.document_ids;
    ids.dedup();
    if ids.len() > 100 {
        return Err(AppError::unprocessable("too_many", "Не больше 100 документов у товара"));
    }
    let mut tx = state.pool.begin().await?;
    product_exists(&mut tx, id).await?;
    let known: Vec<i32> = sqlx::query_scalar("SELECT id FROM documents WHERE id = ANY($1)").bind(&ids).fetch_all(&mut *tx).await?;
    if let Some(missing) = ids.iter().find(|i| !known.contains(i)) {
        return Err(AppError::unprocessable("unknown_document", format!("Документ #{missing} не найден")));
    }
    sqlx::query("DELETE FROM product_documents WHERE product_id = $1").bind(id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO product_documents (product_id, document_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING").bind(id).bind(&ids).execute(&mut *tx).await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(admin_product(&state, id).await?))
}

#[derive(Deserialize)]
struct AccessoryInput {
    code: String,
    group: String,
}

#[derive(Deserialize)]
struct AccessoriesInput {
    items: Vec<AccessoryInput>,
}

/// Комплектующие товара (вкладка «Комплектующие»): товары по коду, сгруппированные («Крышки», «Крепёж»…), в порядке списка.
async fn product_accessories(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>, Json(b): Json<AccessoriesInput>) -> AppResult<Json<Value>> {
    if b.items.len() > 300 {
        return Err(AppError::unprocessable("too_many", "Не больше 300 комплектующих у товара"));
    }
    let items: Vec<(String, String)> = b.items.into_iter().map(|i| (i.code.trim().to_string(), i.group.split_whitespace().collect::<Vec<_>>().join(" "))).collect();
    if let Some((code, _)) = items.iter().find(|(c, g)| c.is_empty() || g.is_empty() || g.chars().count() > 100) {
        return Err(AppError::unprocessable("invalid_accessory", if code.is_empty() { "Укажите код товара".to_string() } else { format!("{code}: укажите группу (до 100 символов)") }));
    }
    let codes: Vec<String> = items.iter().map(|(c, _)| c.clone()).collect();
    let mut tx = state.pool.begin().await?;
    product_exists(&mut tx, id).await?;
    let found: Vec<(Uuid, String)> = sqlx::query_as("SELECT id, code FROM products WHERE code = ANY($1)").bind(&codes).fetch_all(&mut *tx).await?;
    let missing: Vec<&str> = codes.iter().filter(|c| !found.iter().any(|f| &f.1 == *c)).map(String::as_str).collect();
    if !missing.is_empty() {
        return Err(AppError::unprocessable("unknown_product", format!("Товары с кодом {} не найдены", missing.join(", "))));
    }
    sqlx::query("DELETE FROM accessories WHERE product_id = $1").bind(id).execute(&mut *tx).await?;
    let mut seen = Vec::new();
    for (sort, (code, group)) in items.iter().enumerate() {
        let acc = found.iter().find(|f| &f.1 == code).map(|f| f.0).expect("checked above");
        if acc == id || seen.contains(&acc) {
            continue;
        }
        seen.push(acc);
        sqlx::query("INSERT INTO accessories (product_id, accessory_id, group_name, sort) VALUES ($1, $2, $3, $4)")
            .bind(id)
            .bind(acc)
            .bind(group)
            .bind(sort as i32)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(admin_product(&state, id).await?))
}

#[derive(Deserialize)]
struct AxisValue {
    axis: String,
    value: String,
}

#[derive(Deserialize)]
struct VariantInput {
    /// название группы торговых предложений; пусто / null — товар не входит в группу
    group: Option<String>,
    /// оси группы по порядку на странице; не указаны — прежние оси группы (у новой — оси из `values`)
    axes: Option<Vec<String>>,
    values: Vec<AxisValue>,
}

fn clean_label(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Торговое предложение товара: группа (один товар в нескольких исполнениях), её оси и значения товара по осям.
/// Группа ищется по названию, новая создаётся; группы без товаров удаляются.
async fn product_variant(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>, Json(b): Json<VariantInput>) -> AppResult<Json<Value>> {
    let invalid = |m: String| AppError::unprocessable("invalid_variant", m);
    let group = b.group.as_deref().map(clean_label).filter(|g| !g.is_empty());
    let mut tx = state.pool.begin().await?;
    product_exists(&mut tx, id).await?;
    match group {
        None => {
            sqlx::query("UPDATE products SET group_id = NULL, variant = '{}'::jsonb WHERE id = $1").bind(id).execute(&mut *tx).await?;
        }
        Some(name) => {
            if name.chars().count() > 200 {
                return Err(invalid("Название группы — не длиннее 200 символов".into()));
            }
            let values: Vec<(String, String)> = b.values.iter().map(|v| (clean_label(&v.axis), clean_label(&v.value))).filter(|(a, _)| !a.is_empty()).collect();
            let existing: Option<(i32, Vec<String>)> = sqlx::query_as("SELECT id, axes FROM product_groups WHERE name = $1 FOR UPDATE").bind(&name).fetch_optional(&mut *tx).await?;
            let mut axes: Vec<String> = match (&b.axes, &existing) {
                (Some(list), _) => list.iter().map(|a| clean_label(a)).filter(|a| !a.is_empty()).collect(),
                (None, Some((_, axes))) if !axes.is_empty() => axes.clone(),
                _ => values.iter().map(|(a, _)| a.clone()).collect(),
            };
            let mut seen = Vec::new();
            axes.retain(|a| {
                let key = a.to_lowercase();
                let fresh = !seen.contains(&key);
                seen.push(key);
                fresh
            });
            if axes.is_empty() {
                return Err(invalid("Укажите хотя бы одну ось группы, например «Номинальный ток, А»".into()));
            }
            if axes.len() > 5 || axes.iter().any(|a| a.chars().count() > 100) {
                return Err(invalid("Не больше 5 осей, название оси — до 100 символов".into()));
            }
            if let Some((a, _)) = values.iter().find(|(a, _)| !axes.contains(a)) {
                return Err(invalid(format!("Оси «{a}» нет в группе: {}", axes.join(", "))));
            }
            let mut variant = serde_json::Map::new();
            for axis in &axes {
                let v = values.iter().find(|(a, _)| a == axis).map(|(_, v)| v.clone()).unwrap_or_default();
                if v.is_empty() || v.chars().count() > 100 {
                    return Err(invalid(format!("Укажите значение «{axis}» (до 100 символов)")));
                }
                variant.insert(axis.clone(), json!(v));
            }
            let gid: i32 = match existing {
                Some((gid, _)) => {
                    sqlx::query("UPDATE product_groups SET axes = $2 WHERE id = $1").bind(gid).bind(&axes).execute(&mut *tx).await?;
                    gid
                }
                None => sqlx::query_scalar("INSERT INTO product_groups (name, axes) VALUES ($1, $2) RETURNING id").bind(&name).bind(&axes).fetch_one(&mut *tx).await?,
            };
            let variant = Value::Object(variant);
            let twin: Option<String> = sqlx::query_scalar("SELECT code FROM products WHERE group_id = $1 AND id <> $2 AND variant = $3 LIMIT 1")
                .bind(gid)
                .bind(id)
                .bind(&variant)
                .fetch_optional(&mut *tx)
                .await?;
            if let Some(code) = twin {
                return Err(invalid(format!("В группе уже есть исполнение с такими значениями — товар {code}")));
            }
            sqlx::query("UPDATE products SET group_id = $2, variant = $3 WHERE id = $1").bind(id).bind(gid).bind(&variant).execute(&mut *tx).await?;
        }
    }
    sqlx::query("DELETE FROM product_groups g WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.group_id = g.id)").execute(&mut *tx).await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(admin_product(&state, id).await?))
}

// ---------- библиотека документов ----------

const DOC_KINDS: [&str; 6] = ["certificate", "declaration", "passport", "drawing", "catalog", "other"];

#[derive(Deserialize)]
struct DocumentsQuery {
    q: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
}

const DOC_COLS: &str = r#"d.id, d.title, d.kind, d.file_name, d.size_kb, d.url, d.file_id IS NOT NULL AS has_file, d.created_at,
    (SELECT count(*) FROM product_documents pd WHERE pd.document_id = d.id) AS products"#;

async fn document_json(conn: &mut sqlx::PgConnection, id: i32) -> AppResult<Value> {
    let sql = format!("SELECT to_jsonb(t) FROM (SELECT {DOC_COLS} FROM documents d WHERE d.id = $1) t");
    sqlx::query_scalar(AssertSqlSafe(sql)).bind(id).fetch_optional(conn).await?.ok_or_else(|| AppError::not_found("Документ не найден"))
}

async fn documents(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<DocumentsQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let pattern = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(super::admin::like_pattern);
    let sql = format!(
        "SELECT count(*) OVER() AS total, to_jsonb(t) AS row FROM (SELECT {DOC_COLS} FROM documents d WHERE ($1::text IS NULL OR d.title ILIKE $1 OR d.file_name ILIKE $1) ORDER BY d.id DESC) t LIMIT $2 OFFSET $3"
    );
    let rows: Vec<(i64, Value)> = sqlx::query_as(AssertSqlSafe(sql)).bind(pattern).bind(per).bind((page - 1) * per).fetch_all(&state.pool).await?;
    let total = rows.first().map(|r| r.0).unwrap_or(0);
    Ok(Json(paged(rows.into_iter().map(|r| r.1).collect(), total, page, per)))
}

fn doc_title(raw: Option<&str>) -> AppResult<Option<String>> {
    let t = raw.map(clean_label).filter(|t| !t.is_empty());
    if t.as_ref().is_some_and(|t| t.chars().count() > 300) {
        return Err(AppError::unprocessable("invalid_document", "Название документа — не длиннее 300 символов"));
    }
    Ok(t)
}

fn doc_kind(raw: Option<&str>, title: &str) -> AppResult<String> {
    match raw {
        Some(k) if DOC_KINDS.contains(&k) => Ok(k.to_string()),
        Some(_) => Err(AppError::unprocessable("invalid_document", "Вид документа: certificate, declaration, passport, drawing, catalog или other")),
        None => Ok(files::guess_doc_kind(title).to_string()),
    }
}

fn doc_url(raw: Option<&str>) -> AppResult<Option<String>> {
    match raw.map(str::trim).filter(|u| !u.is_empty()) {
        Some(u) if (u.starts_with("https://") || u.starts_with("http://")) && u.len() <= 1000 && !u.contains(char::is_whitespace) => Ok(Some(u.to_string())),
        Some(_) => Err(AppError::unprocessable("invalid_document", "Ссылка на документ — адрес https://…")),
        None => Ok(None),
    }
}

/// Новый документ: файл (поле `file`, до 20 МБ) или ссылка (`url`); `title`, `kind` (иначе — по названию),
/// `product_id` — сразу привязать к товару.
async fn create_document(State(state): State<AppState>, Manager(_m): Manager, multipart: Multipart) -> AppResult<(StatusCode, Json<Value>)> {
    let up = Upload::read(multipart).await?;
    let url = doc_url(up.field("url"))?;
    let product_id = match up.field("product_id") {
        Some(v) => Some(Uuid::parse_str(v).map_err(|_| AppError::unprocessable("invalid_document", "Неверный product_id"))?),
        None => None,
    };
    let (file_name, file) = match (&up.file, &url) {
        (Some((name, bytes)), _) => (name.clone(), Some((files::content_type_for(name)?, bytes))),
        (None, Some(u)) => (files::clean_name(u.split(['?', '#']).next().unwrap_or(u).rsplit('/').next().unwrap_or("document")), None),
        (None, None) => return Err(AppError::unprocessable("file_required", "Приложите файл или укажите ссылку на документ")),
    };
    let title = doc_title(up.field("title"))?.unwrap_or_else(|| file_name.rsplit_once('.').map(|(n, _)| n.to_string()).unwrap_or_else(|| file_name.clone()));
    let kind = doc_kind(up.field("kind"), &title)?;
    let mut tx = state.pool.begin().await?;
    if let Some(u) = &url {
        let dup: Option<i32> = sqlx::query_scalar("SELECT id FROM documents WHERE url = $1").bind(u).fetch_optional(&mut *tx).await?;
        if let Some(d) = dup {
            return Err(AppError::conflict("duplicate_document", format!("Документ с такой ссылкой уже есть — #{d}")).with_details(json!({ "id": d })));
        }
    }
    let (file_id, content_type, size_kb) = match file {
        Some((ct, bytes)) => (Some(files::store(&mut tx, &file_name, ct, bytes).await?), ct, bytes.len().div_ceil(1024) as i32),
        None => (None, "application/pdf", 0),
    };
    let id: i32 = sqlx::query_scalar("INSERT INTO documents (title, kind, file_name, size_kb, content_type, file_id, url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id")
        .bind(&title)
        .bind(&kind)
        .bind(&file_name)
        .bind(size_kb)
        .bind(content_type)
        .bind(file_id)
        .bind(&url)
        .fetch_one(&mut *tx)
        .await?;
    if let Some(pid) = product_id {
        product_exists(&mut tx, pid).await?;
        sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING").bind(pid).bind(id).execute(&mut *tx).await?;
    }
    let doc = document_json(&mut tx, id).await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok((StatusCode::CREATED, Json(doc)))
}

#[derive(Deserialize)]
struct DocumentPatch {
    title: Option<String>,
    kind: Option<String>,
    /// внешняя ссылка; у документа-файла не меняется
    url: Option<String>,
}

async fn update_document(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>, Json(b): Json<DocumentPatch>) -> AppResult<Json<Value>> {
    let mut tx = state.pool.begin().await?;
    let (title, has_file): (String, bool) = sqlx::query_as("SELECT title, file_id IS NOT NULL FROM documents WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Документ не найден"))?;
    let title = doc_title(b.title.as_deref())?.unwrap_or(title);
    let kind = match b.kind.as_deref() {
        Some(k) => Some(doc_kind(Some(k), &title)?),
        None => None,
    };
    let url = if has_file { None } else { doc_url(b.url.as_deref())? };
    if let Some(u) = &url {
        let dup: Option<i32> = sqlx::query_scalar("SELECT id FROM documents WHERE url = $1 AND id <> $2").bind(u).bind(id).fetch_optional(&mut *tx).await?;
        if let Some(d) = dup {
            return Err(AppError::conflict("duplicate_document", format!("Документ с такой ссылкой уже есть — #{d}")));
        }
    }
    sqlx::query("UPDATE documents SET title = $2, kind = COALESCE($3, kind), url = COALESCE($4, url) WHERE id = $1")
        .bind(id)
        .bind(&title)
        .bind(kind)
        .bind(url)
        .execute(&mut *tx)
        .await?;
    let doc = document_json(&mut tx, id).await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(doc))
}

/// Удаление документа: он пропадает у всех товаров, загруженный файл удаляется.
async fn delete_document(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let file_id: Option<Option<Uuid>> = sqlx::query_scalar("DELETE FROM documents WHERE id = $1 RETURNING file_id").bind(id).fetch_optional(&mut *tx).await?;
    let Some(file_id) = file_id else { return Err(AppError::not_found("Документ не найден")) };
    if let Some(f) = file_id {
        sqlx::query("DELETE FROM files WHERE id = $1").bind(f).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    state.invalidate_public();
    Ok(StatusCode::NO_CONTENT)
}

// ---------- бренды ----------

async fn brands(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (SELECT b.id, b.slug, b.name, b.country_brand, b.country_origin, b.description, b.logo_url, b.is_featured,
                  (SELECT count(*) FROM products p WHERE p.brand_id = b.id) AS products
           FROM brands b ORDER BY b.sort, b.name) t"#,
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
struct BrandPatch {
    name: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    country_brand: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    country_origin: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    description: Option<Option<String>>,
}

/// Бренд: название, страна бренда и страна производства (флаги в карточке товара), описание.
async fn update_brand(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>, Json(b): Json<BrandPatch>) -> AppResult<Json<Value>> {
    let name = b.name.as_deref().map(clean_label).filter(|n| !n.is_empty());
    if name.as_ref().is_some_and(|n| n.chars().count() > 120) {
        return Err(AppError::unprocessable("invalid_brand", "Название бренда — не длиннее 120 символов"));
    }
    let description = b.description.map(|d| d.map(|d| d.trim().chars().take(5000).collect::<String>()).filter(|d| !d.is_empty()));
    let mut tx = state.pool.begin().await?;
    let found: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM brands WHERE id = $1)").bind(id).fetch_one(&mut *tx).await?;
    if !found {
        return Err(AppError::not_found("Бренд не найден"));
    }
    sqlx::query(
        r#"UPDATE brands SET name = COALESCE($2, name),
             country_brand = CASE WHEN $3 THEN $4 ELSE country_brand END,
             country_origin = CASE WHEN $5 THEN $6 ELSE country_origin END,
             description = CASE WHEN $7 THEN $8 ELSE description END
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(name)
    .bind(b.country_brand.is_some())
    .bind(country(b.country_brand.flatten())?)
    .bind(b.country_origin.is_some())
    .bind(country(b.country_origin.flatten())?)
    .bind(description.is_some())
    .bind(description.flatten())
    .execute(&mut *tx)
    .await?;
    let row: Value = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (SELECT b.id, b.slug, b.name, b.country_brand, b.country_origin, b.description, b.logo_url, b.is_featured,
                  (SELECT count(*) FROM products p WHERE p.brand_id = b.id) AS products FROM brands b WHERE b.id = $1) t"#,
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(Json(row))
}

// ---------- загрузка файлов (картинки новостей и проектов) ----------

/// Файл в хранилище; ответ — `url` для поля картинки (`/api/v1/files/{id}/{имя}`).
async fn upload_file(State(state): State<AppState>, Manager(_m): Manager, multipart: Multipart) -> AppResult<(StatusCode, Json<Value>)> {
    let up = Upload::read(multipart).await?;
    let (name, bytes) = up.file.as_ref().ok_or_else(|| AppError::unprocessable("file_required", "Приложите файл в поле file"))?;
    let ct = files::content_type_for(name)?;
    if up.field("kind") == Some("image") && !files::is_image(ct) {
        return Err(AppError::unprocessable("unsupported_file", "Нужна картинка: JPG, PNG, WebP или GIF"));
    }
    let mut conn = state.pool.acquire().await?;
    let id = files::store(&mut conn, name, ct, bytes).await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "url": files::public_url(id, name), "name": name, "content_type": ct, "size_bytes": bytes.len() }))))
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
        .route("/admin/products/{id}/documents", put(product_documents))
        .route("/admin/products/{id}/accessories", put(product_accessories))
        .route("/admin/products/{id}/variant", put(product_variant))
        .route("/admin/documents", get(documents))
        .route("/admin/documents/{id}", put(update_document).delete(delete_document))
        .route("/admin/brands", get(brands))
        .route("/admin/brands/{id}", put(update_brand))
        .route("/admin/import/template.xlsx", get(import_template))
}

/// Загрузка документов и картинок — до 20 МБ (остальной API — до 2 МБ).
pub fn upload_routes() -> Router<AppState> {
    Router::new()
        .route("/admin/documents", post(create_document))
        .route("/admin/files", post(upload_file))
        .layer(DefaultBodyLimit::max(files::MAX_FILE_BYTES + 64 * 1024))
}

/// Загрузка файла — отдельно: свой лимит тела (20 МБ) и таймаут (большой каталог пишется дольше 30 с).
pub fn import_routes() -> Router<AppState> {
    Router::new().route("/admin/import/catalog", post(import_catalog)).layer(DefaultBodyLimit::max(IMPORT_BODY_LIMIT))
}

use std::collections::{BTreeMap, HashMap};

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{AssertSqlSafe, Postgres, QueryBuilder};
use uuid::Uuid;

use crate::{
    auth::{AuthUser, OptionalUser},
    error::{AppError, AppResult},
    models::{BrandRef, CategoryRow, Crumb, DocumentJson, ProductCard, ProductRow, Sibling, StoreStock, PRODUCT_SELECT},
    services::{
        catalog::{product_by_slug, products_by_ids, to_card},
        pricing::PriceCtx,
    },
    state::AppState,
};

// ---------- tree ----------

#[derive(Serialize, Clone)]
struct TreeNode {
    id: i32,
    slug: String,
    name: String,
    image: Option<String>,
    product_count: i32,
    children: Vec<TreeNode>,
}

fn build_tree(rows: &[CategoryRow], parent: Option<i32>) -> Vec<TreeNode> {
    rows.iter()
        .filter(|c| c.parent_id == parent)
        .map(|c| TreeNode {
            id: c.id,
            slug: c.slug.clone(),
            name: c.name.clone(),
            image: c.image_url.clone(),
            product_count: c.product_count,
            children: build_tree(rows, Some(c.id)),
        })
        .collect()
}

async fn all_categories(state: &AppState) -> AppResult<Vec<CategoryRow>> {
    Ok(sqlx::query_as::<_, CategoryRow>("SELECT * FROM categories ORDER BY sort, id").fetch_all(&state.pool).await?)
}

async fn tree(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json("tree".to_string(), &headers, |state| async move {
            let rows = all_categories(&state).await?;
            Ok(build_tree(&rows, None))
        })
        .await
}

// ---------- category page ----------

#[derive(Serialize, sqlx::FromRow)]
struct BrandFacet {
    slug: String,
    name: String,
    count: i64,
}

#[derive(sqlx::FromRow)]
struct AttrFacetRow {
    name: String,
    value: String,
    count: i64,
}

#[derive(Serialize)]
struct FacetValue {
    value: String,
    count: i64,
}

#[derive(Serialize)]
struct Facet {
    name: String,
    values: Vec<FacetValue>,
}

fn path_condition(qb: &mut QueryBuilder<Postgres>, path: &str) {
    qb.push(" AND (c.path = ").push_bind(path.to_string()).push(" OR c.path LIKE ").push_bind(format!("{path}/%")).push(")");
}

async fn category(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("category:{slug}"), &headers, |state| async move {
            let rows = all_categories(&state).await?;
            let cat = rows.iter().find(|c| c.slug == slug).cloned().ok_or_else(|| AppError::not_found("Категория не найдена"))?;
            let breadcrumbs = breadcrumbs_for(&rows, &cat.path);
            let children: Vec<Value> = rows
                .iter()
                .filter(|c| c.parent_id == Some(cat.id))
                .map(|c| json!({ "slug": c.slug, "name": c.name, "product_count": c.product_count, "image": c.image_url }))
                .collect();
            let brands = sqlx::query_as::<_, BrandFacet>(
                r#"SELECT b.slug, b.name, count(*) AS count FROM products p
                   JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
                   WHERE (c.path = $1 OR c.path LIKE $1 || '/%') GROUP BY b.slug, b.name ORDER BY count DESC, b.name"#,
            )
            .bind(&cat.path)
            .fetch_all(&state.pool)
            .await?;
            let attrs = sqlx::query_as::<_, AttrFacetRow>(
                r#"SELECT a->>'name' AS name, a->>'value' AS value, count(*) AS count
                   FROM products p JOIN categories c ON c.id = p.category_id, jsonb_array_elements(p.attributes) a
                   WHERE (c.path = $1 OR c.path LIKE $1 || '/%') AND (a->>'name') NOT IN ('Артикул','Бренд')
                   GROUP BY 1, 2 ORDER BY 1, 3 DESC, 2"#,
            )
            .bind(&cat.path)
            .fetch_all(&state.pool)
            .await?;
            let mut grouped: BTreeMap<String, Vec<FacetValue>> = BTreeMap::new();
            for a in attrs {
                grouped.entry(a.name).or_default().push(FacetValue { value: a.value, count: a.count });
            }
            let filters: Vec<Facet> = grouped
                .into_iter()
                .filter(|(_, v)| v.len() > 1 && v.len() <= 40)
                .map(|(name, values)| Facet { name, values })
                .collect();
            let (min, max): (Option<Decimal>, Option<Decimal>) = sqlx::query_as(
                r#"SELECT min(COALESCE(p.sale_price, p.list_price)), max(COALESCE(p.sale_price, p.list_price))
                   FROM products p JOIN categories c ON c.id = p.category_id WHERE (c.path = $1 OR c.path LIKE $1 || '/%')"#,
            )
            .bind(&cat.path)
            .fetch_one(&state.pool)
            .await?;
            Ok(json!({
                "category": { "slug": cat.slug, "name": cat.name, "description": cat.description, "image": cat.image_url, "product_count": cat.product_count },
                "breadcrumbs": breadcrumbs,
                "children": children,
                "brands": brands,
                "filters": filters,
                "price_range": { "min": min.unwrap_or_default(), "max": max.unwrap_or_default() },
            }))
        })
        .await
}

fn breadcrumbs_for(rows: &[CategoryRow], path: &str) -> Vec<Crumb> {
    let mut acc = String::new();
    let mut out = Vec::new();
    for seg in path.split('/') {
        if !acc.is_empty() {
            acc.push('/');
        }
        acc.push_str(seg);
        if let Some(c) = rows.iter().find(|c| c.path == acc) {
            out.push(Crumb { slug: c.slug.clone(), name: c.name.clone() });
        }
    }
    out
}

// ---------- listing ----------

#[derive(sqlx::FromRow)]
struct ListRow {
    total: i64,
    #[sqlx(flatten)]
    product: ProductRow,
}

#[derive(Serialize)]
struct Listing {
    items: Vec<ProductCard>,
    total: i64,
    page: i64,
    per_page: i64,
    pages: i64,
}

async fn run_listing(state: &AppState, q: &HashMap<String, String>, ctx: &PriceCtx) -> AppResult<Listing> {
    let page: i64 = q.get("page").and_then(|v| v.parse().ok()).unwrap_or(1).max(1);
    let per_page: i64 = q.get("per_page").and_then(|v| v.parse().ok()).unwrap_or(24).clamp(1, 100);
    let select = PRODUCT_SELECT.replacen("SELECT ", "SELECT count(*) OVER() AS total, ", 1);
    let mut qb = QueryBuilder::<Postgres>::new(select);
    qb.push(" WHERE TRUE");
    if let Some(cat) = q.get("category").filter(|s| !s.is_empty()) {
        let path: Option<String> = sqlx::query_scalar("SELECT path FROM categories WHERE slug = $1").bind(cat).fetch_optional(&state.pool).await?;
        match path {
            Some(p) => path_condition(&mut qb, &p),
            None => return Ok(Listing { items: vec![], total: 0, page, per_page, pages: 0 }),
        }
    }
    if let Some(brand) = q.get("brand").filter(|s| !s.is_empty()) {
        qb.push(" AND b.slug = ANY(").push_bind(brand.split(',').map(|s| s.trim().to_string()).collect::<Vec<_>>()).push(")");
    }
    if let Some(text) = q.get("q").map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let like = format!("%{text}%");
        qb.push(" AND (p.name ILIKE ").push_bind(like.clone());
        qb.push(" OR p.code ILIKE ").push_bind(like.clone());
        qb.push(" OR b.name ILIKE ").push_bind(like).push(")");
    }
    let flag = |v: Option<&String>| v.map(|s| s == "1" || s == "true").unwrap_or(false);
    if flag(q.get("in_stock")) {
        qb.push(" AND EXISTS (SELECT 1 FROM stock s WHERE s.product_id = p.id AND s.qty > 0)");
    }
    if flag(q.get("sale")) {
        qb.push(" AND p.sale_price IS NOT NULL");
    }
    if flag(q.get("hit")) {
        qb.push(" AND p.is_hit");
    }
    if flag(q.get("new")) {
        qb.push(" AND p.is_new");
    }
    if let Some(v) = q.get("price_min").and_then(|s| s.parse::<Decimal>().ok()) {
        qb.push(" AND COALESCE(p.sale_price, p.list_price) >= ").push_bind(v);
    }
    if let Some(v) = q.get("price_max").and_then(|s| s.parse::<Decimal>().ok()) {
        qb.push(" AND COALESCE(p.sale_price, p.list_price) <= ").push_bind(v);
    }
    for (k, v) in q.iter() {
        if let Some(name) = k.strip_prefix("attr.") {
            let values: Vec<Value> = v.split(',').map(|x| json!({ "name": name, "value": x.trim() })).collect();
            qb.push(" AND (FALSE");
            for val in values {
                qb.push(" OR p.attributes @> ").push_bind(json!([val]));
            }
            qb.push(")");
        }
    }
    let order = match q.get("sort").map(String::as_str) {
        Some("new") => " ORDER BY p.created_at DESC, p.id",
        Some("price_asc") => " ORDER BY COALESCE(p.sale_price, p.list_price) ASC, p.id",
        Some("price_desc") => " ORDER BY COALESCE(p.sale_price, p.list_price) DESC, p.id",
        Some("name") => " ORDER BY p.name, p.id",
        _ => " ORDER BY p.popularity DESC, p.id",
    };
    qb.push(order);
    qb.push(" LIMIT ").push_bind(per_page).push(" OFFSET ").push_bind((page - 1) * per_page);
    let rows: Vec<ListRow> = qb.build_query_as().fetch_all(&state.pool).await?;
    let total = rows.first().map(|r| r.total).unwrap_or(0);
    Ok(Listing {
        items: rows.iter().map(|r| to_card(&r.product, ctx)).collect(),
        total,
        page,
        per_page,
        pages: (total + per_page - 1) / per_page,
    })
}

async fn products(
    State(state): State<AppState>,
    OptionalUser(user): OptionalUser,
    Query(q): Query<HashMap<String, String>>,
    headers: HeaderMap,
) -> AppResult<Response> {
    match user {
        None => {
            let mut key_parts: Vec<String> = q.iter().map(|(k, v)| format!("{k}={v}")).collect();
            key_parts.sort();
            let key = format!("products:{}", key_parts.join("&"));
            state.cached_json(key, &headers, |state| async move { run_listing(&state, &q, &PriceCtx::anonymous()).await }).await
        }
        Some(u) => {
            let ctx = PriceCtx::for_user(&state.pool, &u).await?;
            Ok(Json(run_listing(&state, &q, &ctx).await?).into_response())
        }
    }
}

// ---------- product card ----------

#[derive(Serialize)]
struct ProductJson {
    #[serde(flatten)]
    card: ProductCard,
    description: String,
    short_description: String,
    category: Crumb,
    breadcrumbs: Vec<Crumb>,
    brand: Value,
    attributes: Value,
    pack: Option<Value>,
    stock: Vec<StoreStock>,
    group: Option<Value>,
    documents: Vec<DocumentJson>,
    accessories: Vec<Value>,
    configurator: Option<Value>,
    images: Vec<String>,
    questions_count: i32,
    features: Value,
    popularity: i32,
}

#[derive(sqlx::FromRow)]
struct StockRow {
    store_id: i32,
    city: String,
    name: String,
    qty: Decimal,
    delivery_hint: String,
}

#[derive(sqlx::FromRow)]
struct SiblingRow {
    slug: String,
    code: String,
    param_value: Option<String>,
    stock_total: Decimal,
}

#[derive(sqlx::FromRow)]
struct AccessoryRow {
    accessory_id: Uuid,
    group_name: String,
}

async fn build_product(state: &AppState, p: &ProductRow, ctx: &PriceCtx) -> AppResult<ProductJson> {
    let pool = &state.pool;
    let cats = all_categories(state).await?;
    let breadcrumbs = breadcrumbs_for(&cats, &p.category_path);
    let brand: Option<Value> = match p.brand_id {
        Some(id) => sqlx::query_scalar(
            "SELECT to_jsonb(t) FROM (SELECT slug, name, country_brand, country_origin, logo_url AS logo FROM brands WHERE id = $1) t",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?,
        None => None,
    };
    let stock = sqlx::query_as::<_, StockRow>(
        r#"SELECT st.id AS store_id, st.city, st.name, COALESCE(s.qty, 0) AS qty, st.delivery_hint
           FROM stores st LEFT JOIN stock s ON s.store_id = st.id AND s.product_id = $1 ORDER BY st.sort, st.id"#,
    )
    .bind(p.id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|s| StoreStock {
        store_id: s.store_id,
        city: s.city,
        name: s.name,
        delivery_hint: if s.qty > Decimal::ZERO { Some(s.delivery_hint) } else { None },
        qty: s.qty,
    })
    .collect();
    let group = match p.group_id {
        Some(gid) => {
            let param_name: String = sqlx::query_scalar("SELECT param_name FROM product_groups WHERE id = $1").bind(gid).fetch_one(pool).await?;
            let mut sib = sqlx::query_as::<_, SiblingRow>(
                r#"SELECT p.slug, p.code, p.param_value, (SELECT COALESCE(SUM(qty),0) FROM stock s WHERE s.product_id = p.id) AS stock_total
                   FROM products p WHERE p.group_id = $1"#,
            )
            .bind(gid)
            .fetch_all(pool)
            .await?;
            sib.sort_by(|a, b| {
                let na = a.param_value.as_deref().and_then(|v| v.parse::<f64>().ok());
                let nb = b.param_value.as_deref().and_then(|v| v.parse::<f64>().ok());
                match (na, nb) {
                    (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(std::cmp::Ordering::Equal),
                    _ => a.param_value.cmp(&b.param_value),
                }
            });
            let siblings: Vec<Sibling> = sib
                .into_iter()
                .map(|s| Sibling { slug: s.slug, code: s.code, param_value: s.param_value.unwrap_or_default(), in_stock: s.stock_total > Decimal::ZERO })
                .collect();
            Some(json!({ "param_name": param_name, "current": p.param_value, "siblings": siblings }))
        }
        None => None,
    };
    let documents: Vec<DocumentJson> = sqlx::query_as::<_, crate::models::DocumentRow>(
        "SELECT d.id, d.title, d.kind, d.file_name, d.size_kb, d.content_type FROM product_documents pd JOIN documents d ON d.id = pd.document_id WHERE pd.product_id = $1 ORDER BY d.kind, d.id",
    )
    .bind(p.id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|d| DocumentJson { id: d.id, title: d.title, kind: d.kind, url: format!("/api/v1/documents/{}/download", d.id), size_kb: d.size_kb })
    .collect();
    let acc_rows = sqlx::query_as::<_, AccessoryRow>("SELECT accessory_id, group_name FROM accessories WHERE product_id = $1 ORDER BY sort, group_name")
        .bind(p.id)
        .fetch_all(pool)
        .await?;
    let ids: Vec<Uuid> = acc_rows.iter().map(|a| a.accessory_id).collect();
    let acc_products = products_by_ids(pool, &ids).await?;
    let accessories: Vec<Value> = acc_rows
        .iter()
        .filter_map(|a| acc_products.iter().find(|p| p.id == a.accessory_id).map(|p| json!({ "group": a.group_name, "product": to_card(p, ctx) })))
        .collect();
    let configurator: Option<Value> = match p.configurator_id {
        Some(id) => sqlx::query_scalar("SELECT to_jsonb(t) FROM (SELECT slug, name, url, description FROM configurators WHERE id = $1) t")
            .bind(id)
            .fetch_optional(pool)
            .await?,
        None => None,
    };
    let pack = match (p.pack_qty, &p.pack_label) {
        (Some(q), Some(l)) => Some(json!({ "qty": q, "label": l })),
        (Some(q), None) => Some(json!({ "qty": q, "label": format!("{q} {}", p.unit) })),
        _ => None,
    };
    Ok(ProductJson {
        card: to_card(p, ctx),
        description: p.description.clone(),
        short_description: p.short_description.clone(),
        category: Crumb { slug: p.category_slug.clone(), name: p.category_name.clone() },
        breadcrumbs,
        brand: brand.unwrap_or_else(|| json!({ "slug": "", "name": "", "country_brand": null, "country_origin": null, "logo": null })),
        attributes: p.attributes.clone(),
        pack,
        stock,
        group,
        documents,
        accessories,
        configurator,
        images: p.images.clone(),
        questions_count: p.questions_count,
        features: p.features.clone(),
        popularity: p.popularity,
    })
}

async fn product(State(state): State<AppState>, OptionalUser(user): OptionalUser, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    match user {
        None => {
            state
                .cached_json(format!("product:{slug}"), &headers, |state| async move {
                    let p = product_by_slug(&state.pool, &slug).await?.ok_or_else(|| AppError::not_found("Товар не найден"))?;
                    build_product(&state, &p, &PriceCtx::anonymous()).await
                })
                .await
        }
        Some(u) => {
            let p = product_by_slug(&state.pool, &slug).await?.ok_or_else(|| AppError::not_found("Товар не найден"))?;
            let ctx = PriceCtx::for_user(&state.pool, &u).await?;
            Ok(Json(build_product(&state, &p, &ctx).await?).into_response())
        }
    }
}

// ---------- reviews ----------

#[derive(sqlx::FromRow)]
struct ReviewRow {
    id: Uuid,
    author_name: String,
    created_at: chrono::DateTime<chrono::Utc>,
    rating: i32,
    pros: String,
    cons: String,
    body: String,
    reply_text: Option<String>,
    reply_author: Option<String>,
    replied_at: Option<chrono::DateTime<chrono::Utc>>,
    total: i64,
}

fn review_json(r: &ReviewRow) -> Value {
    json!({
        "id": r.id, "author": r.author_name, "date": r.created_at, "rating": r.rating,
        "pros": r.pros, "cons": r.cons, "text": r.body,
        "reply": r.reply_text.as_ref().map(|t| json!({ "author": r.reply_author.clone().unwrap_or_else(|| "Точикэлектрокомплект".into()), "date": r.replied_at, "text": t, "role": "Специалист ТЭК" })),
    })
}

#[derive(sqlx::FromRow)]
struct Dist {
    rating: i32,
    count: i64,
}

async fn reviews(State(state): State<AppState>, Path(slug): Path<String>, Query(p): Query<super::content::Paging>, headers: HeaderMap) -> AppResult<Response> {
    let (page, per) = p.clamp(10);
    state
        .cached_json(format!("reviews:{slug}:{page}:{per}"), &headers, |state| async move {
            let pid: Uuid = sqlx::query_scalar("SELECT id FROM products WHERE slug = $1")
                .bind(&slug)
                .fetch_optional(&state.pool)
                .await?
                .ok_or_else(|| AppError::not_found("Товар не найден"))?;
            let rows = sqlx::query_as::<_, ReviewRow>(
                r#"SELECT id, author_name, created_at, rating, pros, cons, body, reply_text, reply_author, replied_at, count(*) OVER() AS total
                   FROM reviews WHERE product_id = $1 AND status = 'published' ORDER BY created_at DESC LIMIT $2 OFFSET $3"#,
            )
            .bind(pid)
            .bind(per)
            .bind((page - 1) * per)
            .fetch_all(&state.pool)
            .await?;
            let dist = sqlx::query_as::<_, Dist>("SELECT rating, count(*) AS count FROM reviews WHERE product_id = $1 AND status = 'published' GROUP BY rating")
                .bind(pid)
                .fetch_all(&state.pool)
                .await?;
            let count: i64 = dist.iter().map(|d| d.count).sum();
            let avg = if count == 0 { 0.0 } else { dist.iter().map(|d| d.rating as f64 * d.count as f64).sum::<f64>() / count as f64 };
            let mut distribution = serde_json::Map::new();
            for r in 1..=5 {
                distribution.insert(r.to_string(), json!(dist.iter().find(|d| d.rating == r).map(|d| d.count).unwrap_or(0)));
            }
            Ok(json!({
                "summary": { "avg": (avg * 10.0).round() / 10.0, "count": count, "distribution": distribution },
                "items": rows.iter().map(review_json).collect::<Vec<_>>(),
                "page": page, "pages": (rows.first().map(|r| r.total).unwrap_or(0) + per - 1) / per,
            }))
        })
        .await
}

#[derive(Deserialize)]
struct NewReview {
    rating: i32,
    pros: Option<String>,
    cons: Option<String>,
    text: String,
}

async fn post_review(State(state): State<AppState>, AuthUser(user): AuthUser, Path(slug): Path<String>, Json(body): Json<NewReview>) -> AppResult<Response> {
    if !(1..=5).contains(&body.rating) {
        return Err(AppError::unprocessable("invalid_rating", "Оценка должна быть от 1 до 5"));
    }
    if body.text.trim().is_empty() {
        return Err(AppError::unprocessable("empty_text", "Напишите текст отзыва"));
    }
    let pid: Uuid = sqlx::query_scalar("SELECT id FROM products WHERE slug = $1")
        .bind(&slug)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Товар не найден"))?;
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query_as::<_, ReviewRow>(
        r#"INSERT INTO reviews (product_id, user_id, author_name, rating, pros, cons, body) VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, author_name, created_at, rating, pros, cons, body, reply_text, reply_author, replied_at, 1::bigint AS total"#,
    )
    .bind(pid)
    .bind(user.id)
    .bind(user.full_name())
    .bind(body.rating)
    .bind(body.pros.unwrap_or_default().trim())
    .bind(body.cons.unwrap_or_default().trim())
    .bind(body.text.trim())
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        r#"UPDATE products SET reviews_count = (SELECT count(*) FROM reviews WHERE product_id = $1 AND status = 'published'),
           rating = (SELECT COALESCE(round(avg(rating)::numeric, 2), 0) FROM reviews WHERE product_id = $1 AND status = 'published') WHERE id = $1"#,
    )
    .bind(pid)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok((StatusCode::CREATED, Json(review_json(&row))).into_response())
}

// ---------- questions ----------

#[derive(sqlx::FromRow)]
struct QuestionRow {
    id: Uuid,
    author_name: String,
    created_at: chrono::DateTime<chrono::Utc>,
    body: String,
    answer_text: Option<String>,
    answer_author: Option<String>,
    answered_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn question_json(q: &QuestionRow) -> Value {
    json!({
        "id": q.id, "author": q.author_name, "date": q.created_at, "text": q.body,
        "answer": q.answer_text.as_ref().map(|t| json!({ "author": q.answer_author.clone().unwrap_or_else(|| "Точикэлектрокомплект".into()), "date": q.answered_at, "text": t, "role": "Специалист ТЭК" })),
    })
}

async fn questions(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("questions:{slug}"), &headers, |state| async move {
            let pid: Uuid = sqlx::query_scalar("SELECT id FROM products WHERE slug = $1")
                .bind(&slug)
                .fetch_optional(&state.pool)
                .await?
                .ok_or_else(|| AppError::not_found("Товар не найден"))?;
            let rows = sqlx::query_as::<_, QuestionRow>(
                "SELECT id, author_name, created_at, body, answer_text, answer_author, answered_at FROM questions WHERE product_id = $1 ORDER BY created_at DESC LIMIT 100",
            )
            .bind(pid)
            .fetch_all(&state.pool)
            .await?;
            Ok(json!({ "items": rows.iter().map(question_json).collect::<Vec<_>>(), "total": rows.len() }))
        })
        .await
}

#[derive(Deserialize)]
struct NewQuestion {
    text: String,
}

async fn post_question(State(state): State<AppState>, AuthUser(user): AuthUser, Path(slug): Path<String>, Json(body): Json<NewQuestion>) -> AppResult<Response> {
    if body.text.trim().is_empty() {
        return Err(AppError::unprocessable("empty_text", "Напишите вопрос"));
    }
    let pid: Uuid = sqlx::query_scalar("SELECT id FROM products WHERE slug = $1")
        .bind(&slug)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Товар не найден"))?;
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query_as::<_, QuestionRow>(
        "INSERT INTO questions (product_id, user_id, author_name, body) VALUES ($1,$2,$3,$4) RETURNING id, author_name, created_at, body, answer_text, answer_author, answered_at",
    )
    .bind(pid)
    .bind(user.id)
    .bind(user.full_name())
    .bind(body.text.trim())
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE products SET questions_count = (SELECT count(*) FROM questions WHERE product_id = $1) WHERE id = $1")
        .bind(pid)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok((StatusCode::CREATED, Json(question_json(&row))).into_response())
}

// ---------- suggest ----------

#[derive(Deserialize)]
struct SuggestQuery {
    q: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct SuggestProduct {
    slug: String,
    name: String,
    code: String,
    price: Decimal,
    image: Option<String>,
}

async fn suggest(State(state): State<AppState>, Query(q): Query<SuggestQuery>) -> AppResult<Json<Value>> {
    let text = q.q.unwrap_or_default().trim().to_string();
    if text.len() < 2 {
        return Ok(Json(json!({ "products": [], "categories": [], "brands": [] })));
    }
    let like = format!("%{text}%");
    let products = sqlx::query_as::<_, SuggestProduct>(
        r#"SELECT slug, name, code, COALESCE(sale_price, list_price) AS price, images[1] AS image FROM products
           WHERE name ILIKE $1 OR code ILIKE $1 ORDER BY (code ILIKE $2) DESC, popularity DESC LIMIT 6"#,
    )
    .bind(&like)
    .bind(format!("{text}%"))
    .fetch_all(&state.pool)
    .await?;
    let categories = sqlx::query_as::<_, Crumb>("SELECT slug, name FROM categories WHERE name ILIKE $1 ORDER BY product_count DESC LIMIT 5")
        .bind(&like)
        .fetch_all(&state.pool)
        .await?;
    let brands = sqlx::query_as::<_, BrandRefRow>("SELECT slug, name FROM brands WHERE name ILIKE $1 ORDER BY sort LIMIT 5")
        .bind(&like)
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .map(|b| BrandRef { slug: b.slug, name: b.name })
        .collect::<Vec<_>>();
    Ok(Json(json!({ "products": products, "categories": categories, "brands": brands })))
}

#[derive(sqlx::FromRow)]
struct BrandRefRow {
    slug: String,
    name: String,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/catalog/tree", get(tree))
        .route("/catalog/categories/{slug}", get(category))
        .route("/catalog/products", get(products))
        .route("/catalog/products/{slug}", get(product))
        .route("/catalog/products/{slug}/reviews", get(reviews).post(post_review))
        .route("/catalog/products/{slug}/questions", get(questions).post(post_question))
        .route("/catalog/suggest", get(suggest))
}

#[allow(dead_code)]
fn _assert_sql_safe(_: AssertSqlSafe<String>) {}

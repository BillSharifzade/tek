use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{AuthUser, CartIdentity},
    error::{AppError, AppResult},
    models::{CartJson, CartRow},
    services::{
        cart::{self, add_item},
        catalog::{products_by_ids, to_card},
        delivery, excel,
        pricing::{round2, PriceCtx},
    },
    state::AppState,
};

async fn ctx_for(state: &AppState, id: &CartIdentity) -> AppResult<PriceCtx> {
    PriceCtx::for_optional(&state.pool, id.user.as_deref()).await
}

async fn respond(state: &AppState, id: &CartIdentity, cart: &CartRow) -> AppResult<Json<CartJson>> {
    let ctx = ctx_for(state, id).await?;
    Ok(Json(cart::view(state, cart, &ctx).await?))
}

/// Просмотр корзины её не создаёт: гостевая корзина появляется при первом добавлении товара.
async fn get_cart(State(state): State<AppState>, id: CartIdentity) -> AppResult<Json<CartJson>> {
    match cart::resolve_cart(&state, &id, id.user.is_some()).await? {
        Some(cart) => respond(&state, &id, &cart).await,
        None => Ok(Json(CartJson {
            id: Uuid::nil(),
            cart_token: None,
            items: vec![],
            items_count: 0,
            selected_count: 0,
            subtotal_list: Decimal::ZERO,
            discount_total: Decimal::ZERO,
            coupon: None,
            subtotal: Decimal::ZERO,
            cashback_total: Decimal::ZERO,
            total: Decimal::ZERO,
            has_errors: false,
        })),
    }
}

#[derive(Deserialize)]
struct AddItem {
    product_id: Uuid,
    qty: Option<Decimal>,
}

async fn post_item(State(state): State<AppState>, id: CartIdentity, Json(body): Json<AddItem>) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    add_item(&state, cart.id, body.product_id, body.qty.unwrap_or(Decimal::ONE)).await?;
    respond(&state, &id, &cart).await
}

#[derive(Deserialize)]
struct PatchItem {
    qty: Option<Decimal>,
    selected: Option<bool>,
}

async fn patch_item(State(state): State<AppState>, id: CartIdentity, Path(item_id): Path<Uuid>, Json(body): Json<PatchItem>) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    let row: Option<(Uuid, Decimal, String, String, Option<Decimal>)> = sqlx::query_as(
        "SELECT ci.product_id, (SELECT COALESCE(SUM(qty),0) FROM stock s WHERE s.product_id = ci.product_id), p.unit, p.name, p.pack_qty FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.id = $1 AND ci.cart_id = $2",
    )
    .bind(item_id)
    .bind(cart.id)
    .fetch_optional(&state.pool)
    .await?;
    let Some((_, stock, unit, name, pack)) = row else { return Err(AppError::not_found("Позиция не найдена")) };
    if let Some(q) = body.qty {
        crate::services::orders::validate_qty(q, &unit, &name, pack)?;
        if q > stock {
            return Err(AppError::unprocessable("insufficient_stock", "Количество превышает остаток на складе")
                .with_details(json!({ "available": stock, "requested": q })));
        }
        sqlx::query("UPDATE cart_items SET qty = $2 WHERE id = $1").bind(item_id).bind(q).execute(&state.pool).await?;
    }
    if let Some(s) = body.selected {
        sqlx::query("UPDATE cart_items SET selected = $2 WHERE id = $1").bind(item_id).bind(s).execute(&state.pool).await?;
    }
    cart::touch(&state, cart.id).await?;
    respond(&state, &id, &cart).await
}

async fn delete_item(State(state): State<AppState>, id: CartIdentity, Path(item_id): Path<Uuid>) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    sqlx::query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2").bind(item_id).bind(cart.id).execute(&state.pool).await?;
    respond(&state, &id, &cart).await
}

async fn delete_selected(State(state): State<AppState>, id: CartIdentity) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    sqlx::query("DELETE FROM cart_items WHERE cart_id = $1 AND selected").bind(cart.id).execute(&state.pool).await?;
    respond(&state, &id, &cart).await
}

#[derive(Deserialize)]
struct SelectAll {
    selected: bool,
}

async fn select_all(State(state): State<AppState>, id: CartIdentity, Json(body): Json<SelectAll>) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    sqlx::query("UPDATE cart_items SET selected = $2 WHERE cart_id = $1").bind(cart.id).bind(body.selected).execute(&state.pool).await?;
    respond(&state, &id, &cart).await
}

async fn clear(State(state): State<AppState>, id: CartIdentity) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    sqlx::query("DELETE FROM cart_items WHERE cart_id = $1").bind(cart.id).execute(&state.pool).await?;
    sqlx::query("UPDATE carts SET coupon_code = NULL WHERE id = $1").bind(cart.id).execute(&state.pool).await?;
    respond(&state, &id, &cart).await
}

#[derive(Deserialize)]
struct CouponInput {
    code: String,
}

async fn apply_coupon(State(state): State<AppState>, id: CartIdentity, Json(body): Json<CouponInput>) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    let code = body.code.trim().to_uppercase();
    let Some(coupon) = cart::load_coupon(&state.pool, &code).await? else {
        return Err(AppError::unprocessable("coupon_invalid", "Купон не найден"));
    };
    let ctx = ctx_for(&state, &id).await?;
    let current = cart::view(&state, &cart, &ctx).await?;
    if let Err(msg) = cart::coupon_discount(&coupon, current.subtotal) {
        return Err(AppError::unprocessable("coupon_invalid", msg));
    }
    sqlx::query("UPDATE carts SET coupon_code = $2, updated_at = now() WHERE id = $1").bind(cart.id).bind(&coupon.code).execute(&state.pool).await?;
    let cart = cart::cart_by_id(&state.pool, cart.id).await?;
    Ok(Json(cart::view(&state, &cart, &ctx).await?))
}

async fn remove_coupon(State(state): State<AppState>, id: CartIdentity) -> AppResult<Json<CartJson>> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    sqlx::query("UPDATE carts SET coupon_code = NULL, updated_at = now() WHERE id = $1").bind(cart.id).execute(&state.pool).await?;
    let cart = cart::cart_by_id(&state.pool, cart.id).await?;
    respond(&state, &id, &cart).await
}

/// Merge the guest cart (X-Cart-Token) into the authenticated user's cart.
async fn merge(State(state): State<AppState>, AuthUser(user): AuthUser, id: CartIdentity) -> AppResult<Json<CartJson>> {
    let user_identity = CartIdentity { user: Some(user.clone()), token: None };
    let target = cart::resolve_cart(&state, &user_identity, true).await?.expect("created");
    if let Some(token) = id.token {
        let guest = sqlx::query_as::<_, CartRow>("SELECT id, user_id, token, coupon_code FROM carts WHERE token = $1 AND user_id IS NULL")
            .bind(token)
            .fetch_optional(&state.pool)
            .await?;
        if let Some(g) = guest {
            if g.id != target.id {
                let mut tx = state.pool.begin().await?;
                sqlx::query(
                    r#"INSERT INTO cart_items (cart_id, product_id, qty, selected)
                       SELECT $1, product_id, qty, selected FROM cart_items WHERE cart_id = $2
                       ON CONFLICT (cart_id, product_id) DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty"#,
                )
                .bind(target.id)
                .bind(g.id)
                .execute(&mut *tx)
                .await?;
                if target.coupon_code.is_none() && g.coupon_code.is_some() {
                    sqlx::query("UPDATE carts SET coupon_code = $2 WHERE id = $1").bind(target.id).bind(&g.coupon_code).execute(&mut *tx).await?;
                }
                sqlx::query("DELETE FROM carts WHERE id = $1").bind(g.id).execute(&mut *tx).await?;
                tx.commit().await?;
            }
        }
    }
    let cart = cart::cart_by_id(&state.pool, target.id).await?;
    respond(&state, &user_identity, &cart).await
}

async fn export_xlsx(State(state): State<AppState>, id: CartIdentity) -> AppResult<Response> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    let ctx = ctx_for(&state, &id).await?;
    let view = cart::view(&state, &cart, &ctx).await?;
    let (company, customer) = match &id.user {
        Some(u) => {
            let company: Option<String> = match u.company_id {
                Some(cid) => sqlx::query_scalar("SELECT name FROM companies WHERE id = $1").bind(cid).fetch_optional(&state.pool).await?,
                None => None,
            };
            (company, u.full_name())
        }
        None => (None, "Гость".to_string()),
    };
    let date = delivery::today_local().format("%d.%m.%Y").to_string();
    let bytes = excel::cart_estimate(company.as_deref(), &customer, &date, &view)?;
    Ok(xlsx_response(bytes, &format!("smeta-{}.xlsx", delivery::today_local())))
}

pub fn xlsx_response(bytes: Vec<u8>, filename: &str) -> Response {
    let mut resp = (StatusCode::OK, bytes).into_response();
    let h = resp.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    if let Ok(v) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        h.insert(header::CONTENT_DISPOSITION, v);
    }
    resp
}

fn snapshot_items(view: &CartJson) -> Value {
    json!(view.items.iter().map(|i| json!({ "product_id": i.product.id, "qty": i.qty })).collect::<Vec<_>>())
}

async fn share(State(state): State<AppState>, id: CartIdentity) -> AppResult<(StatusCode, Json<Value>)> {
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    let ctx = ctx_for(&state, &id).await?;
    let view = cart::view(&state, &cart, &ctx).await?;
    if view.items.is_empty() {
        return Err(AppError::unprocessable("empty_cart", "Корзина пуста"));
    }
    let token: Uuid = sqlx::query_scalar("INSERT INTO cart_shares (created_by, items) VALUES ($1, $2) RETURNING token")
        .bind(id.user.as_ref().map(|u| u.id))
        .bind(snapshot_items(&view))
        .fetch_one(&state.pool)
        .await?;
    let url = format!("{}/cart/shared/{token}", state.cfg.frontend_url.trim_end_matches('/'));
    Ok((StatusCode::CREATED, Json(json!({ "token": token, "url": url }))))
}

#[derive(Deserialize)]
struct SnapItem {
    product_id: Uuid,
    qty: Decimal,
}

async fn load_share(state: &AppState, token: Uuid) -> AppResult<Vec<SnapItem>> {
    let items: Option<Value> = sqlx::query_scalar("SELECT items FROM cart_shares WHERE token = $1").bind(token).fetch_optional(&state.pool).await?;
    let Some(items) = items else { return Err(AppError::not_found("Ссылка на корзину не найдена")) };
    serde_json::from_value(items).map_err(|e| AppError::internal(e.to_string()))
}

/// Shared cart priced for the current viewer.
async fn shared(State(state): State<AppState>, id: CartIdentity, Path(token): Path<Uuid>) -> AppResult<Json<Value>> {
    let snap = load_share(&state, token).await?;
    let ctx = ctx_for(&state, &id).await?;
    let ids: Vec<Uuid> = snap.iter().map(|s| s.product_id).collect();
    let products = products_by_ids(&state.pool, &ids).await?;
    let mut items = Vec::new();
    let mut subtotal = Decimal::ZERO;
    let mut subtotal_list = Decimal::ZERO;
    let mut cashback_total = Decimal::ZERO;
    for s in &snap {
        if let Some(p) = products.iter().find(|p| p.id == s.product_id) {
            let card = to_card(p, &ctx);
            let line_total = round2(card.price.price * s.qty);
            subtotal += line_total;
            subtotal_list += round2(card.price.list * s.qty);
            cashback_total += round2(card.price.cashback * s.qty);
            items.push(json!({ "product": card, "qty": s.qty, "price": card.price, "line_total": line_total, "stock_total": p.stock_total, "error": if s.qty > p.stock_total { json!({ "code": "insufficient_stock", "available": p.stock_total }) } else { Value::Null } }));
        }
    }
    Ok(Json(json!({
        "token": token, "items": items, "items_count": items.len(),
        "subtotal_list": subtotal_list, "discount_total": round2(subtotal_list - subtotal),
        "subtotal": subtotal, "total": subtotal, "cashback_total": cashback_total,
    })))
}

async fn apply_shared(State(state): State<AppState>, id: CartIdentity, Path(token): Path<Uuid>) -> AppResult<Json<CartJson>> {
    let snap = load_share(&state, token).await?;
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    for s in snap {
        // Clamp to stock instead of failing the whole import.
        let stock: Option<Decimal> = sqlx::query_scalar("SELECT COALESCE(SUM(qty),0) FROM stock WHERE product_id = $1").bind(s.product_id).fetch_optional(&state.pool).await?;
        let Some(stock) = stock else { continue };
        if stock <= Decimal::ZERO {
            continue;
        }
        sqlx::query(
            r#"INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1, $2, LEAST($3, $4))
               ON CONFLICT (cart_id, product_id) DO UPDATE SET qty = LEAST(cart_items.qty + EXCLUDED.qty, $4), selected = true"#,
        )
        .bind(cart.id)
        .bind(s.product_id)
        .bind(s.qty)
        .bind(stock)
        .execute(&state.pool)
        .await?;
    }
    cart::touch(&state, cart.id).await?;
    respond(&state, &id, &cart).await
}

#[derive(Deserialize)]
struct EstimateInput {
    name: Option<String>,
}

async fn save_estimate(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<EstimateInput>) -> AppResult<(StatusCode, Json<Value>)> {
    let id = CartIdentity { user: Some(user.clone()), token: None };
    let cart = cart::resolve_cart(&state, &id, true).await?.expect("created");
    let ctx = ctx_for(&state, &id).await?;
    let view = cart::view(&state, &cart, &ctx).await?;
    if view.items.is_empty() {
        return Err(AppError::unprocessable("empty_cart", "Корзина пуста"));
    }
    let name = body.name.unwrap_or_default().trim().to_string();
    let name = if name.is_empty() { format!("Смета от {}", delivery::today_local().format("%d.%m.%Y")) } else { name };
    let row: (Uuid, chrono::DateTime<chrono::Utc>) = sqlx::query_as("INSERT INTO saved_estimates (user_id, name, items, total) VALUES ($1,$2,$3,$4) RETURNING id, created_at")
        .bind(user.id)
        .bind(&name)
        .bind(snapshot_items(&view))
        .bind(view.total)
        .fetch_one(&state.pool)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": row.0, "name": name, "total": view.total, "items_count": view.items.len(), "created_at": row.1 }))))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/cart", get(get_cart))
        .route("/cart/items", post(post_item))
        .route("/cart/items/delete-selected", post(delete_selected))
        .route("/cart/items/{id}", axum::routing::patch(patch_item).delete(delete_item))
        .route("/cart/select-all", post(select_all))
        .route("/cart/clear", post(clear))
        .route("/cart/coupon", post(apply_coupon).delete(remove_coupon))
        .route("/cart/merge", post(merge))
        .route("/cart/export.xlsx", get(export_xlsx))
        .route("/cart/share", post(share))
        .route("/cart/shared/{token}", get(shared))
        .route("/cart/shared/{token}/apply", post(apply_shared))
        .route("/cart/estimates", post(save_estimate))
}

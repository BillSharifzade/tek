use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    auth::{CartIdentity, OptionalUser},
    error::{AppError, AppResult},
    models::{payment_method_label, StoreRow},
    services::{
        cart, delivery, excel,
        orders::{self, CheckoutInput},
        pricing::PriceCtx,
    },
    state::AppState,
};

async fn options(State(state): State<AppState>, OptionalUser(user): OptionalUser) -> AppResult<Json<Value>> {
    let has_company = user.as_ref().map(|u| u.company_id.is_some()).unwrap_or(false);
    let stores = sqlx::query_as::<_, StoreRow>("SELECT * FROM stores ORDER BY sort, id").fetch_all(&state.pool).await?;
    let payment_methods: Vec<Value> = ["alif", "dc", "cash", "invoice"]
        .iter()
        .map(|m| {
            let (label, sub) = payment_method_label(m);
            json!({ "code": m, "label": label, "sublabel": sub, "available": *m != "invoice" || has_company })
        })
        .collect();
    Ok(Json(json!({
        "delivery_methods": [
            { "code": "courier", "label": "Доставка", "price": delivery::COURIER_PRICE, "description": "Бережно доставляем товары по Таджикистану за 48 часов. По Душанбе и Худжанду — за 1 рабочий день." },
            { "code": "pickup", "label": "Самовывоз", "price": 0, "description": "Бесплатно из магазинов ТЭК в Душанбе и Худжанде." },
        ],
        "delivery_dates": delivery::delivery_dates(),
        "payment_methods": payment_methods,
        "stores": stores.iter().map(|s| json!({ "id": s.id, "city": s.city, "name": s.name, "address": s.address, "phone": s.phone, "hours": s.hours })).collect::<Vec<_>>(),
        "note": "Подъем/спуск на этажи и разгрузка товара не входят в услугу доставки",
    })))
}

async fn checkout(State(state): State<AppState>, id: CartIdentity, Json(input): Json<CheckoutInput>) -> AppResult<(StatusCode, Json<Value>)> {
    let Some(cart_row) = cart::resolve_cart(&state, &id, false).await? else {
        return Err(AppError::unprocessable("empty_cart", "Корзина пуста"));
    };
    let ctx = PriceCtx::for_optional(&state.pool, id.user.as_deref()).await?;
    let computed = cart::compute(&state, &cart_row, &ctx).await?;
    let order = orders::create_order(&state, id.user.as_deref(), &cart_row, computed, input).await?;
    let payment = match order.payment_method.as_str() {
        "alif" | "dc" => json!({
            "kind": "redirect",
            "url": format!("{}/payment/{}?order={}", state.cfg.frontend_url.trim_end_matches('/'), order.payment_method, order.number),
        }),
        "invoice" => json!({ "kind": "invoice", "url": format!("/api/v1/orders/{}/invoice.xlsx", order.number) }),
        _ => json!({ "kind": "none" }),
    };
    let order_json = orders::order_json(&state, &order).await?;
    Ok((StatusCode::CREATED, Json(json!({ "order": order_json, "payment": payment }))))
}

#[derive(Deserialize)]
struct Callback {
    order_number: String,
    status: String,
    txn_id: Option<String>,
}

async fn payment_callback(State(state): State<AppState>, Path(provider): Path<String>, Json(body): Json<Callback>) -> AppResult<Json<Value>> {
    if !matches!(provider.as_str(), "alif" | "dc") {
        return Err(AppError::not_found("Провайдер не найден"));
    }
    let Some(order) = orders::load_by_number(&state.pool, &body.order_number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    if order.payment_method != provider {
        return Err(AppError::unprocessable("provider_mismatch", "Способ оплаты заказа не совпадает с провайдером"));
    }
    let order = orders::mark_paid(&state, &order, body.txn_id, body.status == "paid").await?;
    Ok(Json(json!({ "ok": true, "order": orders::order_json(&state, &order).await? })))
}

#[derive(Deserialize)]
struct GuestLookup {
    email: Option<String>,
}

async fn get_order(State(state): State<AppState>, OptionalUser(user): OptionalUser, Path(number): Path<String>, Query(q): Query<GuestLookup>) -> AppResult<Json<Value>> {
    let Some(order) = orders::load_by_number(&state.pool, &number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    let allowed = match (&user, &order.user_id) {
        (Some(u), Some(uid)) => u.id == *uid || u.is_manager(),
        (Some(u), None) => u.is_manager() || q.email.as_deref().map(|e| e.eq_ignore_ascii_case(&order.email)).unwrap_or(false),
        (None, _) => order.user_id.is_none() && q.email.as_deref().map(|e| e.eq_ignore_ascii_case(&order.email)).unwrap_or(false),
    };
    if !allowed {
        return Err(AppError::forbidden("forbidden", "Нет доступа к заказу"));
    }
    Ok(Json(json!(orders::order_json(&state, &order).await?)))
}

async fn invoice(State(state): State<AppState>, OptionalUser(user): OptionalUser, Path(number): Path<String>, Query(q): Query<GuestLookup>) -> AppResult<Response> {
    let Some(order) = orders::load_by_number(&state.pool, &number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    let allowed = match (&user, &order.user_id) {
        (Some(u), Some(uid)) => u.id == *uid || u.is_manager(),
        (Some(u), None) => u.is_manager(),
        (None, _) => q.email.as_deref().map(|e| e.eq_ignore_ascii_case(&order.email)).unwrap_or(false),
    };
    if !allowed {
        return Err(AppError::forbidden("forbidden", "Нет доступа к заказу"));
    }
    let oj = orders::order_json(&state, &order).await?;
    let company: Option<String> = match order.company_id {
        Some(cid) => sqlx::query_scalar("SELECT name FROM companies WHERE id = $1").bind(cid).fetch_optional(&state.pool).await?,
        None => None,
    };
    let view = crate::models::CartJson {
        id: order.id,
        cart_token: None,
        items_count: oj.items.len(),
        selected_count: oj.items.len(),
        items: oj
            .items
            .iter()
            .map(|i| crate::models::CartItemJson {
                id: i.id,
                product: i.product.clone(),
                qty: i.qty,
                selected: true,
                price: i.price.clone(),
                line_total: i.line_total,
                line_cashback: i.line_cashback,
                stock_total: i.product.stock_total,
                error: None,
            })
            .collect(),
        subtotal_list: order.subtotal_list,
        discount_total: order.discount_total,
        coupon: order.coupon_code.clone().map(|code| crate::models::CouponJson { code, discount: order.coupon_discount }),
        subtotal: order.subtotal,
        cashback_total: order.cashback_total,
        total: order.total,
        has_errors: false,
    };
    let bytes = excel::cart_estimate(company.as_deref(), &format!("{} {}", order.first_name, order.last_name), &order.created_at.format("%d.%m.%Y").to_string(), &view)?;
    Ok(super::cart::xlsx_response(bytes, &format!("invoice-{}.xlsx", order.number)))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/checkout/options", get(options))
        .route("/checkout", post(checkout))
        .route("/payments/{provider}/callback", post(payment_callback))
        .route("/orders/{number}", get(get_order))
        .route("/orders/{number}/invoice.xlsx", get(invoice))
}

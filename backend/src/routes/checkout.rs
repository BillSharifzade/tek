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
    let company = match user.as_ref().and_then(|u| u.company_id) {
        Some(cid) => orders::company_verified(&state.pool, cid).await?,
        None => None,
    };
    let stores = sqlx::query_as::<_, StoreRow>("SELECT * FROM stores ORDER BY sort, id").fetch_all(&state.pool).await?;
    let payment_methods: Vec<Value> = ["alif", "dc", "cash", "invoice"]
        .iter()
        .map(|m| {
            let (label, sub) = payment_method_label(m);
            let (available, sub) = match *m {
                // онлайн-оплата включается после подключения эквайринга банков (PAYMENTS_MOCK вне production)
                "alif" | "dc" if !state.cfg.payments_mock => (false, "скоро"),
                "invoice" if company.is_none() => (false, sub),
                "invoice" if company == Some(false) => (false, "после проверки компании менеджером"),
                _ => (true, sub),
            };
            json!({ "code": m, "label": label, "sublabel": sub, "available": available })
        })
        .collect();
    Ok(Json(json!({
        "delivery_methods": [
            { "code": "courier", "label": "Доставка", "price": delivery::COURIER_PRICE, "free_from": delivery::FREE_DELIVERY_FROM, "description": "Бережно доставляем товары по Таджикистану за 48 часов. По Душанбе и Худжанду — за 1 рабочий день." },
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

/// Заглушка callback'а эквайринга — только вне production (PAYMENTS_MOCK). Настоящая интеграция Алиф / ДС должна
/// проверять подпись провайдера и сумму; без неё любой мог бы отметить заказ оплаченным.
async fn payment_callback(State(state): State<AppState>, Path(provider): Path<String>, Json(body): Json<Callback>) -> AppResult<Json<Value>> {
    if !state.cfg.payments_mock || !matches!(provider.as_str(), "alif" | "dc") {
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

/// Гостевой заказ открывается по номеру + e-mail покупателя; пустой e-mail не подходит никогда.
fn guest_email_matches(q: &GuestLookup, order_email: &str) -> bool {
    let order_email = order_email.trim();
    !order_email.is_empty() && q.email.as_deref().map(str::trim).is_some_and(|e| e.eq_ignore_ascii_case(order_email))
}

async fn get_order(State(state): State<AppState>, OptionalUser(user): OptionalUser, Path(number): Path<String>, Query(q): Query<GuestLookup>) -> AppResult<Json<Value>> {
    let Some(order) = orders::load_by_number(&state.pool, &number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    let allowed = match (&user, &order.user_id) {
        (Some(u), Some(uid)) => u.id == *uid || u.is_manager(),
        (Some(u), None) => u.is_manager() || guest_email_matches(&q, &order.email),
        (None, _) => order.user_id.is_none() && guest_email_matches(&q, &order.email),
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
        (Some(u), None) => u.is_manager() || guest_email_matches(&q, &order.email),
        (None, _) => order.user_id.is_none() && guest_email_matches(&q, &order.email),
    };
    if !allowed {
        return Err(AppError::forbidden("forbidden", "Нет доступа к заказу"));
    }
    let oj = orders::order_json(&state, &order).await?;
    let company: Option<(String, Option<String>, Option<String>)> = match order.company_id {
        Some(cid) => sqlx::query_as("SELECT name, inn, address FROM companies WHERE id = $1").bind(cid).fetch_optional(&state.pool).await?,
        None => None,
    };
    let buyer = excel::InvoiceBuyer {
        company: company.as_ref().map(|c| c.0.clone()),
        inn: company.as_ref().and_then(|c| c.1.clone()).filter(|v| !v.trim().is_empty()),
        address: company.as_ref().and_then(|c| c.2.clone()).or_else(|| order.delivery_address.clone()).filter(|v| !v.trim().is_empty()),
        contact: format!("{} {}", order.first_name, order.last_name).trim().to_string(),
        phone: order.phone.clone(),
    };
    let lines: Vec<excel::InvoiceLine> = oj
        .items
        .iter()
        .map(|i| excel::InvoiceLine { code: i.product.code.clone(), name: i.product.name.clone(), unit: i.product.unit.clone(), qty: i.qty, price: i.price.price, total: i.line_total })
        .collect();
    let totals = excel::InvoiceTotals { goods: order.subtotal, coupon: order.coupon_discount, delivery: order.delivery_price, total: order.total };
    let seq = order.number.trim_start_matches("TEK-");
    let due = order.due_date.map(|d| d.format("%d.%m.%Y").to_string());
    let bytes = excel::invoice(&format!("СЧ-{seq}"), &order.created_at.format("%d.%m.%Y").to_string(), due.as_deref(), &buyer, &lines, &totals)?;
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

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Response,
    routing::{get, post, put},
    Json, Router,
};
use chrono::{Duration, NaiveDate};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{self, AuthUser},
    error::{AppError, AppResult},
    models::{order_status_label, CompanyJson, ProductCard, UserJson},
    services::{
        catalog::{products_by_ids, to_card},
        delivery, excel, ledger, orders,
        pricing::{round2, PriceCtx},
    },
    state::AppState,
};

use super::auth::user_json;

#[derive(Deserialize)]
pub struct PeriodQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl PeriodQuery {
    fn range(&self, default_days: i64) -> (NaiveDate, NaiveDate) {
        let today = delivery::today_local();
        let to = self.to.unwrap_or(today);
        let from = self.from.unwrap_or(to - Duration::days(default_days));
        (from, to)
    }
}

async fn company_name(state: &AppState, id: Option<Uuid>) -> AppResult<Option<String>> {
    match id {
        Some(cid) => Ok(sqlx::query_scalar("SELECT name FROM companies WHERE id = $1").bind(cid).fetch_optional(&state.pool).await?),
        None => Ok(None),
    }
}

async fn dashboard(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Value>> {
    let pool = &state.pool;
    let uj = user_json(&state, &user).await?;
    let orders_count: i64 = sqlx::query_scalar("SELECT count(*) FROM orders WHERE user_id = $1").bind(user.id).fetch_one(pool).await?;
    let active_orders: i64 = sqlx::query_scalar("SELECT count(*) FROM orders WHERE user_id = $1 AND status NOT IN ('delivered','cancelled')").bind(user.id).fetch_one(pool).await?;
    let documents_count: i64 = sqlx::query_scalar("SELECT count(*) FROM ledger_entries WHERE user_id = $1 AND doc_type = 'invoice'").bind(user.id).fetch_one(pool).await?;
    let favorites_count: i64 = sqlx::query_scalar("SELECT count(*) FROM favorites WHERE user_id = $1").bind(user.id).fetch_one(pool).await?;
    let cart_count: i64 = sqlx::query_scalar("SELECT count(*) FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.user_id = $1").bind(user.id).fetch_one(pool).await?;
    let unread: i64 = sqlx::query_scalar("SELECT count(*) FROM notifications WHERE user_id = $1 AND NOT is_read").bind(user.id).fetch_one(pool).await?;
    let receivable = ledger::receivable(pool, user.id).await?;
    let overdue = ledger::overdue_amount(pool, user.id).await?;
    Ok(Json(json!({
        "company_name": uj.company.as_ref().map(|c| c.name.clone()),
        "user_name": user.full_name(),
        "balance": { "receivable": receivable, "overdue": overdue },
        "orders_count": orders_count,
        "active_orders": active_orders,
        "documents_count": documents_count,
        "favorites_count": favorites_count,
        "cart_count": cart_count,
        "bonus_balance": uj.bonus_balance,
        "manager": uj.manager,
        "notifications_unread": unread,
        "discount_pct": user.discount_pct,
        "cashback_pct": user.cashback_pct,
    })))
}

async fn get_profile(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<UserJson>> {
    Ok(Json(user_json(&state, &user).await?))
}

#[derive(Deserialize)]
struct ProfileInput {
    first_name: Option<String>,
    last_name: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    /// нужен только при смене e-mail (это логин)
    current_password: Option<String>,
}

async fn put_profile(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<ProfileInput>) -> AppResult<Json<UserJson>> {
    let email = body.email.map(|e| e.trim().to_lowercase()).filter(|e| !e.is_empty());
    if let Some(e) = &email {
        if !e.contains('@') {
            return Err(AppError::unprocessable("invalid_email", "Укажите корректный e-mail"));
        }
        let taken: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE email = $1 AND id <> $2").bind(e).bind(user.id).fetch_optional(&state.pool).await?;
        if taken.is_some() {
            return Err(AppError::conflict("email_taken", "E-mail уже используется"));
        }
        if *e != user.email {
            let ok = match body.current_password.clone() {
                Some(p) => auth::verify_password_async(p, Some(user.password_hash.clone())).await,
                None => false,
            };
            if !ok {
                return Err(AppError::unprocessable("password_required", "Для смены e-mail введите текущий пароль"));
            }
        }
    }
    let phone = body.phone.as_ref().map(|s| s.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect::<String>()).filter(|s| !s.is_empty());
    if let Some(p) = &phone {
        if p.chars().filter(char::is_ascii_digit).count() < 9 {
            return Err(AppError::unprocessable("invalid_phone", "Укажите телефон в формате +992 XX XXX XX XX"));
        }
        let taken: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE phone = $1 AND id <> $2").bind(p).bind(user.id).fetch_optional(&state.pool).await?;
        if taken.is_some() {
            return Err(AppError::conflict("phone_taken", "Телефон уже используется другим аккаунтом"));
        }
    }
    sqlx::query(
        r#"UPDATE users SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name),
           phone = COALESCE($4, phone), email = COALESCE($5, email) WHERE id = $1"#,
    )
    .bind(user.id)
    .bind(body.first_name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()))
    .bind(body.last_name.map(|s| s.trim().to_string()))
    .bind(phone)
    .bind(email)
    .execute(&state.pool)
    .await?;
    state.invalidate_user(user.id).await;
    let fresh = auth::load_user(&state, user.id).await?.ok_or_else(|| AppError::not_found("Пользователь не найден"))?;
    Ok(Json(user_json(&state, &fresh).await?))
}

#[derive(Deserialize)]
struct PasswordInput {
    current_password: String,
    new_password: String,
}

async fn put_password(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<PasswordInput>) -> AppResult<StatusCode> {
    if !auth::verify_password_async(body.current_password.clone(), Some(user.password_hash.clone())).await {
        return Err(AppError::unprocessable("wrong_password", "Текущий пароль указан неверно"));
    }
    auth::validate_password(&body.new_password, &user.email, &user.first_name)?;
    let hash = auth::hash_password_async(body.new_password.clone()).await?;
    sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1").bind(user.id).bind(hash).execute(&state.pool).await?;
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1").bind(user.id).execute(&state.pool).await?;
    state.invalidate_user(user.id).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct NotifyInput {
    notify_marketing: Option<bool>,
    notify_replies: Option<bool>,
}

async fn put_notifications(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<NotifyInput>) -> AppResult<Json<UserJson>> {
    sqlx::query("UPDATE users SET notify_marketing = COALESCE($2, notify_marketing), notify_replies = COALESCE($3, notify_replies) WHERE id = $1")
        .bind(user.id)
        .bind(body.notify_marketing)
        .bind(body.notify_replies)
        .execute(&state.pool)
        .await?;
    state.invalidate_user(user.id).await;
    let fresh = auth::load_user(&state, user.id).await?.ok_or_else(|| AppError::not_found("Пользователь не найден"))?;
    Ok(Json(user_json(&state, &fresh).await?))
}

async fn get_company(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Option<CompanyJson>>> {
    Ok(Json(user_json(&state, &user).await?.company))
}

#[derive(Deserialize)]
struct CompanyInput {
    name: String,
    inn: Option<String>,
    address: Option<String>,
    phone: Option<String>,
    email: Option<String>,
}

async fn put_company(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<CompanyInput>) -> AppResult<Json<CompanyJson>> {
    if body.name.trim().is_empty() {
        return Err(AppError::unprocessable("invalid_name", "Укажите наименование компании"));
    }
    let row = match user.company_id {
        Some(cid) => {
            // смена реквизитов (наименование / ИНН) снова требует проверки менеджером для оплаты по счёту
            sqlx::query_as::<_, CompanyJson>(
                r#"UPDATE companies SET name = $2, inn = $3, address = $4, phone = $5, email = $6,
                   verified = verified AND name = $2 AND inn IS NOT DISTINCT FROM $3
                   WHERE id = $1 RETURNING id, name, inn, address, phone, email"#,
            )
            .bind(cid)
            .bind(body.name.trim())
            .bind(body.inn.as_deref().map(str::trim))
            .bind(body.address.as_deref().map(str::trim))
            .bind(body.phone.as_deref().map(str::trim))
            .bind(body.email.as_deref().map(str::trim))
            .fetch_one(&state.pool)
            .await?
        }
        None => {
            let c = sqlx::query_as::<_, CompanyJson>(
                "INSERT INTO companies (name, inn, address, phone, email) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, inn, address, phone, email",
            )
            .bind(body.name.trim())
            .bind(body.inn.as_deref().map(str::trim))
            .bind(body.address.as_deref().map(str::trim))
            .bind(body.phone.as_deref().map(str::trim))
            .bind(body.email.as_deref().map(str::trim))
            .fetch_one(&state.pool)
            .await?;
            sqlx::query("UPDATE users SET company_id = $2 WHERE id = $1").bind(user.id).bind(c.id).execute(&state.pool).await?;
            state.invalidate_user(user.id).await;
            c
        }
    };
    Ok(Json(row))
}

#[derive(sqlx::FromRow)]
struct OrderSummary {
    id: Uuid,
    number: String,
    created_at: chrono::DateTime<chrono::Utc>,
    status: String,
    total: Decimal,
    paid_amount: Decimal,
    due_date: Option<NaiveDate>,
    payment_method: String,
    payment_status: String,
    delivery_method: String,
    items_count: i64,
    total_rows: i64,
}

async fn list_orders(State(state): State<AppState>, AuthUser(user): AuthUser, Query(q): Query<PeriodQuery>) -> AppResult<Json<Value>> {
    let (from, to) = q.range(30);
    let page = q.page.unwrap_or(1).max(1);
    let per = q.per_page.unwrap_or(20).clamp(1, 100);
    let rows = sqlx::query_as::<_, OrderSummary>(
        r#"SELECT o.id, o.number, o.created_at, o.status, o.total, o.paid_amount, o.due_date, o.payment_method, o.payment_status, o.delivery_method,
                  (SELECT count(*) FROM order_items i WHERE i.order_id = o.id) AS items_count, count(*) OVER() AS total_rows
           FROM orders o WHERE o.user_id = $1 AND (o.created_at + interval '5 hours')::date >= $2 AND (o.created_at + interval '5 hours')::date <= $3
           ORDER BY o.created_at DESC LIMIT $4 OFFSET $5"#,
    )
    .bind(user.id)
    .bind(from)
    .bind(to)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&state.pool)
    .await?;
    let total = rows.first().map(|r| r.total_rows).unwrap_or(0);
    let items: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.id, "number": r.number, "date": r.created_at, "status": r.status, "status_label": order_status_label(&r.status),
                "total": r.total, "paid_amount": r.paid_amount, "remaining": round2((r.total - r.paid_amount).max(Decimal::ZERO)),
                "due_date": r.due_date, "payment_method": r.payment_method, "payment_status": r.payment_status,
                "delivery_method": r.delivery_method, "items_count": r.items_count,
            })
        })
        .collect();
    Ok(Json(json!({ "items": items, "total": total, "page": page, "pages": (total + per - 1) / per, "period": { "from": from, "to": to } })))
}

async fn own_order(state: &AppState, user_id: Uuid, number: &str) -> AppResult<crate::models::OrderRow> {
    let Some(o) = orders::load_by_number(&state.pool, number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    if o.user_id != Some(user_id) {
        return Err(AppError::not_found("Заказ не найден"));
    }
    Ok(o)
}

async fn get_order(State(state): State<AppState>, AuthUser(user): AuthUser, Path(number): Path<String>) -> AppResult<Json<Value>> {
    let o = own_order(&state, user.id, &number).await?;
    Ok(Json(json!(orders::order_json(&state, &o).await?)))
}

async fn cancel_order(State(state): State<AppState>, AuthUser(user): AuthUser, Path(number): Path<String>) -> AppResult<Json<Value>> {
    let o = own_order(&state, user.id, &number).await?;
    let o = orders::cancel_order(&state, &o).await?;
    Ok(Json(json!(orders::order_json(&state, &o).await?)))
}

#[derive(Deserialize)]
struct EditInput {
    items: Vec<orders::EditItem>,
    comment: Option<String>,
}

async fn edit_order(State(state): State<AppState>, AuthUser(user): AuthUser, Path(number): Path<String>, Json(body): Json<EditInput>) -> AppResult<Json<Value>> {
    let o = own_order(&state, user.id, &number).await?;
    let o = orders::edit_order(&state, &o, &user, body.items, body.comment).await?;
    Ok(Json(json!(orders::order_json(&state, &o).await?)))
}

async fn reconciliation(State(state): State<AppState>, AuthUser(user): AuthUser, Query(q): Query<PeriodQuery>) -> AppResult<Json<Value>> {
    let (from, to) = q.range(365);
    let company = company_name(&state, user.company_id).await?;
    Ok(Json(json!(ledger::reconciliation(&state.pool, user.id, company, from, to).await?)))
}

async fn reconciliation_xlsx(State(state): State<AppState>, AuthUser(user): AuthUser, Query(q): Query<PeriodQuery>) -> AppResult<Response> {
    let (from, to) = q.range(365);
    let company = company_name(&state, user.company_id).await?;
    let rec = ledger::reconciliation(&state.pool, user.id, company, from, to).await?;
    let bytes = excel::reconciliation_xlsx(&user.full_name(), &rec)?;
    Ok(super::cart::xlsx_response(bytes, &format!("akt-sverki-{from}-{to}.xlsx")))
}

async fn bonus(State(state): State<AppState>, AuthUser(user): AuthUser, Query(q): Query<PeriodQuery>) -> AppResult<Json<Value>> {
    let (from, to) = q.range(365);
    Ok(Json(json!(ledger::bonus_statement(&state.pool, user.id, from, to).await?)))
}

async fn bonus_xlsx(State(state): State<AppState>, AuthUser(user): AuthUser, Query(q): Query<PeriodQuery>) -> AppResult<Response> {
    let (from, to) = q.range(365);
    let st = ledger::bonus_statement(&state.pool, user.id, from, to).await?;
    let bytes = excel::bonus_xlsx(&user.full_name(), &st)?;
    Ok(super::cart::xlsx_response(bytes, &format!("bonus-{from}-{to}.xlsx")))
}

async fn my_reviews(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT r.id, jsonb_build_object('slug', p.slug, 'name', p.name, 'code', p.code) AS product, r.rating, r.pros, r.cons, r.body AS text, r.created_at AS date,
                    CASE WHEN r.reply_text IS NULL THEN NULL ELSE jsonb_build_object('author', COALESCE(r.reply_author, 'Точикэлектрокомплект'), 'date', r.replied_at, 'text', r.reply_text) END AS reply
             FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.user_id = $1 ORDER BY r.created_at DESC) t"#,
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn my_questions(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT q.id, jsonb_build_object('slug', p.slug, 'name', p.name, 'code', p.code) AS product, q.body AS text, q.created_at AS date,
                    CASE WHEN q.answer_text IS NULL THEN NULL ELSE jsonb_build_object('author', COALESCE(q.answer_author, 'Точикэлектрокомплект'), 'date', q.answered_at, 'text', q.answer_text) END AS answer
             FROM questions q JOIN products p ON p.id = q.product_id WHERE q.user_id = $1 ORDER BY q.created_at DESC) t"#,
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn notifications(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        "SELECT to_jsonb(t) FROM (SELECT id, kind, title, body, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100) t",
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
struct ReadInput {
    ids: Option<Vec<Uuid>>,
}

async fn read_notifications(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<ReadInput>) -> AppResult<Json<Value>> {
    let n = match body.ids {
        Some(ids) if !ids.is_empty() => sqlx::query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2)").bind(user.id).bind(&ids).execute(&state.pool).await?.rows_affected(),
        _ => sqlx::query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read").bind(user.id).execute(&state.pool).await?.rows_affected(),
    };
    Ok(Json(json!({ "updated": n })))
}

async fn documents(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT l.id, l.doc_type AS kind, CASE l.doc_type WHEN 'invoice' THEN 'Счёт' WHEN 'payment' THEN 'Платёж' ELSE 'Корректировка' END AS kind_label,
                    l.doc_number AS number, l.entry_date AS date, l.debit, l.credit, l.note, o.number AS order_number,
                    CASE WHEN o.number IS NOT NULL THEN '/api/v1/orders/' || o.number || '/invoice.xlsx' ELSE NULL END AS url
             FROM ledger_entries l LEFT JOIN orders o ON o.id = l.order_id WHERE l.user_id = $1 ORDER BY l.entry_date DESC, l.id DESC LIMIT 200) t"#,
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn favorites(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Vec<ProductCard>>> {
    let ids: Vec<Uuid> = sqlx::query_scalar("SELECT product_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC").bind(user.id).fetch_all(&state.pool).await?;
    let products = products_by_ids(&state.pool, &ids).await?;
    let ctx = PriceCtx::for_user(&state.pool, &user).await?;
    Ok(Json(products.iter().map(|p| to_card(p, &ctx)).collect()))
}

#[derive(Deserialize)]
struct FavInput {
    product_id: Uuid,
}

async fn add_favorite(State(state): State<AppState>, AuthUser(user): AuthUser, Json(body): Json<FavInput>) -> AppResult<Json<Vec<ProductCard>>> {
    sqlx::query("INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING").bind(user.id).bind(body.product_id).execute(&state.pool).await?;
    favorites(State(state), AuthUser(user)).await
}

async fn remove_favorite(State(state): State<AppState>, AuthUser(user): AuthUser, Path(product_id): Path<Uuid>) -> AppResult<Json<Vec<ProductCard>>> {
    sqlx::query("DELETE FROM favorites WHERE user_id = $1 AND product_id = $2").bind(user.id).bind(product_id).execute(&state.pool).await?;
    favorites(State(state), AuthUser(user)).await
}

async fn estimates(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        "SELECT to_jsonb(t) FROM (SELECT id, name, total, jsonb_array_length(items) AS items_count, created_at FROM saved_estimates WHERE user_id = $1 ORDER BY created_at DESC) t",
    )
    .bind(user.id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn restore_estimate(State(state): State<AppState>, AuthUser(user): AuthUser, Path(id): Path<Uuid>) -> AppResult<Json<crate::models::CartJson>> {
    let items: Option<Value> = sqlx::query_scalar("SELECT items FROM saved_estimates WHERE id = $1 AND user_id = $2").bind(id).bind(user.id).fetch_optional(&state.pool).await?;
    let Some(items) = items else { return Err(AppError::not_found("Смета не найдена")) };
    let identity = crate::auth::CartIdentity { user: Some(user.clone()), token: None };
    let cart = crate::services::cart::resolve_cart(&state, &identity, true).await?.expect("created");
    if let Some(arr) = items.as_array() {
        for it in arr {
            let (Some(pid), Some(qty)) = (it.get("product_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()), it.get("qty").and_then(|v| v.as_f64())) else { continue };
            let qty = Decimal::try_from(qty).unwrap_or(Decimal::ONE);
            let stock: Option<Decimal> = sqlx::query_scalar("SELECT COALESCE(SUM(qty),0) FROM stock WHERE product_id = $1").bind(pid).fetch_optional(&state.pool).await?;
            let Some(stock) = stock else { continue };
            if stock <= Decimal::ZERO {
                continue;
            }
            sqlx::query(
                r#"INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1, $2, LEAST($3, $4))
                   ON CONFLICT (cart_id, product_id) DO UPDATE SET qty = LEAST(EXCLUDED.qty, $4), selected = true"#,
            )
            .bind(cart.id)
            .bind(pid)
            .bind(qty)
            .bind(stock)
            .execute(&state.pool)
            .await?;
        }
    }
    let ctx = PriceCtx::for_user(&state.pool, &user).await?;
    Ok(Json(crate::services::cart::view(&state, &cart, &ctx).await?))
}

async fn delete_estimate(State(state): State<AppState>, AuthUser(user): AuthUser, Path(id): Path<Uuid>) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM saved_estimates WHERE id = $1 AND user_id = $2").bind(id).bind(user.id).execute(&state.pool).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/account/dashboard", get(dashboard))
        .route("/account/profile", get(get_profile).put(put_profile))
        .route("/account/password", put(put_password))
        .route("/account/notifications", get(notifications).put(put_notifications))
        .route("/account/notifications/read", post(read_notifications))
        .route("/account/company", get(get_company).put(put_company))
        .route("/account/orders", get(list_orders))
        .route("/account/orders/{number}", get(get_order).put(edit_order))
        .route("/account/orders/{number}/cancel", post(cancel_order))
        .route("/account/reconciliation", get(reconciliation))
        .route("/account/reconciliation.xlsx", get(reconciliation_xlsx))
        .route("/account/bonus", get(bonus))
        .route("/account/bonus.xlsx", get(bonus_xlsx))
        .route("/account/reviews", get(my_reviews))
        .route("/account/questions", get(my_questions))
        .route("/account/documents", get(documents))
        .route("/account/favorites", get(favorites).post(add_favorite))
        .route("/account/favorites/{product_id}", axum::routing::delete(remove_favorite))
        .route("/account/estimates", get(estimates))
        .route("/account/estimates/{id}/restore", post(restore_estimate))
        .route("/account/estimates/{id}", axum::routing::delete(delete_estimate))
}

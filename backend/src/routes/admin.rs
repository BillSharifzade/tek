use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::Manager,
    error::{AppError, AppResult},
    services::orders,
    state::AppState,
};

#[derive(Deserialize)]
struct StatusFilter {
    status: Option<String>,
}

async fn users(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<StatusFilter>) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.status, u.customer_type, u.discount_pct, u.cashback_pct,
                    u.manager_id, c.name AS company_name, c.inn AS company_inn, u.created_at
             FROM users u LEFT JOIN companies c ON c.id = u.company_id
             WHERE ($1::text IS NULL OR u.status = $1) ORDER BY u.created_at DESC LIMIT 500) t"#,
    )
    .bind(q.status.filter(|s| !s.is_empty()))
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

/// Одобрение аккаунта; заодно подтверждает компанию пользователя (открывает оплату по счёту).
async fn approve(State(state): State<AppState>, Manager(m): Manager, Path(id): Path<Uuid>) -> AppResult<Json<Value>> {
    let n = sqlx::query("UPDATE users SET status = 'approved', manager_id = COALESCE(manager_id, $2) WHERE id = $1 AND status = 'pending'")
        .bind(id)
        .bind(if m.role == "manager" { Some(m.id) } else { None })
        .execute(&state.pool)
        .await?
        .rows_affected();
    let verified = sqlx::query("UPDATE companies SET verified = true WHERE id = (SELECT company_id FROM users WHERE id = $1) AND NOT verified")
        .bind(id)
        .execute(&state.pool)
        .await?
        .rows_affected();
    if n == 0 && verified == 0 {
        return Err(AppError::not_found("Пользователь не найден или уже одобрен"));
    }
    sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, 'account', 'Аккаунт одобрен', 'Ваш аккаунт активирован. Теперь вам доступны персональные цены и кешбэк.', '/account')")
        .bind(id)
        .execute(&state.pool)
        .await?;
    state.invalidate_user(id).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct RuleInput {
    category_slug: Option<String>,
    brand_slug: Option<String>,
    product_id: Option<Uuid>,
    discount_pct: Decimal,
    cashback_pct: Decimal,
}

#[derive(Deserialize)]
struct PricingInput {
    discount_pct: Option<Decimal>,
    cashback_pct: Option<Decimal>,
    manager_id: Option<Uuid>,
    rules: Option<Vec<RuleInput>>,
}

fn pct_ok(v: Decimal, max: Decimal) -> bool {
    v >= Decimal::ZERO && v <= max
}

/// Персональные цены: менеджер — только своим клиентам, себе — никто; скидка 0–90 %, кешбэк 0–50 %.
async fn pricing(State(state): State<AppState>, Manager(m): Manager, Path(id): Path<Uuid>, Json(body): Json<PricingInput>) -> AppResult<Json<Value>> {
    let (max_discount, max_cashback) = (Decimal::from(90), Decimal::from(50));
    if id == m.id {
        return Err(AppError::forbidden("self_pricing", "Нельзя менять собственные условия"));
    }
    let bad = body.discount_pct.is_some_and(|v| !pct_ok(v, max_discount))
        || body.cashback_pct.is_some_and(|v| !pct_ok(v, max_cashback))
        || body.rules.as_ref().is_some_and(|rs| rs.iter().any(|r| !pct_ok(r.discount_pct, max_discount) || !pct_ok(r.cashback_pct, max_cashback)));
    if bad {
        return Err(AppError::unprocessable("invalid_pct", "Скидка — от 0 до 90 %, кешбэк — от 0 до 50 %"));
    }
    if m.role != "admin" {
        let owner: Option<Option<Uuid>> = sqlx::query_scalar("SELECT manager_id FROM users WHERE id = $1").bind(id).fetch_optional(&state.pool).await?;
        match owner {
            None => return Err(AppError::not_found("Пользователь не найден")),
            Some(Some(mid)) if mid == m.id => {}
            _ => return Err(AppError::forbidden("not_your_client", "Условия клиента может менять его менеджер или администратор")),
        }
    }
    let mut tx = state.pool.begin().await?;
    let n = sqlx::query("UPDATE users SET discount_pct = COALESCE($2, discount_pct), cashback_pct = COALESCE($3, cashback_pct), manager_id = COALESCE($4, manager_id) WHERE id = $1")
        .bind(id)
        .bind(body.discount_pct)
        .bind(body.cashback_pct)
        .bind(body.manager_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::not_found("Пользователь не найден"));
    }
    if let Some(rules) = body.rules {
        sqlx::query("DELETE FROM user_price_rules WHERE user_id = $1").bind(id).execute(&mut *tx).await?;
        for r in rules {
            let category_id: Option<i32> = match &r.category_slug {
                Some(s) => sqlx::query_scalar("SELECT id FROM categories WHERE slug = $1").bind(s).fetch_optional(&mut *tx).await?,
                None => None,
            };
            let brand_id: Option<i32> = match &r.brand_slug {
                Some(s) => sqlx::query_scalar("SELECT id FROM brands WHERE slug = $1").bind(s).fetch_optional(&mut *tx).await?,
                None => None,
            };
            let unknown = (r.category_slug.is_some() && category_id.is_none()) || (r.brand_slug.is_some() && brand_id.is_none());
            if unknown || (category_id.is_none() && brand_id.is_none() && r.product_id.is_none()) {
                return Err(AppError::unprocessable("invalid_rule", "Правило должно ссылаться на существующую категорию, бренд или товар"));
            }
            sqlx::query("INSERT INTO user_price_rules (user_id, category_id, brand_id, product_id, discount_pct, cashback_pct) VALUES ($1,$2,$3,$4,$5,$6)")
                .bind(id)
                .bind(category_id)
                .bind(brand_id)
                .bind(r.product_id)
                .bind(r.discount_pct)
                .bind(r.cashback_pct)
                .execute(&mut *tx)
                .await?;
        }
    }
    tx.commit().await?;
    state.invalidate_user(id).await;
    Ok(Json(json!({ "ok": true })))
}

async fn admin_orders(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<StatusFilter>) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT o.id, o.number, o.created_at, o.status, o.total, o.paid_amount, o.payment_method, o.payment_status, o.delivery_method,
                    o.first_name, o.last_name, o.phone, o.email, o.crm_status, o.reservation_status,
                    (SELECT email FROM users m WHERE m.id = o.assigned_manager_id) AS manager_email
             FROM orders o WHERE ($1::text IS NULL OR o.status = $1) ORDER BY o.created_at DESC LIMIT 500) t"#,
    )
    .bind(q.status.filter(|s| !s.is_empty()))
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
struct StatusInput {
    status: String,
}

async fn set_status(State(state): State<AppState>, Manager(_m): Manager, Path(number): Path<String>, Json(body): Json<StatusInput>) -> AppResult<Json<Value>> {
    let Some(o) = orders::load_by_number(&state.pool, &number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    let o = orders::set_status(&state, &o, &body.status).await?;
    Ok(Json(json!(orders::order_json(&state, &o).await?)))
}

async fn outbox(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        "SELECT to_jsonb(t) FROM (SELECT id, target, event, status, attempts, mock, last_error, created_at, sent_at, payload FROM integration_outbox ORDER BY id DESC LIMIT 200) t",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
struct TextInput {
    text: String,
}

async fn reply_review(State(state): State<AppState>, Manager(m): Manager, Path(id): Path<Uuid>, Json(body): Json<TextInput>) -> AppResult<Json<Value>> {
    let text = body.text.trim();
    if text.is_empty() || text.chars().count() > 4000 {
        return Err(AppError::unprocessable("invalid_text", "Напишите ответ (до 4000 символов)"));
    }
    // уведомляем только о первом ответе и только если клиент не отключил уведомления об ответах
    let first: Option<bool> = sqlx::query_scalar("SELECT reply_text IS NULL FROM reviews WHERE id = $1").bind(id).fetch_optional(&state.pool).await?;
    let row: Option<(Option<Uuid>, Uuid)> = sqlx::query_as(
        "UPDATE reviews SET reply_text = $2, reply_author = 'Точикэлектрокомплект', replied_at = $3 WHERE id = $1 RETURNING user_id, product_id",
    )
    .bind(id)
    .bind(text)
    .bind(Utc::now())
    .fetch_optional(&state.pool)
    .await?;
    let Some((user_id, product_id)) = row else { return Err(AppError::not_found("Отзыв не найден")) };
    let wants: bool = match user_id {
        Some(uid) => sqlx::query_scalar("SELECT notify_replies FROM users WHERE id = $1").bind(uid).fetch_optional(&state.pool).await?.unwrap_or(false),
        None => false,
    };
    if let (Some(uid), Some(true), true) = (user_id, first, wants) {
        let slug: String = sqlx::query_scalar("SELECT slug FROM products WHERE id = $1").bind(product_id).fetch_one(&state.pool).await?;
        sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, 'review_reply', 'Ответ на ваш отзыв', $2, $3)")
            .bind(uid)
            .bind(format!("{} ответил(а) на ваш отзыв.", m.full_name()))
            .bind(format!("/product/{slug}#reviews"))
            .execute(&state.pool)
            .await?;
    }
    state.invalidate_public();
    Ok(Json(json!({ "ok": true })))
}

async fn answer_question(State(state): State<AppState>, Manager(m): Manager, Path(id): Path<Uuid>, Json(body): Json<TextInput>) -> AppResult<Json<Value>> {
    let text = body.text.trim();
    if text.is_empty() || text.chars().count() > 4000 {
        return Err(AppError::unprocessable("invalid_text", "Напишите ответ (до 4000 символов)"));
    }
    // уведомляем только о первом ответе и только если клиент не отключил уведомления об ответах
    let first: Option<bool> = sqlx::query_scalar("SELECT answer_text IS NULL FROM questions WHERE id = $1").bind(id).fetch_optional(&state.pool).await?;
    let row: Option<(Option<Uuid>, Uuid)> = sqlx::query_as(
        "UPDATE questions SET answer_text = $2, answer_author = 'Точикэлектрокомплект', answered_at = $3 WHERE id = $1 RETURNING user_id, product_id",
    )
    .bind(id)
    .bind(text)
    .bind(Utc::now())
    .fetch_optional(&state.pool)
    .await?;
    let Some((user_id, product_id)) = row else { return Err(AppError::not_found("Вопрос не найден")) };
    let wants: bool = match user_id {
        Some(uid) => sqlx::query_scalar("SELECT notify_replies FROM users WHERE id = $1").bind(uid).fetch_optional(&state.pool).await?.unwrap_or(false),
        None => false,
    };
    if let (Some(uid), Some(true), true) = (user_id, first, wants) {
        let slug: String = sqlx::query_scalar("SELECT slug FROM products WHERE id = $1").bind(product_id).fetch_one(&state.pool).await?;
        sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, 'question_answer', 'Ответ на ваш вопрос', $2, $3)")
            .bind(uid)
            .bind(format!("{} ответил(а) на ваш вопрос.", m.full_name()))
            .bind(format!("/product/{slug}#questions"))
            .execute(&state.pool)
            .await?;
    }
    state.invalidate_public();
    Ok(Json(json!({ "ok": true })))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(users))
        .route("/admin/users/{id}/approve", post(approve))
        .route("/admin/users/{id}/pricing", put(pricing))
        .route("/admin/orders", get(admin_orders))
        .route("/admin/orders/{number}/status", put(set_status))
        .route("/admin/outbox", get(outbox))
        .route("/admin/reviews/{id}/reply", post(reply_review))
        .route("/admin/questions/{id}/answer", post(answer_question))
}

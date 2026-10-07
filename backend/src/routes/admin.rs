use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer};
use serde_json::{json, Value};
use sqlx::AssertSqlSafe;
use uuid::Uuid;

use crate::{
    auth::{admin_only, Manager},
    error::{AppError, AppResult},
    models::{delivery_method_label, order_status_label, payment_method_label, payment_status_label, UserRow},
    services::{mail, orders, outbox},
    state::AppState,
};

// ---------- общее для списков панели ----------

/// `%текст%` для ILIKE: служебные символы шаблона (`%`, `_`, `\`) экранируются.
pub fn like_pattern(q: &str) -> String {
    format!("%{}%", q.trim().replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"))
}

/// Текст поиска → (шаблон ILIKE, цифры для поиска телефона в любом написании — если запрос похож на телефон).
fn search_terms(q: Option<&str>) -> (Option<String>, String) {
    let Some(q) = q.map(str::trim).filter(|q| !q.is_empty()) else { return (None, String::new()) };
    let phone_like = q.chars().all(|c| c.is_ascii_digit() || " +-()".contains(c));
    let digits: String = q.chars().filter(char::is_ascii_digit).collect();
    (Some(like_pattern(q)), if phone_like && digits.len() >= 3 { digits } else { String::new() })
}

/// Поле, которое можно не передать (не менять), передать `null` (очистить) или значение.
pub fn double_option<'de, D, T>(d: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(d).map(Some)
}

/// Страница списка: page ≥ 1, per_page 1–200 (по умолчанию `default`).
pub fn page_params(page: Option<i64>, per_page: Option<i64>, default: i64) -> (i64, i64) {
    (page.unwrap_or(1).clamp(1, 100_000), per_page.unwrap_or(default).clamp(1, 200))
}

pub fn paged(items: Vec<Value>, total: i64, page: i64, per: i64) -> Value {
    json!({ "items": items, "total": total, "page": page, "per_page": per, "pages": (total + per - 1) / per })
}

fn flag(v: Option<&str>) -> bool {
    matches!(v, Some("1" | "true" | "yes"))
}

// ---------- пользователи ----------

/// Строка пользователя в панели (список и ответ на изменение).
const ADMIN_USER_SELECT: &str = r#"
SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.status, u.customer_type, u.discount_pct, u.cashback_pct,
       u.manager_id, NULLIF(trim(concat_ws(' ', m.first_name, m.last_name)), '') AS manager_name, u.is_lead_manager,
       c.name AS company_name, c.inn AS company_inn, c.verified AS company_verified, u.created_at
FROM users u LEFT JOIN companies c ON c.id = u.company_id LEFT JOIN users m ON m.id = u.manager_id
"#;

#[derive(Deserialize)]
struct UsersQuery {
    status: Option<String>,
    role: Option<String>,
    q: Option<String>,
}

async fn users(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<UsersQuery>) -> AppResult<Json<Vec<Value>>> {
    let (pattern, digits) = search_terms(q.q.as_deref());
    let sql = format!(
        r#"SELECT to_jsonb(t) FROM ({ADMIN_USER_SELECT}
             WHERE ($1::text IS NULL OR u.status = $1) AND ($2::text IS NULL OR u.role = $2)
               AND ($3::text IS NULL OR u.email ILIKE $3 OR u.phone ILIKE $3 OR concat_ws(' ', u.first_name, u.last_name) ILIKE $3
                    OR concat_ws(' ', u.last_name, u.first_name) ILIKE $3 OR c.name ILIKE $3 OR c.inn ILIKE $3
                    OR ($4 <> '' AND regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') LIKE '%' || $4 || '%'))
             ORDER BY u.created_at DESC LIMIT 500) t"#
    );
    let rows: Vec<Value> = sqlx::query_scalar(AssertSqlSafe(sql))
        .bind(q.status.filter(|s| !s.is_empty()))
        .bind(q.role.filter(|s| !s.is_empty()))
        .bind(pattern)
        .bind(digits)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows))
}

async fn admin_user(state: &AppState, id: Uuid) -> AppResult<Value> {
    let sql = format!("SELECT to_jsonb(t) FROM ({ADMIN_USER_SELECT} WHERE u.id = $1) t");
    let row: Option<Value> = sqlx::query_scalar(AssertSqlSafe(sql)).bind(id).fetch_optional(&state.pool).await?;
    row.ok_or_else(|| AppError::not_found("Пользователь не найден"))
}

/// Один пользователь — та же строка, что в списке.
async fn get_user(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>) -> AppResult<Json<Value>> {
    Ok(Json(admin_user(&state, id).await?))
}

/// Уведомление и письмо «аккаунт активирован» (одобрение регистрации).
async fn notify_approved(state: &AppState, id: Uuid) {
    let res = sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, 'account', 'Аккаунт одобрен', 'Ваш аккаунт активирован. Теперь вам доступны персональные цены и кешбэк.', '/account')")
        .bind(id)
        .execute(&state.pool)
        .await;
    if let Err(e) = res {
        tracing::warn!(error = %e, "approval notification not saved");
    }
    let user: Option<(Option<String>, String)> = sqlx::query_as("SELECT email, first_name FROM users WHERE id = $1").bind(id).fetch_optional(&state.pool).await.ok().flatten();
    if let Some((email, name)) = user
        && let Some(to) = mail::valid_email(email.as_deref())
    {
        mail::enqueue_pool(&state.pool, "email.account_approved", mail::account_approved(&state.cfg, to, &name), None).await;
    }
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
    if n > 0 {
        notify_approved(&state, id).await;
    }
    state.invalidate_user(id).await;
    Ok(Json(json!({ "ok": true })))
}

#[derive(Deserialize)]
struct UserPatch {
    status: Option<String>,
    role: Option<String>,
    is_lead_manager: Option<bool>,
    #[serde(default, deserialize_with = "double_option")]
    manager_id: Option<Option<Uuid>>,
    company_verified: Option<bool>,
}

/// Изменение пользователя менеджером: блокировка / разблокировка / одобрение, закреплённый менеджер, проверка компании;
/// роль и лид-менеджер — только администратор. Свои роль и статус менять нельзя; сотрудников меняет только администратор.
async fn update_user(State(state): State<AppState>, Manager(m): Manager, Path(id): Path<Uuid>, Json(body): Json<UserPatch>) -> AppResult<Json<Value>> {
    let is_admin = m.role == "admin";
    if id == m.id && (body.status.is_some() || body.role.is_some()) {
        return Err(AppError::forbidden("self_change", "Нельзя менять собственные роль и статус"));
    }
    if !is_admin && (body.role.is_some() || body.is_lead_manager.is_some()) {
        return Err(admin_only());
    }
    if body.status.as_deref().is_some_and(|s| !matches!(s, "approved" | "blocked")) {
        return Err(AppError::unprocessable("invalid_status", "Статус: approved или blocked"));
    }
    if body.role.as_deref().is_some_and(|r| !matches!(r, "customer" | "manager" | "admin")) {
        return Err(AppError::unprocessable("invalid_role", "Роль: customer, manager или admin"));
    }
    let mut tx = state.pool.begin().await?;
    let target = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Пользователь не найден"))?;
    if !is_admin && target.is_manager() {
        return Err(admin_only());
    }
    if let Some(Some(mid)) = body.manager_id {
        if mid == id {
            return Err(AppError::unprocessable("invalid_manager", "Нельзя закрепить пользователя за самим собой"));
        }
        let ok: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND role IN ('manager','admin') AND status <> 'blocked')")
            .bind(mid)
            .fetch_one(&mut *tx)
            .await?;
        if !ok {
            return Err(AppError::unprocessable("invalid_manager", "Менеджер не найден"));
        }
    }
    let new_status = body.status.clone().unwrap_or_else(|| target.status.clone());
    let approved_now = target.status == "pending" && new_status == "approved";
    // как при POST /approve: менеджер, одобривший клиента без менеджера, становится его менеджером
    let (set_manager, manager_id) = match body.manager_id {
        Some(v) => (true, v),
        None if approved_now && m.role == "manager" && target.manager_id.is_none() => (true, Some(m.id)),
        None => (false, None),
    };
    sqlx::query(
        r#"UPDATE users SET status = COALESCE($2, status), role = COALESCE($3, role),
             is_lead_manager = CASE WHEN COALESCE($3, role) = 'customer' THEN false ELSE COALESCE($4, is_lead_manager) END,
             manager_id = CASE WHEN $5 THEN $6 ELSE manager_id END
           WHERE id = $1"#,
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.role)
    .bind(body.is_lead_manager)
    .bind(set_manager)
    .bind(manager_id)
    .execute(&mut *tx)
    .await?;
    if let Some(v) = body.company_verified {
        let Some(cid) = target.company_id else {
            return Err(AppError::unprocessable("no_company", "У пользователя нет компании"));
        };
        sqlx::query("UPDATE companies SET verified = $2 WHERE id = $1").bind(cid).bind(v).execute(&mut *tx).await?;
    }
    if new_status == "blocked" && target.status != "blocked" {
        // заблокированный выходит из всех сессий; access-токен перестаёт действовать сразу (статус проверяется на каждом запросе)
        sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1").bind(id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    state.invalidate_user(id).await;
    if approved_now {
        notify_approved(&state, id).await;
    }
    Ok(Json(admin_user(&state, id).await?))
}

/// Менеджеры и администраторы (без заблокированных) — для выбора ответственного.
async fn managers(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT id, COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), email, phone) AS name, email, phone, role, is_lead_manager
             FROM users WHERE role IN ('manager','admin') AND status <> 'blocked'
             ORDER BY is_lead_manager DESC, role DESC, first_name, last_name) t"#,
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn get_pricing(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>) -> AppResult<Json<Value>> {
    let row: Option<(Decimal, Decimal, Option<Uuid>)> = sqlx::query_as("SELECT discount_pct, cashback_pct, manager_id FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?;
    let (discount_pct, cashback_pct, manager_id) = row.ok_or_else(|| AppError::not_found("Пользователь не найден"))?;
    let rules: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT c.slug AS category_slug, b.slug AS brand_slug, r.product_id, r.discount_pct, r.cashback_pct,
                    c.name AS category_name, b.name AS brand_name, p.code AS product_code, p.name AS product_name
             FROM user_price_rules r LEFT JOIN categories c ON c.id = r.category_id LEFT JOIN brands b ON b.id = r.brand_id
             LEFT JOIN products p ON p.id = r.product_id
             WHERE r.user_id = $1 ORDER BY r.id) t"#,
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({ "discount_pct": discount_pct, "cashback_pct": cashback_pct, "manager_id": manager_id, "rules": rules })))
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

// ---------- заказы ----------

#[derive(Deserialize)]
struct OrdersQuery {
    status: Option<String>,
    q: Option<String>,
    mine: Option<String>,
}

async fn admin_orders(State(state): State<AppState>, Manager(m): Manager, Query(q): Query<OrdersQuery>) -> AppResult<Json<Vec<Value>>> {
    let (pattern, digits) = search_terms(q.q.as_deref());
    let mut rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT o.id, o.number, o.created_at, o.status, o.total, o.paid_amount, GREATEST(o.total - o.paid_amount, 0) AS remaining,
                    o.payment_method, o.payment_status, o.delivery_method, o.first_name, o.last_name, o.phone, o.email,
                    c.name AS company_name, o.crm_status, o.reservation_status, o.assigned_manager_id AS manager_id,
                    NULLIF(trim(concat_ws(' ', mg.first_name, mg.last_name)), '') AS manager_name, mg.email AS manager_email
             FROM orders o LEFT JOIN companies c ON c.id = o.company_id LEFT JOIN users mg ON mg.id = o.assigned_manager_id
             WHERE ($1::text IS NULL OR o.status = $1) AND ($2::uuid IS NULL OR o.assigned_manager_id = $2)
               AND ($3::text IS NULL OR o.number ILIKE $3 OR concat_ws(' ', o.first_name, o.last_name) ILIKE $3
                    OR concat_ws(' ', o.last_name, o.first_name) ILIKE $3 OR o.phone ILIKE $3 OR o.email ILIKE $3 OR c.name ILIKE $3
                    OR ($4 <> '' AND regexp_replace(o.phone, '\D', '', 'g') LIKE '%' || $4 || '%'))
             ORDER BY o.created_at DESC LIMIT 500) t"#,
    )
    .bind(q.status.filter(|s| !s.is_empty()))
    .bind(if flag(q.mine.as_deref()) { Some(m.id) } else { None })
    .bind(pattern)
    .bind(digits)
    .fetch_all(&state.pool)
    .await?;
    for r in rows.iter_mut() {
        let text = |k: &str| r.get(k).and_then(Value::as_str).unwrap_or("").to_string();
        let (status, pay_status, pay_method, delivery) = (text("status"), text("payment_status"), text("payment_method"), text("delivery_method"));
        r["status_label"] = json!(order_status_label(&status));
        r["payment_status_label"] = json!(payment_status_label(&pay_status));
        r["payment_method_label"] = json!(payment_method_label(&pay_method).0);
        r["delivery_method_label"] = json!(delivery_method_label(&delivery));
    }
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

#[derive(Deserialize)]
struct ManagerInput {
    /// null — снять ответственного
    #[serde(default, deserialize_with = "double_option")]
    manager_id: Option<Option<Uuid>>,
}

/// Передать заказ другому менеджеру (`manager_id: null` — снять ответственного): событие order.updated в CRM,
/// письмо новому ответственному.
async fn set_order_manager(State(state): State<AppState>, Manager(m): Manager, Path(number): Path<String>, Json(body): Json<ManagerInput>) -> AppResult<Json<Value>> {
    let Some(manager_id) = body.manager_id else {
        return Err(AppError::unprocessable("invalid_manager", "Укажите manager_id (null — снять менеджера)"));
    };
    let Some(o) = orders::load_by_number(&state.pool, &number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    let mgr = match manager_id {
        Some(id) => Some(
            sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1 AND role IN ('manager','admin') AND status <> 'blocked'")
                .bind(id)
                .fetch_optional(&state.pool)
                .await?
                .ok_or_else(|| AppError::unprocessable("invalid_manager", "Менеджер не найден"))?,
        ),
        None => None,
    };
    let new_id = mgr.as_ref().map(|u| u.id);
    let mut tx = state.pool.begin().await?;
    let prev: Option<Uuid> = sqlx::query_scalar("SELECT assigned_manager_id FROM orders WHERE id = $1 FOR UPDATE").bind(o.id).fetch_one(&mut *tx).await?;
    sqlx::query("UPDATE orders SET assigned_manager_id = $2, updated_at = now() WHERE id = $1").bind(o.id).bind(new_id).execute(&mut *tx).await?;
    if prev != new_id {
        let manager_json = mgr.as_ref().map(|u| json!({ "id": u.id, "name": u.full_name(), "email": u.email, "is_lead": u.is_lead_manager }));
        outbox::enqueue(&mut tx, "crm", "order.updated", json!({ "number": o.number, "order_id": o.id, "manager": manager_json })).await?;
        if let Some(mgr) = &mgr
            && mgr.id != m.id
            && let Some(to) = mail::valid_email(mgr.email.as_deref())
        {
            let customer = format!("{} {}", o.first_name, o.last_name).trim().to_string();
            mail::enqueue(&mut tx, "email.order_assigned", mail::order_assigned_manager(&state.cfg, to, &o.number, &customer, o.total), Some(&o.number)).await?;
        }
    }
    tx.commit().await?;
    let o = orders::load_by_id(&state.pool, o.id).await?;
    Ok(Json(json!(orders::order_json(&state, &o).await?)))
}

#[derive(Deserialize)]
struct PaymentInput {
    amount: Option<Decimal>,
    note: Option<String>,
}

/// Поступление оплаты (перевод по счёту, в том числе частичный); без `amount` — весь остаток.
async fn register_payment(State(state): State<AppState>, Manager(_m): Manager, Path(number): Path<String>, Json(body): Json<PaymentInput>) -> AppResult<Json<Value>> {
    let Some(o) = orders::load_by_number(&state.pool, &number).await? else {
        return Err(AppError::not_found("Заказ не найден"));
    };
    let o = orders::register_payment(&state, &o, body.amount, body.note).await?;
    Ok(Json(json!(orders::order_json(&state, &o).await?)))
}

async fn outbox(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    // у писем HTML-версия не нужна в списке (тяжёлая) — остаются to / subject / text
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (SELECT id, target, event, status, attempts, mock, last_error, created_at, sent_at,
                  CASE WHEN target = 'email' THEN payload - 'html' ELSE payload END AS payload
           FROM integration_outbox ORDER BY id DESC LIMIT 200) t"#,
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

// ---------- заявки с форм сайта ----------

const LEAD_COLS: &str = "id, kind, name, phone, email, note, service, page, status, manager_note, user_id, created_at";

#[derive(Deserialize)]
struct LeadsQuery {
    status: Option<String>,
    kind: Option<String>,
    q: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
}

async fn leads(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<LeadsQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let (pattern, digits) = search_terms(q.q.as_deref());
    let filter = r#"($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR kind = $2)
                    AND ($3::text IS NULL OR name ILIKE $3 OR phone ILIKE $3 OR email ILIKE $3 OR note ILIKE $3
                         OR ($4 <> '' AND regexp_replace(phone, '\D', '', 'g') LIKE '%' || $4 || '%'))"#;
    let status = q.status.filter(|s| !s.is_empty());
    let kind = q.kind.filter(|s| !s.is_empty());
    let total: i64 = sqlx::query_scalar(AssertSqlSafe(format!("SELECT count(*) FROM leads WHERE {filter}")))
        .bind(&status)
        .bind(&kind)
        .bind(&pattern)
        .bind(&digits)
        .fetch_one(&state.pool)
        .await?;
    let items: Vec<Value> = sqlx::query_scalar(AssertSqlSafe(format!(
        "SELECT to_jsonb(t) FROM (SELECT {LEAD_COLS} FROM leads WHERE {filter} ORDER BY created_at DESC, id DESC LIMIT $5 OFFSET $6) t"
    )))
    .bind(&status)
    .bind(&kind)
    .bind(&pattern)
    .bind(&digits)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(paged(items, total, page, per)))
}

#[derive(Deserialize)]
struct LeadPatch {
    status: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    manager_note: Option<Option<String>>,
}

async fn update_lead(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i64>, Json(body): Json<LeadPatch>) -> AppResult<Json<Value>> {
    if body.status.as_deref().is_some_and(|s| !matches!(s, "new" | "in_progress" | "done")) {
        return Err(AppError::unprocessable("invalid_status", "Статус заявки: new, in_progress или done"));
    }
    let (set_note, note) = match body.manager_note {
        None => (false, None),
        Some(v) => (true, v.map(|n| n.trim().chars().take(4000).collect::<String>()).filter(|n| !n.is_empty())),
    };
    let row: Option<Value> = sqlx::query_scalar(AssertSqlSafe(format!(
        r#"WITH u AS (UPDATE leads SET status = COALESCE($2, status), manager_note = CASE WHEN $3 THEN $4 ELSE manager_note END
                      WHERE id = $1 RETURNING *)
           SELECT to_jsonb(t) FROM (SELECT {LEAD_COLS} FROM u) t"#
    )))
    .bind(id)
    .bind(&body.status)
    .bind(set_note)
    .bind(note)
    .fetch_optional(&state.pool)
    .await?;
    row.map(Json).ok_or_else(|| AppError::not_found("Заявка не найдена"))
}

// ---------- модерация отзывов и вопросов ----------

#[derive(Deserialize)]
struct ModerationQuery {
    unanswered: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
}

async fn admin_reviews(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<ModerationQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let unanswered = flag(q.unanswered.as_deref());
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM reviews WHERE (NOT $1 OR reply_text IS NULL)").bind(unanswered).fetch_one(&state.pool).await?;
    let items: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT r.id, jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name) AS product, r.user_id, r.author_name AS author,
                    r.rating, r.pros, r.cons, r.body AS text, r.created_at, r.reply_text, r.replied_at, r.status
             FROM reviews r JOIN products p ON p.id = r.product_id
             WHERE (NOT $1 OR r.reply_text IS NULL) ORDER BY r.created_at DESC, r.id LIMIT $2 OFFSET $3) t"#,
    )
    .bind(unanswered)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(paged(items, total, page, per)))
}

async fn admin_questions(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<ModerationQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let unanswered = flag(q.unanswered.as_deref());
    let total: i64 = sqlx::query_scalar("SELECT count(*) FROM questions WHERE (NOT $1 OR answer_text IS NULL)").bind(unanswered).fetch_one(&state.pool).await?;
    let items: Vec<Value> = sqlx::query_scalar(
        r#"SELECT to_jsonb(t) FROM (
             SELECT q.id, jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name) AS product, q.user_id, q.author_name AS author,
                    q.body AS text, q.created_at, q.answer_text, q.answered_at
             FROM questions q JOIN products p ON p.id = q.product_id
             WHERE (NOT $1 OR q.answer_text IS NULL) ORDER BY q.created_at DESC, q.id LIMIT $2 OFFSET $3) t"#,
    )
    .bind(unanswered)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(paged(items, total, page, per)))
}

/// Удаление отзыва модератором: рейтинг и число отзывов товара пересчитываются.
async fn delete_review(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let pid: Uuid = sqlx::query_scalar("DELETE FROM reviews WHERE id = $1 RETURNING product_id")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Отзыв не найден"))?;
    sqlx::query(
        r#"UPDATE products SET reviews_count = (SELECT count(*) FROM reviews WHERE product_id = $1 AND status = 'published'),
           rating = (SELECT COALESCE(round(avg(rating)::numeric, 2), 0) FROM reviews WHERE product_id = $1 AND status = 'published') WHERE id = $1"#,
    )
    .bind(pid)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_question(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<Uuid>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let pid: Uuid = sqlx::query_scalar("DELETE FROM questions WHERE id = $1 RETURNING product_id")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Вопрос не найден"))?;
    sqlx::query("UPDATE products SET questions_count = (SELECT count(*) FROM questions WHERE product_id = $1) WHERE id = $1")
        .bind(pid)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    state.invalidate_public();
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct TextInput {
    text: String,
}

/// Письмо автору об ответе (если он не отключил уведомления об ответах и у него есть e-mail).
async fn mail_reply(state: &AppState, user_id: Uuid, product_id: Uuid, answer: &str, question: bool) {
    let row: Option<(Option<String>, String, String, String)> = sqlx::query_as("SELECT u.email, u.first_name, p.name, p.slug FROM users u, products p WHERE u.id = $1 AND p.id = $2")
        .bind(user_id)
        .bind(product_id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();
    if let Some((email, name, product, slug)) = row
        && let Some(to) = mail::valid_email(email.as_deref())
    {
        let event = if question { "email.question_answer" } else { "email.review_reply" };
        mail::enqueue_pool(&state.pool, event, mail::reply(&state.cfg, to, &name, &product, &slug, answer, question), None).await;
    }
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
        mail_reply(&state, uid, product_id, text, false).await;
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
        mail_reply(&state, uid, product_id, text, true).await;
    }
    state.invalidate_public();
    Ok(Json(json!({ "ok": true })))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/users", get(users))
        .route("/admin/users/{id}", get(get_user).put(update_user))
        .route("/admin/users/{id}/approve", post(approve))
        .route("/admin/users/{id}/pricing", get(get_pricing).put(pricing))
        .route("/admin/managers", get(managers))
        .route("/admin/orders", get(admin_orders))
        .route("/admin/orders/{number}/status", put(set_status))
        .route("/admin/orders/{number}/manager", put(set_order_manager))
        .route("/admin/orders/{number}/payments", post(register_payment))
        .route("/admin/outbox", get(outbox))
        .route("/admin/leads", get(leads))
        .route("/admin/leads/{id}", put(update_lead))
        .route("/admin/reviews", get(admin_reviews))
        .route("/admin/reviews/{id}", axum::routing::delete(delete_review))
        .route("/admin/reviews/{id}/reply", post(reply_review))
        .route("/admin/questions", get(admin_questions))
        .route("/admin/questions/{id}", axum::routing::delete(delete_question))
        .route("/admin/questions/{id}/answer", post(answer_question))
}

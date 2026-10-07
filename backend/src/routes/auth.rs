use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{self, AuthUser},
    error::{AppError, AppResult},
    models::{CompanyJson, ManagerJson, UserJson, UserRow},
    services::{ledger, mail, outbox},
    state::AppState,
};

pub async fn user_json(state: &AppState, u: &UserRow) -> AppResult<UserJson> {
    let company = match u.company_id {
        Some(id) => sqlx::query_as::<_, CompanyJson>("SELECT id, name, inn, address, phone, email FROM companies WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?,
        None => None,
    };
    let manager = match u.manager_id {
        Some(id) => sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.pool)
            .await?
            .map(|m| ManagerJson { name: m.full_name(), phone: m.phone.clone(), email: m.email.clone().unwrap_or_default() }),
        None => None,
    };
    let bonus_balance = ledger::bonus_balance(&state.pool, u.id).await?;
    Ok(UserJson {
        id: u.id,
        email: u.email.clone().unwrap_or_default(),
        phone: u.phone.clone(),
        first_name: u.first_name.clone(),
        last_name: u.last_name.clone(),
        role: u.role.clone(),
        status: u.status.clone(),
        customer_type: u.customer_type.clone(),
        discount_pct: u.discount_pct,
        cashback_pct: u.cashback_pct,
        bonus_balance,
        company,
        manager,
        notify_marketing: u.notify_marketing,
        notify_replies: u.notify_replies,
    })
}

#[derive(Deserialize)]
struct CompanyInput {
    name: String,
    inn: Option<String>,
    address: Option<String>,
}

#[derive(Deserialize)]
struct RegisterInput {
    /// не обязателен: вход возможен по телефону
    email: Option<String>,
    phone: Option<String>,
    password: String,
    first_name: String,
    last_name: Option<String>,
    customer_type: Option<String>,
    company: Option<CompanyInput>,
}

async fn register(State(state): State<AppState>, Json(body): Json<RegisterInput>) -> AppResult<Response> {
    let email = body.email.as_deref().map(|e| e.trim().to_lowercase()).filter(|e| !e.is_empty());
    if email.as_deref().is_some_and(|e| !e.contains('@') || e.len() < 5) {
        return Err(AppError::unprocessable("invalid_email", "Укажите корректный e-mail"));
    }
    if body.first_name.trim().is_empty() {
        return Err(AppError::unprocessable("invalid_name", "Укажите имя"));
    }
    let phone = match body.phone.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(raw) => Some(auth::canonical_phone(raw).ok_or_else(|| AppError::unprocessable("invalid_phone", auth::PHONE_FORMAT_ERROR))?),
        None => None,
    };
    // логин — e-mail или телефон: без e-mail телефон обязателен
    if email.is_none() && phone.is_none() {
        return Err(AppError::unprocessable("invalid_phone", "Укажите номер телефона"));
    }
    auth::validate_password(&body.password, email.as_deref().unwrap_or(""), &body.first_name)?;
    // типы клиента при регистрации — физическое и юридическое лицо (electrician / purchaser — прежние значения)
    let customer_type = match body.customer_type.as_deref() {
        Some("legal") => "legal",
        Some("electrician") => "electrician",
        Some("purchaser") => "purchaser",
        _ => "retail",
    };
    if customer_type == "legal" && !body.company.as_ref().is_some_and(|c| !c.name.trim().is_empty()) {
        return Err(AppError::unprocessable("company_required", "Для юридического лица укажите данные компании"));
    }
    let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE ($1::text IS NOT NULL AND email = $1) OR ($2::text IS NOT NULL AND phone = $2)")
        .bind(&email)
        .bind(&phone)
        .fetch_optional(&state.pool)
        .await?;
    if exists.is_some() {
        return Err(AppError::conflict("already_registered", "Пользователь с таким e-mail или телефоном уже зарегистрирован"));
    }
    let hash = auth::hash_password_async(body.password.clone()).await?;
    let first_name = body.first_name.trim().to_string();
    let last_name = body.last_name.as_deref().unwrap_or_default().trim().to_string();
    let mut tx = state.pool.begin().await?;
    let company_id: Option<Uuid> = match &body.company {
        Some(c) if !c.name.trim().is_empty() => Some(
            sqlx::query_scalar("INSERT INTO companies (name, inn, address, email, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id")
                .bind(c.name.trim())
                .bind(c.inn.as_deref().map(str::trim))
                .bind(c.address.as_deref().map(str::trim))
                .bind(&email)
                .bind(&phone)
                .fetch_one(&mut *tx)
                .await?,
        ),
        _ => None,
    };
    let user_id: Uuid = sqlx::query_scalar(
        "INSERT INTO users (email, phone, password_hash, first_name, last_name, customer_type, company_id, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id",
    )
    .bind(&email)
    .bind(&phone)
    .bind(&hash)
    .bind(&first_name)
    .bind(&last_name)
    .bind(customer_type)
    .bind(company_id)
    .fetch_one(&mut *tx)
    .await?;
    outbox::enqueue(&mut tx, "crm", "user.registered", json!({ "user_id": user_id, "email": email, "phone": phone, "customer_type": customer_type, "company_id": company_id })).await?;
    // письма: клиенту — «заявка получена», менеджеру — «новая регистрация ждёт одобрения»
    if let Some(to) = mail::valid_email(email.as_deref()) {
        mail::enqueue(&mut tx, "email.registration_received", mail::registration_received(&state.cfg, to, &first_name), None).await?;
    }
    if let Some(to) = mail::manager_recipient(&mut tx, &state.cfg, None).await? {
        let full_name = format!("{first_name} {last_name}").trim().to_string();
        let company = body.company.as_ref().map(|c| c.name.trim()).filter(|n| !n.is_empty());
        let m = mail::registration_manager(&state.cfg, to, &full_name, email.as_deref(), phone.as_deref(), customer_type, company);
        mail::enqueue(&mut tx, "email.registration_new", m, None).await?;
    }
    tx.commit().await?;
    Ok((StatusCode::ACCEPTED, Json(json!({ "message": "Заявка отправлена на одобрение. Менеджер свяжется с вами, когда аккаунт будет активирован.", "user_id": user_id }))).into_response())
}

#[derive(Deserialize)]
struct LoginInput {
    login: String,
    password: String,
}

async fn issue_pair(state: &AppState, user: &UserRow) -> AppResult<(String, String)> {
    let access = auth::issue_access(&state.cfg.jwt_secret, user)?;
    let refresh = auth::new_refresh_token();
    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user.id)
        .bind(auth::sha256_hex(&refresh))
        .bind(Utc::now() + Duration::days(auth::REFRESH_TTL_DAYS))
        .execute(&state.pool)
        .await?;
    Ok((access, refresh))
}

async fn login(State(state): State<AppState>, Json(body): Json<LoginInput>) -> AppResult<Json<Value>> {
    let login = body.login.trim().to_lowercase();
    // телефон в любом написании (+992 92 111 22 25, 921112225) — к виду +992XXXXXXXXX, как он хранится;
    // номера, сохранённые до единого формата, — как раньше: только цифры и «+»
    let by_email = login.contains('@');
    let legacy_phone: String = if by_email { String::new() } else { login.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect() };
    let phone = if by_email { String::new() } else { auth::canonical_phone(&login).unwrap_or_else(|| legacy_phone.clone()) };
    let user = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM users WHERE email = $1 OR (length($2) >= 7 AND phone = $2) OR (length($3) >= 7 AND phone = $3) ORDER BY (email = $1) DESC NULLS LAST LIMIT 1",
    )
        .bind(&login)
        .bind(&phone)
        .bind(&legacy_phone)
        .fetch_optional(&state.pool)
        .await?;
    let ok = auth::verify_password_async(body.password.clone(), user.as_ref().map(|u| u.password_hash.clone())).await;
    let Some(user) = user.filter(|_| ok) else {
        return Err(AppError::new(StatusCode::UNAUTHORIZED, "invalid_credentials", "Неверный логин или пароль"));
    };
    match user.status.as_str() {
        "pending" => return Err(AppError::forbidden("account_pending", "Аккаунт ожидает одобрения компанией")),
        "blocked" => return Err(AppError::forbidden("account_blocked", "Аккаунт заблокирован")),
        _ => {}
    }
    let (access_token, refresh_token) = issue_pair(&state, &user).await?;
    Ok(Json(json!({ "access_token": access_token, "refresh_token": refresh_token, "user": user_json(&state, &user).await? })))
}

#[derive(Deserialize)]
struct RefreshInput {
    refresh_token: String,
}

async fn refresh(State(state): State<AppState>, Json(body): Json<RefreshInput>) -> AppResult<Json<Value>> {
    let hash = auth::sha256_hex(body.refresh_token.trim());
    let mut tx = state.pool.begin().await?;
    let row: Option<(Uuid, chrono::DateTime<Utc>)> =
        sqlx::query_as("DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING user_id, expires_at")
            .bind(&hash)
            .fetch_optional(&mut *tx)
            .await?;
    let Some((user_id, expires_at)) = row else {
        return Err(AppError::new(StatusCode::UNAUTHORIZED, "invalid_refresh", "Сессия недействительна"));
    };
    if expires_at < Utc::now() {
        tx.commit().await?;
        return Err(AppError::new(StatusCode::UNAUTHORIZED, "refresh_expired", "Сессия истекла"));
    }
    let user = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1").bind(user_id).fetch_one(&mut *tx).await?;
    if user.status != "approved" {
        tx.commit().await?;
        return Err(AppError::forbidden("account_inactive", "Аккаунт неактивен"));
    }
    let access = auth::issue_access(&state.cfg.jwt_secret, &user)?;
    let new_refresh = auth::new_refresh_token();
    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user.id)
        .bind(auth::sha256_hex(&new_refresh))
        .bind(Utc::now() + Duration::days(auth::REFRESH_TTL_DAYS))
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(json!({ "access_token": access, "refresh_token": new_refresh })))
}

async fn logout(State(state): State<AppState>, Json(body): Json<RefreshInput>) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM refresh_tokens WHERE token_hash = $1")
        .bind(auth::sha256_hex(body.refresh_token.trim()))
        .execute(&state.pool)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn me(State(state): State<AppState>, AuthUser(user): AuthUser) -> AppResult<Json<UserJson>> {
    Ok(Json(user_json(&state, &user).await?))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
}

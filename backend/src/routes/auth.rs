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
    services::{ledger, outbox},
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
            .map(|m| ManagerJson { name: m.full_name(), phone: m.phone.clone(), email: m.email.clone() }),
        None => None,
    };
    let bonus_balance = ledger::bonus_balance(&state.pool, u.id).await?;
    Ok(UserJson {
        id: u.id,
        email: u.email.clone(),
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
    email: String,
    phone: Option<String>,
    password: String,
    first_name: String,
    last_name: Option<String>,
    customer_type: Option<String>,
    company: Option<CompanyInput>,
}

fn normalize_phone(p: &str) -> String {
    p.chars().filter(|c| c.is_ascii_digit() || *c == '+').collect()
}

async fn register(State(state): State<AppState>, Json(body): Json<RegisterInput>) -> AppResult<Response> {
    let email = body.email.trim().to_lowercase();
    if !email.contains('@') || email.len() < 5 {
        return Err(AppError::unprocessable("invalid_email", "Укажите корректный e-mail"));
    }
    if body.first_name.trim().is_empty() {
        return Err(AppError::unprocessable("invalid_name", "Укажите имя"));
    }
    auth::validate_password(&body.password, &email, &body.first_name)?;
    let customer_type = match body.customer_type.as_deref() {
        Some("electrician") => "electrician",
        Some("purchaser") => "purchaser",
        _ => "retail",
    };
    let phone = body.phone.as_deref().map(normalize_phone).filter(|p| !p.is_empty());
    let exists: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE email = $1 OR ($2::text IS NOT NULL AND phone = $2)")
        .bind(&email)
        .bind(&phone)
        .fetch_optional(&state.pool)
        .await?;
    if exists.is_some() {
        return Err(AppError::conflict("already_registered", "Пользователь с таким e-mail или телефоном уже зарегистрирован"));
    }
    let hash = auth::hash_password(&body.password)?;
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
    .bind(body.first_name.trim())
    .bind(body.last_name.unwrap_or_default().trim())
    .bind(customer_type)
    .bind(company_id)
    .fetch_one(&mut *tx)
    .await?;
    outbox::enqueue(&mut tx, "crm", "user.registered", json!({ "user_id": user_id, "email": email, "phone": phone, "customer_type": customer_type, "company_id": company_id })).await?;
    tx.commit().await?;
    Ok((StatusCode::ACCEPTED, Json(json!({ "message": "Заявка отправлена на одобрение. Мы сообщим вам по e-mail, когда аккаунт будет активирован.", "user_id": user_id }))).into_response())
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
    let phone = normalize_phone(&login);
    let user = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE email = $1 OR (length($2) >= 7 AND phone = $2)")
        .bind(&login)
        .bind(&phone)
        .fetch_optional(&state.pool)
        .await?;
    let Some(user) = user else {
        return Err(AppError::new(StatusCode::UNAUTHORIZED, "invalid_credentials", "Неверный логин или пароль"));
    };
    if !auth::verify_password(&body.password, &user.password_hash) {
        return Err(AppError::new(StatusCode::UNAUTHORIZED, "invalid_credentials", "Неверный логин или пароль"));
    }
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

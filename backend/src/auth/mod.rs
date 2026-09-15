use std::sync::Arc;

use argon2::{
    password_hash::{phc::PasswordHash, PasswordHasher, PasswordVerifier},
    Argon2,
};
use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::UserRow,
    state::AppState,
};

pub const ACCESS_TTL_MIN: i64 = 15;
pub const REFRESH_TTL_DAYS: i64 = 30;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub role: String,
    pub iat: i64,
    pub exp: i64,
}

pub fn issue_access(secret: &str, user: &UserRow) -> AppResult<String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user.id,
        role: user.role.clone(),
        iat: now.timestamp(),
        exp: (now + Duration::minutes(ACCESS_TTL_MIN)).timestamp(),
    };
    encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .map_err(|e| AppError::internal(format!("jwt: {e}")))
}

pub fn verify_access(secret: &str, token: &str) -> Option<Claims> {
    let mut v = Validation::new(Algorithm::HS256);
    v.leeway = 5;
    decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &v)
        .ok()
        .map(|d| d.claims)
}

pub fn hash_password(password: &str) -> AppResult<String> {
    Argon2::default()
        .hash_password(password.as_bytes())
        .map(|h| h.to_string())
        .map_err(|e| AppError::internal(format!("hash: {e}")))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

pub fn sha256_hex(input: &str) -> String {
    hex::encode(Sha256::digest(input.as_bytes()))
}

pub fn new_refresh_token() -> String {
    // 256 bits of randomness, url-safe.
    let a = Uuid::new_v4().simple().to_string();
    let b = Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// Password policy from the contract:
/// ≥8 chars, latin letters + digits (a few punctuation chars tolerated), at least one letter and
/// one digit, must not contain the user name / email local part.
pub fn validate_password(password: &str, email: &str, first_name: &str) -> AppResult<()> {
    let err = |msg: &str| AppError::unprocessable("weak_password", msg);
    if password.chars().count() < 8 {
        return Err(err("Пароль должен содержать не менее 8 символов"));
    }
    let allowed = |c: char| c.is_ascii_alphanumeric() || "!@#$%^&*()_-+=.,:;?".contains(c);
    if !password.chars().all(allowed) {
        return Err(err("Допускаются только буквы латинского алфавита, цифры и знаки препинания"));
    }
    let has_letter = password.chars().any(|c| c.is_ascii_alphabetic());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    if !(has_letter && has_digit) {
        return Err(err("Пароль должен содержать как минимум одну букву и одну цифру"));
    }
    let lower = password.to_lowercase();
    let local = email.split('@').next().unwrap_or("").to_lowercase();
    if local.len() >= 3 && lower.contains(&local) {
        return Err(err("Пароль не должен содержать имя пользователя"));
    }
    let fname = first_name.trim().to_lowercase();
    if fname.len() >= 3 && lower.contains(&fname) {
        return Err(err("Пароль не должен содержать имя пользователя"));
    }
    Ok(())
}

pub async fn load_user(state: &AppState, id: Uuid) -> AppResult<Option<Arc<UserRow>>> {
    if let Some(u) = state.user_cache.get(&id).await {
        return Ok(Some(u));
    }
    let row = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?;
    match row {
        Some(u) => {
            let u = Arc::new(u);
            state.user_cache.insert(id, u.clone()).await;
            Ok(Some(u))
        }
        None => Ok(None),
    }
}

fn bearer(parts: &Parts) -> Option<&str> {
    parts
        .headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer ").or_else(|| v.strip_prefix("bearer ")))
        .map(str::trim)
        .filter(|t| !t.is_empty())
}

async fn user_from_parts(parts: &Parts, state: &AppState) -> AppResult<Option<Arc<UserRow>>> {
    let Some(token) = bearer(parts) else { return Ok(None) };
    let Some(claims) = verify_access(&state.cfg.jwt_secret, token) else {
        return Err(AppError::unauthorized());
    };
    let Some(user) = load_user(state, claims.sub).await? else {
        return Err(AppError::unauthorized());
    };
    if user.status == "blocked" {
        return Err(AppError::forbidden("account_blocked", "Аккаунт заблокирован"));
    }
    Ok(Some(user))
}

/// Mandatory authenticated user (approved).
pub struct AuthUser(pub Arc<UserRow>);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        match user_from_parts(parts, state).await? {
            Some(u) => {
                if u.status == "pending" {
                    return Err(AppError::forbidden("account_pending", "Аккаунт ожидает одобрения"));
                }
                Ok(AuthUser(u))
            }
            None => Err(AppError::unauthorized()),
        }
    }
}

/// Optional user: anonymous requests are allowed, invalid tokens are rejected.
pub struct OptionalUser(pub Option<Arc<UserRow>>);

impl FromRequestParts<AppState> for OptionalUser {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let u = user_from_parts(parts, state).await?;
        Ok(OptionalUser(u.filter(|u| u.status == "approved")))
    }
}

/// Manager or admin.
pub struct Manager(pub Arc<UserRow>);

impl FromRequestParts<AppState> for Manager {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let AuthUser(u) = AuthUser::from_request_parts(parts, state).await?;
        if !u.is_manager() {
            return Err(AppError::forbidden("forbidden", "Недостаточно прав"));
        }
        Ok(Manager(u))
    }
}

/// Identity used by the cart: optional user + optional guest token (`X-Cart-Token`).
pub struct CartIdentity {
    pub user: Option<Arc<UserRow>>,
    pub token: Option<Uuid>,
}

impl FromRequestParts<AppState> for CartIdentity {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let OptionalUser(user) = OptionalUser::from_request_parts(parts, state).await?;
        let token = parts
            .headers
            .get("x-cart-token")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| Uuid::parse_str(v.trim()).ok());
        Ok(CartIdentity { user, token })
    }
}

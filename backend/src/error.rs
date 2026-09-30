use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub code: String,
    pub message: String,
    pub details: Option<Value>,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(status: StatusCode, code: impl Into<String>, message: impl Into<String>) -> Self {
        Self { status, code: code.into(), message: message.into(), details: None }
    }
    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", message)
    }
    #[allow(dead_code)]
    pub fn bad_request(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message)
    }
    pub fn unprocessable(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNPROCESSABLE_ENTITY, code, message)
    }
    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "unauthorized", "Требуется авторизация")
    }
    pub fn forbidden(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, code, message)
    }
    pub fn conflict(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, code, message)
    }
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal_error", message)
    }
}

impl IntoResponse for AppError {
    fn into_response(mut self) -> Response {
        if self.status.is_server_error() {
            tracing::error!(code = %self.code, message = %self.message, "request failed");
            // подробности — только в лог: наружу не уходят тексты ошибок библиотек
            if self.code == "internal_error" && !self.message.chars().next().is_some_and(|c| ('А'..='я').contains(&c)) {
                self.message = "Внутренняя ошибка сервера".into();
            }
        }
        let body = json!({
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details.unwrap_or(Value::Null),
            }
        });
        (self.status, Json(body)).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        match e {
            sqlx::Error::RowNotFound => AppError::not_found("Не найдено"),
            // уникальность и внешние ключи — ошибка запроса клиента, а не сервера
            sqlx::Error::Database(ref db) if db.code().as_deref() == Some("23505") => {
                AppError::conflict("already_exists", "Такие данные уже используются (e-mail, телефон или код)")
            }
            sqlx::Error::Database(ref db) if db.code().as_deref() == Some("23503") => {
                AppError::unprocessable("invalid_reference", "Связанная запись не найдена")
            }
            other => {
                tracing::error!(error = %other, "database error");
                AppError::internal("Ошибка базы данных")
            }
        }
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        tracing::error!(error = %e, "internal error");
        AppError::internal("Внутренняя ошибка сервера")
    }
}

impl From<rust_xlsxwriter::XlsxError> for AppError {
    fn from(e: rust_xlsxwriter::XlsxError) -> Self {
        tracing::error!(error = %e, "xlsx error");
        AppError::internal("Не удалось сформировать документ")
    }
}

/// Ошибки фреймворка (невалидный JSON, неизвестный маршрут, неверный Content-Type) приходят текстом —
/// приводим их к общему формату `{ "error": { code, message, details } }`.
pub async fn json_error_envelope(resp: Response) -> Response {
    let status = resp.status();
    let is_json = resp
        .headers()
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("application/json"));
    if !(status.is_client_error() || status.is_server_error()) || is_json || status == StatusCode::NOT_MODIFIED {
        return resp;
    }
    let (code, message) = match status {
        StatusCode::NOT_FOUND => ("not_found", "Не найдено"),
        StatusCode::METHOD_NOT_ALLOWED => ("method_not_allowed", "Метод не поддерживается"),
        StatusCode::PAYLOAD_TOO_LARGE => ("payload_too_large", "Слишком большой запрос"),
        StatusCode::UNSUPPORTED_MEDIA_TYPE => ("unsupported_media_type", "Ожидается JSON (Content-Type: application/json)"),
        StatusCode::REQUEST_TIMEOUT => ("timeout", "Сервер не успел ответить"),
        StatusCode::TOO_MANY_REQUESTS => ("rate_limited", "Слишком много запросов — попробуйте через минуту"),
        s if s.is_server_error() => ("internal_error", "Внутренняя ошибка сервера"),
        _ => ("invalid_request", "Некорректный запрос"),
    };
    let mut out = AppError::new(status, code, message).into_response();
    if let Some(v) = resp.headers().get(axum::http::header::RETRY_AFTER) {
        out.headers_mut().insert(axum::http::header::RETRY_AFTER, v.clone());
    }
    out
}

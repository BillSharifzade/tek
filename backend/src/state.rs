use std::{sync::Arc, time::Duration};

use axum::{
    body::Bytes,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use moka::future::Cache;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{config::Config, error::AppResult, models::UserRow};

#[derive(Clone)]
pub struct CachedBody {
    pub body: Bytes,
    pub etag: String,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
    /// Public, anonymous JSON responses keyed by a logical cache key.
    pub cache: Cache<String, CachedBody>,
    /// Short-lived user cache (auth extractor hot path).
    pub user_cache: Cache<Uuid, Arc<UserRow>>,
    pub http: reqwest::Client,
    pub limiter: crate::services::ratelimit::Limiter,
    /// SMTP (None — не настроен: письма mock вне production / ждут в очереди в production)
    pub mailer: Option<crate::services::mail::Mailer>,
    pub version: &'static str,
}

impl AppState {
    pub fn new(pool: PgPool, cfg: Config) -> Self {
        let mailer = crate::services::mail::Mailer::from_config(&cfg);
        Self {
            pool,
            cfg: Arc::new(cfg),
            cache: Cache::builder()
                .max_capacity(10_000)
                .time_to_live(Duration::from_secs(60))
                .build(),
            user_cache: Cache::builder()
                .max_capacity(50_000)
                .time_to_live(Duration::from_secs(20))
                .build(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("http client"),
            limiter: Default::default(),
            mailer,
            version: env!("CARGO_PKG_VERSION"),
        }
    }

    /// Drop all catalog/home caches (called after writes that affect public data).
    pub fn invalidate_public(&self) {
        self.cache.invalidate_all();
    }

    pub async fn invalidate_user(&self, id: Uuid) {
        self.user_cache.invalidate(&id).await;
    }

    /// Serve a public JSON payload from the in-memory cache (with ETag / Cache-Control),
    /// computing it with `f` on a miss.
    pub async fn cached_json<T, F, Fut>(&self, key: String, req_headers: &HeaderMap, f: F) -> AppResult<Response>
    where
        T: Serialize,
        F: FnOnce(AppState) -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        // одновременные промахи по одному ключу считаются один раз (moka try_get_with)
        let state = self.clone();
        let entry = self
            .cache
            .try_get_with(key, async move {
                let value = f(state).await?;
                let body = Bytes::from(serde_json::to_vec(&value).map_err(|e| crate::error::AppError::internal(e.to_string()))?);
                let etag = format!("\"{}\"", hex::encode(&<sha2::Sha256 as sha2::Digest>::digest(&body)[..8]));
                Ok::<_, crate::error::AppError>(CachedBody { body, etag })
            })
            .await
            .map_err(|e| crate::error::AppError::new(e.status, e.code.clone(), e.message.clone()).with_details(e.details.clone().unwrap_or_default()))?;
        if let Some(inm) = req_headers.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) {
            if inm == entry.etag {
                return Ok(StatusCode::NOT_MODIFIED.into_response());
            }
        }
        Ok(json_bytes_response(entry.body, Some(&entry.etag)))
    }
}

pub fn json_bytes_response(body: Bytes, etag: Option<&str>) -> Response {
    let mut resp = (StatusCode::OK, body).into_response();
    let h = resp.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=60"));
    if let Some(tag) = etag {
        if let Ok(v) = HeaderValue::from_str(tag) {
            h.insert(header::ETAG, v);
        }
    }
    resp
}

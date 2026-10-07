//! Лимиты запросов по IP для форм и входа (подбор паролей, спам заявками/отзывами).
//! Считаются только изменяющие запросы из браузера — серверный рендер Next (GET) не ограничивается.

use std::{
    net::SocketAddr,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use moka::sync::Cache;

use crate::{error::AppError, state::AppState};

/// (метод, путь без /api/v1, как сопоставлять, запросов, окно в секундах)
const RULES: &[(Method, &str, Match, u32, u64)] = &[
    (Method::POST, "/auth/login", Match::Exact, 10, 60),
    (Method::POST, "/auth/register", Match::Exact, 5, 600),
    (Method::POST, "/auth/refresh", Match::Exact, 60, 60),
    (Method::PUT, "/account/password", Match::Exact, 5, 600),
    (Method::POST, "/leads", Match::Exact, 5, 600),
    (Method::POST, "/checkout", Match::Exact, 10, 600),
    (Method::POST, "/cart/share", Match::Exact, 20, 600),
    (Method::POST, "/cart/coupon", Match::Exact, 20, 600),
    (Method::POST, "/reviews", Match::Suffix, 10, 600),
    (Method::POST, "/questions", Match::Suffix, 10, 600),
    (Method::POST, "/payments/", Match::Prefix, 30, 60),
];

#[derive(Clone, Copy)]
enum Match {
    Exact,
    Prefix,
    Suffix,
}

#[derive(Clone)]
pub struct Limiter {
    hits: Cache<String, Arc<AtomicU32>>,
}

impl Default for Limiter {
    fn default() -> Self {
        Self { hits: Cache::builder().max_capacity(200_000).time_to_live(Duration::from_secs(600)).build() }
    }
}

fn client_ip(req: &Request, trust_proxy: bool, header: &str) -> String {
    if trust_proxy {
        // правый адрес списка добавил наш reverse proxy — его клиент подделать не может
        if let Some(ip) = req
            .headers()
            .get(header)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.rsplit(',').next())
            .map(str::trim)
            .filter(|v| !v.is_empty())
        {
            return ip.to_string();
        }
    }
    req.extensions().get::<ConnectInfo<SocketAddr>>().map(|c| c.0.ip().to_string()).unwrap_or_else(|| "unknown".into())
}

pub async fn middleware(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let path = req.uri().path().strip_prefix("/api/v1").unwrap_or(req.uri().path()).to_string();
    let rule = RULES.iter().enumerate().find(|(_, (m, p, how, ..))| {
        req.method() == m
            && match how {
                Match::Exact => path == *p,
                Match::Prefix => path.starts_with(p),
                Match::Suffix => path.ends_with(p),
            }
    });
    let Some((idx, (_, _, _, limit, window))) = rule else {
        return next.run(req).await;
    };
    let ip = client_ip(&req, state.cfg.trust_proxy, &state.cfg.client_ip_header);
    // локальные тесты (smoke/e2e) вне production не ограничиваем
    if !state.cfg.production && (ip == "127.0.0.1" || ip == "::1") {
        return next.run(req).await;
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let key = format!("{idx}:{ip}:{}", now / window);
    let counter = state.limiter.hits.get_with(key, || Arc::new(AtomicU32::new(0)));
    if counter.fetch_add(1, Ordering::Relaxed) >= *limit {
        let mut resp = AppError::new(StatusCode::TOO_MANY_REQUESTS, "rate_limited", "Слишком много попыток — попробуйте немного позже").into_response();
        let retry = window - now % window;
        if let Ok(v) = HeaderValue::from_str(&retry.to_string()) {
            resp.headers_mut().insert(header::RETRY_AFTER, v);
        }
        return resp;
    }
    next.run(req).await
}

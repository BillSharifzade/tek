mod auth;
mod config;
mod error;
mod models;
mod routes;
mod seed;
mod services;
mod state;

use std::time::Duration;

use axum::{
    extract::DefaultBodyLimit,
    http::{header, HeaderName, HeaderValue, Method},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::{
    catch_panic::CatchPanicLayer,
    compression::CompressionLayer,
    cors::{AllowOrigin, Any, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use crate::{config::Config, state::AppState};

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = Config::from_env();
    // служебные команды: `tek-api healthcheck` (HEALTHCHECK контейнера), `tek-api set-password <email>` (пароль из NEW_PASSWORD),
    // `tek-api import <файл.xlsx|файл.csv> [--dry-run]` (импорт каталога, отчёт — JSON в stdout)
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("healthcheck") => {
            let url = format!("http://127.0.0.1:{}/api/v1/health", cfg.bind.port());
            let ok = reqwest::Client::new().get(url).timeout(Duration::from_secs(3)).send().await.map(|r| r.status().is_success()).unwrap_or(false);
            std::process::exit(if ok { 0 } else { 1 });
        }
        Some("set-password") => return cli_set_password(&cfg, args.get(2).map(String::as_str)).await,
        Some("import") => return cli_import(&cfg, &args[2..]).await,
        _ => {}
    }
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,tower_http=info")))
        .with(fmt::layer().compact())
        .init();
    if let Err(problems) = cfg.validate() {
        tracing::error!("небезопасная конфигурация для APP_ENV=production:\n{problems}");
        std::process::exit(2);
    }

    let pool = PgPoolOptions::new()
        .max_connections(cfg.db_max_connections)
        .min_connections(4)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&cfg.database_url)
        .await?;
    tracing::info!("connected to postgres");

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("migrations applied");

    let seeded = seed::run(&pool, cfg.seed).await?;
    if seeded {
        tracing::info!(mode = ?cfg.seed, "database seeded");
    }
    // досев контента и группировка торговых предложений — только для базы из сида, не для выгрузки 1С
    if cfg.seed != config::SeedMode::Off {
        seed::enrich(&pool).await?;
    }
    seed::bootstrap_admin(&pool, &cfg).await?;

    let state = AppState::new(pool, cfg.clone());
    services::outbox::spawn_worker(state.clone());

    let cors = if cfg.cors_origins.iter().any(|o| o == "*") {
        CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any).expose_headers(Any)
    } else {
        let origins: Vec<HeaderValue> = cfg.cors_origins.iter().filter_map(|o| HeaderValue::from_str(o).ok()).collect();
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE, Method::OPTIONS])
            .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, HeaderName::from_static("x-cart-token")])
            .expose_headers([header::CONTENT_DISPOSITION, header::ETAG])
            .allow_credentials(true)
            .max_age(Duration::from_secs(3600))
    };

    let x_request_id = HeaderName::from_static("x-request-id");
    let app = Router::new()
        .nest("/api/v1", routes::api())
        .fallback(|| async { error::AppError::not_found("Не найдено") })
        .layer(axum::middleware::from_fn_with_state(state.clone(), services::ratelimit::middleware))
        .layer(axum::middleware::map_response(error::json_error_envelope))
        .with_state(state)
        .layer(
            tower::ServiceBuilder::new()
                .layer(SetRequestIdLayer::new(x_request_id.clone(), MakeRequestUuid))
                .layer(TraceLayer::new_for_http())
                .layer(CatchPanicLayer::new())
                // таймаут запроса (30 с, импорт каталога — 10 мин) — в routes::api()
                .layer(CompressionLayer::new())
                .layer(cors)
                .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
                .layer(PropagateRequestIdLayer::new(x_request_id))
                .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
                .layer(SetResponseHeaderLayer::if_not_present(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
                .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer"))),
        );

    let listener = tokio::net::TcpListener::bind(cfg.bind).await?;
    tracing::info!(addr = %cfg.bind, "tek-api listening");
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Смена пароля пользователя из консоли сервера (восстановления по e-mail пока нет):
/// `NEW_PASSWORD='…' tek-api set-password user@example.com` — все сессии пользователя завершаются.
async fn cli_set_password(cfg: &Config, email: Option<&str>) -> anyhow::Result<()> {
    let email = email.map(|e| e.trim().to_lowercase()).filter(|e| e.contains('@')).ok_or_else(|| anyhow::anyhow!("usage: NEW_PASSWORD=... tek-api set-password <email>"))?;
    let password = std::env::var("NEW_PASSWORD").ok().filter(|p| p.len() >= 10).ok_or_else(|| anyhow::anyhow!("NEW_PASSWORD must be set (at least 10 characters)"))?;
    let pool = PgPoolOptions::new().max_connections(1).connect(&cfg.database_url).await?;
    let hash = auth::hash_password(&password).map_err(|e| anyhow::anyhow!(e.message))?;
    let id: Option<uuid::Uuid> = sqlx::query_scalar("UPDATE users SET password_hash = $2 WHERE email = $1 RETURNING id").bind(&email).bind(hash).fetch_optional(&pool).await?;
    let Some(id) = id else { anyhow::bail!("user {email} not found") };
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1").bind(id).execute(&pool).await?;
    println!("password updated for {email}");
    Ok(())
}

/// Импорт каталога из консоли сервера (как `POST /admin/import/catalog`): `tek-api import catalog.xlsx [--dry-run]`.
/// Кэш публичных ответов работающего API обновится сам за минуту.
async fn cli_import(cfg: &Config, args: &[String]) -> anyhow::Result<()> {
    let dry_run = args.iter().any(|a| a == "--dry-run");
    let path = args.iter().find(|a| !a.starts_with("--")).ok_or_else(|| anyhow::anyhow!("usage: tek-api import <file.xlsx|file.csv> [--dry-run]"))?;
    let bytes = std::fs::read(path).map_err(|e| anyhow::anyhow!("{path}: {e}"))?;
    let pool = PgPoolOptions::new().max_connections(2).connect(&cfg.database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    let table = services::import::parse_file(path, &bytes).map_err(|e| anyhow::anyhow!("{}", e.message))?;
    let summary = services::import::run(&pool, table, dry_run).await.map_err(|e| anyhow::anyhow!("{}", e.message))?;
    println!("{}", serde_json::to_string_pretty(&summary)?);
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}

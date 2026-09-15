use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub bind: SocketAddr,
    pub jwt_secret: String,
    pub cors_origins: Vec<String>,
    pub crm_webhook_url: Option<String>,
    pub onec_webhook_url: Option<String>,
    /// Public URL of the storefront (used for share links).
    pub frontend_url: String,
    pub db_max_connections: u32,
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

impl Config {
    pub fn from_env() -> Self {
        let _ = dotenvy::dotenv();
        Self {
            database_url: env_or("DATABASE_URL", "postgres://tek:tek@127.0.0.1:5433/tek"),
            bind: env_or("BIND", "127.0.0.1:8181").parse().expect("BIND must be host:port"),
            jwt_secret: env_or("JWT_SECRET", "tek-dev-secret-change-me-please-0123456789"),
            cors_origins: env_or("CORS_ORIGINS", "*")
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            crm_webhook_url: std::env::var("CRM_WEBHOOK_URL").ok().filter(|v| !v.is_empty()),
            onec_webhook_url: std::env::var("ONEC_WEBHOOK_URL").ok().filter(|v| !v.is_empty()),
            frontend_url: env_or("FRONTEND_URL", "http://127.0.0.1:3010"),
            db_max_connections: env_or("DB_MAX_CONNECTIONS", "32").parse().unwrap_or(32),
        }
    }
}

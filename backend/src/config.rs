use std::net::SocketAddr;

/// Что заливать в пустую базу при первом старте.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeedMode {
    /// каталог + контент + демо-аккаунты с известными паролями, заказы, отзывы, купоны (только для разработки)
    Full,
    /// каталог и контент сайта без демо-аккаунтов, заказов, отзывов и купонов
    Catalog,
    /// ничего — данные приходят из 1С / вручную
    Off,
}

#[derive(Debug, Clone)]
pub struct Config {
    /// APP_ENV=production: строгая проверка настроек, без демо-данных и заглушек оплаты/интеграций
    pub production: bool,
    pub seed: SeedMode,
    /// первый администратор (production): создаётся при старте, если в базе нет ни одного admin
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    /// заглушки онлайн-оплаты (Алиф / ДС): callback без подписи и способы оплаты в чекауте — только вне production
    pub payments_mock: bool,
    /// доверять X-Forwarded-For (API за reverse proxy) — для лимитов по IP
    pub trust_proxy: bool,
    /// заголовок с IP клиента от reverse proxy (берётся правый адрес списка)
    pub client_ip_header: String,
    /// демо-стенд: в production разрешён SEED_DEMO=full (пароли демо-аккаунтов сразу меняются `tek-api set-password`)
    pub demo_stand: bool,
    pub database_url: String,
    pub bind: SocketAddr,
    pub jwt_secret: String,
    pub cors_origins: Vec<String>,
    pub crm_webhook_url: Option<String>,
    pub onec_webhook_url: Option<String>,
    /// Public URL of the storefront (used for share links).
    pub frontend_url: String,
    pub db_max_connections: u32,
    /// SMTP для писем: `smtps://user:pass@smtp.example.com:465` или `smtp://user:pass@host:587?tls=required`;
    /// не задан — вне production письма помечаются отправленными (mock), в production копятся в очереди
    pub smtp_url: Option<String>,
    /// отправитель писем: `ТЭК <noreply@tec.tj>`
    pub mail_from: String,
    /// куда уведомлять о заказах, регистрациях и заявках, если у клиента нет закреплённого менеджера
    /// (иначе — лид-менеджеру)
    pub manager_notify_email: Option<String>,
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

const DEV_JWT_SECRET: &str = "tek-dev-secret-change-me-please-0123456789";

fn flag(key: &str, default: bool) -> bool {
    match std::env::var(key).ok().map(|v| v.trim().to_lowercase()) {
        Some(v) if ["1", "true", "yes", "on"].contains(&v.as_str()) => true,
        Some(v) if ["0", "false", "no", "off"].contains(&v.as_str()) => false,
        _ => default,
    }
}

impl Config {
    pub fn from_env() -> Self {
        let _ = dotenvy::dotenv();
        let production = env_or("APP_ENV", "development") == "production";
        let seed = match env_or("SEED_DEMO", if production { "off" } else { "full" }).to_lowercase().as_str() {
            "full" | "true" | "1" => SeedMode::Full,
            "catalog" => SeedMode::Catalog,
            _ => SeedMode::Off,
        };
        Self {
            production,
            seed,
            admin_email: std::env::var("ADMIN_EMAIL").ok().map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()),
            admin_password: std::env::var("ADMIN_PASSWORD").ok().filter(|v| !v.is_empty()),
            payments_mock: flag("PAYMENTS_MOCK", !production),
            trust_proxy: flag("TRUST_PROXY", production),
            demo_stand: flag("DEMO_STAND", false),
            client_ip_header: env_or("CLIENT_IP_HEADER", "x-forwarded-for").to_lowercase(),
            database_url: env_or("DATABASE_URL", "postgres://tek:tek@127.0.0.1:5433/tek"),
            bind: env_or("BIND", "127.0.0.1:8181").parse().expect("BIND must be host:port"),
            jwt_secret: env_or("JWT_SECRET", DEV_JWT_SECRET),
            cors_origins: env_or("CORS_ORIGINS", "*")
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            crm_webhook_url: std::env::var("CRM_WEBHOOK_URL").ok().filter(|v| !v.is_empty()),
            onec_webhook_url: std::env::var("ONEC_WEBHOOK_URL").ok().filter(|v| !v.is_empty()),
            frontend_url: env_or("FRONTEND_URL", "http://127.0.0.1:3010"),
            db_max_connections: env_or("DB_MAX_CONNECTIONS", "32").parse().unwrap_or(32),
            smtp_url: std::env::var("SMTP_URL").ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty()),
            mail_from: env_or("MAIL_FROM", "ТЭК <noreply@tec.tj>"),
            manager_notify_email: std::env::var("MANAGER_NOTIFY_EMAIL").ok().map(|v| v.trim().to_lowercase()).filter(|v| v.contains('@')),
        }
    }

    /// В production не стартуем с небезопасными настройками — лучше упасть при деплое, чем работать с ними.
    pub fn validate(&self) -> Result<(), String> {
        if !self.production {
            return Ok(());
        }
        let mut errors = Vec::new();
        if self.jwt_secret == DEV_JWT_SECRET || self.jwt_secret.len() < 32 {
            errors.push("JWT_SECRET: задайте случайную строку не короче 32 символов (openssl rand -hex 32)");
        }
        if self.cors_origins.is_empty() || self.cors_origins.iter().any(|o| o == "*" || o.contains("localhost") || o.contains("127.0.0.1")) {
            errors.push("CORS_ORIGINS: укажите публичный адрес сайта, например https://tec.tj");
        }
        if !self.frontend_url.starts_with("https://") {
            errors.push("FRONTEND_URL: укажите публичный https-адрес сайта");
        }
        if self.payments_mock && !self.demo_stand {
            errors.push("PAYMENTS_MOCK: заглушка оплаты принимает callback без подписи — любой мог бы отметить заказ оплаченным; в production запрещена (кроме DEMO_STAND=true)");
        }
        if self.seed == SeedMode::Full && !self.demo_stand {
            errors.push("SEED_DEMO=full создаёт демо-аккаунты с известными паролями — в production допустимо только catalog или off (или DEMO_STAND=true для демо-стенда)");
        }
        if let Some(p) = &self.admin_password {
            if p.len() < 12 {
                errors.push("ADMIN_PASSWORD: не короче 12 символов");
            }
        }
        if let Err(e) = crate::services::mail::check_config(self) {
            errors.push(e);
        }
        if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) }
    }
}

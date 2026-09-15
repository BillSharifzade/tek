# tek-api — бэкенд маркетплейса ТЭК (Rust / Axum)

Реализует контракт из [`../docs/API.md`](../docs/API.md). Слушает `127.0.0.1:8181`, префикс `/api/v1`.

## Стек

* **axum 0.8** + tokio, **sqlx 0.9** (Postgres, без макросов — `query_as::<_, T>`), **moka** (in-memory кэш публичных ответов, TTL 60 c, ETag / `Cache-Control: public, max-age=60`, 304 по `If-None-Match`),
  **mimalloc**, tower-http (brotli/gzip/zstd compression, CORS, timeout 30 s, request-id, catch-panic, tracing),
  **argon2** (пароли), **jsonwebtoken** HS256 (access 15 мин, refresh 30 дней с ротацией, хранится sha256),
  **rust_xlsxwriter** (сметы, акт сверки, детализация бонусов), release-профиль с fat LTO.
* Ценообразование: `list_price` для гостей; для авторизованных — самое специфичное правило
  `user_price_rules` (товар → бренд → ближайшая категория) → скидка/кешбэк аккаунта. `sale_price` заменяет прайс, персональная скидка применяется сверху.
* Интеграции: таблица `integration_outbox` + фоновый воркер (каждые 5 c) → `CRM_WEBHOOK_URL` / `ONEC_WEBHOOK_URL`; без URL события помечаются `sent, mock=true`.
  Заказ маршрутизируется закреплённому менеджеру, иначе лид-менеджеру (`users.is_lead_manager`).

## Запуск

```bash
# Postgres (из корня репозитория)
docker compose up -d            # postgres:18 на 127.0.0.1:5433 (tek/tek)

cd backend
cp .env.example .env            # при необходимости отредактируйте
./scripts/dev.sh                # = cargo run --release, миграции и сид применяются автоматически
```

Миграции: `migrations/*.sql` (`sqlx::migrate!`). Сид (`src/seed.rs`) выполняется один раз, когда таблица `products` пуста:
~350 товаров по реальному дереву каталога tectj.com, 19 брендов, 3 склада, документы, комплектующие, отзывы/вопросы,
баннеры, услуги, проекты, новости, страницы, конфигураторы, тестовые аккаунты и история заказов клиента.

Полный сброс данных: `docker compose down -v && docker compose up -d`.

## Тестовые аккаунты

| Логин | Пароль | Роль |
|---|---|---|
| `admin@tec.tj` | `Admin1234` | admin |
| `manager@tec.tj` | `Manager1234` | лид-менеджер (Абдурахим Фозилов) |
| `client@tec.tj` | `Client1234` | B2B закупщик, ООО «Точикэлектрокомплект», скидка 10 % / кешбэк 3 % (+15 %/5 % на кабеленесущие системы), 8 заказов, акт сверки 69 069,00 с. (просрочено 69,00 с.) |
| `electric@tec.tj` | `Electric1234` | электрик, 5 % / 2 % (+8 %/3 % на ДКС) |
| `pending@tec.tj` | `Pending1234` | ожидает одобрения → `403 account_pending` |

Купоны: `TEK10` (−10 %), `WELCOME50` (−50 с. от 500 с.).

## Скрипты

| Команда | Что делает |
|---|---|
| `./scripts/dev.sh` | запуск в release-режиме с переменными из `.env` |
| `./scripts/smoke.sh [base_url]` | сквозной smoke-тест всех эндпоинтов (89 проверок) |
| `cargo check` / `cargo build --release` | сборка |
| `oha -z 10s -c 64 http://127.0.0.1:8181/api/v1/home` | нагрузочный тест |

## Структура

```
src/
  main.rs            сборка приложения, middleware, graceful shutdown
  config.rs          env → Config
  state.rs           PgPool, moka-кэши, cached_json (ETag)
  error.rs           AppError → {"error":{code,message,details}}
  models.rs          строки БД и JSON-типы (Price, ProductCard, Cart, Order…)
  seed.rs            детерминированный сид
  auth/mod.rs        JWT, argon2, экстракторы AuthUser / OptionalUser / Manager / CartIdentity, политика паролей
  routes/            home, catalog, brands, content, auth, cart, checkout(+payments, orders), account, admin, documents
  services/          pricing, catalog, cart, orders (checkout/cancel/edit/status/paid), ledger (акт сверки, бонусы),
                     delivery (даты, «Сегодня/Завтра/Пятница»), excel, outbox worker, pdf (заглушки документов)
migrations/0001_schema.sql
scripts/dev.sh, scripts/smoke.sh
```

## Бенчмарк (release, 16 ядер, oha -c 64)

| Эндпоинт | req/s | p50 | p99 |
|---|---|---|---|
| `GET /catalog/products?category=kabelnye-lotki-dks` (гость, кэш) | ~37 500 | 1.6 ms | 3.9 ms |
| `GET /home` (гость, кэш, ~52 KB) | ~12 400 | 5.1 ms | 9.6 ms |
| `GET /catalog/products?...` с токеном (персональные цены, без кэша, Postgres) | ~2 600 | 24 ms | 33 ms |

# tek-api — бэкенд маркетплейса ТЭК (Rust / Axum)

Реализует контракт из [`../docs/API.md`](../docs/API.md). Слушает `127.0.0.1:8181`, префикс `/api/v1`.

## Стек

* **axum 0.8** + tokio, **sqlx 0.9** (Postgres, без макросов — `query_as::<_, T>`), **moka** (in-memory кэш публичных ответов, TTL 60 c, ETag / `Cache-Control: public, max-age=60`, 304 по `If-None-Match`),
  **mimalloc**, tower-http (brotli/gzip/zstd compression, CORS, timeout 30 s, request-id, catch-panic, tracing),
  **argon2** (пароли), **jsonwebtoken** HS256 (access 15 мин, refresh 30 дней с ротацией, хранится sha256),
  **rust_xlsxwriter** (сметы, акт сверки, детализация бонусов, счёт на оплату, шаблон импорта), **calamine** (чтение Excel при импорте каталога),
  **lettre** (SMTP, rustls) — письма клиентам и менеджерам.
* Ценообразование: `list_price` для гостей; для авторизованных — самое специфичное правило
  `user_price_rules` (товар → бренд → ближайшая категория) → скидка/кешбэк аккаунта. `sale_price` заменяет прайс, персональная скидка применяется сверху.
* Интеграции: таблица `integration_outbox` + фоновый воркер (каждые 5 c) → `CRM_WEBHOOK_URL` / `ONEC_WEBHOOK_URL`; события одного заказа
  уходят по порядку, повторы с паузой до 6 ч (12 попыток). Без URL: вне production события помечаются `sent, mock=true`, в production копятся в очереди.
* Оплата: онлайн (Алиф / ДС — заглушка, только `PAYMENTS_MOCK` вне production), наличными (оплачено при «Доставлен»), по счёту
  (срок — 3 рабочих дня; поступление вносит менеджер: `POST /admin/orders/{n}/payments`). Акт сверки: заказ компании — дебет, оплаты — кредит,
  изменение / отмена заказа — корректировки.
* Телефон — логин наравне с e-mail (e-mail при регистрации не обязателен); хранится как `+992XXXXXXXXX`.
  Заказ маршрутизируется закреплённому менеджеру, иначе лид-менеджеру (`users.is_lead_manager`); менеджер может передать его другому.
* Панель менеджера `/api/v1/admin/*` (экстракторы `Manager` / `Admin`): пользователи, заказы, заявки, модерация, промокоды, товары,
  импорт каталога из Excel / CSV (только администратор, формат — [`../docs/IMPORT.md`](../docs/IMPORT.md)). Снятый с продажи товар
  (`products.is_active = false`) не виден на витрине и не добавляется в корзину.
* Письма: шаблоны — `services/mail.rs`, ставятся в `integration_outbox` (target `email`) в транзакции события, отправляет воркер
  outbox через SMTP. Без `SMTP_URL`: вне production — `sent, mock=true`, в production ждут в очереди.

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

## Переменные окружения для писем

| Переменная | Пример | Что делает |
|---|---|---|
| `SMTP_URL` | `smtps://user:pass@smtp.example.com:465` или `smtp://user:pass@smtp.example.com:587?tls=required` | SMTP-сервер (спецсимволы пароля — в URL-кодировке). Не задан — письма mock (вне production) / в очереди (production) |
| `MAIL_FROM` | `ТЭК <noreply@tec.tj>` | отправитель (по умолчанию — этот) |
| `MANAGER_NOTIFY_EMAIL` | `sales@tec.tj` | куда писать о заказах, регистрациях и заявках клиентов без закреплённого менеджера (иначе — лид-менеджеру) |

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
| `./scripts/smoke.sh [base_url]` | сквозной smoke-тест эндпоинтов (≈190 проверок, включая панель менеджера и импорт; нужен сид `SEED_DEMO=full`) |
| `cargo test` | юнит-тесты (поиск, торговые предложения, рабочие дни, разбор файла импорта, форматы писем) |
| `tek-api import <файл.xlsx\|.csv> [--dry-run]` | импорт каталога из консоли (отчёт — JSON), см. `docs/IMPORT.md` |
| `NEW_PASSWORD=… tek-api set-password <email>` | смена пароля пользователя |
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
  routes/            home, catalog, brands, content, auth, cart, checkout(+payments, orders), account, documents,
                     admin (пользователи, заказы, заявки, модерация), admin_catalog (промокоды, товары, импорт каталога)
  services/          pricing, catalog, cart, orders (checkout/cancel/edit/status/paid/payments), ledger (акт сверки, бонусы),
                     delivery (даты, «Сегодня/Завтра/Пятница», рабочие дни), excel, outbox worker (CRM / 1С / e-mail), pdf (заглушки документов),
                     ratelimit (лимиты по IP), search (нормализация запроса), variants (торговые предложения),
                     import (импорт каталога из Excel / CSV, шаблон), mail (SMTP и шаблоны писем)
migrations/0001_schema.sql … 0004_hardening.sql, 0005_outbox_order.sql (порядок событий заказа),
           0006_r1.sql (доработки R1: e-mail не обязателен, магазины, фото категорий, телефоны),
           0007_r2.sql (доработки R2: лишние услуги удалены, «Для проектировщиков», тексты оплаты/возврата)
           0008_landing.sql (макет лендинга 06.10: разделы «Инструменты», «Солнечная энергетика», «Электромонтажная продукция», тексты преимуществ)
           0009_admin.sql (панель: статус и заметка заявок, products.is_active, индексы списков)
scripts/dev.sh, scripts/smoke.sh
```

## Бенчмарк (release, 16 ядер, oha -c 64)

| Эндпоинт | req/s | p50 | p99 |
|---|---|---|---|
| `GET /catalog/products?category=kabelnye-lotki-dks` (гость, кэш) | ~37 500 | 1.6 ms | 3.9 ms |
| `GET /home` (гость, кэш, ~52 KB) | ~12 400 | 5.1 ms | 9.6 ms |
| `GET /catalog/products?...` с токеном (персональные цены, без кэша, Postgres) | ~2 600 | 24 ms | 33 ms |

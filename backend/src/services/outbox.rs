use std::time::Duration;

use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};

use crate::{error::AppResult, state::AppState};

/// Queue an integration event (CRM / 1C) inside the caller's transaction.
pub async fn enqueue(tx: &mut Transaction<'_, Postgres>, target: &str, event: &str, payload: Value) -> AppResult<()> {
    sqlx::query("INSERT INTO integration_outbox (target, event, payload) VALUES ($1, $2, $3)")
        .bind(target)
        .bind(event)
        .bind(payload)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

#[allow(dead_code)]
pub async fn enqueue_pool(pool: &PgPool, target: &str, event: &str, payload: Value) -> AppResult<()> {
    sqlx::query("INSERT INTO integration_outbox (target, event, payload) VALUES ($1, $2, $3)")
        .bind(target)
        .bind(event)
        .bind(payload)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct Pending {
    id: i64,
    target: String,
    event: String,
    payload: Value,
    attempts: i32,
}

/// Фоновый доставщик событий (каждые 5 с) и ночная уборка устаревших данных (раз в час).
/// Без адреса вебхука: вне production событие помечается `sent` с `mock = true`; в production остаётся в очереди
/// до настройки CRM_WEBHOOK_URL / ONEC_WEBHOOK_URL — заказы не теряются.
pub fn spawn_worker(state: AppState) {
    let s = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            if let Err(e) = tick(&s).await {
                tracing::warn!(error = %e.message, "outbox tick failed");
            }
        }
    });
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(3600));
        loop {
            interval.tick().await;
            if let Err(e) = cleanup(&state.pool).await {
                tracing::warn!(error = %e.message, "cleanup failed");
            }
        }
    });
}

/// Пустые гостевые корзины старше 30 дней, брошенные гостевые старше 90, истёкшие refresh-токены,
/// ссылки «поделиться корзиной» старше 90 дней.
async fn cleanup(pool: &PgPool) -> AppResult<()> {
    let carts = sqlx::query(
        r#"DELETE FROM carts c WHERE c.user_id IS NULL AND (
             (c.updated_at < now() - interval '30 days' AND NOT EXISTS (SELECT 1 FROM cart_items i WHERE i.cart_id = c.id))
             OR c.updated_at < now() - interval '90 days')"#,
    )
    .execute(pool)
    .await?
    .rows_affected();
    let tokens = sqlx::query("DELETE FROM refresh_tokens WHERE expires_at < now()").execute(pool).await?.rows_affected();
    let shares = sqlx::query("DELETE FROM cart_shares WHERE created_at < now() - interval '90 days'").execute(pool).await?.rows_affected();
    if carts + tokens + shares > 0 {
        tracing::info!(carts, tokens, shares, "cleanup");
    }
    Ok(())
}

/// Пауза перед повтором: 30 с, 1 мин, 2 мин … до 6 ч; после 12 попыток (~сутки) — `failed` с ошибкой в логе.
fn backoff_secs(attempts: i32) -> i64 {
    (30_i64 << attempts.clamp(0, 10)).min(6 * 3600)
}

const MAX_ATTEMPTS: i32 = 12;

async fn tick(state: &AppState) -> AppResult<()> {
    // забираем пачку «к отправке» и сразу сдвигаем срок — другой воркер её не возьмёт, а HTTP идёт без открытой транзакции
    let rows = sqlx::query_as::<_, Pending>(
        r#"UPDATE integration_outbox SET next_attempt_at = now() + interval '2 minutes'
           WHERE id IN (SELECT id FROM integration_outbox WHERE status = 'pending' AND next_attempt_at <= now()
                        ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED)
           RETURNING id, target, event, payload, attempts"#,
    )
    .fetch_all(&state.pool)
    .await?;
    for row in rows {
        let url = match row.target.as_str() {
            "crm" => state.cfg.crm_webhook_url.clone(),
            "onec" => state.cfg.onec_webhook_url.clone(),
            _ => None,
        };
        let body = serde_json::json!({ "event": row.event, "target": row.target, "id": row.id, "payload": row.payload });
        let result: Result<bool, String> = match url {
            None if state.cfg.production => {
                // интеграция ещё не настроена — оставляем в очереди, проверим через 10 минут
                sqlx::query("UPDATE integration_outbox SET next_attempt_at = now() + interval '10 minutes' WHERE id = $1").bind(row.id).execute(&state.pool).await?;
                continue;
            }
            None => Ok(true),
            Some(u) => match state.http.post(&u).json(&body).send().await {
                Ok(resp) if resp.status().is_success() => Ok(false),
                Ok(resp) => Err(format!("http {}", resp.status())),
                Err(e) => Err(e.to_string()),
            },
        };
        match result {
            Ok(mock) => {
                let mut tx = state.pool.begin().await?;
                sqlx::query("UPDATE integration_outbox SET status = 'sent', mock = $2, sent_at = now(), attempts = attempts + 1 WHERE id = $1")
                    .bind(row.id)
                    .bind(mock)
                    .execute(&mut *tx)
                    .await?;
                if row.event.starts_with("order.") || row.event == "stock.reserve" {
                    if let Some(number) = row.payload.get("number").and_then(|v| v.as_str()) {
                        let col = if row.target == "crm" { "crm_status" } else { "reservation_status" };
                        let sql = format!("UPDATE orders SET {col} = $2 WHERE number = $1");
                        sqlx::query(sqlx::AssertSqlSafe(sql))
                            .bind(number)
                            .bind(if mock { "sent_mock" } else { "sent" })
                            .execute(&mut *tx)
                            .await?;
                    }
                }
                tx.commit().await?;
            }
            Err(err) => {
                let failed = row.attempts + 1 >= MAX_ATTEMPTS;
                if failed {
                    tracing::error!(id = row.id, target = %row.target, event = %row.event, error = %err, "integration event failed permanently");
                } else {
                    tracing::warn!(id = row.id, target = %row.target, event = %row.event, error = %err, "integration event delivery failed, will retry");
                }
                sqlx::query(
                    r#"UPDATE integration_outbox SET attempts = attempts + 1, last_error = $2, status = $3,
                       next_attempt_at = now() + make_interval(secs => $4) WHERE id = $1"#,
                )
                .bind(row.id)
                .bind(err)
                .bind(if failed { "failed" } else { "pending" })
                .bind(backoff_secs(row.attempts) as f64)
                .execute(&state.pool)
                .await?;
            }
        }
    }
    Ok(())
}

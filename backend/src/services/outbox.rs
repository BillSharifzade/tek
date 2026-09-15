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

/// Background worker: every 5 seconds deliver pending events to the configured webhooks.
/// Without a webhook URL the event is marked `sent` with `mock = true`.
pub fn spawn_worker(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            if let Err(e) = tick(&state).await {
                tracing::warn!(error = %e.message, "outbox tick failed");
            }
        }
    });
}

async fn tick(state: &AppState) -> AppResult<()> {
    let mut tx = state.pool.begin().await?;
    let rows = sqlx::query_as::<_, Pending>(
        r#"SELECT id, target, event, payload, attempts FROM integration_outbox
           WHERE status = 'pending' AND attempts < 10
           ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED"#,
    )
    .fetch_all(&mut *tx)
    .await?;
    for row in rows {
        let url = match row.target.as_str() {
            "crm" => state.cfg.crm_webhook_url.clone(),
            "onec" => state.cfg.onec_webhook_url.clone(),
            _ => None,
        };
        let body = serde_json::json!({ "event": row.event, "target": row.target, "id": row.id, "payload": row.payload });
        let result: Result<bool, String> = match url {
            None => Ok(true),
            Some(u) => match state.http.post(&u).json(&body).send().await {
                Ok(resp) if resp.status().is_success() => Ok(false),
                Ok(resp) => Err(format!("http {}", resp.status())),
                Err(e) => Err(e.to_string()),
            },
        };
        match result {
            Ok(mock) => {
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
            }
            Err(err) => {
                let status = if row.attempts + 1 >= 10 { "failed" } else { "pending" };
                sqlx::query("UPDATE integration_outbox SET attempts = attempts + 1, last_error = $2, status = $3 WHERE id = $1")
                    .bind(row.id)
                    .bind(err)
                    .bind(status)
                    .execute(&mut *tx)
                    .await?;
            }
        }
    }
    tx.commit().await?;
    Ok(())
}

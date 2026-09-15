use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
pub struct Period {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct LedgerRow {
    entry_date: NaiveDate,
    doc_type: String,
    doc_number: String,
    debit: Decimal,
    credit: Decimal,
    order_number: Option<String>,
    note: Option<String>,
    due_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReconciliationEntry {
    pub date: NaiveDate,
    pub doc_type: String,
    pub doc_type_label: String,
    pub doc_number: String,
    pub debit: Decimal,
    pub credit: Decimal,
    pub balance: Decimal,
    pub order_number: Option<String>,
    pub note: Option<String>,
    pub due_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Turnover {
    pub debit: Decimal,
    pub credit: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct Reconciliation {
    pub period: Period,
    pub company: Option<String>,
    pub opening_balance: Decimal,
    pub entries: Vec<ReconciliationEntry>,
    pub turnover: Turnover,
    pub closing_balance: Decimal,
    pub overdue: Decimal,
}

fn doc_type_label(t: &str) -> String {
    match t {
        "invoice" => "Реализация (счёт)",
        "payment" => "Оплата",
        "credit_note" => "Корректировка",
        _ => "Документ",
    }
    .to_string()
}

pub async fn reconciliation(pool: &PgPool, user_id: Uuid, company: Option<String>, from: NaiveDate, to: NaiveDate) -> AppResult<Reconciliation> {
    let opening: Decimal = sqlx::query_scalar(
        "SELECT COALESCE(SUM(debit - credit), 0) FROM ledger_entries WHERE user_id = $1 AND entry_date < $2",
    )
    .bind(user_id)
    .bind(from)
    .fetch_one(pool)
    .await?;
    let rows = sqlx::query_as::<_, LedgerRow>(
        r#"SELECT l.entry_date, l.doc_type, l.doc_number, l.debit, l.credit, o.number AS order_number, l.note, l.due_date
           FROM ledger_entries l LEFT JOIN orders o ON o.id = l.order_id
           WHERE l.user_id = $1 AND l.entry_date >= $2 AND l.entry_date <= $3
           ORDER BY l.entry_date, l.id"#,
    )
    .bind(user_id)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;
    let mut balance = opening;
    let mut turnover = Turnover { debit: Decimal::ZERO, credit: Decimal::ZERO };
    let mut entries = Vec::with_capacity(rows.len());
    for r in rows {
        balance += r.debit - r.credit;
        turnover.debit += r.debit;
        turnover.credit += r.credit;
        entries.push(ReconciliationEntry {
            date: r.entry_date,
            doc_type_label: doc_type_label(&r.doc_type),
            doc_type: r.doc_type,
            doc_number: r.doc_number,
            debit: r.debit,
            credit: r.credit,
            balance,
            order_number: r.order_number,
            note: r.note,
            due_date: r.due_date,
        });
    }
    let overdue = overdue_amount(pool, user_id).await?;
    Ok(Reconciliation { period: Period { from, to }, company, opening_balance: opening, entries, turnover, closing_balance: balance, overdue })
}

/// Receivable = Σ(debit - credit) over all time. Overdue = unpaid remainder of orders whose due date passed.
pub async fn receivable(pool: &PgPool, user_id: Uuid) -> AppResult<Decimal> {
    Ok(sqlx::query_scalar("SELECT COALESCE(SUM(debit - credit), 0) FROM ledger_entries WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?)
}

pub async fn overdue_amount(pool: &PgPool, user_id: Uuid) -> AppResult<Decimal> {
    Ok(sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(GREATEST(total - paid_amount, 0)), 0) FROM orders
           WHERE user_id = $1 AND status <> 'cancelled' AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND total > paid_amount"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?)
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct BonusRow {
    entry_date: NaiveDate,
    kind: String,
    amount: Decimal,
    note: Option<String>,
    order_number: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BonusEntry {
    pub date: NaiveDate,
    pub order_number: Option<String>,
    pub kind: String,
    pub kind_label: String,
    pub amount: Decimal,
    pub balance: Decimal,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BonusStatement {
    pub period: Period,
    pub balance: Decimal,
    pub opening: Decimal,
    pub entries: Vec<BonusEntry>,
    pub accrued: Decimal,
    pub spent: Decimal,
    pub closing: Decimal,
}

pub async fn bonus_balance(pool: &PgPool, user_id: Uuid) -> AppResult<Decimal> {
    Ok(sqlx::query_scalar("SELECT COALESCE(SUM(amount), 0) FROM bonus_transactions WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?)
}

pub async fn bonus_statement(pool: &PgPool, user_id: Uuid, from: NaiveDate, to: NaiveDate) -> AppResult<BonusStatement> {
    let opening: Decimal = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM bonus_transactions WHERE user_id = $1 AND entry_date < $2",
    )
    .bind(user_id)
    .bind(from)
    .fetch_one(pool)
    .await?;
    let rows = sqlx::query_as::<_, BonusRow>(
        r#"SELECT b.entry_date, b.kind, b.amount, b.note, o.number AS order_number
           FROM bonus_transactions b LEFT JOIN orders o ON o.id = b.order_id
           WHERE b.user_id = $1 AND b.entry_date >= $2 AND b.entry_date <= $3 ORDER BY b.entry_date, b.id"#,
    )
    .bind(user_id)
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?;
    let mut balance = opening;
    let mut accrued = Decimal::ZERO;
    let mut spent = Decimal::ZERO;
    let entries = rows
        .into_iter()
        .map(|r| {
            balance += r.amount;
            if r.amount >= Decimal::ZERO {
                accrued += r.amount;
            } else {
                spent += -r.amount;
            }
            let kind_label = match r.kind.as_str() {
                "accrual" => "Начисление",
                "spend" => "Списание",
                _ => "Корректировка",
            }
            .to_string();
            BonusEntry { date: r.entry_date, order_number: r.order_number, kind: r.kind, kind_label, amount: r.amount, balance, note: r.note }
        })
        .collect();
    let total = bonus_balance(pool, user_id).await?;
    Ok(BonusStatement { period: Period { from, to }, balance: total, opening, entries, accrued, spent, closing: balance })
}

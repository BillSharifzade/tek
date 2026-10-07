//! Письма клиентам и менеджерам (SMTP, lettre).
//!
//! Письмо не отправляется из обработчика запроса: оно ставится в `integration_outbox` (target = `email`,
//! payload `{to, subject, html, text}`) в той же транзакции, что и событие, которое его вызвало, а доставляет
//! его фоновый воркер outbox — сбой почты никогда не ломает регистрацию, заказ или заявку.
//! Без `SMTP_URL`: вне production письмо помечается отправленным с `mock = true`, в production ждёт в очереди.

use std::time::Duration;

use lettre::{message::Mailbox, message::MultiPart, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use sqlx::{PgConnection, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{config::Config, error::AppResult};

// ---------- доставка ----------

#[derive(Clone)]
pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

/// Ошибка доставки: постоянная (неверный адрес, отказ сервера 5xx) — письмо больше не повторяется.
pub enum SendError {
    Permanent(String),
    Temporary(String),
}

fn transport(url: &str) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    AsyncSmtpTransport::<Tokio1Executor>::from_url(url)
        .map(|b| b.timeout(Some(Duration::from_secs(20))).build())
        .map_err(|e| e.to_string())
}

/// Проверка SMTP_URL / MAIL_FROM при старте в production.
pub fn check_config(cfg: &Config) -> Result<(), &'static str> {
    let Some(url) = &cfg.smtp_url else { return Ok(()) };
    if transport(url).is_err() {
        return Err("SMTP_URL: ожидается smtps://user:pass@host:465 или smtp://user:pass@host:587?tls=required");
    }
    if cfg.mail_from.parse::<Mailbox>().is_err() {
        return Err("MAIL_FROM: ожидается адрес отправителя, например «ТЭК <noreply@tec.tj>»");
    }
    Ok(())
}

impl Mailer {
    /// None — SMTP не настроен (или настроен с ошибкой: она в логе, письма остаются в очереди / mock).
    pub fn from_config(cfg: &Config) -> Option<Self> {
        let url = cfg.smtp_url.as_ref()?;
        let from = match cfg.mail_from.parse::<Mailbox>() {
            Ok(m) => m,
            Err(e) => {
                tracing::error!(error = %e, "MAIL_FROM is not a valid mailbox, e-mail disabled");
                return None;
            }
        };
        match transport(url) {
            Ok(transport) => Some(Self { transport, from }),
            Err(e) => {
                tracing::error!(error = %e, "SMTP_URL is invalid, e-mail disabled");
                None
            }
        }
    }

    pub async fn send(&self, payload: &Value) -> Result<(), SendError> {
        let field = |k: &str| payload.get(k).and_then(Value::as_str).unwrap_or("").to_string();
        let to: Mailbox = field("to").parse().map_err(|e| SendError::Permanent(format!("invalid recipient: {e}")))?;
        let msg = Message::builder()
            .from(self.from.clone())
            .to(to)
            .subject(field("subject"))
            .multipart(MultiPart::alternative_plain_html(field("text"), field("html")))
            .map_err(|e| SendError::Permanent(format!("message: {e}")))?;
        match self.transport.send(msg).await {
            Ok(_) => Ok(()),
            Err(e) if e.is_permanent() => Err(SendError::Permanent(e.to_string())),
            Err(e) => Err(SendError::Temporary(e.to_string())),
        }
    }
}

// ---------- постановка в очередь ----------

pub struct Mail {
    pub to: String,
    pub subject: String,
    pub html: String,
    pub text: String,
}

/// Адрес, на который можно писать: непустой, с «@»; иначе письмо не ставится.
pub fn valid_email(raw: Option<&str>) -> Option<String> {
    let e = raw?.trim();
    (e.len() >= 5 && e.contains('@') && !e.contains(char::is_whitespace)).then(|| e.to_string())
}

fn payload(mail: &Mail, number: Option<&str>) -> Value {
    // number — письма одного заказа уходят по порядку (как события CRM)
    let mut p = json!({ "to": mail.to, "subject": mail.subject, "html": mail.html, "text": mail.text });
    if let Some(n) = number {
        p["number"] = json!(n);
    }
    p
}

/// Письмо в той же транзакции, что и событие (регистрация, заказ, заявка).
pub async fn enqueue(tx: &mut Transaction<'_, Postgres>, event: &str, mail: Mail, number: Option<&str>) -> AppResult<()> {
    crate::services::outbox::enqueue(tx, "email", event, payload(&mail, number)).await
}

/// Письмо вне транзакции; ошибка только пишется в лог — основной запрос из-за письма не падает.
pub async fn enqueue_pool(pool: &PgPool, event: &str, mail: Mail, number: Option<&str>) {
    if let Err(e) = crate::services::outbox::enqueue_pool(pool, "email", event, payload(&mail, number)).await {
        tracing::warn!(error = %e.message, event, "e-mail not queued");
    }
}

/// Кому писать о заказе / регистрации / заявке: закреплённый менеджер клиента → `MANAGER_NOTIFY_EMAIL` → лид-менеджер.
pub async fn manager_recipient(conn: &mut PgConnection, cfg: &Config, personal: Option<Uuid>) -> AppResult<Option<String>> {
    if let Some(id) = personal {
        let email: Option<Option<String>> =
            sqlx::query_scalar("SELECT email FROM users WHERE id = $1 AND role IN ('manager','admin') AND status <> 'blocked'").bind(id).fetch_optional(&mut *conn).await?;
        if let Some(e) = valid_email(email.flatten().as_deref()) {
            return Ok(Some(e));
        }
    }
    if let Some(e) = valid_email(cfg.manager_notify_email.as_deref()) {
        return Ok(Some(e));
    }
    let lead: Option<Option<String>> = sqlx::query_scalar(
        "SELECT email FROM users WHERE role IN ('manager','admin') AND is_lead_manager AND status <> 'blocked' AND email IS NOT NULL ORDER BY created_at LIMIT 1",
    )
    .fetch_optional(&mut *conn)
    .await?;
    Ok(valid_email(lead.flatten().as_deref()))
}

// ---------- шаблоны ----------

pub fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}

/// «1 690,80 с.» — как на сайте.
pub fn money(d: Decimal) -> String {
    let s = format!("{:.2}", d.round_dp(2));
    let (int, frac) = s.split_once('.').unwrap_or((&s, "00"));
    let (sign, digits) = int.strip_prefix('-').map(|d| ("-", d)).unwrap_or(("", int));
    let mut grouped = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push('\u{a0}');
        }
        grouped.push(c);
    }
    format!("{sign}{grouped},{frac}\u{a0}с.")
}

pub fn qty(d: Decimal) -> String {
    d.normalize().to_string().replace('.', ",")
}

fn base_url(cfg: &Config) -> &str {
    cfg.frontend_url.trim_end_matches('/')
}

/// Общий макет письма: жёлтая шапка ТЭК, заголовок, текст, кнопка, подвал с контактами.
fn layout(cfg: &Config, heading: &str, body_html: &str, cta: Option<(&str, &str)>) -> String {
    let button = cta
        .map(|(label, url)| {
            format!(
                r#"<p style="margin:24px 0 0"><a href="{}" style="display:inline-block;background:#FFCC33;color:#000;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:4px">{}</a></p>"#,
                esc(url),
                esc(label)
            )
        })
        .unwrap_or_default();
    format!(
        r#"<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{title}</title></head>
<body style="margin:0;background:#F6F7F8;font-family:Roboto,Arial,sans-serif;color:#1F2329">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #D9DDE4;border-radius:10px;overflow:hidden">
<tr><td style="background:#FFCC33;padding:16px 28px;font-size:20px;font-weight:700;color:#000">ТЭК <span style="font-weight:400;font-size:14px">· Точикэлектрокомплект</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px">{title}</h1>
<div style="font-size:15px;line-height:22px">{body}</div>{button}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #EEF0F2;font-size:12px;line-height:18px;color:#6B7280">
ООО «Точикэлектрокомплект» · +992 446 20 60 60 · sales@tec.tj · <a href="{site}" style="color:#6B7280">{site_label}</a><br>
Письмо отправлено автоматически, отвечать на него не нужно.</td></tr>
</table></td></tr></table></body></html>"#,
        title = esc(heading),
        body = body_html,
        button = button,
        site = esc(base_url(cfg)),
        site_label = esc(base_url(cfg).trim_start_matches("https://").trim_start_matches("http://")),
    )
}

fn text_footer() -> &'static str {
    "\n\n--\nООО «Точикэлектрокомплект» · +992 446 20 60 60 · sales@tec.tj\nПисьмо отправлено автоматически, отвечать на него не нужно."
}

fn hello(name: &str) -> String {
    let n = name.trim();
    if n.is_empty() { "Здравствуйте!".to_string() } else { format!("Здравствуйте, {n}!") }
}

/// Клиенту: заявка на регистрацию получена.
pub fn registration_received(cfg: &Config, to: String, name: &str) -> Mail {
    let p1 = "Мы получили вашу заявку на регистрацию на сайте ТЭК. Менеджер проверит данные и активирует аккаунт — об этом придёт отдельное письмо.";
    let p2 = "После активации вам станут доступны персональные цены, кешбэк, история заказов и акт сверки.";
    Mail {
        to,
        subject: "Заявка на регистрацию получена".into(),
        html: layout(cfg, "Заявка на регистрацию получена", &format!("<p>{}</p><p>{p1}</p><p>{p2}</p>", esc(&hello(name))), None),
        text: format!("{}\n\n{p1}\n{p2}{}", hello(name), text_footer()),
    }
}

/// Клиенту: аккаунт одобрен.
pub fn account_approved(cfg: &Config, to: String, name: &str) -> Mail {
    let url = format!("{}/login", base_url(cfg));
    let p1 = "Ваш аккаунт на сайте ТЭК активирован. Теперь вам доступны персональные цены, кешбэк, история заказов и акт сверки.";
    Mail {
        to,
        subject: "Аккаунт активирован".into(),
        html: layout(cfg, "Аккаунт активирован", &format!("<p>{}</p><p>{p1}</p>", esc(&hello(name))), Some(("Войти в личный кабинет", &url))),
        text: format!("{}\n\n{p1}\nВход: {url}{}", hello(name), text_footer()),
    }
}

pub struct MailItem {
    pub code: String,
    pub name: String,
    pub qty: Decimal,
    pub unit: String,
    pub price: Decimal,
    pub line_total: Decimal,
}

/// Сводка заказа для писем.
pub struct OrderMail<'a> {
    pub number: &'a str,
    pub customer: String,
    pub phone: &'a str,
    pub email: &'a str,
    pub items: &'a [MailItem],
    pub delivery: String,
    pub payment: String,
    pub delivery_price: Decimal,
    pub coupon_discount: Decimal,
    pub total: Decimal,
    pub comment: Option<&'a str>,
}

fn items_html(o: &OrderMail<'_>) -> String {
    let td = "padding:8px 6px;border-bottom:1px solid #EEF0F2;vertical-align:top";
    let mut rows = String::new();
    for it in o.items {
        rows.push_str(&format!(
            r#"<tr><td style="{td}">{}<br><span style="color:#6B7280;font-size:12px">Код {}</span></td><td style="{td};white-space:nowrap;text-align:right">{} {}</td><td style="{td};white-space:nowrap;text-align:right">{}</td></tr>"#,
            esc(&it.name),
            esc(&it.code),
            qty(it.qty),
            esc(&it.unit),
            money(it.line_total)
        ));
    }
    let mut totals = String::new();
    if o.coupon_discount > Decimal::ZERO {
        totals.push_str(&format!(r#"<tr><td colspan="2" style="padding:6px;text-align:right">Промокод</td><td style="padding:6px;text-align:right;white-space:nowrap">−{}</td></tr>"#, money(o.coupon_discount)));
    }
    totals.push_str(&format!(r#"<tr><td colspan="2" style="padding:6px;text-align:right">Доставка</td><td style="padding:6px;text-align:right;white-space:nowrap">{}</td></tr>"#, money(o.delivery_price)));
    totals.push_str(&format!(
        r#"<tr><td colspan="2" style="padding:6px;text-align:right;font-weight:700">Итого</td><td style="padding:6px;text-align:right;white-space:nowrap;font-weight:700">{}</td></tr>"#,
        money(o.total)
    ));
    format!(
        r#"<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;line-height:20px;border-collapse:collapse"><tr><th align="left" style="padding:6px;border-bottom:2px solid #FFCC33">Товар</th><th align="right" style="padding:6px;border-bottom:2px solid #FFCC33">Кол-во</th><th align="right" style="padding:6px;border-bottom:2px solid #FFCC33">Сумма</th></tr>{rows}{totals}</table>"#
    )
}

fn items_text(o: &OrderMail<'_>) -> String {
    let mut out = String::new();
    for (i, it) in o.items.iter().enumerate() {
        out.push_str(&format!("{}. {} (код {}) — {} {} × {} = {}\n", i + 1, it.name, it.code, qty(it.qty), it.unit, money(it.price), money(it.line_total)));
    }
    if o.coupon_discount > Decimal::ZERO {
        out.push_str(&format!("Промокод: −{}\n", money(o.coupon_discount)));
    }
    out.push_str(&format!("Доставка: {}\nИтого: {}\n", money(o.delivery_price), money(o.total)));
    out
}

/// Клиенту: заказ оформлен.
pub fn order_created_customer(cfg: &Config, to: String, o: &OrderMail<'_>, registered: bool) -> Mail {
    let url = if registered { format!("{}/account/orders/{}", base_url(cfg), o.number) } else { format!("{}/checkout/success/{}", base_url(cfg), o.number) };
    let p1 = "Спасибо за заказ! Мы передали его менеджеру и зарезервировали товар на складе. Менеджер свяжется с вами, чтобы подтвердить детали.";
    let details = format!("Доставка: {}<br>Оплата: {}", esc(&o.delivery), esc(&o.payment));
    Mail {
        to,
        subject: format!("Заказ {} оформлен", o.number),
        html: layout(
            cfg,
            &format!("Заказ {} оформлен", o.number),
            &format!("<p>{}</p><p>{p1}</p><p>{details}</p>{}", esc(&hello(&o.customer)), items_html(o)),
            Some(("Открыть заказ", &url)),
        ),
        text: format!("{}\n\n{p1}\n\nДоставка: {}\nОплата: {}\n\n{}\nЗаказ: {url}{}", hello(&o.customer), o.delivery, o.payment, items_text(o), text_footer()),
    }
}

/// Менеджеру: новый заказ.
pub fn order_created_manager(cfg: &Config, to: String, o: &OrderMail<'_>, company: Option<&str>) -> Mail {
    let url = format!("{}/admin/orders?q={}", base_url(cfg), o.number);
    let who = match company {
        Some(c) => format!("{} ({c})", o.customer),
        None => o.customer.clone(),
    };
    let comment = o.comment.map(|c| format!("<br>Комментарий: {}", esc(c))).unwrap_or_default();
    let html_body = format!(
        "<p>Покупатель: {}<br>Телефон: {}<br>E-mail: {}<br>Доставка: {}<br>Оплата: {}{comment}</p>{}",
        esc(&who),
        esc(o.phone),
        esc(if o.email.is_empty() { "—" } else { o.email }),
        esc(&o.delivery),
        esc(&o.payment),
        items_html(o)
    );
    Mail {
        to,
        subject: format!("Новый заказ {} на {}", o.number, money(o.total)),
        html: layout(cfg, &format!("Новый заказ {}", o.number), &html_body, Some(("Открыть в панели", &url))),
        text: format!(
            "Новый заказ {}\n\nПокупатель: {who}\nТелефон: {}\nE-mail: {}\nДоставка: {}\nОплата: {}{}\n\n{}\nПанель: {url}{}",
            o.number,
            o.phone,
            o.email,
            o.delivery,
            o.payment,
            o.comment.map(|c| format!("\nКомментарий: {c}")).unwrap_or_default(),
            items_text(o),
            text_footer()
        ),
    }
}

/// Менеджеру: ему передали заказ.
pub fn order_assigned_manager(cfg: &Config, to: String, number: &str, customer: &str, total: Decimal) -> Mail {
    let url = format!("{}/admin/orders?q={number}", base_url(cfg));
    let p = format!("Вам передан заказ {number} ({customer}) на {}.", money(total));
    Mail {
        to,
        subject: format!("Вам передан заказ {number}"),
        html: layout(cfg, &format!("Вам передан заказ {number}"), &format!("<p>{}</p>", esc(&p)), Some(("Открыть в панели", &url))),
        text: format!("{p}\nПанель: {url}{}", text_footer()),
    }
}

/// Клиенту: статус заказа изменился.
pub fn order_status(cfg: &Config, to: String, name: &str, number: &str, status_label: &str, registered: bool) -> Mail {
    let url = if registered { format!("{}/account/orders/{number}", base_url(cfg)) } else { format!("{}/checkout/success/{number}", base_url(cfg)) };
    let p = format!("Статус вашего заказа {number}: «{status_label}».");
    Mail {
        to,
        subject: format!("Заказ {number}: {status_label}"),
        html: layout(cfg, &format!("Заказ {number}: {status_label}"), &format!("<p>{}</p><p>{}</p>", esc(&hello(name)), esc(&p)), Some(("Открыть заказ", &url))),
        text: format!("{}\n\n{p}\nЗаказ: {url}{}", hello(name), text_footer()),
    }
}

/// Клиенту: ответ на отзыв (`question = false`) или на вопрос о товаре.
pub fn reply(cfg: &Config, to: String, name: &str, product: &str, slug: &str, answer: &str, question: bool) -> Mail {
    let (subject, what, anchor) = if question { ("Ответ на ваш вопрос", "вопрос", "questions") } else { ("Ответ на ваш отзыв", "отзыв", "reviews") };
    let url = format!("{}/product/{slug}#{anchor}", base_url(cfg));
    let p = format!("Специалист ТЭК ответил на ваш {what} о товаре «{product}»:");
    Mail {
        to,
        subject: subject.into(),
        html: layout(
            cfg,
            subject,
            &format!(
                r#"<p>{}</p><p>{}</p><blockquote style="margin:0;padding:12px 16px;background:#F6F7F8;border-left:3px solid #FFCC33;white-space:pre-line">{}</blockquote>"#,
                esc(&hello(name)),
                esc(&p),
                esc(answer)
            ),
            Some(("Посмотреть на сайте", &url)),
        ),
        text: format!("{}\n\n{p}\n\n{answer}\n\n{url}{}", hello(name), text_footer()),
    }
}

/// Менеджеру: новая регистрация ждёт одобрения.
pub fn registration_manager(cfg: &Config, to: String, name: &str, email: Option<&str>, phone: Option<&str>, customer_type: &str, company: Option<&str>) -> Mail {
    let url = format!("{}/admin/users?status=pending", base_url(cfg));
    let kind = match customer_type {
        "legal" => "юридическое лицо",
        "electrician" => "электрик",
        "purchaser" => "закупщик",
        _ => "физическое лицо",
    };
    let lines = [
        format!("Имя: {name}"),
        format!("E-mail: {}", email.unwrap_or("—")),
        format!("Телефон: {}", phone.unwrap_or("—")),
        format!("Тип: {kind}"),
        format!("Компания: {}", company.unwrap_or("—")),
    ];
    Mail {
        to,
        subject: format!("Новая регистрация: {name}"),
        html: layout(
            cfg,
            "Новая регистрация ждёт одобрения",
            &format!("<p>{}</p>", lines.iter().map(|l| esc(l)).collect::<Vec<_>>().join("<br>")),
            Some(("Открыть в панели", &url)),
        ),
        text: format!("Новая регистрация ждёт одобрения\n\n{}\n\nПанель: {url}{}", lines.join("\n"), text_footer()),
    }
}

pub fn lead_kind_label(kind: &str) -> &'static str {
    match kind {
        "service" => "заявка на услугу",
        "question" => "вопрос",
        "project" => "проект",
        "consultation" => "консультация",
        _ => "обратная связь",
    }
}

pub struct LeadMail<'a> {
    pub id: i64,
    pub kind: &'a str,
    pub name: &'a str,
    pub phone: &'a str,
    pub email: Option<&'a str>,
    pub note: &'a str,
    pub service: Option<&'a str>,
    pub page: Option<&'a str>,
}

/// Менеджеру: новая заявка с формы сайта.
pub fn lead_manager(cfg: &Config, to: String, l: &LeadMail<'_>) -> Mail {
    let url = format!("{}/admin/leads", base_url(cfg));
    let mut lines = vec![format!("Тип: {}", lead_kind_label(l.kind)), format!("Имя: {}", l.name), format!("Телефон: {}", l.phone)];
    if let Some(e) = l.email {
        lines.push(format!("E-mail: {e}"));
    }
    if let Some(s) = l.service {
        lines.push(format!("Услуга: {s}"));
    }
    if let Some(p) = l.page {
        lines.push(format!("Страница: {p}"));
    }
    let note_html = if l.note.is_empty() {
        String::new()
    } else {
        format!(r#"<blockquote style="margin:16px 0 0;padding:12px 16px;background:#F6F7F8;border-left:3px solid #FFCC33;white-space:pre-line">{}</blockquote>"#, esc(l.note))
    };
    Mail {
        to,
        subject: format!("Заявка с сайта №{}: {}", l.id, l.name),
        html: layout(
            cfg,
            &format!("Новая заявка с сайта — {}", lead_kind_label(l.kind)),
            &format!("<p>{}</p>{note_html}", lines.iter().map(|x| esc(x)).collect::<Vec<_>>().join("<br>")),
            Some(("Открыть в панели", &url)),
        ),
        text: format!(
            "Новая заявка с сайта №{}\n\n{}{}\n\nПанель: {url}{}",
            l.id,
            lines.join("\n"),
            if l.note.is_empty() { String::new() } else { format!("\n\n{}", l.note) },
            text_footer()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn money_format() {
        assert_eq!(money(dec!(1690.8)), "1\u{a0}690,80\u{a0}с.");
        assert_eq!(money(dec!(30)), "30,00\u{a0}с.");
        assert_eq!(money(dec!(1234567.891)), "1\u{a0}234\u{a0}567,89\u{a0}с.");
        assert_eq!(qty(dec!(2.500)), "2,5");
    }

    #[test]
    fn email_validation_and_escape() {
        assert_eq!(valid_email(Some(" a@b.tj ")), Some("a@b.tj".into()));
        assert_eq!(valid_email(Some("")), None);
        assert_eq!(valid_email(Some("no-at-sign")), None);
        assert_eq!(valid_email(None), None);
        assert_eq!(esc("<b>\"x\" & 'y'</b>"), "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
    }

    #[test]
    fn mailbox_with_cyrillic_name_parses() {
        assert!("ТЭК <noreply@tec.tj>".parse::<Mailbox>().is_ok());
    }
}

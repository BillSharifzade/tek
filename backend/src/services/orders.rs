use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{
        delivery_method_label, order_status_label, payment_method_label, payment_status_label, BrandRef, CartRow, OrderEventRow,
        OrderItemRow, OrderRow, Price, ProductCard, ProductRow, StoreRow, UserRow,
    },
    services::{
        cart::{self, Computed},
        catalog::{products_by_ids, to_card},
        delivery::{self, COURIER_PRICE},
        mail, outbox,
        pricing::{round2, PriceCtx},
    },
    state::AppState,
};

// ---------- JSON ----------

#[derive(Debug, Clone, Serialize)]
pub struct StoreJson {
    pub id: i32,
    pub city: String,
    pub name: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryJson {
    pub method: String,
    pub method_label: &'static str,
    pub address: Option<String>,
    pub date: Option<NaiveDate>,
    pub date_label: Option<String>,
    pub store: Option<StoreJson>,
    pub price: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaymentJson {
    pub method: String,
    pub method_label: &'static str,
    pub sublabel: &'static str,
    pub status: String,
    pub status_label: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContactJson {
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderItemJson {
    pub id: Uuid,
    pub product: ProductCard,
    pub qty: Decimal,
    pub price: Price,
    pub line_total: Decimal,
    pub line_cashback: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct EventJson {
    pub kind: String,
    pub label: String,
    pub at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderJson {
    pub id: Uuid,
    pub number: String,
    pub status: String,
    pub status_label: &'static str,
    pub created_at: DateTime<Utc>,
    pub contact: ContactJson,
    pub delivery: DeliveryJson,
    pub payment: PaymentJson,
    pub subtotal_list: Decimal,
    pub subtotal: Decimal,
    pub discount_total: Decimal,
    pub coupon_code: Option<String>,
    pub coupon_discount: Decimal,
    pub delivery_price: Decimal,
    pub total: Decimal,
    pub cashback_total: Decimal,
    pub paid_amount: Decimal,
    pub remaining: Decimal,
    pub due_date: Option<NaiveDate>,
    pub comment: Option<String>,
    pub items: Vec<OrderItemJson>,
    pub events: Vec<EventJson>,
    pub can_cancel: bool,
    pub can_edit: bool,
    pub manager: Option<crate::models::ManagerJson>,
}

pub fn is_editable(status: &str) -> bool {
    matches!(status, "new" | "confirmed" | "processing")
}

pub async fn load_by_number(pool: &PgPool, number: &str) -> AppResult<Option<OrderRow>> {
    Ok(sqlx::query_as::<_, OrderRow>("SELECT * FROM orders WHERE number = $1")
        .bind(number)
        .fetch_optional(pool)
        .await?)
}

pub async fn load_by_id(pool: &PgPool, id: Uuid) -> AppResult<OrderRow> {
    Ok(sqlx::query_as::<_, OrderRow>("SELECT * FROM orders WHERE id = $1").bind(id).fetch_one(pool).await?)
}

pub async fn order_json(state: &AppState, o: &OrderRow) -> AppResult<OrderJson> {
    let pool = &state.pool;
    let items = sqlx::query_as::<_, OrderItemRow>("SELECT * FROM order_items WHERE order_id = $1 ORDER BY name")
        .bind(o.id)
        .fetch_all(pool)
        .await?;
    let ids: Vec<Uuid> = items.iter().filter_map(|i| i.product_id).collect();
    let products = products_by_ids(pool, &ids).await?;
    let anon = PriceCtx::anonymous();
    let items_json = items
        .iter()
        .map(|it| {
            let card = match it.product_id.and_then(|pid| products.iter().find(|p| p.id == pid)) {
                Some(p) => to_card(p, &anon),
                None => ProductCard {
                    id: it.product_id.unwrap_or_default(),
                    slug: String::new(),
                    code: it.code.clone(),
                    name: it.name.clone(),
                    brand: BrandRef { slug: String::new(), name: String::new() },
                    unit: it.unit.clone(),
                    image: None,
                    price: Price { list: it.list_price, price: it.price, discount_pct: it.discount_pct, cashback: Decimal::ZERO, sale: false, savings: Decimal::ZERO },
                    stock_total: Decimal::ZERO,
                    in_stock: false,
                    badges: vec![],
                    rating: Decimal::ZERO,
                    reviews_count: 0,
                    price_unit_label: if it.unit == "м" { "за метр" } else { "за шт" },
                    category: BrandRef { slug: String::new(), name: String::new() },
                    pack_qty: None,
                },
            };
            let cashback = if it.qty.is_zero() { Decimal::ZERO } else { round2(it.line_cashback / it.qty) };
            OrderItemJson {
                id: it.id,
                product: card,
                qty: it.qty,
                price: Price {
                    list: it.list_price,
                    price: it.price,
                    discount_pct: it.discount_pct,
                    cashback,
                    sale: false,
                    savings: round2((it.list_price - it.price).max(Decimal::ZERO)),
                },
                line_total: it.line_total,
                line_cashback: it.line_cashback,
            }
        })
        .collect();
    let events = sqlx::query_as::<_, OrderEventRow>("SELECT kind, label, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at")
        .bind(o.id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|e| EventJson { kind: e.kind, label: e.label, at: e.created_at })
        .collect();
    let store = match o.store_id {
        Some(id) => sqlx::query_as::<_, StoreRow>("SELECT * FROM stores WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .map(|s| StoreJson { id: s.id, city: s.city, name: s.name, address: s.address }),
        None => None,
    };
    let manager = match o.assigned_manager_id {
        Some(id) => sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .map(|m| crate::models::ManagerJson { name: m.full_name(), phone: m.phone.clone(), email: m.email.clone().unwrap_or_default() }),
        None => None,
    };
    let (pm_label, pm_sub) = payment_method_label(&o.payment_method);
    Ok(OrderJson {
        id: o.id,
        number: o.number.clone(),
        status: o.status.clone(),
        status_label: order_status_label(&o.status),
        created_at: o.created_at,
        contact: ContactJson { first_name: o.first_name.clone(), last_name: o.last_name.clone(), phone: o.phone.clone(), email: o.email.clone() },
        delivery: DeliveryJson {
            method: o.delivery_method.clone(),
            method_label: delivery_method_label(&o.delivery_method),
            address: o.delivery_address.clone(),
            date: o.delivery_date,
            date_label: o.delivery_date.map(delivery::day_label),
            store,
            price: o.delivery_price,
        },
        payment: PaymentJson {
            method: o.payment_method.clone(),
            method_label: pm_label,
            sublabel: pm_sub,
            status: o.payment_status.clone(),
            status_label: payment_status_label(&o.payment_status),
        },
        subtotal_list: o.subtotal_list,
        subtotal: o.subtotal,
        discount_total: o.discount_total,
        coupon_code: o.coupon_code.clone(),
        coupon_discount: o.coupon_discount,
        delivery_price: o.delivery_price,
        total: o.total,
        cashback_total: o.cashback_total,
        paid_amount: o.paid_amount,
        remaining: round2((o.total - o.paid_amount).max(Decimal::ZERO)),
        due_date: o.due_date,
        comment: o.comment.clone(),
        items: items_json,
        events,
        // те же правила, что в cancel_order / edit_order: оплаченный (в том числе частично) заказ клиент не отменяет
        can_cancel: is_editable(&o.status) && o.payment_status != "paid" && o.paid_amount.is_zero(),
        can_edit: is_editable(&o.status) && o.payment_status != "paid",
        manager,
    })
}

// ---------- checkout ----------

#[derive(Debug, Deserialize)]
pub struct ContactInput {
    pub first_name: String,
    pub last_name: Option<String>,
    pub phone: String,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryInput {
    pub method: String,
    pub address: Option<String>,
    pub date: Option<NaiveDate>,
    pub store_id: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct PaymentInput {
    pub method: String,
}

#[derive(Debug, Deserialize)]
pub struct CheckoutInput {
    pub contact: ContactInput,
    pub delivery: DeliveryInput,
    pub payment: PaymentInput,
    pub comment: Option<String>,
}

pub async fn route_manager(pool: &PgPool, user: Option<&UserRow>) -> AppResult<Option<Uuid>> {
    if let Some(u) = user {
        if let Some(m) = u.manager_id {
            return Ok(Some(m));
        }
    }
    Ok(sqlx::query_scalar("SELECT id FROM users WHERE role IN ('manager','admin') AND is_lead_manager ORDER BY created_at LIMIT 1")
        .fetch_optional(pool)
        .await?)
}

/// Some(true/false) — у пользователя есть компания и она проверена/не проверена менеджером; None — компании нет.
pub async fn company_verified(pool: &PgPool, company_id: Uuid) -> AppResult<Option<bool>> {
    Ok(sqlx::query_scalar("SELECT verified FROM companies WHERE id = $1").bind(company_id).fetch_optional(pool).await?)
}

/// Резервирует остатки под заказ: списывает со складов (сначала магазин самовывоза, затем по порядку складов)
/// под блокировкой строк — два одновременных заказа не продадут один и тот же остаток.
/// Строки блокируются всегда в одном порядке (товар, склад), иначе встречные заказы с общими товарами
/// или разными магазинами самовывоза взаимно блокируются (deadlock); порядок списания — уже в памяти.
async fn reserve_stock(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, order_id: Uuid, lines: &[(Uuid, String, Decimal)], prefer_store: Option<i32>) -> AppResult<()> {
    let mut lines: Vec<&(Uuid, String, Decimal)> = lines.iter().collect();
    lines.sort_by_key(|l| l.0);
    for (product_id, name, qty) in lines {
        let mut rows: Vec<(i32, Decimal, i32)> = sqlx::query_as(
            r#"SELECT s.store_id, s.qty, st.sort FROM stock s JOIN stores st ON st.id = s.store_id
               WHERE s.product_id = $1 AND s.qty > 0
               ORDER BY s.store_id
               FOR UPDATE OF s"#,
        )
        .bind(product_id)
        .fetch_all(&mut **tx)
        .await?;
        rows.sort_by_key(|&(store_id, _, sort)| (Some(store_id) != prefer_store, sort, store_id));
        let available: Decimal = rows.iter().map(|r| r.1).sum();
        if available < *qty {
            return Err(AppError::unprocessable("insufficient_stock", format!("«{name}»: количество превышает остаток"))
                .with_details(json!({ "product_id": product_id, "available": available, "requested": qty })));
        }
        let mut left = *qty;
        for (store_id, have, _) in rows {
            if left.is_zero() {
                break;
            }
            let take = left.min(have);
            sqlx::query("UPDATE stock SET qty = qty - $3 WHERE product_id = $1 AND store_id = $2").bind(product_id).bind(store_id).bind(take).execute(&mut **tx).await?;
            sqlx::query(
                "INSERT INTO order_stock (order_id, product_id, store_id, qty) VALUES ($1,$2,$3,$4) ON CONFLICT (order_id, product_id, store_id) DO UPDATE SET qty = order_stock.qty + EXCLUDED.qty",
            )
            .bind(order_id)
            .bind(product_id)
            .bind(store_id)
            .bind(take)
            .execute(&mut **tx)
            .await?;
            left -= take;
        }
    }
    Ok(())
}

/// Возвращает зарезервированный под заказ товар на склады (отмена / изменение заказа).
async fn release_stock(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, order_id: Uuid) -> AppResult<()> {
    // блокировка в том же порядке (товар, склад), что и в reserve_stock
    sqlx::query(
        r#"SELECT 1 FROM stock s JOIN order_stock os ON os.product_id = s.product_id AND os.store_id = s.store_id
           WHERE os.order_id = $1 ORDER BY s.product_id, s.store_id FOR UPDATE OF s"#,
    )
    .bind(order_id)
    .execute(&mut **tx)
    .await?;
    sqlx::query(
        r#"UPDATE stock s SET qty = s.qty + os.qty FROM order_stock os
           WHERE os.order_id = $1 AND s.product_id = os.product_id AND s.store_id = os.store_id"#,
    )
    .bind(order_id)
    .execute(&mut **tx)
    .await?;
    sqlx::query("DELETE FROM order_stock WHERE order_id = $1").bind(order_id).execute(&mut **tx).await?;
    Ok(())
}

/// Количество: положительное, для штучных товаров — целое, при кратности упаковки — кратно ей
/// (лоток 3 м — 3, 6, 9 м; кабель в барабане 100 м — 100, 200 м).
pub fn validate_qty(qty: Decimal, unit: &str, name: &str, pack: Option<Decimal>) -> AppResult<()> {
    if qty <= Decimal::ZERO || qty > Decimal::from(1_000_000) {
        return Err(AppError::unprocessable("invalid_qty", format!("«{name}»: некорректное количество")));
    }
    if unit != "м" && !qty.fract().is_zero() {
        return Err(AppError::unprocessable("invalid_qty", format!("«{name}»: количество должно быть целым")));
    }
    if let Some(p) = pack.filter(|p| *p > Decimal::ZERO) {
        if !(qty % p).is_zero() {
            return Err(AppError::unprocessable("invalid_pack", format!("«{name}»: продаётся кратно {} {unit}", p.normalize()))
                .with_details(json!({ "pack_qty": p })));
        }
    }
    Ok(())
}

pub fn delivery_price(method: &str, goods_total: Decimal) -> AppResult<Decimal> {
    match method {
        "courier" if goods_total >= delivery::FREE_DELIVERY_FROM => Ok(Decimal::ZERO),
        "courier" => Ok(COURIER_PRICE),
        "pickup" => Ok(Decimal::ZERO),
        _ => Err(AppError::unprocessable("invalid_delivery", "Неизвестный способ доставки")),
    }
}

pub async fn create_order(
    state: &AppState,
    user: Option<&UserRow>,
    cart_row: &CartRow,
    computed: Computed,
    input: CheckoutInput,
) -> AppResult<OrderRow> {
    let pool = &state.pool;
    let selected: Vec<_> = computed.lines.iter().filter(|l| l.selected).collect();
    if selected.is_empty() {
        return Err(AppError::unprocessable("empty_cart", "В корзине нет выбранных товаров"));
    }
    for l in &selected {
        if !l.product.is_active {
            return Err(AppError::unprocessable("product_unavailable", format!("«{}» снят с продажи — удалите его из корзины", l.product.name))
                .with_details(json!({ "product_id": l.product.id })));
        }
        validate_qty(l.qty, &l.product.unit, &l.product.name, l.product.pack_qty)?;
        if l.qty > l.product.stock_total {
            return Err(AppError::unprocessable("insufficient_stock", format!("«{}»: количество превышает остаток", l.product.name))
                .with_details(json!({ "product_id": l.product.id, "available": l.product.stock_total, "requested": l.qty })));
        }
    }
    if input.contact.first_name.trim().is_empty() || input.contact.phone.trim().is_empty() {
        return Err(AppError::unprocessable("invalid_contact", "Укажите имя и телефон"));
    }
    let delivery_price = delivery_price(&input.delivery.method, computed.json.total)?;
    if input.delivery.method == "courier" && input.delivery.address.as_deref().unwrap_or("").trim().is_empty() {
        return Err(AppError::unprocessable("invalid_address", "Укажите адрес доставки"));
    }
    if input.delivery.method == "pickup" {
        let known: bool = match input.delivery.store_id {
            Some(id) => sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stores WHERE id = $1)").bind(id).fetch_one(pool).await?,
            None => false,
        };
        if !known {
            return Err(AppError::unprocessable("invalid_store", "Выберите магазин самовывоза"));
        }
    }
    let email_given = input.contact.email.as_deref().map(str::trim).unwrap_or("");
    if user.is_none() && (email_given.len() < 5 || !email_given.contains('@')) {
        return Err(AppError::unprocessable("invalid_email", "Укажите e-mail — на него придёт информация о заказе"));
    }
    if let Some(d) = input.delivery.date {
        let ok = delivery::delivery_dates().iter().any(|x| x.date == d && x.available);
        if !ok {
            return Err(AppError::unprocessable("invalid_date", "Выбранная дата доставки недоступна"));
        }
    }
    let company_id = user.and_then(|u| u.company_id);
    match input.payment.method.as_str() {
        "cash" => {}
        "alif" | "dc" if state.cfg.payments_mock => {}
        "alif" | "dc" => return Err(AppError::unprocessable("payment_unavailable", "Онлайн-оплата пока недоступна — выберите другой способ")),
        "invoice" => match company_id {
            None => return Err(AppError::unprocessable("invoice_requires_company", "Оплата по счёту доступна только для юридических лиц")),
            Some(cid) if company_verified(pool, cid).await? != Some(true) => {
                return Err(AppError::unprocessable("company_not_verified", "Оплата по счёту станет доступна после проверки компании менеджером"));
            }
            Some(_) => {}
        },
        _ => return Err(AppError::unprocessable("invalid_payment", "Неизвестный способ оплаты")),
    }

    let cj = &computed.json;
    let total = round2(cj.total + delivery_price);
    let today = delivery::today_local();
    // срок оплаты счёта — 3 рабочих дня (доработки R2)
    let due_date = if input.payment.method == "invoice" { Some(delivery::add_working_days(today, 3)) } else { None };
    let payment_status = if input.payment.method == "invoice" { "invoice_issued" } else { "pending" };
    let manager_id = route_manager(pool, user).await?;

    let mut tx = pool.begin().await?;
    // корзина блокируется на время оформления: повторный клик или второй запрос ждёт первый и, не найдя
    // уже оформленных позиций, получает 409 вместо дубля заказа. FOR NO KEY UPDATE — не мешает проверке внешнего
    // ключа при добавлении товаров в эту корзину (FOR UPDATE с ней конфликтует и может дать взаимную блокировку).
    let locked_coupon: Option<Option<String>> = sqlx::query_scalar("SELECT coupon_code FROM carts WHERE id = $1 FOR NO KEY UPDATE")
        .bind(cart_row.id)
        .fetch_optional(&mut *tx)
        .await?;
    let ordered_ids: Vec<Uuid> = selected.iter().map(|l| l.item_id).collect();
    let ordered_qty: Vec<Decimal> = selected.iter().map(|l| l.qty).collect();
    // позиции, количество и промокод — те же, что были посчитаны до блокировки (другая вкладка могла их изменить)
    let still_in_cart: i64 = sqlx::query_scalar(
        r#"SELECT count(*) FROM cart_items ci JOIN unnest($2::uuid[], $3::numeric[]) AS x(id, qty) ON x.id = ci.id AND x.qty = ci.qty
           WHERE ci.cart_id = $1 AND ci.selected"#,
    )
    .bind(cart_row.id)
    .bind(&ordered_ids)
    .bind(&ordered_qty)
    .fetch_one(&mut *tx)
    .await?;
    if still_in_cart != ordered_ids.len() as i64 || locked_coupon.flatten() != cart_row.coupon_code {
        return Err(AppError::conflict("cart_changed", "Корзина изменилась — проверьте состав заказа"));
    }
    let seq: i64 = sqlx::query_scalar("SELECT nextval('order_number_seq')").fetch_one(&mut *tx).await?;
    let number = format!("TEK-{seq:06}");
    let email = Some(email_given.to_string()).filter(|e| !e.is_empty()).or_else(|| user.and_then(|u| u.email.clone())).unwrap_or_default();
    let order = sqlx::query_as::<_, OrderRow>(
        r#"INSERT INTO orders (number, user_id, company_id, first_name, last_name, phone, email, status,
              delivery_method, delivery_address, delivery_date, store_id, delivery_price, payment_method, payment_status,
              comment, subtotal_list, discount_total, coupon_code, coupon_discount, subtotal, total, cashback_total,
              due_date, assigned_manager_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           RETURNING *"#,
    )
    .bind(&number)
    .bind(user.map(|u| u.id))
    .bind(company_id)
    .bind(input.contact.first_name.trim())
    .bind(input.contact.last_name.clone().unwrap_or_default().trim())
    .bind(input.contact.phone.trim())
    .bind(&email)
    .bind(&input.delivery.method)
    .bind(input.delivery.address.as_deref().map(str::trim))
    .bind(input.delivery.date)
    .bind(input.delivery.store_id)
    .bind(delivery_price)
    .bind(&input.payment.method)
    .bind(payment_status)
    .bind(input.comment.as_deref().map(str::trim).filter(|c| !c.is_empty()))
    .bind(cj.subtotal_list)
    .bind(cj.discount_total)
    .bind(cj.coupon.as_ref().map(|c| c.code.clone()))
    .bind(cj.coupon.as_ref().map(|c| c.discount).unwrap_or(Decimal::ZERO))
    .bind(cj.subtotal)
    .bind(total)
    .bind(cj.cashback_total)
    .bind(due_date)
    .bind(manager_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut items_payload = Vec::new();
    let mut mail_items = Vec::new();
    for l in &selected {
        let item = cj.items.iter().find(|i| i.id == l.item_id).expect("computed item");
        mail_items.push(mail::MailItem {
            code: l.product.code.clone(),
            name: l.product.name.clone(),
            qty: l.qty,
            unit: l.product.unit.clone(),
            price: item.price.price,
            line_total: item.line_total,
        });
        sqlx::query(
            r#"INSERT INTO order_items (order_id, product_id, code, name, unit, qty, list_price, price, discount_pct, cashback_pct, line_total, line_cashback)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"#,
        )
        .bind(order.id)
        .bind(l.product.id)
        .bind(&l.product.code)
        .bind(&l.product.name)
        .bind(&l.product.unit)
        .bind(l.qty)
        .bind(item.price.list)
        .bind(item.price.price)
        .bind(item.price.discount_pct)
        .bind(if item.price.price.is_zero() { Decimal::ZERO } else { round2(item.price.cashback / item.price.price * Decimal::ONE_HUNDRED) })
        .bind(item.line_total)
        .bind(item.line_cashback)
        .execute(&mut *tx)
        .await?;
        items_payload.push(json!({ "product_id": l.product.id, "code": l.product.code, "name": l.product.name, "qty": l.qty, "price": item.price.price, "line_total": item.line_total }));
    }

    let reserve: Vec<(Uuid, String, Decimal)> = selected.iter().map(|l| (l.product.id, l.product.name.clone(), l.qty)).collect();
    reserve_stock(&mut tx, order.id, &reserve, input.delivery.store_id).await?;

    sqlx::query("INSERT INTO order_events (order_id, kind, label, payload) VALUES ($1, 'created', 'Заказ создан', $2)")
        .bind(order.id)
        .bind(json!({ "number": number }))
        .execute(&mut *tx)
        .await?;

    let manager_json = match manager_id {
        Some(id) => sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .map(|m| json!({ "id": m.id, "name": m.full_name(), "email": m.email, "is_lead": m.is_lead_manager })),
        None => None,
    };
    let crm_payload = json!({
        "number": number, "order_id": order.id, "user_id": user.map(|u| u.id), "company_id": company_id,
        "contact": { "first_name": order.first_name, "last_name": order.last_name, "phone": order.phone, "email": order.email },
        "route": if user.and_then(|u| u.manager_id).is_some() { "assigned_manager" } else { "lead_manager" },
        "manager": manager_json,
        "delivery": { "method": order.delivery_method, "address": order.delivery_address, "date": order.delivery_date, "price": delivery_price },
        "payment": { "method": order.payment_method, "status": payment_status },
        "totals": { "subtotal": cj.subtotal, "discount": cj.discount_total, "coupon": cj.coupon, "total": total, "cashback": cj.cashback_total },
        "items": items_payload, "comment": order.comment,
    });
    outbox::enqueue(&mut tx, "crm", "order.created", crm_payload).await?;
    outbox::enqueue(&mut tx, "onec", "stock.reserve", json!({ "number": number, "order_id": order.id, "items": items_payload })).await?;

    // письма покупателю и менеджеру (закреплённому → MANAGER_NOTIFY_EMAIL → лид-менеджеру) — через outbox
    let delivery_text = match input.delivery.method.as_str() {
        "pickup" => {
            let store: Option<(String, String)> = sqlx::query_as("SELECT name, address FROM stores WHERE id = $1").bind(input.delivery.store_id).fetch_optional(&mut *tx).await?;
            format!("самовывоз{}", store.map(|(n, a)| format!(" — {n}, {a}")).unwrap_or_default())
        }
        _ => format!(
            "доставка — {}{}",
            order.delivery_address.clone().unwrap_or_default(),
            order.delivery_date.map(|d| format!(", {}", delivery::day_label(d))).unwrap_or_default()
        ),
    };
    let order_mail = mail::OrderMail {
        number: &number,
        customer: format!("{} {}", order.first_name, order.last_name).trim().to_string(),
        phone: &order.phone,
        email: &order.email,
        items: &mail_items,
        delivery: delivery_text,
        payment: payment_method_label(&order.payment_method).0.to_string(),
        delivery_price,
        coupon_discount: order.coupon_discount,
        total,
        comment: order.comment.as_deref(),
    };
    if let Some(to) = mail::valid_email(Some(&order.email)) {
        mail::enqueue(&mut tx, "email.order_created", mail::order_created_customer(&state.cfg, to, &order_mail, user.is_some()), Some(&number)).await?;
    }
    if let Some(to) = mail::manager_recipient(&mut tx, &state.cfg, user.and_then(|u| u.manager_id)).await? {
        let company: Option<String> = match company_id {
            Some(cid) => sqlx::query_scalar("SELECT name FROM companies WHERE id = $1").bind(cid).fetch_optional(&mut *tx).await?,
            None => None,
        };
        mail::enqueue(&mut tx, "email.order_new", mail::order_created_manager(&state.cfg, to, &order_mail, company.as_deref()), Some(&number)).await?;
    }

    if let Some(u) = user {
        if company_id.is_some() {
            sqlx::query(
                "INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, order_id, due_date, note) VALUES ($1,$2,$3,'invoice',$4,$5,0,$6,$7,$8)",
            )
            .bind(u.id)
            .bind(company_id)
            .bind(today)
            .bind(format!("СЧ-{seq:06}"))
            .bind(total)
            .bind(order.id)
            .bind(due_date)
            .bind(format!("Заказ {number}"))
            .execute(&mut *tx)
            .await?;
        }
        // кешбэк начисляется при получении заказа (set_status → delivered), а не при оформлении
        sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1,'order_status',$2,$3,$4)")
            .bind(u.id)
            .bind(format!("Заказ {number} создан"))
            .bind("Мы получили ваш заказ и передали его менеджеру.")
            .bind(format!("/account/orders/{number}"))
            .execute(&mut *tx)
            .await?;
    }
    if let Some(c) = &cj.coupon {
        // проверка лимита и списание использования — одним условным UPDATE (без гонки двух заказов)
        let used = sqlx::query(
            "UPDATE coupons SET used_count = used_count + 1 WHERE upper(code) = upper($1) AND active AND (usage_limit IS NULL OR used_count < usage_limit) AND (expires_at IS NULL OR expires_at > now())",
        )
        .bind(&c.code)
        .execute(&mut *tx)
        .await?;
        if used.rows_affected() == 0 {
            return Err(AppError::unprocessable("coupon_exhausted", "Промокод больше не действует"));
        }
    }
    sqlx::query("DELETE FROM cart_items WHERE id = ANY($1)").bind(&ordered_ids).execute(&mut *tx).await?;
    sqlx::query("UPDATE carts SET coupon_code = NULL, updated_at = now() WHERE id = $1").bind(cart_row.id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(order)
}

/// Сколько кешбэка по заказу уже начислено на бонусный счёт (начисления минус корректировки).
async fn accrued_cashback(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, order_id: Uuid) -> AppResult<Decimal> {
    Ok(sqlx::query_scalar("SELECT COALESCE(SUM(amount), 0) FROM bonus_transactions WHERE order_id = $1 AND kind IN ('accrual', 'adjust')")
        .bind(order_id)
        .fetch_one(&mut **tx)
        .await?)
}

/// Перечитывает заказ под блокировкой строки: отмена, изменение, смена статуса и оплата одного заказа идут
/// строго по очереди, а проверки статуса делаются по актуальной строке, а не по прочитанной до транзакции.
async fn lock_order(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, id: Uuid) -> AppResult<OrderRow> {
    Ok(sqlx::query_as::<_, OrderRow>("SELECT * FROM orders WHERE id = $1 FOR UPDATE").bind(id).fetch_one(&mut **tx).await?)
}

/// Номер документа акта сверки по заказу: «ПЛ-000123», для второго и следующих документов того же вида —
/// «ПЛ-000123/2», «ПЛ-000123/3» (частичные оплаты, несколько корректировок).
async fn ledger_doc_number(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, o: &OrderRow, doc_type: &str, prefix: &str) -> AppResult<String> {
    let base = format!("{prefix}-{}", o.number.trim_start_matches("TEK-"));
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM ledger_entries WHERE order_id = $1 AND doc_type = $2")
        .bind(o.id)
        .bind(doc_type)
        .fetch_one(&mut **tx)
        .await?;
    Ok(if n == 0 { base } else { format!("{base}/{}", n + 1) })
}

/// Поступление оплаты по заказу (под блокировкой `lock_order`): сумма копится в `paid_amount`, при полной оплате —
/// статус «Оплачен»; у компании — приход в акте сверки; событие в CRM.
async fn record_payment(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, o: &OrderRow, amount: Decimal, txn_id: Option<String>, note: &str) -> AppResult<()> {
    let paid_amount = round2(o.paid_amount + amount);
    let fully = paid_amount >= o.total;
    // частичная оплата после неудачной онлайн-попытки — снова «ожидает оплаты», а не «ошибка»
    let payment_status = match o.payment_status.as_str() {
        _ if fully => "paid",
        "failed" => "pending",
        other => other,
    };
    sqlx::query("UPDATE orders SET paid_amount = $2, payment_status = $3, updated_at = now() WHERE id = $1")
        .bind(o.id)
        .bind(paid_amount)
        .bind(payment_status)
        .execute(&mut **tx)
        .await?;
    let (kind, label) = if fully { ("paid", "Оплата получена".to_string()) } else { ("payment", format!("Частичная оплата: {} с.", amount.normalize())) };
    sqlx::query("INSERT INTO order_events (order_id, kind, label, payload) VALUES ($1, $2, $3, $4)")
        .bind(o.id)
        .bind(kind)
        .bind(label)
        .bind(json!({ "txn_id": txn_id, "amount": amount }))
        .execute(&mut **tx)
        .await?;
    if let (Some(uid), Some(cid)) = (o.user_id, o.company_id) {
        if amount > Decimal::ZERO {
            let doc = ledger_doc_number(tx, o, "payment", "ПЛ").await?;
            sqlx::query("INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, order_id, note) VALUES ($1,$2,$3,'payment',$4,0,$5,$6,$7)")
                .bind(uid)
                .bind(cid)
                .bind(delivery::today_local())
                .bind(doc)
                .bind(amount)
                .bind(o.id)
                .bind(note)
                .execute(&mut **tx)
                .await?;
        }
    }
    outbox::enqueue(tx, "crm", "order.updated", json!({ "number": o.number, "order_id": o.id, "payment_status": payment_status, "paid_amount": paid_amount }))
        .await?;
    Ok(())
}

/// Отмена заказа (клиентом или менеджером): остатки — обратно на склады, использование промокода — обратно,
/// начисленный кешбэк — сторно, неоплаченная часть счёта — кредит-нотой; события в CRM и 1С.
async fn apply_cancel(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, o: &OrderRow, label: &str) -> AppResult<()> {
    sqlx::query("UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1").bind(o.id).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO order_events (order_id, kind, label) VALUES ($1, 'cancelled', $2)").bind(o.id).bind(label).execute(&mut **tx).await?;
    release_stock(tx, o.id).await?;
    if let Some(code) = &o.coupon_code {
        sqlx::query("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE upper(code) = upper($1)").bind(code).execute(&mut **tx).await?;
    }
    if let Some(uid) = o.user_id {
        let today = delivery::today_local();
        let accrued = accrued_cashback(tx, o.id).await?;
        if accrued > Decimal::ZERO {
            sqlx::query("INSERT INTO bonus_transactions (user_id, order_id, entry_date, kind, amount, note) VALUES ($1,$2,$3,'adjust',$4,$5)")
                .bind(uid)
                .bind(o.id)
                .bind(today)
                .bind(-accrued)
                .bind(format!("Отмена заказа {}", o.number))
                .execute(&mut **tx)
                .await?;
        }
        let unpaid = round2(o.total - o.paid_amount).max(Decimal::ZERO);
        if o.company_id.is_some() && unpaid > Decimal::ZERO {
            let doc = ledger_doc_number(tx, o, "credit_note", "КОР").await?;
            sqlx::query("INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, order_id, note) VALUES ($1,$2,$3,'credit_note',$4,0,$5,$6,$7)")
                .bind(uid)
                .bind(o.company_id)
                .bind(today)
                .bind(doc)
                .bind(unpaid)
                .bind(o.id)
                .bind(format!("Отмена заказа {}", o.number))
                .execute(&mut **tx)
                .await?;
        }
    }
    outbox::enqueue(tx, "crm", "order.cancelled", json!({ "number": o.number, "order_id": o.id })).await?;
    outbox::enqueue(tx, "onec", "stock.release", json!({ "number": o.number, "order_id": o.id })).await?;
    Ok(())
}

pub async fn cancel_order(state: &AppState, o: &OrderRow) -> AppResult<OrderRow> {
    let mut tx = state.pool.begin().await?;
    let o = lock_order(&mut tx, o.id).await?;
    if !is_editable(&o.status) {
        return Err(AppError::conflict("not_cancellable", "Заказ уже отгружен и не может быть отменён"));
    }
    if o.payment_status == "paid" || o.paid_amount > Decimal::ZERO {
        return Err(AppError::conflict("paid_order", "Заказ оплачен — для отмены и возврата денег свяжитесь с менеджером"));
    }
    apply_cancel(&mut tx, &o, "Заказ отменён клиентом").await?;
    tx.commit().await?;
    state.invalidate_public();
    load_by_id(&state.pool, o.id).await
}

#[derive(Debug, Deserialize)]
pub struct EditItem {
    pub product_id: Uuid,
    pub qty: Decimal,
}

/// Позиция изменённого заказа: цены — как при оформлении (для товаров, которые уже были в заказе) или текущие.
struct EditLine {
    product: ProductRow,
    qty: Decimal,
    list: Decimal,
    price: Decimal,
    discount_pct: Decimal,
    cashback_pct: Decimal,
    line_total: Decimal,
    line_cashback: Decimal,
}

pub async fn edit_order(state: &AppState, o: &OrderRow, user: &UserRow, items: Vec<EditItem>, comment: Option<String>) -> AppResult<OrderRow> {
    let items: Vec<EditItem> = items.into_iter().filter(|i| i.qty > Decimal::ZERO).collect();
    if items.is_empty() {
        return Err(AppError::unprocessable("empty_order", "В заказе должен остаться хотя бы один товар"));
    }
    let ctx = PriceCtx::for_user(&state.pool, user).await?;
    let ids: Vec<Uuid> = items.iter().map(|i| i.product_id).collect();
    let products = products_by_ids(&state.pool, &ids).await?;
    let coupon = match &o.coupon_code {
        Some(code) => cart::load_coupon(&state.pool, code).await?,
        None => None,
    };

    let mut tx = state.pool.begin().await?;
    let o = lock_order(&mut tx, o.id).await?;
    if !is_editable(&o.status) {
        return Err(AppError::conflict("not_editable", "Заказ уже отгружен и не может быть изменён"));
    }
    if o.payment_status == "paid" {
        return Err(AppError::conflict("paid_order", "Заказ оплачен — изменить состав можно через менеджера"));
    }
    // цены уже заказанных товаров не пересчитываются по сегодняшнему прайсу — меняется только количество
    let old_items = sqlx::query_as::<_, OrderItemRow>("SELECT * FROM order_items WHERE order_id = $1").bind(o.id).fetch_all(&mut *tx).await?;
    let mut subtotal_list = Decimal::ZERO;
    let mut subtotal = Decimal::ZERO;
    let mut cashback_total = Decimal::ZERO;
    let mut rows = Vec::new();
    for it in &items {
        let Some(p) = products.iter().find(|p| p.id == it.product_id) else {
            return Err(AppError::unprocessable("unknown_product", "Товар не найден"));
        };
        // снятый с продажи товар остаётся в заказе, если уже был в нём, но добавить его заново нельзя
        if !p.is_active && !old_items.iter().any(|i| i.product_id == Some(p.id)) {
            return Err(AppError::unprocessable("product_unavailable", format!("«{}» снят с продажи", p.name)).with_details(json!({ "product_id": p.id })));
        }
        validate_qty(it.qty, &p.unit, &p.name, p.pack_qty)?;
        let line = match old_items.iter().find(|i| i.product_id == Some(p.id)) {
            Some(old) => {
                let unit_cashback = if old.qty.is_zero() { Decimal::ZERO } else { old.line_cashback / old.qty };
                EditLine {
                    product: p.clone(),
                    qty: it.qty,
                    list: old.list_price,
                    price: old.price,
                    discount_pct: old.discount_pct,
                    cashback_pct: old.cashback_pct,
                    line_total: round2(old.price * it.qty),
                    line_cashback: round2(unit_cashback * it.qty),
                }
            }
            None => {
                let price = ctx.price(p);
                EditLine {
                    product: p.clone(),
                    qty: it.qty,
                    list: price.list,
                    price: price.price,
                    discount_pct: price.discount_pct,
                    cashback_pct: if price.price.is_zero() { Decimal::ZERO } else { round2(price.cashback / price.price * Decimal::ONE_HUNDRED) },
                    line_total: round2(price.price * it.qty),
                    line_cashback: round2(price.cashback * it.qty),
                }
            }
        };
        subtotal_list += round2(line.list * line.qty);
        subtotal += line.line_total;
        cashback_total += line.line_cashback;
        rows.push(line);
    }
    // промокод заказ уже использовал — его срок и лимит не проверяем; доставка — по тем же правилам, что в чекауте
    let coupon_discount = coupon.as_ref().and_then(|c| cart::redeemed_coupon_discount(c, subtotal)).unwrap_or(Decimal::ZERO);
    let goods_total = (subtotal - coupon_discount).max(Decimal::ZERO);
    let delivery_price = delivery_price(&o.delivery_method, goods_total)?;
    let total = round2(goods_total + delivery_price);
    // после частичной оплаты сумма заказа не может стать меньше уже внесённой
    if total < o.paid_amount {
        return Err(AppError::conflict("below_paid", "Заказ частично оплачен — уменьшить его сумму можно через менеджера"));
    }
    // остатки старого и нового состава блокируются сразу и в общем порядке (товар, склад) — иначе release + reserve
    // двумя проходами нарушили бы порядок и могли бы взаимно заблокироваться со встречным заказом
    let new_ids: Vec<Uuid> = rows.iter().map(|l| l.product.id).collect();
    sqlx::query(
        r#"SELECT 1 FROM stock WHERE product_id = ANY($1) OR product_id IN (SELECT product_id FROM order_stock WHERE order_id = $2)
           ORDER BY product_id, store_id FOR UPDATE"#,
    )
    .bind(&new_ids)
    .bind(o.id)
    .execute(&mut *tx)
    .await?;
    // старый резерв — на склад, новый состав — в резерв (остаток проверяется под блокировкой)
    release_stock(&mut tx, o.id).await?;
    let reserve: Vec<(Uuid, String, Decimal)> = rows.iter().map(|l| (l.product.id, l.product.name.clone(), l.qty)).collect();
    reserve_stock(&mut tx, o.id, &reserve, o.store_id).await?;
    sqlx::query("DELETE FROM order_items WHERE order_id = $1").bind(o.id).execute(&mut *tx).await?;
    let mut payload_items = Vec::new();
    for l in &rows {
        let p = &l.product;
        sqlx::query(
            r#"INSERT INTO order_items (order_id, product_id, code, name, unit, qty, list_price, price, discount_pct, cashback_pct, line_total, line_cashback)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"#,
        )
        .bind(o.id)
        .bind(p.id)
        .bind(&p.code)
        .bind(&p.name)
        .bind(&p.unit)
        .bind(l.qty)
        .bind(l.list)
        .bind(l.price)
        .bind(l.discount_pct)
        .bind(l.cashback_pct)
        .bind(l.line_total)
        .bind(l.line_cashback)
        .execute(&mut *tx)
        .await?;
        payload_items.push(json!({ "product_id": p.id, "code": p.code, "qty": l.qty, "price": l.price, "line_total": l.line_total }));
    }
    sqlx::query(
        r#"UPDATE orders SET subtotal_list = $2, discount_total = $3, coupon_discount = $4, subtotal = $5, total = $6,
           cashback_total = $7, comment = COALESCE($8, comment), delivery_price = $9, updated_at = now() WHERE id = $1"#,
    )
    .bind(o.id)
    .bind(subtotal_list)
    .bind(round2(subtotal_list - subtotal))
    .bind(coupon_discount)
    .bind(subtotal)
    .bind(total)
    .bind(cashback_total)
    .bind(comment)
    .bind(delivery_price)
    .execute(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO order_events (order_id, kind, label) VALUES ($1, 'edited', 'Состав заказа изменён клиентом')")
        .bind(o.id)
        .execute(&mut *tx)
        .await?;
    if let (Some(uid), Some(cid)) = (o.user_id, o.company_id) {
        // исходный документ не переписываем (акт сверки за прошлый период не должен меняться) — разница отдельной корректировкой
        let diff = round2(total - o.total);
        if !diff.is_zero() {
            let doc = ledger_doc_number(&mut tx, &o, "credit_note", "КОР").await?;
            sqlx::query("INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, order_id, note) VALUES ($1,$2,$3,'credit_note',$4,$5,$6,$7,$8)")
                .bind(uid)
                .bind(cid)
                .bind(delivery::today_local())
                .bind(doc)
                .bind(diff.max(Decimal::ZERO))
                .bind((-diff).max(Decimal::ZERO))
                .bind(o.id)
                .bind(format!("Изменение заказа {}", o.number))
                .execute(&mut *tx)
                .await?;
        }
    }
    if let Some(uid) = o.user_id {
        // корректируем только уже начисленный кешбэк (заказы, оформленные до начисления по получению)
        let accrued = accrued_cashback(&mut tx, o.id).await?;
        let diff = if accrued.is_zero() { Decimal::ZERO } else { round2(cashback_total - accrued) };
        if !diff.is_zero() {
            sqlx::query("INSERT INTO bonus_transactions (user_id, order_id, entry_date, kind, amount, note) VALUES ($1,$2,$3,'adjust',$4,$5)")
                .bind(uid)
                .bind(o.id)
                .bind(delivery::today_local())
                .bind(diff)
                .bind(format!("Изменение заказа {}", o.number))
                .execute(&mut *tx)
                .await?;
        }
    }
    // после частичной оплаты заказ уменьшили ровно до внесённой суммы — он оплачен полностью
    if o.paid_amount > Decimal::ZERO && total <= o.paid_amount {
        let updated = lock_order(&mut tx, o.id).await?;
        record_payment(&mut tx, &updated, Decimal::ZERO, None, &format!("Оплата заказа {}", o.number)).await?;
    }
    outbox::enqueue(&mut tx, "crm", "order.updated", json!({ "number": o.number, "order_id": o.id, "items": payload_items, "delivery_price": delivery_price, "total": total }))
        .await?;
    outbox::enqueue(&mut tx, "onec", "stock.reserve", json!({ "number": o.number, "order_id": o.id, "items": payload_items })).await?;
    tx.commit().await?;
    state.invalidate_public();
    load_by_id(&state.pool, o.id).await
}

/// Допустимые переходы статуса заказа (менеджер): вперёд по цепочке или отмена до получения.
fn transition_allowed(from: &str, to: &str) -> bool {
    match from {
        "new" => matches!(to, "confirmed" | "processing" | "shipped" | "cancelled"),
        "confirmed" => matches!(to, "processing" | "shipped" | "cancelled"),
        "processing" => matches!(to, "shipped" | "cancelled"),
        "shipped" => matches!(to, "delivered" | "cancelled"),
        _ => false,
    }
}

pub async fn set_status(state: &AppState, o: &OrderRow, status: &str) -> AppResult<OrderRow> {
    if !matches!(status, "new" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled") {
        return Err(AppError::unprocessable("invalid_status", "Неизвестный статус"));
    }
    let mut tx = state.pool.begin().await?;
    let o = lock_order(&mut tx, o.id).await?;
    if !transition_allowed(&o.status, status) {
        return Err(AppError::conflict(
            "invalid_transition",
            format!("Нельзя перевести заказ из «{}» в «{}»", order_status_label(&o.status), order_status_label(status)),
        ));
    }
    if status == "cancelled" {
        apply_cancel(&mut tx, &o, "Заказ отменён менеджером").await?;
    } else {
        sqlx::query("UPDATE orders SET status = $2, updated_at = now() WHERE id = $1").bind(o.id).bind(status).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO order_events (order_id, kind, label) VALUES ($1, $2, $3)")
            .bind(o.id)
            .bind(status)
            .bind(format!("Статус: {}", order_status_label(status)))
            .execute(&mut *tx)
            .await?;
        outbox::enqueue(&mut tx, "crm", "order.updated", json!({ "number": o.number, "order_id": o.id, "status": status })).await?;
        // «Наличными при получении»: получение заказа и есть оплата — иначе долг в акте сверки не закрылся бы никогда
        if status == "delivered" && o.payment_method == "cash" && o.payment_status != "paid" {
            let rest = round2(o.total - o.paid_amount).max(Decimal::ZERO);
            record_payment(&mut tx, &o, rest, None, &format!("Оплата наличными при получении заказа {}", o.number)).await?;
        }
    }
    if let Some(uid) = o.user_id {
        // кешбэк — на бонусный счёт при получении заказа
        if status == "delivered" && o.cashback_total > Decimal::ZERO && accrued_cashback(&mut tx, o.id).await?.is_zero() {
            sqlx::query("INSERT INTO bonus_transactions (user_id, order_id, entry_date, kind, amount, note) VALUES ($1,$2,$3,'accrual',$4,$5)")
                .bind(uid)
                .bind(o.id)
                .bind(delivery::today_local())
                .bind(o.cashback_total)
                .bind(format!("Кешбэк по заказу {}", o.number))
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1,'order_status',$2,$3,$4)")
            .bind(uid)
            .bind(format!("Заказ {}: {}", o.number, order_status_label(status)))
            .bind("Статус вашего заказа обновлён.")
            .bind(format!("/account/orders/{}", o.number))
            .execute(&mut *tx)
            .await?;
    }
    if let Some(to) = mail::valid_email(Some(&o.email)) {
        let m = mail::order_status(&state.cfg, to, &o.first_name, &o.number, order_status_label(status), o.user_id.is_some());
        mail::enqueue(&mut tx, "email.order_status", m, Some(&o.number)).await?;
    }
    tx.commit().await?;
    if status == "cancelled" {
        state.invalidate_public();
    }
    load_by_id(&state.pool, o.id).await
}

pub async fn mark_paid(state: &AppState, o: &OrderRow, txn_id: Option<String>, paid: bool) -> AppResult<OrderRow> {
    let mut tx = state.pool.begin().await?;
    let o = lock_order(&mut tx, o.id).await?;
    // повторный callback и «failed» после «paid» ничего не меняют; отменённый заказ оплатить нельзя
    if o.payment_status == "paid" {
        return Ok(o);
    }
    if o.status == "cancelled" {
        return Err(AppError::conflict("order_cancelled", "Заказ отменён"));
    }
    if paid {
        let rest = round2(o.total - o.paid_amount).max(Decimal::ZERO);
        record_payment(&mut tx, &o, rest, txn_id, &format!("Онлайн-оплата заказа {}", o.number)).await?;
    } else {
        sqlx::query("UPDATE orders SET payment_status = 'failed', updated_at = now() WHERE id = $1").bind(o.id).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO order_events (order_id, kind, label) VALUES ($1, 'payment_failed', 'Ошибка оплаты')").bind(o.id).execute(&mut *tx).await?;
        outbox::enqueue(&mut tx, "crm", "order.updated", json!({ "number": o.number, "order_id": o.id, "payment_status": "failed" })).await?;
    }
    tx.commit().await?;
    load_by_id(&state.pool, o.id).await
}

/// Поступление оплаты, внесённое менеджером: банковский перевод по счёту (в том числе частичный) или оплата,
/// подтверждённая вручную. Без суммы — весь остаток.
pub async fn register_payment(state: &AppState, o: &OrderRow, amount: Option<Decimal>, note: Option<String>) -> AppResult<OrderRow> {
    let mut tx = state.pool.begin().await?;
    let o = lock_order(&mut tx, o.id).await?;
    if o.status == "cancelled" {
        return Err(AppError::conflict("order_cancelled", "Заказ отменён"));
    }
    let rest = round2(o.total - o.paid_amount).max(Decimal::ZERO);
    if rest.is_zero() {
        return Err(AppError::conflict("already_paid", "Заказ уже оплачен полностью"));
    }
    let amount = amount.map(round2).unwrap_or(rest);
    if amount <= Decimal::ZERO || amount > rest {
        return Err(AppError::unprocessable("invalid_amount", format!("Сумма оплаты — от 0,01 до {} с.", rest.normalize())));
    }
    let note = note.map(|n| n.trim().to_string()).filter(|n| !n.is_empty()).unwrap_or_else(|| format!("Оплата заказа {}", o.number));
    record_payment(&mut tx, &o, amount, None, &note).await?;
    tx.commit().await?;
    load_by_id(&state.pool, o.id).await
}

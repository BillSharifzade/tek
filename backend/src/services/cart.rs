use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::{AssertSqlSafe, PgPool};
use uuid::Uuid;

use crate::{
    auth::CartIdentity,
    error::{AppError, AppResult},
    models::{CartItemError, CartItemJson, CartJson, CartRow, CouponJson, CouponRow, ProductRow, PRODUCT_SELECT},
    services::{catalog::to_card, pricing::{round2, PriceCtx}},
    state::AppState,
};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CartLineRow {
    pub item_id: Uuid,
    pub qty: Decimal,
    pub selected: bool,
    #[sqlx(flatten)]
    pub product: ProductRow,
}

/// Find the cart for the identity. `create` → create one if missing (guest carts get a token).
pub async fn resolve_cart(state: &AppState, identity: &CartIdentity, create: bool) -> AppResult<Option<CartRow>> {
    let pool = &state.pool;
    if let Some(user) = &identity.user {
        let row = sqlx::query_as::<_, CartRow>("SELECT id, user_id, token, coupon_code FROM carts WHERE user_id = $1")
            .bind(user.id)
            .fetch_optional(pool)
            .await?;
        if row.is_some() || !create {
            return Ok(row);
        }
        let row = sqlx::query_as::<_, CartRow>(
            "INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING id, user_id, token, coupon_code",
        )
        .bind(user.id)
        .fetch_one(pool)
        .await?;
        return Ok(Some(row));
    }
    if let Some(token) = identity.token {
        let row = sqlx::query_as::<_, CartRow>("SELECT id, user_id, token, coupon_code FROM carts WHERE token = $1")
            .bind(token)
            .fetch_optional(pool)
            .await?;
        if row.is_some() || !create {
            return Ok(row);
        }
        let row = sqlx::query_as::<_, CartRow>(
            "INSERT INTO carts (token) VALUES ($1) ON CONFLICT (token) DO UPDATE SET updated_at = now() RETURNING id, user_id, token, coupon_code",
        )
        .bind(token)
        .fetch_one(pool)
        .await?;
        return Ok(Some(row));
    }
    if !create {
        return Ok(None);
    }
    let row = sqlx::query_as::<_, CartRow>(
        "INSERT INTO carts (token) VALUES ($1) RETURNING id, user_id, token, coupon_code",
    )
    .bind(Uuid::new_v4())
    .fetch_one(pool)
    .await?;
    Ok(Some(row))
}

pub async fn cart_by_id(pool: &PgPool, id: Uuid) -> AppResult<CartRow> {
    Ok(sqlx::query_as::<_, CartRow>("SELECT id, user_id, token, coupon_code FROM carts WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await?)
}

pub async fn load_lines(pool: &PgPool, cart_id: Uuid) -> AppResult<Vec<CartLineRow>> {
    let sql = format!(
        "SELECT ci.id AS item_id, ci.qty, ci.selected, sub.* FROM cart_items ci JOIN ({PRODUCT_SELECT}) sub ON sub.id = ci.product_id WHERE ci.cart_id = $1 ORDER BY ci.created_at"
    );
    Ok(sqlx::query_as::<_, CartLineRow>(AssertSqlSafe(sql)).bind(cart_id).fetch_all(pool).await?)
}

pub async fn load_coupon(pool: &PgPool, code: &str) -> AppResult<Option<CouponRow>> {
    Ok(sqlx::query_as::<_, CouponRow>("SELECT * FROM coupons WHERE upper(code) = upper($1)")
        .bind(code)
        .fetch_optional(pool)
        .await?)
}

/// Returns the discount amount if the coupon is applicable to `subtotal`.
pub fn coupon_discount(c: &CouponRow, subtotal: Decimal) -> Result<Decimal, &'static str> {
    if !c.active {
        return Err("Купон не активен");
    }
    if let Some(exp) = c.expires_at {
        if exp < Utc::now() {
            return Err("Срок действия купона истёк");
        }
    }
    if let Some(limit) = c.usage_limit {
        if c.used_count >= limit {
            return Err("Лимит использования купона исчерпан");
        }
    }
    if subtotal < c.min_total {
        return Err("Сумма заказа меньше минимальной для купона");
    }
    let d = match c.kind.as_str() {
        "percent" => round2(subtotal * c.value / dec!(100)),
        _ => c.value.min(subtotal),
    };
    Ok(d)
}

pub struct Computed {
    pub json: CartJson,
    pub lines: Vec<CartLineRow>,
}

pub async fn compute(state: &AppState, cart: &CartRow, ctx: &PriceCtx) -> AppResult<Computed> {
    let lines = load_lines(&state.pool, cart.id).await?;
    let mut items = Vec::with_capacity(lines.len());
    let mut subtotal_list = Decimal::ZERO;
    let mut subtotal = Decimal::ZERO;
    let mut cashback_total = Decimal::ZERO;
    let mut selected_count = 0usize;
    let mut has_errors = false;
    for l in &lines {
        let card = to_card(&l.product, ctx);
        let price = card.price.clone();
        let line_total = round2(price.price * l.qty);
        let line_cashback = round2(price.cashback * l.qty);
        let error = if l.qty > l.product.stock_total {
            has_errors = has_errors || l.selected;
            Some(CartItemError { code: "insufficient_stock", available: l.product.stock_total })
        } else {
            None
        };
        if l.selected {
            selected_count += 1;
            subtotal_list += round2(price.list * l.qty);
            subtotal += line_total;
            cashback_total += line_cashback;
        }
        items.push(CartItemJson {
            id: l.item_id,
            stock_total: l.product.stock_total,
            product: card,
            qty: l.qty,
            selected: l.selected,
            price,
            line_total,
            line_cashback,
            error,
        });
    }
    let mut coupon = None;
    let mut coupon_discount_amount = Decimal::ZERO;
    if let Some(code) = &cart.coupon_code {
        if let Some(c) = load_coupon(&state.pool, code).await? {
            if let Ok(d) = coupon_discount(&c, subtotal) {
                coupon_discount_amount = d;
                coupon = Some(CouponJson { code: c.code.clone(), discount: d });
            }
        }
    }
    let total = (subtotal - coupon_discount_amount).max(Decimal::ZERO);
    let json = CartJson {
        id: cart.id,
        cart_token: if cart.user_id.is_some() { None } else { cart.token },
        items_count: items.len(),
        selected_count,
        items,
        subtotal_list,
        discount_total: round2(subtotal_list - subtotal),
        coupon,
        subtotal,
        cashback_total,
        total,
        has_errors,
    };
    Ok(Computed { json, lines })
}

pub async fn view(state: &AppState, cart: &CartRow, ctx: &PriceCtx) -> AppResult<CartJson> {
    Ok(compute(state, cart, ctx).await?.json)
}

/// Add (or increment) a product in the cart with a stock check.
pub async fn add_item(state: &AppState, cart_id: Uuid, product_id: Uuid, qty: Decimal) -> AppResult<()> {
    if qty <= Decimal::ZERO {
        return Err(AppError::unprocessable("invalid_qty", "Количество должно быть больше нуля"));
    }
    let row: Option<(Decimal, String, String, Option<Decimal>)> = sqlx::query_as(
        "SELECT (SELECT COALESCE(SUM(qty),0) FROM stock WHERE product_id = p.id), p.unit, p.name, p.pack_qty FROM products p WHERE p.id = $1",
    )
    .bind(product_id)
    .fetch_optional(&state.pool)
    .await?;
    let Some((stock, unit, name, pack)) = row else { return Err(AppError::not_found("Товар не найден")) };
    crate::services::orders::validate_qty(qty, &unit, &name, pack)?;
    let existing: Option<Decimal> =
        sqlx::query_scalar("SELECT qty FROM cart_items WHERE cart_id = $1 AND product_id = $2")
            .bind(cart_id)
            .bind(product_id)
            .fetch_optional(&state.pool)
            .await?;
    let new_qty = existing.unwrap_or(Decimal::ZERO) + qty;
    if new_qty > stock {
        return Err(AppError::unprocessable("insufficient_stock", "Количество превышает остаток на складе")
            .with_details(serde_json::json!({ "available": stock, "requested": new_qty })));
    }
    sqlx::query(
        r#"INSERT INTO cart_items (cart_id, product_id, qty) VALUES ($1, $2, $3)
           ON CONFLICT (cart_id, product_id) DO UPDATE SET qty = cart_items.qty + EXCLUDED.qty, selected = true"#,
    )
    .bind(cart_id)
    .bind(product_id)
    .bind(qty)
    .execute(&state.pool)
    .await?;
    touch(state, cart_id).await
}

pub async fn touch(state: &AppState, cart_id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE carts SET updated_at = now() WHERE id = $1").bind(cart_id).execute(&state.pool).await?;
    Ok(())
}

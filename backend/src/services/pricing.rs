use rust_decimal::{Decimal, RoundingStrategy};
use rust_decimal_macros::dec;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::{Price, ProductRow, UserRow},
};

pub fn round2(d: Decimal) -> Decimal {
    d.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PriceRule {
    pub category_path: Option<String>,
    pub brand_id: Option<i32>,
    pub product_id: Option<Uuid>,
    pub discount_pct: Decimal,
}

/// Personal pricing context: персональная скидка аккаунта (по умолчанию и по правилам). Anonymous → list prices.
/// Кешбэк от аккаунта не зависит — он задаётся товару (доработки R5).
#[derive(Debug, Clone, Default)]
pub struct PriceCtx {
    pub discount_pct: Decimal,
    pub rules: Vec<PriceRule>,
}

impl PriceCtx {
    pub fn anonymous() -> Self {
        Self::default()
    }

    pub async fn for_user(pool: &PgPool, user: &UserRow) -> AppResult<Self> {
        let rules = sqlx::query_as::<_, PriceRule>(
            r#"SELECT c.path AS category_path, r.brand_id, r.product_id, r.discount_pct
               FROM user_price_rules r LEFT JOIN categories c ON c.id = r.category_id
               WHERE r.user_id = $1"#,
        )
        .bind(user.id)
        .fetch_all(pool)
        .await?;
        Ok(Self { discount_pct: user.discount_pct, rules })
    }

    pub async fn for_optional(pool: &PgPool, user: Option<&UserRow>) -> AppResult<Self> {
        match user {
            Some(u) => Self::for_user(pool, u).await,
            None => Ok(Self::anonymous()),
        }
    }

    /// Most specific rule wins: product > brand > nearest category > user default.
    pub fn resolve(&self, product_id: Uuid, brand_id: Option<i32>, category_path: &str) -> Decimal {
        if let Some(r) = self.rules.iter().find(|r| r.product_id == Some(product_id)) {
            return r.discount_pct;
        }
        if let Some(b) = brand_id {
            if let Some(r) = self.rules.iter().find(|r| r.product_id.is_none() && r.brand_id == Some(b)) {
                return r.discount_pct;
            }
        }
        let best = self
            .rules
            .iter()
            .filter(|r| r.product_id.is_none() && r.brand_id.is_none())
            .filter_map(|r| r.category_path.as_deref().map(|p| (p, r)))
            .filter(|(p, _)| category_path == *p || category_path.starts_with(&format!("{p}/")))
            .max_by_key(|(p, _)| p.len());
        if let Some((_, r)) = best {
            return r.discount_pct;
        }
        self.discount_pct
    }

    /// Цена для покупателя. Персональная скидка — это и есть его обычная цена: `list` — цена со скидкой аккаунта
    /// без акции, `price` — к оплате; зачёркнутая цена и выгода остаются только у акционных товаров (`sale`).
    /// Кешбэк — `cashback_pct` товара от цены к оплате.
    pub fn price_for(&self, product_id: Uuid, brand_id: Option<i32>, category_path: &str, list: Decimal, sale: Option<Decimal>, cashback_pct: Decimal) -> Price {
        let discount_pct = self.resolve(product_id, brand_id, category_path);
        let k = dec!(1) - discount_pct / dec!(100);
        let regular = round2(list * k);
        let price = sale.map(|s| round2(s * k)).unwrap_or(regular);
        let cashback = round2(price * cashback_pct / dec!(100));
        Price {
            list: regular,
            price,
            discount_pct,
            cashback,
            cashback_pct,
            sale: sale.is_some(),
            savings: round2((regular - price).max(Decimal::ZERO)),
        }
    }

    pub fn price(&self, p: &ProductRow) -> Price {
        self.price_for(p.id, p.brand_id, &p.category_path, p.list_price, p.sale_price, p.cashback_pct)
    }
}

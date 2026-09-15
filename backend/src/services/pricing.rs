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
    pub cashback_pct: Decimal,
}

/// Personal pricing context. Anonymous → list prices.
#[derive(Debug, Clone, Default)]
pub struct PriceCtx {
    pub discount_pct: Decimal,
    pub cashback_pct: Decimal,
    pub rules: Vec<PriceRule>,
}

impl PriceCtx {
    pub fn anonymous() -> Self {
        Self::default()
    }

    pub async fn for_user(pool: &PgPool, user: &UserRow) -> AppResult<Self> {
        let rules = sqlx::query_as::<_, PriceRule>(
            r#"SELECT c.path AS category_path, r.brand_id, r.product_id, r.discount_pct, r.cashback_pct
               FROM user_price_rules r LEFT JOIN categories c ON c.id = r.category_id
               WHERE r.user_id = $1"#,
        )
        .bind(user.id)
        .fetch_all(pool)
        .await?;
        Ok(Self { discount_pct: user.discount_pct, cashback_pct: user.cashback_pct, rules })
    }

    pub async fn for_optional(pool: &PgPool, user: Option<&UserRow>) -> AppResult<Self> {
        match user {
            Some(u) => Self::for_user(pool, u).await,
            None => Ok(Self::anonymous()),
        }
    }

    /// Most specific rule wins: product > brand > nearest category > user default.
    pub fn resolve(&self, product_id: Uuid, brand_id: Option<i32>, category_path: &str) -> (Decimal, Decimal) {
        if let Some(r) = self.rules.iter().find(|r| r.product_id == Some(product_id)) {
            return (r.discount_pct, r.cashback_pct);
        }
        if let Some(b) = brand_id {
            if let Some(r) = self.rules.iter().find(|r| r.product_id.is_none() && r.brand_id == Some(b)) {
                return (r.discount_pct, r.cashback_pct);
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
            return (r.discount_pct, r.cashback_pct);
        }
        (self.discount_pct, self.cashback_pct)
    }

    pub fn price_for(&self, product_id: Uuid, brand_id: Option<i32>, category_path: &str, list: Decimal, sale: Option<Decimal>) -> Price {
        let (discount_pct, cashback_pct) = self.resolve(product_id, brand_id, category_path);
        let base = sale.unwrap_or(list);
        let price = round2(base * (dec!(1) - discount_pct / dec!(100)));
        let cashback = round2(price * cashback_pct / dec!(100));
        Price {
            list,
            price,
            discount_pct,
            cashback,
            sale: sale.is_some(),
            savings: round2((list - price).max(Decimal::ZERO)),
        }
    }

    pub fn price(&self, p: &ProductRow) -> Price {
        self.price_for(p.id, p.brand_id, &p.category_path, p.list_price, p.sale_price)
    }
}

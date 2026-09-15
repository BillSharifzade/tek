use rust_decimal::Decimal;
use sqlx::{AssertSqlSafe, PgPool};
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::{BrandRef, ProductCard, ProductRow, PRODUCT_SELECT},
    services::pricing::PriceCtx,
};

pub fn to_card(p: &ProductRow, ctx: &PriceCtx) -> ProductCard {
    let price = ctx.price(p);
    let mut badges = Vec::new();
    if p.sale_price.is_some() {
        badges.push("sale");
    }
    if p.is_hit {
        badges.push("hit");
    }
    if p.is_new {
        badges.push("new");
    }
    ProductCard {
        id: p.id,
        slug: p.slug.clone(),
        code: p.code.clone(),
        name: p.name.clone(),
        brand: BrandRef {
            slug: p.brand_slug.clone().unwrap_or_default(),
            name: p.brand_name.clone().unwrap_or_default(),
        },
        unit: p.unit.clone(),
        image: p.images.first().cloned(),
        price,
        stock_total: p.stock_total,
        in_stock: p.stock_total > Decimal::ZERO,
        badges,
        rating: p.rating,
        reviews_count: p.reviews_count,
        price_unit_label: if p.unit == "м" { "за метр" } else { "за шт" },
        category: BrandRef { slug: p.category_slug.clone(), name: p.category_name.clone() },
    }
}

pub async fn product_by_slug(pool: &PgPool, slug: &str) -> AppResult<Option<ProductRow>> {
    let sql = format!("{PRODUCT_SELECT} WHERE p.slug = $1");
    Ok(sqlx::query_as::<_, ProductRow>(AssertSqlSafe(sql)).bind(slug).fetch_optional(pool).await?)
}

#[allow(dead_code)]
pub async fn product_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<ProductRow>> {
    let sql = format!("{PRODUCT_SELECT} WHERE p.id = $1");
    Ok(sqlx::query_as::<_, ProductRow>(AssertSqlSafe(sql)).bind(id).fetch_optional(pool).await?)
}

/// Fetch many products in one query, preserving the order of `ids`.
pub async fn products_by_ids(pool: &PgPool, ids: &[Uuid]) -> AppResult<Vec<ProductRow>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let sql = format!("{PRODUCT_SELECT} WHERE p.id = ANY($1)");
    let rows = sqlx::query_as::<_, ProductRow>(AssertSqlSafe(sql)).bind(ids).fetch_all(pool).await?;
    let mut out: Vec<ProductRow> = Vec::with_capacity(rows.len());
    for id in ids {
        if let Some(r) = rows.iter().find(|r| r.id == *id) {
            out.push(r.clone());
        }
    }
    Ok(out)
}

pub async fn products_where(pool: &PgPool, where_sql: &str, limit: i64) -> AppResult<Vec<ProductRow>> {
    let sql = format!("{PRODUCT_SELECT} WHERE {where_sql} LIMIT {limit}");
    Ok(sqlx::query_as::<_, ProductRow>(AssertSqlSafe(sql)).fetch_all(pool).await?)
}

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::Response,
    routing::get,
    Router,
};
use serde::Serialize;
use serde_json::json;

use crate::{error::{AppError, AppResult}, models::BrandRow, state::AppState};

#[derive(Serialize, sqlx::FromRow)]
struct BrandListRow {
    slug: String,
    name: String,
    #[sqlx(rename = "logo_url")]
    logo: Option<String>,
    country_brand: Option<String>,
    country_origin: Option<String>,
    product_count: i64,
    is_featured: bool,
}

async fn list(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json("brands".to_string(), &headers, |state| async move {
            let rows = sqlx::query_as::<_, BrandListRow>(
                r#"SELECT b.slug, b.name, b.logo_url, b.country_brand, b.country_origin, b.is_featured,
                          (SELECT count(*) FROM products p WHERE p.brand_id = b.id AND p.is_active) AS product_count
                   FROM brands b ORDER BY b.sort, b.name"#,
            )
            .fetch_all(&state.pool)
            .await?;
            Ok(rows)
        })
        .await
}

#[derive(Serialize, sqlx::FromRow)]
struct BrandCategory {
    slug: String,
    name: String,
    product_count: i64,
}

async fn one(State(state): State<AppState>, Path(slug): Path<String>, headers: HeaderMap) -> AppResult<Response> {
    state
        .cached_json(format!("brand:{slug}"), &headers, |state| async move {
            let brand = sqlx::query_as::<_, BrandRow>(
                "SELECT id, slug, name, country_brand, country_origin, description, logo_url, is_featured FROM brands WHERE slug = $1",
            )
            .bind(&slug)
            .fetch_optional(&state.pool)
            .await?
            .ok_or_else(|| AppError::not_found("Бренд не найден"))?;
            let categories = sqlx::query_as::<_, BrandCategory>(
                r#"SELECT c.slug, c.name, count(*) AS product_count
                   FROM products p JOIN categories c ON c.id = p.category_id
                   WHERE p.brand_id = $1 AND p.is_active GROUP BY c.slug, c.name ORDER BY product_count DESC, c.name"#,
            )
            .bind(brand.id)
            .fetch_all(&state.pool)
            .await?;
            let product_count: i64 = categories.iter().map(|c| c.product_count).sum();
            Ok(json!({
                "brand": {
                    "slug": brand.slug, "name": brand.name, "logo": brand.logo_url,
                    "country_brand": brand.country_brand, "country_origin": brand.country_origin,
                    "description": brand.description, "product_count": product_count,
                },
                "categories": categories,
            }))
        })
        .await
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/brands", get(list)).route("/brands/{slug}", get(one))
}

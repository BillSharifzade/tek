use axum::{extract::State, http::HeaderMap, response::Response, routing::get, Json, Router};
use serde::Serialize;
use serde_json::Value;

use crate::{
    auth::OptionalUser,
    error::AppResult,
    models::{CategoryRow, ProductCard},
    services::{catalog::{products_where, to_card}, pricing::PriceCtx},
    state::AppState,
};

#[derive(Serialize, sqlx::FromRow)]
struct Banner {
    id: i32,
    title: String,
    text: String,
    cta_text: Option<String>,
    cta_url: Option<String>,
    #[sqlx(rename = "image_url")]
    image: Option<String>,
}

#[derive(Serialize)]
struct PopularCategory {
    slug: String,
    name: String,
    image: Option<String>,
    product_count: i32,
}

#[derive(Serialize, sqlx::FromRow)]
struct BrandMini {
    slug: String,
    name: String,
    #[sqlx(rename = "logo_url")]
    logo: Option<String>,
    country_brand: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct ServiceMini {
    slug: String,
    title: String,
    short: String,
    #[sqlx(rename = "image_url")]
    image: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct ProjectMini {
    slug: String,
    title: String,
    #[sqlx(rename = "project_date")]
    date: chrono::NaiveDate,
    year: String,
    object: String,
    service: String,
    #[sqlx(rename = "image_url")]
    image: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct NewsMini {
    slug: String,
    title: String,
    #[sqlx(rename = "published_at")]
    date: chrono::NaiveDate,
    excerpt: String,
    #[sqlx(rename = "image_url")]
    image: Option<String>,
    tags: Vec<String>,
}

#[derive(Serialize, sqlx::FromRow)]
struct Usp {
    title: String,
    text: String,
    icon: String,
}

#[derive(Serialize)]
struct HomePayload {
    banners: Vec<Banner>,
    popular_categories: Vec<PopularCategory>,
    popular_products: Vec<ProductCard>,
    new_products: Vec<ProductCard>,
    brands: Vec<BrandMini>,
    services: Vec<ServiceMini>,
    projects: Vec<ProjectMini>,
    news: Vec<NewsMini>,
    usp: Vec<Usp>,
    configurators: Vec<Value>,
}

async fn build(state: &AppState, ctx: &PriceCtx) -> AppResult<HomePayload> {
    let pool = &state.pool;
    let banners = sqlx::query_as::<_, Banner>("SELECT id, title, text, cta_text, cta_url, image_url FROM banners WHERE active ORDER BY sort, id")
        .fetch_all(pool)
        .await?;
    let cats = sqlx::query_as::<_, CategoryRow>("SELECT * FROM categories WHERE parent_id IS NULL ORDER BY sort, id LIMIT 12")
        .fetch_all(pool)
        .await?;
    let popular_categories = cats
        .into_iter()
        .map(|c| PopularCategory { slug: c.slug, name: c.name, image: c.image_url, product_count: c.product_count })
        .collect();
    let popular = products_where(pool, "TRUE ORDER BY p.popularity DESC, p.id", 12).await?;
    let newest = products_where(pool, "p.is_new ORDER BY p.created_at DESC, p.id", 12).await?;
    let brands = sqlx::query_as::<_, BrandMini>("SELECT slug, name, logo_url, country_brand FROM brands WHERE is_featured ORDER BY sort, id LIMIT 12")
        .fetch_all(pool)
        .await?;
    let services = sqlx::query_as::<_, ServiceMini>("SELECT slug, title, short, image_url FROM services ORDER BY sort, id LIMIT 6")
        .fetch_all(pool)
        .await?;
    let projects = sqlx::query_as::<_, ProjectMini>(
        "SELECT slug, title, project_date, year, object, service, image_url FROM projects ORDER BY project_date DESC, id LIMIT 4",
    )
    .fetch_all(pool)
    .await?;
    let news = sqlx::query_as::<_, NewsMini>("SELECT slug, title, published_at, excerpt, image_url, tags FROM news ORDER BY published_at DESC, id LIMIT 4")
        .fetch_all(pool)
        .await?;
    let usp = sqlx::query_as::<_, Usp>("SELECT title, text, icon FROM usp ORDER BY sort, id").fetch_all(pool).await?;
    let configurators: Vec<Value> = sqlx::query_scalar(
        "SELECT to_jsonb(t) FROM (SELECT slug, name, description, url, image_url AS image FROM configurators ORDER BY id) t",
    )
    .fetch_all(pool)
    .await?;
    Ok(HomePayload {
        banners,
        popular_categories,
        popular_products: popular.iter().map(|p| to_card(p, ctx)).collect(),
        new_products: newest.iter().map(|p| to_card(p, ctx)).collect(),
        brands,
        services,
        projects,
        news,
        usp,
        configurators,
    })
}

async fn home(State(state): State<AppState>, OptionalUser(user): OptionalUser, headers: HeaderMap) -> AppResult<Response> {
    match user {
        None => state.cached_json("home".to_string(), &headers, |state| async move { build(&state, &PriceCtx::anonymous()).await }).await,
        Some(u) => {
            let ctx = PriceCtx::for_user(&state.pool, &u).await?;
            let payload = build(&state, &ctx).await?;
            Ok(axum::response::IntoResponse::into_response(Json(payload)))
        }
    }
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/home", get(home))
}

#![allow(dead_code)]
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

// ---------- users / companies ----------

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub email: String,
    pub phone: Option<String>,
    pub password_hash: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub status: String,
    pub customer_type: String,
    pub company_id: Option<Uuid>,
    pub manager_id: Option<Uuid>,
    pub is_lead_manager: bool,
    pub discount_pct: Decimal,
    pub cashback_pct: Decimal,
    pub notify_marketing: bool,
    pub notify_replies: bool,
    pub created_at: DateTime<Utc>,
}

impl UserRow {
    pub fn full_name(&self) -> String {
        format!("{} {}", self.first_name, self.last_name).trim().to_string()
    }
    pub fn is_manager(&self) -> bool {
        self.role == "manager" || self.role == "admin"
    }
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct CompanyJson {
    pub id: Uuid,
    pub name: String,
    pub inn: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ManagerJson {
    pub name: String,
    pub phone: Option<String>,
    pub email: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UserJson {
    pub id: Uuid,
    pub email: String,
    pub phone: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub status: String,
    pub customer_type: String,
    pub discount_pct: Decimal,
    pub cashback_pct: Decimal,
    pub bonus_balance: Decimal,
    pub company: Option<CompanyJson>,
    pub manager: Option<ManagerJson>,
    pub notify_marketing: bool,
    pub notify_replies: bool,
}

// ---------- catalog ----------

/// Canonical product SELECT. Every product query uses the same projection so that
/// `ProductRow` can be reused everywhere (cards, cart, orders, accessories...).
pub const PRODUCT_SELECT: &str = r#"
SELECT p.id, p.code, p.slug, p.name, p.brand_id, b.slug AS brand_slug, b.name AS brand_name,
       p.category_id, c.path AS category_path, c.slug AS category_slug, c.name AS category_name,
       p.group_id, p.variant, p.unit, p.list_price, p.sale_price, p.is_hit, p.is_new,
       p.pack_qty, p.pack_label, p.configurator_id, p.attributes, p.images, p.description,
       p.short_description, p.features, p.rating, p.reviews_count, p.questions_count, p.popularity,
       p.created_at,
       (SELECT COALESCE(SUM(s.qty), 0) FROM stock s WHERE s.product_id = p.id) AS stock_total
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
JOIN categories c ON c.id = p.category_id
"#;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProductRow {
    pub id: Uuid,
    pub code: String,
    pub slug: String,
    pub name: String,
    pub brand_id: Option<i32>,
    pub brand_slug: Option<String>,
    pub brand_name: Option<String>,
    pub category_id: i32,
    pub category_path: String,
    pub category_slug: String,
    pub category_name: String,
    pub group_id: Option<i32>,
    /// значения товара по осям его группы торговых предложений: { "Число полюсов": "3", ... }
    pub variant: Value,
    pub unit: String,
    pub list_price: Decimal,
    pub sale_price: Option<Decimal>,
    pub is_hit: bool,
    pub is_new: bool,
    pub pack_qty: Option<Decimal>,
    pub pack_label: Option<String>,
    pub configurator_id: Option<i32>,
    pub attributes: Value,
    pub images: Vec<String>,
    pub description: String,
    pub short_description: String,
    pub features: Value,
    pub rating: Decimal,
    pub reviews_count: i32,
    pub questions_count: i32,
    pub popularity: i32,
    pub created_at: DateTime<Utc>,
    pub stock_total: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct Price {
    pub list: Decimal,
    pub price: Decimal,
    pub discount_pct: Decimal,
    pub cashback: Decimal,
    pub sale: bool,
    pub savings: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrandRef {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductCard {
    pub id: Uuid,
    pub slug: String,
    pub code: String,
    pub name: String,
    pub brand: BrandRef,
    pub unit: String,
    pub image: Option<String>,
    pub price: Price,
    pub stock_total: Decimal,
    pub in_stock: bool,
    pub badges: Vec<&'static str>,
    pub rating: Decimal,
    pub reviews_count: i32,
    pub price_unit_label: &'static str,
    pub category: BrandRef,
    /// кратность упаковки (шаг количества), None — продаётся поштучно / любым метражом
    pub pack_qty: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoreStock {
    pub store_id: i32,
    pub city: String,
    pub name: String,
    pub qty: Decimal,
    pub delivery_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentJson {
    pub id: i32,
    pub title: String,
    pub kind: String,
    pub url: String,
    pub size_kb: i32,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DocumentRow {
    pub id: i32,
    pub title: String,
    pub kind: String,
    pub file_name: String,
    pub size_kb: i32,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Crumb {
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct CategoryRow {
    pub id: i32,
    pub parent_id: Option<i32>,
    pub slug: String,
    pub name: String,
    pub path: String,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub sort: i32,
    pub product_count: i32,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BrandRow {
    pub id: i32,
    pub slug: String,
    pub name: String,
    pub country_brand: Option<String>,
    pub country_origin: Option<String>,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub is_featured: bool,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct StoreRow {
    pub id: i32,
    pub code: String,
    pub city: String,
    pub name: String,
    pub address: String,
    pub phone: Option<String>,
    pub hours: Option<String>,
    pub delivery_hint: String,
}

// ---------- cart ----------

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CartRow {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub token: Option<Uuid>,
    pub coupon_code: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CouponRow {
    pub code: String,
    pub kind: String,
    pub value: Decimal,
    pub min_total: Decimal,
    pub active: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub usage_limit: Option<i32>,
    pub used_count: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct CartItemError {
    pub code: &'static str,
    pub available: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct CartItemJson {
    pub id: Uuid,
    pub product: ProductCard,
    pub qty: Decimal,
    pub selected: bool,
    pub price: Price,
    pub line_total: Decimal,
    pub line_cashback: Decimal,
    pub stock_total: Decimal,
    pub error: Option<CartItemError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CouponJson {
    pub code: String,
    pub discount: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct CartJson {
    pub id: Uuid,
    pub cart_token: Option<Uuid>,
    pub items: Vec<CartItemJson>,
    pub items_count: usize,
    pub selected_count: usize,
    pub subtotal_list: Decimal,
    pub discount_total: Decimal,
    pub coupon: Option<CouponJson>,
    pub subtotal: Decimal,
    pub cashback_total: Decimal,
    pub total: Decimal,
    pub has_errors: bool,
}

// ---------- orders ----------

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrderRow {
    pub id: Uuid,
    pub number: String,
    pub user_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub email: String,
    pub status: String,
    pub delivery_method: String,
    pub delivery_address: Option<String>,
    pub delivery_date: Option<NaiveDate>,
    pub store_id: Option<i32>,
    pub delivery_price: Decimal,
    pub payment_method: String,
    pub payment_status: String,
    pub comment: Option<String>,
    pub subtotal_list: Decimal,
    pub discount_total: Decimal,
    pub coupon_code: Option<String>,
    pub coupon_discount: Decimal,
    pub subtotal: Decimal,
    pub total: Decimal,
    pub cashback_total: Decimal,
    pub paid_amount: Decimal,
    pub due_date: Option<NaiveDate>,
    pub assigned_manager_id: Option<Uuid>,
    pub crm_status: String,
    pub reservation_status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrderItemRow {
    pub id: Uuid,
    pub order_id: Uuid,
    pub product_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub unit: String,
    pub qty: Decimal,
    pub list_price: Decimal,
    pub price: Decimal,
    pub discount_pct: Decimal,
    pub cashback_pct: Decimal,
    pub line_total: Decimal,
    pub line_cashback: Decimal,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct OrderEventRow {
    pub kind: String,
    pub label: String,
    pub created_at: DateTime<Utc>,
}

pub fn order_status_label(status: &str) -> &'static str {
    match status {
        "new" => "Новый",
        "confirmed" => "Подтверждён",
        "processing" => "В обработке",
        "shipped" => "Отгружен",
        "delivered" => "Доставлен",
        "cancelled" => "Отменён",
        _ => "Неизвестно",
    }
}

pub fn payment_method_label(method: &str) -> (&'static str, &'static str) {
    match method {
        "alif" => ("Алиф Банк", "онлайн"),
        "dc" => ("Душанбе Сити Банк", "онлайн"),
        "cash" => ("Наличными", "при получении"),
        "invoice" => ("По счёту", "для юридических лиц"),
        _ => ("Неизвестно", ""),
    }
}

pub fn payment_status_label(status: &str) -> &'static str {
    match status {
        "pending" => "Ожидает оплаты",
        "paid" => "Оплачен",
        "invoice_issued" => "Выставлен счёт",
        "failed" => "Ошибка оплаты",
        _ => "Неизвестно",
    }
}

pub fn delivery_method_label(method: &str) -> &'static str {
    match method {
        "courier" => "Доставка",
        "pickup" => "Самовывоз",
        _ => "Неизвестно",
    }
}

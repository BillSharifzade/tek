//! Торговые предложения («как у Петровича»): группа — один товар в нескольких исполнениях.
//! Каждое исполнение — отдельный товар со своим кодом, URL, ценой, фото и остатками; у группы есть оси
//! (например «Число полюсов» × «Номинальный ток, А»), у товара — значения по этим осям (`products.variant`).

use std::{cmp::Ordering, iter::Peekable, str::Chars};

use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::{Map, Value};
use sqlx::{AssertSqlSafe, PgPool};

use crate::{
    error::AppResult,
    models::{ProductRow, PRODUCT_SELECT},
    services::pricing::PriceCtx,
};

#[derive(Serialize)]
pub struct VariantAxis {
    pub name: String,
    /// все значения оси в группе, отсортированы «по-человечески» (0.75 < 1 < 1.5 < 10, E14 < E27)
    pub values: Vec<String>,
}

#[derive(Serialize)]
pub struct VariantItem {
    pub slug: String,
    pub code: String,
    pub name: String,
    pub values: Map<String, Value>,
    pub in_stock: bool,
    pub price: Decimal,
    pub unit: String,
    pub image: Option<String>,
}

#[derive(Serialize)]
pub struct Variants {
    pub axes: Vec<VariantAxis>,
    pub items: Vec<VariantItem>,
}

/// Значение товара по оси (строкой) или None, если у товара нет такой оси.
fn axis_value<'a>(variant: &'a Value, axis: &str) -> Option<&'a str> {
    variant.get(axis).and_then(Value::as_str).filter(|s| !s.is_empty())
}

/// Варианты группы товара: оси с отсортированными значениями и все исполнения с ценой для текущего покупателя.
/// Исполнения без значения хотя бы по одной оси не попадают в выбор; группа из одного товара не показывается.
pub async fn load(pool: &PgPool, group_id: i32, ctx: &PriceCtx) -> AppResult<Option<Variants>> {
    let axes: Vec<String> = sqlx::query_scalar("SELECT axes FROM product_groups WHERE id = $1").bind(group_id).fetch_optional(pool).await?.unwrap_or_default();
    if axes.is_empty() {
        return Ok(None);
    }
    let sql = format!("{PRODUCT_SELECT} WHERE p.group_id = $1 AND p.is_active");
    let rows = sqlx::query_as::<_, ProductRow>(AssertSqlSafe(sql)).bind(group_id).fetch_all(pool).await?;

    let mut items: Vec<VariantItem> = rows
        .iter()
        .filter_map(|p| {
            let mut values = Map::new();
            for a in &axes {
                values.insert(a.clone(), Value::String(axis_value(&p.variant, a)?.to_string()));
            }
            Some(VariantItem {
                slug: p.slug.clone(),
                code: p.code.clone(),
                name: p.name.clone(),
                values,
                in_stock: p.stock_total > Decimal::ZERO,
                price: ctx.price(p).price,
                unit: p.unit.clone(),
                image: p.images.first().cloned(),
            })
        })
        .collect();
    if items.len() < 2 {
        return Ok(None);
    }

    let value_of = |it: &VariantItem, a: &str| it.values.get(a).and_then(Value::as_str).unwrap_or("").to_string();
    items.sort_by(|x, y| axes.iter().map(|a| natural_cmp(&value_of(x, a), &value_of(y, a))).find(|o| o.is_ne()).unwrap_or(Ordering::Equal));
    let axes = axes
        .iter()
        .map(|a| {
            let mut values: Vec<String> = Vec::new();
            for it in &items {
                let v = value_of(it, a);
                if !values.contains(&v) {
                    values.push(v);
                }
            }
            values.sort_by(|x, y| natural_cmp(x, y));
            VariantAxis { name: a.clone(), values }
        })
        .collect();
    Ok(Some(Variants { axes, items }))
}

/// Сравнение значений осей «как читает человек»: сначала по ведущему числу (запятая = точка),
/// затем посимвольно с числовыми участками как числами («E14» < «E27», «2P» < «10P»).
pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    match (lead_num(a), lead_num(b)) {
        (Some(x), Some(y)) if x != y => x.partial_cmp(&y).unwrap_or(Ordering::Equal),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        _ => chunk_cmp(a, b),
    }
}

fn lead_num(s: &str) -> Option<f64> {
    let t: String = s.trim().chars().take_while(|c| c.is_ascii_digit() || *c == '.' || *c == ',').collect();
    let t = t.replace(',', ".");
    t.trim_end_matches('.').parse().ok()
}

fn take_num(it: &mut Peekable<Chars<'_>>) -> u64 {
    let mut n: u64 = 0;
    while let Some(d) = it.peek().and_then(|c| c.to_digit(10)) {
        n = n.saturating_mul(10).saturating_add(d as u64);
        it.next();
    }
    n
}

fn chunk_cmp(a: &str, b: &str) -> Ordering {
    let (mut x, mut y) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (x.peek().copied(), y.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(c), Some(d)) if c.is_ascii_digit() && d.is_ascii_digit() => match take_num(&mut x).cmp(&take_num(&mut y)) {
                Ordering::Equal => {}
                o => return o,
            },
            (Some(c), Some(d)) => {
                let o = c.to_lowercase().cmp(d.to_lowercase());
                if o.is_ne() {
                    return o;
                }
                x.next();
                y.next();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::natural_cmp;

    fn sorted(mut v: Vec<&str>) -> Vec<&str> {
        v.sort_by(|a, b| natural_cmp(a, b));
        v
    }

    #[test]
    fn numbers_and_mixed() {
        assert_eq!(sorted(vec!["10", "1.5", "0.75", "0.5", "1", "2.5"]), vec!["0.5", "0.75", "1", "1.5", "2.5", "10"]);
        assert_eq!(sorted(vec!["157", "117,6", "200"]), vec!["117,6", "157", "200"]);
        assert_eq!(sorted(vec!["E27", "E14"]), vec!["E14", "E27"]);
        assert_eq!(sorted(vec!["6500K", "3000K", "4000K"]), vec!["3000K", "4000K", "6500K"]);
        assert_eq!(sorted(vec!["25х16", "16х16", "100х50"]), vec!["16х16", "25х16", "100х50"]);
        assert_eq!(sorted(vec!["чёрный", "белый", "синий"]), vec!["белый", "синий", "чёрный"]);
    }
}

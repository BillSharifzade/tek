use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Serialize;

pub const COURIER_PRICE: Decimal = dec!(30.00);
/// Доставка бесплатна от этой суммы заказа (как на странице «Помощь»)
pub const FREE_DELIVERY_FROM: Decimal = dec!(1000.00);

/// Дата через `n` рабочих дней (суббота и воскресенье не считаются) — срок оплаты счёта.
pub fn add_working_days(from: NaiveDate, n: u32) -> NaiveDate {
    let mut d = from;
    let mut left = n;
    while left > 0 {
        d += Duration::days(1);
        if !matches!(d.weekday(), Weekday::Sat | Weekday::Sun) {
            left -= 1;
        }
    }
    d
}

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryDate {
    pub date: NaiveDate,
    pub label: String,
    pub day_label: String,
    pub available: bool,
}

pub fn weekday_ru(w: Weekday) -> &'static str {
    match w {
        Weekday::Mon => "Понедельник",
        Weekday::Tue => "Вторник",
        Weekday::Wed => "Среда",
        Weekday::Thu => "Четверг",
        Weekday::Fri => "Пятница",
        Weekday::Sat => "Суббота",
        Weekday::Sun => "Воскресенье",
    }
}

pub fn month_genitive_ru(m: u32) -> &'static str {
    match m {
        1 => "января",
        2 => "февраля",
        3 => "марта",
        4 => "апреля",
        5 => "мая",
        6 => "июня",
        7 => "июля",
        8 => "августа",
        9 => "сентября",
        10 => "октября",
        11 => "ноября",
        _ => "декабря",
    }
}

pub fn day_label(d: NaiveDate) -> String {
    format!("{} {}", d.day(), month_genitive_ru(d.month()))
}

/// Today + 3 following days; Sunday is unavailable.
pub fn delivery_dates() -> Vec<DeliveryDate> {
    // Dushanbe is UTC+5.
    let today = (Utc::now() + Duration::hours(5)).date_naive();
    (0..4)
        .map(|i| {
            let d = today + Duration::days(i);
            let label = match i {
                0 => "Сегодня".to_string(),
                1 => "Завтра".to_string(),
                _ => weekday_ru(d.weekday()).to_string(),
            };
            DeliveryDate { date: d, label, day_label: day_label(d), available: d.weekday() != Weekday::Sun }
        })
        .collect()
}

pub fn today_local() -> NaiveDate {
    (Utc::now() + Duration::hours(5)).date_naive()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn working_days_skip_weekend() {
        let d = |y, m, day| NaiveDate::from_ymd_opt(y, m, day).unwrap();
        // понедельник + 3 → четверг; пятница + 3 → среда (суббота и воскресенье не считаются)
        assert_eq!(add_working_days(d(2026, 10, 5), 3), d(2026, 10, 8));
        assert_eq!(add_working_days(d(2026, 10, 9), 3), d(2026, 10, 14));
        assert_eq!(add_working_days(d(2026, 10, 10), 3), d(2026, 10, 14));
    }
}

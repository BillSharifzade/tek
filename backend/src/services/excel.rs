use rust_decimal::prelude::ToPrimitive;
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};

use crate::{
    error::AppResult,
    models::CartJson,
    services::ledger::{BonusStatement, Reconciliation},
};

const NUM: &str = "#,##0.00";

fn f(d: rust_decimal::Decimal) -> f64 {
    d.to_f64().unwrap_or(0.0)
}

struct Styles {
    title: Format,
    sub: Format,
    head: Format,
    cell: Format,
    num: Format,
    total_label: Format,
    total_num: Format,
}

fn styles() -> Styles {
    let border = |fmt: Format| fmt.set_border(FormatBorder::Thin).set_border_color(Color::RGB(0xBFBFBF));
    Styles {
        title: Format::new().set_bold().set_font_size(16),
        sub: Format::new().set_font_size(10).set_font_color(Color::RGB(0x5F5F5F)),
        head: border(Format::new().set_bold().set_background_color(Color::RGB(0xF4C241)).set_align(FormatAlign::Center).set_align(FormatAlign::VerticalCenter).set_text_wrap()),
        cell: border(Format::new().set_text_wrap()),
        num: border(Format::new().set_num_format(NUM)),
        total_label: Format::new().set_bold().set_align(FormatAlign::Right),
        total_num: Format::new().set_bold().set_num_format(NUM),
    }
}

/// Смета из корзины по шаблону ТЭК.
pub fn cart_estimate(company: Option<&str>, customer: &str, date: &str, cart: &CartJson) -> AppResult<Vec<u8>> {
    let s = styles();
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_name("Смета")?;
    ws.set_column_width(0, 5)?;
    ws.set_column_width(1, 12)?;
    ws.set_column_width(2, 58)?;
    ws.set_column_width(3, 7)?;
    ws.set_column_width(4, 10)?;
    ws.set_column_width(5, 14)?;
    ws.set_column_width(6, 12)?;
    ws.set_column_width(7, 16)?;

    ws.merge_range(0, 0, 0, 7, "ООО «Точикэлектрокомплект» — смета", &s.title)?;
    ws.merge_range(1, 0, 1, 7, "г. Душанбе, ул. Бохтар 37/1, офис 704 · +992 446 20 60 60 · sales@tec.tj", &s.sub)?;
    ws.write_string(3, 0, "Покупатель:")?;
    ws.write_string(3, 2, if let Some(c) = company { format!("{c} ({customer})") } else { customer.to_string() })?;
    ws.write_string(4, 0, "Дата:")?;
    ws.write_string(4, 2, date)?;

    let head = ["№", "Код", "Наименование", "Ед.", "Кол-во", "Цена, с.", "Скидка, %", "Сумма, с."];
    let hr = 6u32;
    for (i, h) in head.iter().enumerate() {
        ws.write_string_with_format(hr, i as u16, *h, &s.head)?;
    }
    let mut row = hr + 1;
    let mut n = 1;
    for item in cart.items.iter().filter(|i| i.selected) {
        ws.write_number_with_format(row, 0, n as f64, &s.cell)?;
        ws.write_string_with_format(row, 1, &item.product.code, &s.cell)?;
        ws.write_string_with_format(row, 2, &item.product.name, &s.cell)?;
        ws.write_string_with_format(row, 3, &item.product.unit, &s.cell)?;
        ws.write_number_with_format(row, 4, f(item.qty), &s.cell)?;
        ws.write_number_with_format(row, 5, f(item.price.price), &s.num)?;
        ws.write_number_with_format(row, 6, f(item.price.discount_pct), &s.cell)?;
        ws.write_number_with_format(row, 7, f(item.line_total), &s.num)?;
        row += 1;
        n += 1;
    }
    row += 1;
    let totals = [
        ("Товары по прайсу:", cart.subtotal_list),
        ("Скидка:", cart.discount_total),
        ("Купон:", cart.coupon.as_ref().map(|c| c.discount).unwrap_or_default()),
        ("Итого:", cart.total),
        ("Кешбэк на бонусный счёт:", cart.cashback_total),
    ];
    for (label, value) in totals {
        ws.merge_range(row, 4, row, 6, label, &s.total_label)?;
        ws.write_number_with_format(row, 7, f(value), &s.total_num)?;
        row += 1;
    }
    Ok(wb.save_to_buffer()?)
}

/// Покупатель в счёте.
pub struct InvoiceBuyer {
    pub company: Option<String>,
    pub inn: Option<String>,
    pub address: Option<String>,
    pub contact: String,
    pub phone: String,
}

pub struct InvoiceLine {
    pub code: String,
    pub name: String,
    pub unit: String,
    pub qty: rust_decimal::Decimal,
    pub price: rust_decimal::Decimal,
    pub total: rust_decimal::Decimal,
}

pub struct InvoiceTotals {
    pub goods: rust_decimal::Decimal,
    pub coupon: rust_decimal::Decimal,
    pub delivery: rust_decimal::Decimal,
    pub total: rust_decimal::Decimal,
}

/// Счёт на оплату (B2B, оплата по счёту): поставщик с реквизитами из SELLER_*, покупатель, товары, доставка, итог, срок оплаты.
pub fn invoice(number: &str, date: &str, due: Option<&str>, buyer: &InvoiceBuyer, lines: &[InvoiceLine], t: &InvoiceTotals) -> AppResult<Vec<u8>> {
    let s = styles();
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_name("Счёт")?;
    for (col, w) in [(0u16, 5.0), (1, 12.0), (2, 56.0), (3, 7.0), (4, 10.0), (5, 14.0), (6, 16.0)] {
        ws.set_column_width(col, w)?;
    }
    let env = |k: &str| std::env::var(k).ok().filter(|v| !v.trim().is_empty());
    ws.merge_range(0, 0, 0, 6, &format!("Счёт на оплату № {number} от {date}"), &s.title)?;
    let mut info: Vec<(&str, String)> = vec![("Поставщик:", env("SELLER_NAME").unwrap_or_else(|| "ООО «Точикэлектрокомплект»".into()))];
    if let Some(inn) = env("SELLER_INN") {
        info.push(("ИНН:", inn));
    }
    info.push(("Адрес:", env("SELLER_ADDRESS").unwrap_or_else(|| "г. Душанбе, ул. И. Сомони 68/13".into())));
    if let Some(bank) = env("SELLER_BANK") {
        info.push(("Банк:", bank));
    }
    if let Some(acc) = env("SELLER_ACCOUNT") {
        info.push(("Р/с:", acc));
    }
    info.push(("Телефон:", "+992 446 20 60 60 · sales@tec.tj".into()));
    info.push(("", String::new()));
    info.push((
        "Покупатель:",
        match &buyer.company {
            Some(c) => format!("{c} ({})", buyer.contact),
            None => buyer.contact.clone(),
        },
    ));
    if let Some(inn) = &buyer.inn {
        info.push(("ИНН:", inn.clone()));
    }
    if let Some(a) = &buyer.address {
        info.push(("Адрес:", a.clone()));
    }
    info.push(("Телефон:", buyer.phone.clone()));
    let mut row = 2u32;
    for (label, value) in &info {
        ws.write_string(row, 0, *label)?;
        ws.write_string(row, 2, value)?;
        row += 1;
    }

    let hr = row + 1;
    for (i, h) in ["№", "Код", "Наименование", "Ед.", "Кол-во", "Цена, с.", "Сумма, с."].iter().enumerate() {
        ws.write_string_with_format(hr, i as u16, *h, &s.head)?;
    }
    let mut r = hr + 1;
    for (n, l) in lines.iter().enumerate() {
        ws.write_number_with_format(r, 0, (n + 1) as f64, &s.cell)?;
        ws.write_string_with_format(r, 1, &l.code, &s.cell)?;
        ws.write_string_with_format(r, 2, &l.name, &s.cell)?;
        ws.write_string_with_format(r, 3, &l.unit, &s.cell)?;
        ws.write_number_with_format(r, 4, f(l.qty), &s.cell)?;
        ws.write_number_with_format(r, 5, f(l.price), &s.num)?;
        ws.write_number_with_format(r, 6, f(l.total), &s.num)?;
        r += 1;
    }
    if !t.delivery.is_zero() {
        ws.write_number_with_format(r, 0, (lines.len() + 1) as f64, &s.cell)?;
        ws.write_string_with_format(r, 1, "", &s.cell)?;
        ws.write_string_with_format(r, 2, "Доставка", &s.cell)?;
        ws.write_string_with_format(r, 3, "усл.", &s.cell)?;
        ws.write_number_with_format(r, 4, 1.0, &s.cell)?;
        ws.write_number_with_format(r, 5, f(t.delivery), &s.num)?;
        ws.write_number_with_format(r, 6, f(t.delivery), &s.num)?;
        r += 1;
    }
    r += 1;
    let mut totals = vec![("Товары:", t.goods)];
    if !t.coupon.is_zero() {
        totals.push(("Скидка по промокоду:", -t.coupon));
    }
    if !t.delivery.is_zero() {
        totals.push(("Доставка:", t.delivery));
    }
    totals.push(("Итого к оплате:", t.total));
    for (label, value) in totals {
        ws.merge_range(r, 3, r, 5, label, &s.total_label)?;
        ws.write_number_with_format(r, 6, f(value), &s.total_num)?;
        r += 1;
    }
    r += 1;
    ws.write_string(r, 0, "Без НДС.")?;
    if let Some(d) = due {
        ws.write_string(r + 1, 0, &format!("Оплатить до {d}. В назначении платежа укажите номер счёта."))?;
    }
    Ok(wb.save_to_buffer()?)
}

/// Акт сверки взаиморасчётов.
pub fn reconciliation_xlsx(customer: &str, rec: &Reconciliation) -> AppResult<Vec<u8>> {
    let s = styles();
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_name("Акт сверки")?;
    ws.set_column_width(0, 12)?;
    ws.set_column_width(1, 22)?;
    ws.set_column_width(2, 16)?;
    ws.set_column_width(3, 34)?;
    ws.set_column_width(4, 14)?;
    ws.set_column_width(5, 14)?;
    ws.set_column_width(6, 14)?;

    ws.merge_range(0, 0, 0, 6, "Акт сверки взаиморасчётов", &s.title)?;
    ws.merge_range(
        1,
        0,
        1,
        6,
        &format!(
            "между ООО «Точикэлектрокомплект» и {} за период с {} по {}",
            rec.company.as_deref().unwrap_or(customer),
            rec.period.from.format("%d.%m.%Y"),
            rec.period.to.format("%d.%m.%Y")
        ),
        &s.sub,
    )?;
    ws.write_string(3, 0, "Сальдо на начало периода:")?;
    ws.write_number_with_format(3, 6, f(rec.opening_balance), &s.total_num)?;

    let head = ["Дата", "Документ", "Номер", "Примечание", "Дебет, с.", "Кредит, с.", "Сальдо, с."];
    let hr = 5u32;
    for (i, h) in head.iter().enumerate() {
        ws.write_string_with_format(hr, i as u16, *h, &s.head)?;
    }
    let mut row = hr + 1;
    for e in &rec.entries {
        ws.write_string_with_format(row, 0, e.date.format("%d.%m.%Y").to_string(), &s.cell)?;
        ws.write_string_with_format(row, 1, &e.doc_type_label, &s.cell)?;
        ws.write_string_with_format(row, 2, &e.doc_number, &s.cell)?;
        ws.write_string_with_format(row, 3, e.note.clone().unwrap_or_default(), &s.cell)?;
        ws.write_number_with_format(row, 4, f(e.debit), &s.num)?;
        ws.write_number_with_format(row, 5, f(e.credit), &s.num)?;
        ws.write_number_with_format(row, 6, f(e.balance), &s.num)?;
        row += 1;
    }
    row += 1;
    ws.merge_range(row, 0, row, 3, "Обороты за период:", &s.total_label)?;
    ws.write_number_with_format(row, 4, f(rec.turnover.debit), &s.total_num)?;
    ws.write_number_with_format(row, 5, f(rec.turnover.credit), &s.total_num)?;
    row += 1;
    ws.merge_range(row, 0, row, 5, "Сальдо на конец периода (задолженность покупателя):", &s.total_label)?;
    ws.write_number_with_format(row, 6, f(rec.closing_balance), &s.total_num)?;
    row += 1;
    ws.merge_range(row, 0, row, 5, "в т.ч. просроченная задолженность:", &s.total_label)?;
    ws.write_number_with_format(row, 6, f(rec.overdue), &s.total_num)?;
    Ok(wb.save_to_buffer()?)
}

/// Детализация бонусного счёта (по образцу акта сверки).
pub fn bonus_xlsx(customer: &str, st: &BonusStatement) -> AppResult<Vec<u8>> {
    let s = styles();
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_name("Бонусный счёт")?;
    ws.set_column_width(0, 12)?;
    ws.set_column_width(1, 14)?;
    ws.set_column_width(2, 16)?;
    ws.set_column_width(3, 34)?;
    ws.set_column_width(4, 14)?;
    ws.set_column_width(5, 14)?;
    ws.merge_range(0, 0, 0, 5, "Детализация бонусного счёта", &s.title)?;
    ws.merge_range(1, 0, 1, 5, &format!("{} · период с {} по {}", customer, st.period.from.format("%d.%m.%Y"), st.period.to.format("%d.%m.%Y")), &s.sub)?;
    ws.write_string(3, 0, "Бонусов на начало периода:")?;
    ws.write_number_with_format(3, 5, f(st.opening), &s.total_num)?;
    let head = ["Дата", "Заказ", "Операция", "Примечание", "Сумма, с.", "Баланс, с."];
    let hr = 5u32;
    for (i, h) in head.iter().enumerate() {
        ws.write_string_with_format(hr, i as u16, *h, &s.head)?;
    }
    let mut row = hr + 1;
    for e in &st.entries {
        ws.write_string_with_format(row, 0, e.date.format("%d.%m.%Y").to_string(), &s.cell)?;
        ws.write_string_with_format(row, 1, e.order_number.clone().unwrap_or_default(), &s.cell)?;
        ws.write_string_with_format(row, 2, &e.kind_label, &s.cell)?;
        ws.write_string_with_format(row, 3, e.note.clone().unwrap_or_default(), &s.cell)?;
        ws.write_number_with_format(row, 4, f(e.amount), &s.num)?;
        ws.write_number_with_format(row, 5, f(e.balance), &s.num)?;
        row += 1;
    }
    row += 1;
    ws.merge_range(row, 0, row, 4, "Бонусов на конец периода:", &s.total_label)?;
    ws.write_number_with_format(row, 5, f(st.closing), &s.total_num)?;
    Ok(wb.save_to_buffer()?)
}

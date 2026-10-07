//! Импорт каталога из Excel / CSV (выгрузка номенклатуры из 1С): товары создаются и обновляются по коду,
//! недостающие категории и бренды создаются, остатки пишутся по складам, столбцы «Хар: …» — характеристики.
//! Формат файла и правила — `docs/IMPORT.md`. Весь импорт — одна транзакция: строки с ошибками пропускаются
//! и попадают в отчёт, `dry_run` откатывает транзакцию (проверка файла без записи).

use std::{
    collections::{HashMap, HashSet},
    io::Cursor,
    str::FromStr,
};

use calamine::{Data, Reader};
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    seed::slugify,
    services::catalog::recount_categories,
};

/// Сколько строк данных принимаем за один файл.
pub const MAX_ROWS: usize = 100_000;
/// Сколько ошибок возвращаем в отчёте (остальные только считаются в `skipped`).
const MAX_ERRORS: usize = 1000;

/// Таблица из файла: заголовки и строки данных с номерами строк файла (как их видит пользователь в Excel).
pub struct Table {
    pub headers: Vec<String>,
    pub rows: Vec<(usize, Vec<String>)>,
}

#[derive(Debug, Serialize)]
pub struct RowError {
    pub row: usize,
    pub message: String,
}

#[derive(Debug, Serialize, Default)]
pub struct Summary {
    pub dry_run: bool,
    pub rows: usize,
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub categories_created: usize,
    pub brands_created: usize,
    pub stock_rows: usize,
    pub errors: Vec<RowError>,
    /// столбцы, которые импорт не знает (не ошибка — пропускаются)
    pub ignored_columns: Vec<String>,
}

fn invalid_file(msg: impl Into<String>) -> AppError {
    AppError::unprocessable("invalid_file", msg)
}

fn invalid_header(msg: impl Into<String>) -> AppError {
    AppError::unprocessable("invalid_header", msg)
}

// ---------- чтение файла ----------

/// .xlsx / .xls / .ods (по содержимому или расширению) или CSV (UTF-8, с BOM или без; Windows-1251 — тоже), разделитель `;` или `,`.
pub fn parse_file(name: &str, bytes: &[u8]) -> AppResult<Table> {
    if bytes.is_empty() {
        return Err(invalid_file("Файл пустой"));
    }
    let lower = name.to_lowercase();
    let spreadsheet = bytes.starts_with(b"PK\x03\x04") || bytes.starts_with(&[0xD0, 0xCF, 0x11, 0xE0]) || [".xlsx", ".xls", ".ods", ".xlsm"].iter().any(|e| lower.ends_with(e));
    let records = if spreadsheet { read_excel(bytes)? } else { read_csv(bytes) };
    let mut iter = records.into_iter().filter(|(_, cells)| cells.iter().any(|c| !c.trim().is_empty()));
    let Some((_, headers)) = iter.next() else { return Err(invalid_file("В файле нет строки заголовков")) };
    let headers: Vec<String> = headers.into_iter().map(|h| h.trim().to_string()).collect();
    let mut rows = Vec::new();
    for (n, mut cells) in iter {
        if rows.len() >= MAX_ROWS {
            return Err(invalid_file(format!("Слишком много строк: за один раз — не больше {MAX_ROWS}")));
        }
        cells.resize(headers.len().max(cells.len()), String::new());
        rows.push((n, cells));
    }
    Ok(Table { headers, rows })
}

fn cell_text(d: &Data) -> String {
    match d {
        Data::Empty | Data::Error(_) => String::new(),
        Data::String(s) => s.trim().to_string(),
        Data::Int(i) => i.to_string(),
        // целые числа из Excel приходят как float: 200123.0 → «200123»
        Data::Float(f) if f.fract() == 0.0 && f.abs() < 1e15 => format!("{}", *f as i64),
        Data::Float(f) => f.to_string(),
        Data::Bool(b) => if *b { "Да" } else { "Нет" }.to_string(),
        Data::DateTime(d) => d.to_string(),
        Data::DateTimeIso(s) | Data::DurationIso(s) => s.clone(),
    }
}

fn read_excel(bytes: &[u8]) -> AppResult<Vec<(usize, Vec<String>)>> {
    let mut wb = calamine::open_workbook_auto_from_rs(Cursor::new(bytes)).map_err(|e| invalid_file(format!("Не удалось открыть файл Excel: {e}")))?;
    // первый лист, кроме листа с инструкцией из шаблона
    let names = wb.sheet_names();
    let sheet = names.iter().find(|n| !n.to_lowercase().contains("инструкц")).or(names.first()).cloned().ok_or_else(|| invalid_file("В файле нет листов"))?;
    let range = wb.worksheet_range(&sheet).map_err(|e| invalid_file(format!("Не удалось прочитать лист «{sheet}»: {e}")))?;
    let first_row = range.start().map(|(r, _)| r as usize).unwrap_or(0);
    Ok(range.rows().enumerate().map(|(i, row)| (first_row + i + 1, row.iter().map(cell_text).collect())).collect())
}

/// Windows-1251 → UTF-8 (выгрузки 1С в CSV часто в этой кодировке).
fn decode_cp1251(bytes: &[u8]) -> String {
    const HIGH: [char; 64] = [
        'Ђ', 'Ѓ', '‚', 'ѓ', '„', '…', '†', '‡', '€', '‰', 'Љ', '‹', 'Њ', 'Ќ', 'Ћ', 'Џ', 'ђ', '‘', '’', '“', '”', '•', '–', '—', '\u{98}', '™', 'љ', '›', 'њ', 'ќ', 'ћ', 'џ',
        '\u{a0}', 'Ў', 'ў', 'Ј', '¤', 'Ґ', '¦', '§', 'Ё', '©', 'Є', '«', '¬', '\u{ad}', '®', 'Ї', '°', '±', 'І', 'і', 'ґ', 'µ', '¶', '·', 'ё', '№', 'є', '»', 'ј', 'Ѕ', 'ѕ', 'ї',
    ];
    bytes
        .iter()
        .map(|&b| match b {
            0..=0x7F => b as char,
            0x80..=0xBF => HIGH[(b - 0x80) as usize],
            _ => char::from_u32(0x0410 + (b - 0xC0) as u32).unwrap_or('?'),
        })
        .collect()
}

fn read_csv(bytes: &[u8]) -> Vec<(usize, Vec<String>)> {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let text = match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => decode_cp1251(bytes),
    };
    let first_line = text.lines().next().unwrap_or("");
    let count = |d: char| first_line.chars().filter(|c| *c == d).count();
    let delim = [';', '\t', ','].into_iter().max_by_key(|d| (count(*d), *d == ';')).unwrap_or(';');
    parse_csv(&text, delim)
}

/// CSV по RFC 4180: поля в кавычках (с переводами строк и удвоенными кавычками внутри). Номер — строка файла, где начинается запись.
pub fn parse_csv(text: &str, delim: char) -> Vec<(usize, Vec<String>)> {
    let mut out = Vec::new();
    let mut record: Vec<String> = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut line = 1usize;
    let mut record_line = 1usize;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if in_quotes {
            match c {
                '"' if chars.peek() == Some(&'"') => {
                    field.push('"');
                    chars.next();
                }
                '"' => in_quotes = false,
                '\n' => {
                    line += 1;
                    field.push('\n');
                }
                _ => field.push(c),
            }
            continue;
        }
        match c {
            '"' if field.trim().is_empty() => {
                field.clear();
                in_quotes = true;
            }
            c if c == delim => record.push(std::mem::take(&mut field)),
            '\r' => {}
            '\n' => {
                record.push(std::mem::take(&mut field));
                out.push((record_line, std::mem::take(&mut record)));
                line += 1;
                record_line = line;
            }
            _ => field.push(c),
        }
    }
    if !field.is_empty() || !record.is_empty() {
        record.push(field);
        out.push((record_line, record));
    }
    out.into_iter().map(|(n, r)| (n, r.into_iter().map(|f| f.trim().to_string()).collect())).collect()
}

// ---------- заголовки ----------

#[derive(Debug, Clone, PartialEq)]
enum Col {
    Code,
    Name,
    Category,
    Brand,
    Unit,
    Price,
    SalePrice,
    Pack,
    Description,
    Image,
    Stock(i32),
    Attr(String),
    Ignored,
}

/// нижний регистр, ё → е, без лишних пробелов
fn norm(s: &str) -> String {
    s.trim().to_lowercase().replace('ё', "е").split_whitespace().collect::<Vec<_>>().join(" ")
}

#[derive(sqlx::FromRow)]
struct StoreRef {
    id: i32,
    code: String,
    name: String,
}

fn column(header: &str, stores: &[StoreRef]) -> Result<Col, String> {
    let n = norm(header);
    let compact: String = n.chars().filter(|c| !matches!(c, ' ' | '.' | ',' | '(' | ')' | ':')).collect();
    // «Хар: Сечение» / «Характеристика: Сечение»
    if n.starts_with("хар") && n.contains(':') {
        let name = header.split_once(':').map(|(_, v)| v.trim()).unwrap_or("");
        if name.is_empty() {
            return Err(format!("Столбец «{header}»: после «Хар:» укажите название характеристики"));
        }
        return Ok(Col::Attr(name.chars().take(100).collect()));
    }
    if let Some(rest) = n.strip_prefix("остаток") {
        let key = norm(rest.trim_start_matches([':', '-', ' ']));
        if key.is_empty() {
            return match stores {
                [only] => Ok(Col::Stock(only.id)),
                _ => Err(format!("Столбец «{header}»: укажите склад — «Остаток <код или название склада>»")),
            };
        }
        return stores
            .iter()
            .find(|s| norm(&s.code) == key || norm(&s.name) == key)
            .map(|s| Col::Stock(s.id))
            .ok_or_else(|| {
                let known: Vec<String> = stores.iter().map(|s| format!("{} ({})", s.code, s.name)).collect();
                format!("Столбец «{header}»: склад не найден. Склады: {}", known.join(", "))
            });
    }
    Ok(match compact.as_str() {
        "код" | "кодтовара" | "кодноменклатуры" => Col::Code,
        "наименование" | "название" | "наименованиетовара" | "номенклатура" => Col::Name,
        "категория" | "раздел" | "группа" | "группаноменклатуры" => Col::Category,
        "бренд" | "производитель" | "марка" | "торговаямарка" => Col::Brand,
        "едизм" | "ед" | "единица" | "единицаизмерения" => Col::Unit,
        "кратность" | "кратностьупаковки" => Col::Pack,
        "описание" => Col::Description,
        "изображение" | "изображения" | "фото" | "картинка" => Col::Image,
        c if c.starts_with("цена") && (c.contains("распрод") || c.contains("акци") || c.contains("скидк")) => Col::SalePrice,
        c if c.starts_with("цена") || c == "прайс" => Col::Price,
        _ => Col::Ignored,
    })
}

// ---------- значения ячеек ----------

/// «1 690,80», «1690.8», «1 690,80 с.», «1,690.80» → 1690.80
pub fn parse_decimal(raw: &str) -> Option<Decimal> {
    let mut t: String = raw.chars().filter(|c| !c.is_whitespace() && *c != '\u{a0}' && *c != '\u{202f}').collect::<String>().to_lowercase();
    for suffix in ["сомони", "сом", "смн", "tjs", "с.", "с"] {
        if let Some(s) = t.strip_suffix(suffix) {
            t = s.to_string();
            break;
        }
    }
    let t = if t.contains(',') && t.contains('.') { t.replace(',', "") } else { t.replace(',', ".") };
    if t.is_empty() {
        return None;
    }
    Decimal::from_str(&t).or_else(|_| Decimal::from_scientific(&t)).ok()
}

/// «-» или «0» в необязательной ячейке — очистить значение.
fn is_clear(raw: &str) -> bool {
    matches!(raw.trim(), "-" | "—" | "0" | "0,00" | "0.00")
}

fn parse_unit(raw: &str) -> Result<String, String> {
    let t = norm(raw).trim_end_matches('.').to_string();
    Ok(match t.as_str() {
        "шт" | "штук" | "штука" | "штуки" | "pcs" | "pc" => "шт".into(),
        "м" | "метр" | "метра" | "метров" | "м.п" | "мп" | "пог. м" | "пог.м" | "пм" | "m" => "м".into(),
        other if !other.is_empty() && other.chars().count() <= 12 => other.to_string(),
        _ => return Err(format!("Ед. изм.: «{raw}» — укажите «шт» или «м»")),
    })
}

fn parse_images(raw: &str) -> Result<Vec<String>, String> {
    let list: Vec<String> = raw.split([';', '\n', '|', ',']).map(str::trim).filter(|s| !s.is_empty()).map(str::to_string).collect();
    if list.len() > 20 {
        return Err("Изображение: не больше 20 ссылок".into());
    }
    for url in &list {
        if !(url.starts_with("https://") || url.starts_with("http://") || url.starts_with('/')) || url.len() > 1000 {
            return Err(format!("Изображение: «{url}» — укажите ссылку https://… или путь /…"));
        }
    }
    Ok(list)
}

enum Opt<T> {
    Clear,
    Set(T),
}

/// Разобранная строка файла (все проверки — до записи в базу).
struct RowData {
    code: String,
    name: Option<String>,
    category: Option<String>,
    brand: Option<String>,
    unit: Option<String>,
    price: Option<Decimal>,
    sale: Option<Opt<Decimal>>,
    pack: Option<Opt<Decimal>>,
    description: Option<String>,
    images: Option<Vec<String>>,
    stock: Vec<(i32, Decimal)>,
    /// None — удалить характеристику («-»)
    attrs: Vec<(String, Option<String>)>,
}

fn money_cell(label: &str, raw: &str) -> Result<Decimal, String> {
    let v = parse_decimal(raw).ok_or_else(|| format!("{label}: «{raw}» — не число"))?;
    if v <= Decimal::ZERO || v > Decimal::from(10_000_000_000i64) {
        return Err(format!("{label}: должна быть больше нуля"));
    }
    Ok(v.round_dp(2))
}

fn parse_row(cols: &[Col], cells: &[String]) -> Result<RowData, String> {
    let mut d = RowData {
        code: String::new(),
        name: None,
        category: None,
        brand: None,
        unit: None,
        price: None,
        sale: None,
        pack: None,
        description: None,
        images: None,
        stock: Vec::new(),
        attrs: Vec::new(),
    };
    for (col, raw) in cols.iter().zip(cells.iter()) {
        let v = raw.trim();
        if v.is_empty() {
            continue;
        }
        match col {
            Col::Code => d.code = v.to_string(),
            Col::Name => d.name = Some(v.chars().take(300).collect()),
            Col::Category => d.category = Some(v.to_string()),
            Col::Brand => d.brand = Some(v.chars().take(120).collect()),
            Col::Unit => d.unit = Some(parse_unit(v)?),
            Col::Price => d.price = Some(money_cell("Цена", v)?),
            Col::SalePrice if is_clear(v) => d.sale = Some(Opt::Clear),
            Col::SalePrice => d.sale = Some(Opt::Set(money_cell("Цена распродажи", v)?)),
            Col::Pack if is_clear(v) => d.pack = Some(Opt::Clear),
            Col::Pack => {
                let q = parse_decimal(v).filter(|q| *q > Decimal::ZERO && *q <= Decimal::from(1_000_000)).ok_or_else(|| format!("Кратность: «{v}» — укажите положительное число"))?;
                d.pack = Some(Opt::Set(q.round_dp(3)));
            }
            Col::Description => d.description = Some(v.chars().take(20_000).collect()),
            Col::Image => d.images = Some(parse_images(v)?),
            Col::Stock(store) => {
                let q = parse_decimal(v).ok_or_else(|| format!("Остаток: «{v}» — не число"))?;
                // отрицательный остаток из 1С (продано больше, чем числится) — для сайта это 0
                d.stock.push((*store, q.max(Decimal::ZERO).min(Decimal::from(1_000_000_000)).round_dp(3)));
            }
            Col::Attr(name) => d.attrs.push((name.clone(), if matches!(v, "-" | "—") { None } else { Some(v.chars().take(300).collect()) })),
            Col::Ignored => {}
        }
    }
    if d.code.is_empty() {
        return Err("Не указан код товара".into());
    }
    if d.code.chars().count() > 64 {
        return Err("Код: не длиннее 64 символов".into());
    }
    Ok(d)
}

// ---------- справочники ----------

struct Cat {
    id: i32,
    parent_id: Option<i32>,
    slug: String,
    name: String,
    path: String,
    sort: i32,
}

struct Brand {
    id: i32,
    slug: String,
    name: String,
}

#[derive(sqlx::FromRow, Clone)]
struct Existing {
    id: Uuid,
    code: String,
    list_price: Decimal,
    sale_price: Option<Decimal>,
    brand_id: Option<i32>,
    attributes: Value,
}

/// Слаги разделов — как в сиде каталога: «щ» → «shch» (kabelenesushchie-sistemy, molniezashchita…).
fn category_slug(name: &str) -> String {
    slugify(&name.replace('щ', "shch").replace('Щ', "Shch"))
}

fn unique(base: &str, fallback: &str, taken: &mut HashSet<String>) -> String {
    let mut base: String = if base.is_empty() { fallback.to_string() } else { base.to_string() };
    if base.len() > 90 {
        base.truncate(90);
        base = base.trim_end_matches('-').to_string();
    }
    let mut slug = base.clone();
    let mut n = 1;
    while taken.contains(&slug) {
        n += 1;
        slug = format!("{base}-{n}");
    }
    taken.insert(slug.clone());
    slug
}

struct Ctx {
    cats: Vec<Cat>,
    cat_slugs: HashSet<String>,
    brands: Vec<Brand>,
    brand_slugs: HashSet<String>,
    product_slugs: HashSet<String>,
    existing: HashMap<String, Existing>,
    categories_created: usize,
    brands_created: usize,
}

impl Ctx {
    fn find_child(&self, parent: Option<i32>, seg: &str) -> Option<usize> {
        let key = norm(seg);
        self.cats.iter().position(|c| c.parent_id == parent && (norm(&c.name) == key || c.slug == seg))
    }

    /// Раздел по пути «Кабели и провода / Силовые кабели»; недостающие уровни создаются.
    /// Одно название без пути — сначала раздел верхнего уровня, затем единственный раздел с таким названием на любом уровне.
    /// Ошибка базы — `Err` (импорт прерывается: транзакция Postgres после сбоя уже не работает), ошибка данных — `Ok(Err(..))`.
    async fn category(&mut self, conn: &mut PgConnection, raw: &str) -> AppResult<Result<i32, String>> {
        let segs: Vec<&str> = raw.split(" / ").map(str::trim).filter(|s| !s.is_empty()).collect();
        if segs.is_empty() {
            return Ok(Err("Категория: пустое значение".into()));
        }
        if let [one] = segs.as_slice() {
            if let Some(i) = self.find_child(None, one) {
                return Ok(Ok(self.cats[i].id));
            }
            let key = norm(one);
            let found: Vec<i32> = self.cats.iter().filter(|c| norm(&c.name) == key || c.slug == *one).map(|c| c.id).collect();
            match found.as_slice() {
                [id] => return Ok(Ok(*id)),
                [] => {}
                _ => return Ok(Err(format!("Категория «{one}» есть в нескольких разделах — укажите путь через « / »"))),
            }
        }
        if segs.iter().any(|s| s.chars().count() > 200) {
            return Ok(Err("Категория: название раздела не длиннее 200 символов".into()));
        }
        let mut parent: Option<usize> = None;
        for seg in segs {
            let parent_id = parent.map(|i| self.cats[i].id);
            parent = Some(match self.find_child(parent_id, seg) {
                Some(i) => i,
                None => {
                    let slug = unique(&category_slug(seg), "razdel", &mut self.cat_slugs);
                    let path = match parent {
                        Some(i) => format!("{}/{slug}", self.cats[i].path),
                        None => slug.clone(),
                    };
                    let sort = self.cats.iter().filter(|c| c.parent_id == parent_id).map(|c| c.sort + 1).max().unwrap_or(0);
                    let id: i32 = sqlx::query_scalar("INSERT INTO categories (parent_id, slug, name, path, sort) VALUES ($1,$2,$3,$4,$5) RETURNING id")
                        .bind(parent_id)
                        .bind(&slug)
                        .bind(seg)
                        .bind(&path)
                        .bind(sort)
                        .fetch_one(&mut *conn)
                        .await?;
                    self.cats.push(Cat { id, parent_id, slug, name: seg.to_string(), path, sort });
                    self.categories_created += 1;
                    self.cats.len() - 1
                }
            });
        }
        Ok(Ok(parent.map(|i| self.cats[i].id).expect("non-empty path")))
    }

    /// Бренд по названию или слагу; нового — создаём.
    async fn brand(&mut self, conn: &mut PgConnection, raw: &str) -> AppResult<(i32, String)> {
        let key = norm(raw);
        if let Some(b) = self.brands.iter().find(|b| norm(&b.name) == key || b.slug == raw.trim()) {
            return Ok((b.id, b.name.clone()));
        }
        let slug = unique(&slugify(raw), "brand", &mut self.brand_slugs);
        let id: i32 = sqlx::query_scalar("INSERT INTO brands (slug, name, sort) VALUES ($1, $2, (SELECT COALESCE(max(sort), 0) + 1 FROM brands)) RETURNING id")
            .bind(&slug)
            .bind(raw.trim())
            .fetch_one(&mut *conn)
            .await?;
        self.brands.push(Brand { id, slug, name: raw.trim().to_string() });
        self.brands_created += 1;
        Ok((id, raw.trim().to_string()))
    }
}

/// Характеристики: значения из файла заменяют одноимённые, новые добавляются, «-» удаляет.
fn merge_attrs(current: &Value, changes: &[(String, Option<String>)], brand: Option<&str>) -> Value {
    let mut list: Vec<Value> = current.as_array().cloned().unwrap_or_default();
    let mut apply = |name: &str, value: Option<&str>, front: bool| {
        let key = norm(name);
        let pos = list.iter().position(|a| a.get("name").and_then(Value::as_str).is_some_and(|n| norm(n) == key));
        match (pos, value) {
            (Some(i), Some(v)) => list[i]["value"] = json!(v),
            (Some(i), None) => {
                list.remove(i);
            }
            (None, Some(v)) if front => list.insert(0, json!({ "name": name, "value": v })),
            (None, Some(v)) => list.push(json!({ "name": name, "value": v })),
            (None, None) => {}
        }
    };
    if let Some(b) = brand {
        apply("Бренд", Some(b), true);
    }
    for (name, value) in changes {
        apply(name, value.as_deref(), false);
    }
    Value::Array(list)
}

enum Outcome {
    Created,
    Updated,
    Unchanged,
}

/// Запись одной строки. Ошибка данных — `Ok(Err(сообщение))` (строка пропускается), ошибка базы — `Err` (импорт прерывается).
async fn apply_row(conn: &mut PgConnection, ctx: &mut Ctx, d: RowData, stock_rows: &mut usize) -> AppResult<Result<Outcome, String>> {
    let existing = ctx.existing.get(&d.code).cloned();
    let existing = existing.as_ref();
    let is_new = existing.is_none();
    if is_new {
        let missing: Vec<&str> = [("Наименование", d.name.is_none()), ("Категория", d.category.is_none()), ("Цена", d.price.is_none())]
            .into_iter()
            .filter(|(_, m)| *m)
            .map(|(n, _)| n)
            .collect();
        if !missing.is_empty() {
            return Ok(Err(format!("Новый товар {}: заполните {}", d.code, missing.join(", "))));
        }
    }
    // распродажа — ниже прайса (проверяем с учётом текущих значений товара)
    let list = d.price.or(existing.map(|e| e.list_price)).unwrap_or_default();
    let sale = match &d.sale {
        Some(Opt::Set(v)) => Some(*v),
        Some(Opt::Clear) => None,
        None => existing.and_then(|e| e.sale_price),
    };
    if sale.is_some_and(|s| s >= list) {
        return Ok(Err(format!("Цена распродажи ({}) должна быть ниже цены ({})", sale.unwrap_or_default().normalize(), list.normalize())));
    }
    let category_id = match &d.category {
        Some(c) => match ctx.category(conn, c).await? {
            Ok(id) => Some(id),
            Err(e) => return Ok(Err(e)),
        },
        None => None,
    };
    let brand = match &d.brand {
        Some(b) => Some(ctx.brand(conn, b).await?),
        None => None,
    };
    let (pack_set, pack_qty) = match d.pack {
        Some(Opt::Set(q)) => (true, Some(q)),
        Some(Opt::Clear) => (true, None),
        None => (false, None),
    };
    let product_id = match existing {
        None => {
            let name = d.name.clone().unwrap_or_default();
            let slug = {
                let base = slugify(&name);
                let base = if base.is_empty() { format!("tovar-{}", slugify(&d.code)) } else { base };
                unique(&base, "tovar", &mut ctx.product_slugs)
            };
            let mut attrs: Vec<(String, Option<String>)> = d.attrs.clone();
            attrs.push(("Артикул".into(), Some(d.code.clone())));
            let attributes = merge_attrs(&json!([]), &attrs, brand.as_ref().map(|b| b.1.as_str()));
            let id: Uuid = sqlx::query_scalar(
                r#"INSERT INTO products (code, slug, name, brand_id, category_id, unit, list_price, sale_price, pack_qty, attributes, images, description)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id"#,
            )
            .bind(&d.code)
            .bind(&slug)
            .bind(&name)
            .bind(brand.as_ref().map(|b| b.0))
            .bind(category_id)
            .bind(d.unit.as_deref().unwrap_or("шт"))
            .bind(list)
            .bind(sale)
            .bind(pack_qty)
            .bind(&attributes)
            .bind(d.images.clone().unwrap_or_default())
            .bind(d.description.clone().unwrap_or_default())
            .fetch_one(&mut *conn)
            .await?;
            ctx.existing.insert(d.code.clone(), Existing { id, code: d.code.clone(), list_price: list, sale_price: sale, brand_id: brand.as_ref().map(|b| b.0), attributes });
            id
        }
        Some(e) => {
            let id = e.id;
            let brand_changed = brand.as_ref().is_some_and(|b| Some(b.0) != e.brand_id);
            let attributes = if d.attrs.is_empty() && !brand_changed {
                None
            } else {
                Some(merge_attrs(&e.attributes, &d.attrs, if brand_changed { brand.as_ref().map(|b| b.1.as_str()) } else { None }))
            };
            let changed = d.name.is_some()
                || category_id.is_some()
                || brand.is_some()
                || d.unit.is_some()
                || d.price.is_some()
                || d.sale.is_some()
                || pack_set
                || d.description.is_some()
                || d.images.is_some()
                || attributes.is_some();
            if changed {
                sqlx::query(
                    r#"UPDATE products SET name = COALESCE($2, name), category_id = COALESCE($3, category_id), brand_id = COALESCE($4, brand_id),
                         unit = COALESCE($5, unit), list_price = $6, sale_price = $7,
                         pack_qty = CASE WHEN $8 THEN $9 ELSE pack_qty END, pack_label = CASE WHEN $8 THEN NULL ELSE pack_label END,
                         description = COALESCE($10, description), images = COALESCE($11, images), attributes = COALESCE($12, attributes)
                       WHERE id = $1"#,
                )
                .bind(id)
                .bind(&d.name)
                .bind(category_id)
                .bind(brand.as_ref().map(|b| b.0))
                .bind(&d.unit)
                .bind(list)
                .bind(sale)
                .bind(pack_set)
                .bind(pack_qty)
                .bind(&d.description)
                .bind(&d.images)
                .bind(&attributes)
                .execute(&mut *conn)
                .await?;
                if let Some(e) = ctx.existing.get_mut(&d.code) {
                    e.list_price = list;
                    e.sale_price = sale;
                    if let Some(b) = &brand {
                        e.brand_id = Some(b.0);
                    }
                    if let Some(a) = attributes {
                        e.attributes = a;
                    }
                }
            } else if d.stock.is_empty() {
                return Ok(Ok(Outcome::Unchanged));
            }
            id
        }
    };
    if !d.stock.is_empty() {
        let stores: Vec<i32> = d.stock.iter().map(|s| s.0).collect();
        let qtys: Vec<Decimal> = d.stock.iter().map(|s| s.1).collect();
        sqlx::query(
            r#"INSERT INTO stock (product_id, store_id, qty) SELECT $1, s, q FROM unnest($2::int[], $3::numeric[]) AS x(s, q)
               ON CONFLICT (product_id, store_id) DO UPDATE SET qty = EXCLUDED.qty"#,
        )
        .bind(product_id)
        .bind(&stores)
        .bind(&qtys)
        .execute(&mut *conn)
        .await?;
        *stock_rows += d.stock.len();
    }
    Ok(Ok(if is_new { Outcome::Created } else { Outcome::Updated }))
}

/// Импорт в одной транзакции; `dry_run` — всё проверяется и считается так же, но транзакция откатывается.
/// Кэш публичных ответов сбрасывает вызывающий (HTTP-обработчик), CRM / 1С событий импорт не создаёт.
pub async fn run(pool: &PgPool, table: Table, dry_run: bool) -> AppResult<Summary> {
    let mut tx = pool.begin().await?;
    let stores = sqlx::query_as::<_, StoreRef>("SELECT id, code, name FROM stores ORDER BY sort, id").fetch_all(&mut *tx).await?;

    let mut cols = Vec::with_capacity(table.headers.len());
    let mut problems = Vec::new();
    let mut ignored = Vec::new();
    for h in &table.headers {
        match column(h, &stores) {
            Ok(Col::Ignored) => {
                if !h.is_empty() {
                    ignored.push(h.clone());
                }
                cols.push(Col::Ignored);
            }
            Ok(c) => {
                if c != Col::Ignored && cols.contains(&c) {
                    problems.push(format!("Столбец «{h}» указан дважды"));
                }
                cols.push(c);
            }
            Err(e) => problems.push(e),
        }
    }
    if !cols.contains(&Col::Code) {
        problems.insert(0, "Нет обязательного столбца «Код»".into());
    }
    if !problems.is_empty() {
        return Err(invalid_header(problems.join("; ")).with_details(json!({ "problems": problems, "headers": table.headers })));
    }

    let cats: Vec<(i32, Option<i32>, String, String, String, i32)> =
        sqlx::query_as("SELECT id, parent_id, slug, name, path, sort FROM categories ORDER BY sort, id").fetch_all(&mut *tx).await?;
    let brands: Vec<(i32, String, String)> = sqlx::query_as("SELECT id, slug, name FROM brands ORDER BY sort, id").fetch_all(&mut *tx).await?;
    let product_slugs: Vec<String> = sqlx::query_scalar("SELECT slug FROM products").fetch_all(&mut *tx).await?;
    let code_idx = cols.iter().position(|c| *c == Col::Code).expect("checked above");
    let codes: Vec<String> = table.rows.iter().filter_map(|(_, r)| r.get(code_idx)).map(|c| c.trim().to_string()).filter(|c| !c.is_empty()).collect();
    let existing = sqlx::query_as::<_, Existing>("SELECT id, code, list_price, sale_price, brand_id, attributes FROM products WHERE code = ANY($1)")
        .bind(&codes)
        .fetch_all(&mut *tx)
        .await?;
    let mut ctx = Ctx {
        cat_slugs: cats.iter().map(|c| c.2.clone()).collect(),
        cats: cats.into_iter().map(|(id, parent_id, slug, name, path, sort)| Cat { id, parent_id, slug, name, path, sort }).collect(),
        brand_slugs: brands.iter().map(|b| b.1.clone()).collect(),
        brands: brands.into_iter().map(|(id, slug, name)| Brand { id, slug, name }).collect(),
        product_slugs: product_slugs.into_iter().collect(),
        existing: existing.into_iter().map(|e| (e.code.clone(), e)).collect(),
        categories_created: 0,
        brands_created: 0,
    };

    let mut s = Summary { dry_run, rows: table.rows.len(), ignored_columns: ignored, ..Default::default() };
    for (line, cells) in &table.rows {
        let result = match parse_row(&cols, cells) {
            Ok(d) => apply_row(&mut tx, &mut ctx, d, &mut s.stock_rows).await?,
            Err(e) => Err(e),
        };
        match result {
            Ok(Outcome::Created) => s.created += 1,
            Ok(Outcome::Updated) => s.updated += 1,
            Ok(Outcome::Unchanged) => s.skipped += 1,
            Err(message) => {
                s.skipped += 1;
                if s.errors.len() < MAX_ERRORS {
                    s.errors.push(RowError { row: *line, message });
                }
            }
        }
    }
    s.categories_created = ctx.categories_created;
    s.brands_created = ctx.brands_created;
    recount_categories(&mut tx).await?;
    if dry_run {
        tx.rollback().await?;
    } else {
        tx.commit().await?;
        tracing::info!(rows = s.rows, created = s.created, updated = s.updated, skipped = s.skipped, "catalog imported");
    }
    Ok(s)
}

// ---------- шаблон ----------

#[derive(sqlx::FromRow)]
struct Example {
    code: String,
    name: String,
    category_path: String,
    brand: Option<String>,
    unit: String,
    list_price: Decimal,
    sale_price: Option<Decimal>,
    pack_qty: Option<Decimal>,
    description: String,
    image: Option<String>,
    attributes: Value,
    id: Uuid,
}

/// Шаблон файла импорта: лист «Каталог» (заголовки текущих складов + строка-пример из базы) и лист «Инструкция».
pub async fn template(pool: &PgPool) -> AppResult<Vec<u8>> {
    use rust_xlsxwriter::{Color, Format, FormatBorder, Workbook};
    let stores: Vec<(i32, String, String, String)> = sqlx::query_as("SELECT id, code, name, city FROM stores ORDER BY sort, id").fetch_all(pool).await?;
    let example = sqlx::query_as::<_, Example>(
        r#"SELECT p.id, p.code, p.name,
                  (SELECT string_agg(c2.name, ' / ' ORDER BY length(c2.path)) FROM categories c2 WHERE c.path = c2.path OR c.path LIKE c2.path || '/%') AS category_path,
                  b.name AS brand, p.unit, p.list_price, p.sale_price, p.pack_qty, p.description, p.images[1] AS image, p.attributes
           FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN brands b ON b.id = p.brand_id
           WHERE p.is_active ORDER BY p.popularity DESC, p.id LIMIT 1"#,
    )
    .fetch_optional(pool)
    .await?;
    let stock: Vec<(i32, Decimal)> = match &example {
        Some(e) => sqlx::query_as("SELECT store_id, qty FROM stock WHERE product_id = $1").bind(e.id).fetch_all(pool).await?,
        None => vec![],
    };
    let attrs: Vec<(String, String)> = example
        .as_ref()
        .and_then(|e| e.attributes.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|a| Some((a.get("name")?.as_str()?.to_string(), a.get("value")?.as_str()?.to_string())))
        .filter(|(n, _)| !matches!(n.as_str(), "Бренд" | "Артикул" | "Страна" | "Гарантия"))
        .take(2)
        .collect();
    let attr_names: Vec<String> = if attrs.is_empty() { vec!["Материал".into(), "Степень защиты".into()] } else { attrs.iter().map(|a| a.0.clone()).collect() };

    let mut headers: Vec<String> = ["Код", "Наименование", "Категория", "Бренд", "Ед. изм.", "Цена", "Цена распродажи", "Кратность", "Описание", "Изображение"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    headers.extend(stores.iter().map(|s| format!("Остаток {}", s.1)));
    headers.extend(attr_names.iter().map(|n| format!("Хар: {n}")));

    let dec = |d: Decimal| d.normalize().to_string();
    let mut row: Vec<String> = match &example {
        Some(e) => vec![
            e.code.clone(),
            e.name.clone(),
            e.category_path.clone(),
            e.brand.clone().unwrap_or_default(),
            e.unit.clone(),
            dec(e.list_price),
            e.sale_price.map(dec).unwrap_or_default(),
            e.pack_qty.map(dec).unwrap_or_default(),
            e.description.clone(),
            e.image.clone().unwrap_or_default(),
        ],
        None => vec![
            "100001".into(),
            "Кабель силовой ВВГнг(А)-LS 3х2,5".into(),
            "Кабели и провода / Силовые кабели".into(),
            "Кавказкабель".into(),
            "м".into(),
            "12.5".into(),
            String::new(),
            "100".into(),
            "Кабель с медными жилами в негорючей оболочке.".into(),
            "https://tec.tj/images/vvg-3x2.5.jpg".into(),
        ],
    };
    row.extend(stores.iter().map(|s| stock.iter().find(|x| x.0 == s.0).map(|x| dec(x.1)).unwrap_or_else(|| if example.is_some() { "0".into() } else { "500".into() })));
    if attrs.is_empty() {
        row.extend(["ПВХ".to_string(), "IP20".to_string()]);
    } else {
        row.extend(attrs.iter().map(|a| a.1.clone()));
    }

    let border = |f: Format| f.set_border(FormatBorder::Thin).set_border_color(Color::RGB(0xBFBFBF));
    let head = border(Format::new().set_bold().set_background_color(Color::RGB(0xF4C241)).set_text_wrap());
    let text = border(Format::new().set_num_format("@"));
    let cell = border(Format::new());
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    ws.set_name("Каталог")?;
    for (i, h) in headers.iter().enumerate() {
        let col = i as u16;
        ws.write_string_with_format(0, col, h, &head)?;
        let width = match i {
            1 => 48.0,
            2 => 40.0,
            8 | 9 => 36.0,
            _ => 14.0,
        };
        ws.set_column_width(col, width)?;
    }
    // код — текстом (ведущие нули не теряются)
    ws.set_column_format(0, &text)?;
    for (i, v) in row.iter().enumerate() {
        ws.write_string_with_format(1, i as u16, v, if i == 0 { &text } else { &cell })?;
    }
    ws.set_freeze_panes(1, 0)?;

    let help = wb.add_worksheet();
    help.set_name("Инструкция")?;
    help.set_column_width(0, 28)?;
    help.set_column_width(1, 110)?;
    let bold = Format::new().set_bold();
    let wrap = Format::new().set_text_wrap();
    let mut lines: Vec<(String, String)> = vec![
        ("Импорт каталога ТЭК".into(), "Первая строка листа «Каталог» — заголовки (регистр не важен, лишние столбцы пропускаются), дальше — по товару в строке. Файл: .xlsx или .csv (UTF-8, разделитель ; или ,).".into()),
        ("Как обновляются товары".into(), "Товар ищется по столбцу «Код». Нового товара нет в базе — он создаётся (обязательны Наименование, Категория, Цена). Товар уже есть — меняются только заполненные ячейки: файл «Код + Цена» обновит цены, «Код + Остаток …» — остатки.".into()),
        ("Проверка без записи".into(), "Отметьте «Только проверить» (dry_run): файл проверяется целиком, отчёт тот же, но в базу ничего не записывается.".into()),
        (String::new(), String::new()),
        ("Код".into(), "Обязательный. Код номенклатуры из 1С — ключ товара. Не длиннее 64 символов.".into()),
        ("Наименование".into(), "Название товара (до 300 символов). Адрес страницы товара создаётся из названия один раз и потом не меняется.".into()),
        ("Категория".into(), "Путь раздела через « / », например «Кабели и провода / Силовые кабели». Недостающие разделы создаются. Можно указать одно название, если раздел с таким названием в каталоге один.".into()),
        ("Бренд".into(), "Название бренда; нового бренда нет — он создаётся.".into()),
        ("Ед. изм.".into(), "шт или м (метры можно продавать дробным количеством). По умолчанию — шт.".into()),
        ("Цена".into(), "Прайсовая цена, с. (1 690,80 или 1690.80).".into()),
        ("Цена распродажи".into(), "Цена со скидкой, ниже прайсовой. Пусто — не менять; «0» или «-» — снять распродажу.".into()),
        ("Кратность".into(), "Шаг количества (кабель в бухте 100 м — 100). «0» или «-» — убрать кратность.".into()),
        ("Описание".into(), "Текст описания товара.".into()),
        ("Изображение".into(), "Ссылка https://… или путь /… ; несколько — через «;». Заменяет все фото товара.".into()),
        ("Остаток <склад>".into(), "Столбец на каждый склад: «Остаток <код склада>» или «Остаток <название склада>». Количество — остаток на складе (отрицательное считается нулём). Пусто — не менять.".into()),
        ("Хар: <название>".into(), "Характеристика товара, например «Хар: Сечение, мм²». Значение заменяет одноимённую характеристику; «-» — удалить её.".into()),
        (String::new(), String::new()),
        ("Склады".into(), String::new()),
    ];
    for s in &stores {
        lines.push((format!("Остаток {}", s.1), format!("{} — {}", s.2, s.3)));
    }
    for (i, (a, b)) in lines.iter().enumerate() {
        help.write_string_with_format(i as u32, 0, a, &bold)?;
        help.write_string_with_format(i as u32, 1, b, &wrap)?;
    }
    Ok(wb.save_to_buffer()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn decimals_in_any_spelling() {
        assert_eq!(parse_decimal("1 690,80"), Some(dec!(1690.80)));
        assert_eq!(parse_decimal("1690.8"), Some(dec!(1690.8)));
        assert_eq!(parse_decimal("1\u{a0}690,80 с."), Some(dec!(1690.80)));
        assert_eq!(parse_decimal("1,690.80"), Some(dec!(1690.80)));
        assert_eq!(parse_decimal("12 TJS"), Some(dec!(12)));
        assert_eq!(parse_decimal("abc"), None);
        assert_eq!(parse_decimal(""), None);
    }

    #[test]
    fn csv_quotes_and_delimiters() {
        let rows = parse_csv("Код;Наименование;Цена\n1;\"Кабель \"\"ВВГ\"\"; 3х2,5\";12,5\r\n2;\"Лоток\nперфорированный\";100\n", ';');
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[1].1, vec!["1", "Кабель \"ВВГ\"; 3х2,5", "12,5"]);
        assert_eq!(rows[2].0, 3);
        assert_eq!(rows[2].1[1], "Лоток\nперфорированный");
        let comma = read_csv("\u{feff}Код,Цена\n5,10\n".as_bytes());
        assert_eq!(comma[0].1, vec!["Код", "Цена"]);
        assert_eq!(comma[1].1, vec!["5", "10"]);
    }

    #[test]
    fn cp1251_fallback() {
        // «Код;Цена» в Windows-1251
        let bytes = [0xCA, 0xEE, 0xE4, b';', 0xD6, 0xE5, 0xED, 0xE0, b'\n'];
        assert_eq!(read_csv(&bytes)[0].1, vec!["Код", "Цена"]);
    }

    #[test]
    fn headers_are_recognized() {
        let stores = vec![StoreRef { id: 1, code: "dushanbe".into(), name: "Центральный склад".into() }, StoreRef { id: 2, code: "khujand".into(), name: "Худжанд".into() }];
        assert_eq!(column("КОД", &stores), Ok(Col::Code));
        assert_eq!(column("Ед. изм.", &stores), Ok(Col::Unit));
        assert_eq!(column("Цена", &stores), Ok(Col::Price));
        assert_eq!(column("Цена распродажи", &stores), Ok(Col::SalePrice));
        assert_eq!(column("Остаток dushanbe", &stores), Ok(Col::Stock(1)));
        assert_eq!(column("Остаток Центральный  склад", &stores), Ok(Col::Stock(1)));
        assert!(column("Остаток Москва", &stores).is_err());
        assert_eq!(column("Хар: Сечение, мм²", &stores), Ok(Col::Attr("Сечение, мм²".into())));
        assert_eq!(column("Комментарий", &stores), Ok(Col::Ignored));
    }

    #[test]
    fn slugs_match_catalog_style() {
        assert_eq!(category_slug("Кабеленесущие системы"), "kabelenesushchie-sistemy");
        assert_eq!(category_slug("Светотехника"), "svetotekhnika");
        let mut taken: HashSet<String> = ["kabel".to_string()].into_iter().collect();
        assert_eq!(unique("kabel", "x", &mut taken), "kabel-2");
        assert_eq!(unique("", "tovar", &mut taken), "tovar");
    }

    #[test]
    fn attributes_merge() {
        let cur = json!([{ "name": "Бренд", "value": "DKS" }, { "name": "Цвет", "value": "серый" }, { "name": "Артикул", "value": "1" }]);
        let out = merge_attrs(&cur, &[("цвет".into(), Some("белый".into())), ("IP".into(), Some("IP54".into())), ("Артикул".into(), None)], Some("IEK"));
        assert_eq!(out, json!([{ "name": "Бренд", "value": "IEK" }, { "name": "Цвет", "value": "белый" }, { "name": "IP", "value": "IP54" }]));
    }

    #[test]
    fn units() {
        assert_eq!(parse_unit("шт."), Ok("шт".into()));
        assert_eq!(parse_unit("Метр"), Ok("м".into()));
        assert_eq!(parse_unit("компл"), Ok("компл".into()));
    }
}

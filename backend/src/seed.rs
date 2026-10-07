//! Deterministic seed: real tectj.com catalog structure, ~400 products, dev accounts, orders, content.
//! Runs once (when `products` is empty). All randomness comes from a fixed-seed xorshift.

use std::collections::HashMap;

use chrono::{Duration, Utc};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde_json::{json, Value};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{auth::hash_password, config::SeedMode, services::pdf::translit, services::pricing::round2};

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn range(&mut self, lo: i64, hi: i64) -> i64 {
        lo + (self.next() % ((hi - lo + 1) as u64)) as i64
    }
    fn pick<'a, T>(&mut self, xs: &'a [T]) -> &'a T {
        &xs[(self.next() % xs.len() as u64) as usize]
    }
    fn chance(&mut self, pct: u64) -> bool {
        self.next() % 100 < pct
    }
    fn money(&mut self, lo: i64, hi: i64) -> Decimal {
        let cents = self.range(lo * 100, hi * 100);
        // round to .x0 for a realistic price list
        Decimal::new((cents / 10) * 10, 2)
    }
}

pub fn slugify(s: &str) -> String {
    let t = translit(s).to_lowercase();
    let mut out = String::with_capacity(t.len());
    let mut dash = false;
    for c in t.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    out.trim_end_matches('-').to_string()
}

type Tx<'a> = Transaction<'a, Postgres>;

struct UserSeed {
    email: String,
    phone: String,
    hash: String,
    first_name: String,
    last_name: String,
    role: String,
    status: String,
    ctype: String,
    company: Option<Uuid>,
    manager: Option<Uuid>,
    lead: bool,
    discount: Decimal,
    cashback: Decimal,
}

async fn insert_user(tx: &mut Tx<'_>, u: UserSeed) -> anyhow::Result<Uuid> {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO users (email, phone, password_hash, first_name, last_name, role, status, customer_type, company_id, manager_id, is_lead_manager, discount_pct, cashback_pct) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id",
    )
    .bind(u.email).bind(u.phone).bind(u.hash).bind(u.first_name).bind(u.last_name).bind(u.role).bind(u.status).bind(u.ctype).bind(u.company).bind(u.manager).bind(u.lead).bind(u.discount).bind(u.cashback)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

struct Ctx {
    rng: Rng,
    brands: HashMap<&'static str, i32>,
    cats: HashMap<&'static str, i32>,
    stores: Vec<i32>,
    code_seq: i64,
    slugs: HashMap<String, u32>,
}

impl Ctx {
    fn next_code(&mut self) -> String {
        self.code_seq += 1;
        format!("{}", self.code_seq)
    }
    fn unique_slug(&mut self, base: &str) -> String {
        let n = self.slugs.entry(base.to_string()).or_insert(0);
        *n += 1;
        if *n == 1 { base.to_string() } else { format!("{base}-{n}") }
    }
}

struct P {
    name: String,
    brand: &'static str,
    cat: &'static str,
    unit: &'static str,
    price: Decimal,
    sale: Option<Decimal>,
    code: Option<String>,
    /// (группа торговых предложений, значения товара по её осям)
    group: Option<(i32, Value)>,
    pack: Option<(Decimal, String)>,
    attrs: Vec<(String, String)>,
    short: String,
    desc: String,
    hit: bool,
    new: bool,
    popularity: i64,
    configurator: Option<i32>,
    stock: Option<(Decimal, Decimal, Decimal)>,
    features: Value,
}

impl P {
    fn basic(name: impl Into<String>, brand: &'static str, cat: &'static str, unit: &'static str, price: Decimal) -> Self {
        P {
            name: name.into(),
            brand,
            cat,
            unit,
            price,
            sale: None,
            code: None,
            group: None,
            pack: None,
            attrs: vec![],
            short: String::new(),
            desc: String::new(),
            hit: false,
            new: false,
            popularity: 0,
            configurator: None,
            stock: None,
            features: json!([]),
        }
    }
}

/// Категории верхнего уровня с фото (frontend/public/categories/{slug}.png); то же — в миграциях 0006 и 0008.
const CATEGORY_PHOTOS: &[&str] = &[
    "kabelenesushchie-sistemy",
    "svetotekhnika",
    "generatory",
    "molniezashchita-i-zazemlenie",
    "nizkovoltnoe-oborudovanie",
    "shchitovoe-oborudovanie",
    "elektroustanovochnye-izdeliya",
    "instrumenty",
    "solnechnaya-energetika",
    "elektromontazhnaya-produktsiya",
];

const COUNTRIES: &[(&str, &str)] = &[
    ("dks", "Россия"),
    ("schneider-electric", "Франция"),
    ("systeme-electric", "Россия"),
    ("legrand", "Франция"),
    ("philips-lighting", "Нидерланды"),
    ("hascelik-kablo", "Турция"),
    ("hes-kablo", "Турция"),
    ("prysmian", "Италия"),
    ("aksa", "Турция"),
    ("te-connectivity", "Швейцария"),
    ("omicron", "Австрия"),
    ("megger", "Великобритания"),
    ("hexing", "Китай"),
    ("sata-tools", "Китай"),
    ("promrukav", "Россия"),
    ("iek", "Россия"),
    ("abb", "Швейцария"),
    ("tsmo", "Россия"),
    ("metz", "Беларусь"),
];

fn country(brand: &str) -> &'static str {
    COUNTRIES.iter().find(|(b, _)| *b == brand).map(|(_, c)| *c).unwrap_or("Россия")
}

async fn insert_product(tx: &mut Tx<'_>, ctx: &mut Ctx, p: P) -> anyhow::Result<Uuid> {
    let code = p.code.clone().unwrap_or_else(|| ctx.next_code());
    let slug = ctx.unique_slug(&slugify(&p.name));
    let brand_id = *ctx.brands.get(p.brand).unwrap_or_else(|| panic!("brand {}", p.brand));
    let cat_id = *ctx.cats.get(p.cat).unwrap_or_else(|| panic!("cat {}", p.cat));
    let mut attrs: Vec<Value> = Vec::new();
    let brand_name: String = sqlx::query_scalar("SELECT name FROM brands WHERE id = $1").bind(brand_id).fetch_one(&mut **tx).await?;
    attrs.push(json!({ "name": "Бренд", "value": brand_name }));
    for (k, v) in &p.attrs {
        attrs.push(json!({ "name": k, "value": v }));
    }
    attrs.push(json!({ "name": "Артикул", "value": code }));
    if !p.attrs.iter().any(|(k, _)| k == "Страна") {
        attrs.push(json!({ "name": "Страна", "value": country(p.brand) }));
    }
    if !p.attrs.iter().any(|(k, _)| k == "Гарантия") {
        let warranty = ["1 год", "2 года", "3 года", "5 лет"][(ctx.rng.next() % 4) as usize];
        attrs.push(json!({ "name": "Гарантия", "value": warranty }));
    }
    let popularity = if p.popularity > 0 { p.popularity } else { ctx.rng.range(0, 1000) };
    let hit = p.hit || popularity > 900;
    let new = p.new || ctx.rng.chance(15);
    let created_at = Utc::now() - Duration::days(if new { ctx.rng.range(0, 20) } else { ctx.rng.range(30, 700) });
    let desc = if p.desc.is_empty() {
        format!(
            "{} — оригинальная продукция бренда {}. Поставляется со склада ТЭК в Душанбе, сертифицирована для применения в Республике Таджикистан. Квалифицированная техническая поддержка и помощь в подборе.",
            p.name, brand_name
        )
    } else {
        p.desc.clone()
    };
    let (pack_qty, pack_label) = match &p.pack {
        Some((q, l)) => (Some(*q), Some(l.clone())),
        None => (None, None),
    };
    let id: Uuid = sqlx::query_scalar(
        r#"INSERT INTO products (code, slug, name, brand_id, category_id, group_id, variant, unit, list_price, sale_price, is_hit, is_new,
             pack_qty, pack_label, configurator_id, attributes, images, description, short_description, features, popularity, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'{}',$17,$18,$19,$20,$21) RETURNING id"#,
    )
    .bind(&code)
    .bind(&slug)
    .bind(&p.name)
    .bind(brand_id)
    .bind(cat_id)
    .bind(p.group.as_ref().map(|g| g.0))
    .bind(p.group.as_ref().map(|g| g.1.clone()).unwrap_or_else(|| json!({})))
    .bind(p.unit)
    .bind(p.price)
    .bind(p.sale)
    .bind(hit)
    .bind(new)
    .bind(pack_qty)
    .bind(pack_label)
    .bind(p.configurator)
    .bind(Value::Array(attrs))
    .bind(&desc)
    .bind(&p.short)
    .bind(&p.features)
    .bind(popularity as i32)
    .bind(created_at)
    .fetch_one(&mut **tx)
    .await?;
    let (d, k, m) = match p.stock {
        Some(s) => s,
        None => {
            let unit_scale: i64 = if p.unit == "м" { 100 } else { 1 };
            let d = if ctx.rng.chance(12) { 0 } else { ctx.rng.range(5, 400) * unit_scale };
            let k = if ctx.rng.chance(45) { 0 } else { ctx.rng.range(1, 120) * unit_scale };
            let m = if ctx.rng.chance(60) { 0 } else { ctx.rng.range(1, 40) * unit_scale };
            (Decimal::from(d), Decimal::from(k), Decimal::from(m))
        }
    };
    for (store, qty) in ctx.stores.iter().zip([d, k, m]) {
        sqlx::query("INSERT INTO stock (product_id, store_id, qty) VALUES ($1, $2, $3)").bind(id).bind(store).bind(qty).execute(&mut **tx).await?;
    }
    Ok(id)
}

async fn insert_category(tx: &mut Tx<'_>, parent: Option<(i32, &str)>, slug: &str, name: &str, sort: i32) -> anyhow::Result<i32> {
    let path = match parent {
        Some((_, ppath)) => format!("{ppath}/{slug}"),
        None => slug.to_string(),
    };
    let id: i32 = sqlx::query_scalar("INSERT INTO categories (parent_id, slug, name, path, sort) VALUES ($1,$2,$3,$4,$5) RETURNING id")
        .bind(parent.map(|p| p.0))
        .bind(slug)
        .bind(name)
        .bind(&path)
        .bind(sort)
        .fetch_one(&mut **tx)
        .await?;
    Ok(id)
}

/// Заполняет пустую базу. `SeedMode::Catalog` — каталог и контент сайта; `Full` — плюс демо-аккаунты
/// (admin@tec.tj / Admin1234 …), их заказы, отзывы и купоны; `Off` — ничего.
pub async fn run(pool: &PgPool, mode: SeedMode) -> anyhow::Result<bool> {
    if mode == SeedMode::Off {
        return Ok(false);
    }
    let demo = mode == SeedMode::Full;
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM products").fetch_one(pool).await?;
    if count > 0 {
        return Ok(false);
    }
    let mut tx = pool.begin().await?;
    let mut ctx = Ctx { rng: Rng(0x9E37_79B9_7F4A_7C15), brands: HashMap::new(), cats: HashMap::new(), stores: vec![], code_seq: 200_000, slugs: HashMap::new() };

    // ---------- stores ----------
    for (code, city, name, addr, phone, hours, hint, sort, (lat, lon)) in [
        ("dushanbe", "Душанбе", "Центральный склад", "г. Душанбе, ул. Низоми Ганджави", None, "8:30–17:00", "сегодня", 1, (38.549998, 68.735072)),
        ("khujand", "Худжанд", "Филиал Худжанд", "г. Худжанд, рынок Вахдат, вход 1", Some("+992 92 111 22 25"), "Пн–Сб 8:00–17:00", "завтра", 2, (40.247170, 69.695286)),
        ("kushoniyon", "Душанбе", "Магазин на рынке Кушониён", "г. Душанбе, рынок Кушониён, магазин №327", Some("+992 55 000 66 13"), "Пн – Сб: 9:00–17:00, Вс — выходной", "сегодня", 3, (38.633192, 68.766223)),
    ] {
        let id: i32 = sqlx::query_scalar("INSERT INTO stores (code, city, name, address, phone, hours, delivery_hint, sort, lat, lon) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id")
            .bind(code).bind(city).bind(name).bind(addr).bind(phone).bind(hours).bind(hint).bind(sort).bind(lat).bind(lon)
            .fetch_one(&mut *tx).await?;
        ctx.stores.push(id);
    }

    // ---------- brands ----------
    let brands: [(&str, &str, bool, &str); 19] = [
        ("dks", "ДКС", true, "Российский производитель кабеленесущих систем №1: металлические и проволочные лотки, кабель-каналы, трубы, аксессуары."),
        ("schneider-electric", "Schneider Electric", true, "Мировой лидер в области управления энергией и автоматизации."),
        ("systeme-electric", "Systeme Electric", true, "Электроустановочные изделия и низковольтное оборудование серий Этюд, Glossa, AtlasDesign."),
        ("legrand", "Legrand", true, "Электроустановочные изделия, кабель-каналы DLP, распределительные щиты."),
        ("philips-lighting", "Philips Lighting", true, "Светодиодные лампы, светильники и прожекторы Philips / Signify."),
        ("hascelik-kablo", "Hasçelik Kablo", true, "Турецкий производитель силовых и контрольных кабелей."),
        ("hes-kablo", "HES Kablo", true, "Кабельная продукция: H05VV-F, NYM, NYY и др."),
        ("prysmian", "Prysmian", true, "Итальянская кабельная группа — кабели среднего и высокого напряжения."),
        ("aksa", "AKSA", true, "Дизельные и бензиновые генераторы AKSA Power Generation."),
        ("te-connectivity", "TE Connectivity", true, "Кабельные муфты Raychem, соединители, термоусадка."),
        ("omicron", "Omicron", true, "Испытательное оборудование для релейной защиты и первичного оборудования."),
        ("megger", "Megger", true, "Измерительные приборы: мегаомметры, тестеры заземления."),
        ("hexing", "Hexing", true, "Счётчики электроэнергии и системы АСКУЭ."),
        ("sata-tools", "SATA Tools", true, "Профессиональный ручной и электроинструмент."),
        ("promrukav", "Промрукав", false, "Гофрированные трубы, лотки серии «Стандарт», аксессуары."),
        ("iek", "IEK", false, "Модульное оборудование, щиты, трансформаторы тока."),
        ("abb", "ABB", false, "Низковольтная аппаратура и сухие трансформаторы."),
        ("tsmo", "ЦМО", false, "Телекоммуникационные шкафы и стойки 19\"."),
        ("metz", "МЭТЗ им. Козлова", false, "Масляные силовые трансформаторы ТМГ."),
    ];
    for (i, (slug, name, featured, desc)) in brands.iter().enumerate() {
        let id: i32 = sqlx::query_scalar(
            "INSERT INTO brands (slug, name, country_brand, country_origin, description, logo_url, is_featured, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
        )
        .bind(slug)
        .bind(name)
        .bind(country(slug))
        .bind(if *slug == "dks" || *slug == "promrukav" || *slug == "iek" { "Россия" } else { country(slug) })
        .bind(desc)
        .bind(format!("/brands/{slug}.svg"))
        .bind(featured)
        .bind(i as i32)
        .fetch_one(&mut *tx)
        .await?;
        ctx.brands.insert(slug, id);
    }

    // ---------- categories ----------
    let tree: &[(&str, &str, &[(&str, &str, &[(&str, &str)])])] = &[
        ("kabeli-i-provoda", "Кабели и провода", &[("silovye-kabeli", "Силовые кабели", &[]), ("provoda-montazhnye", "Провода монтажные", &[]), ("kontrolnye-kabeli", "Контрольные кабели", &[])]),
        ("kabelenesushchie-sistemy", "Кабеленесущие системы", &[
            ("kabelnye-lotki-i-aksessuary", "Кабельные лотки и аксессуары", &[("kabelnye-lotki-dks", "Кабельные лотки ДКС"), ("kryshki", "Крышки"), ("ugly", "Углы"), ("otvetviteli", "Ответвители"), ("konsoli", "Консоли")]),
            ("kabel-kanaly-i-aksessuary", "Кабель-каналы и аксессуары", &[]),
            ("kabelnye-truby-i-aksessuary", "Кабельные трубы и аксессуары", &[]),
        ]),
        ("svetotekhnika", "Светотехника", &[("lampy", "Лампы", &[]), ("svetilniki", "Светильники", &[]), ("prozhektory", "Прожекторы", &[])]),
        ("generatory", "Генераторы", &[("portativnye-generatory", "Портативные генераторы", &[]), ("statsionarnye-generatory", "Стационарные генераторы", &[])]),
        ("molniezashchita-i-zazemlenie", "Молниезащита и заземление", &[("molniepriemniki", "Молниеприемники", &[]), ("komplekty-zazemleniya", "Комплекты заземления", &[]), ("provodniki", "Проводники", &[])]),
        ("transformatory", "Трансформаторы", &[("maslyanye-transformatory", "Масляные трансформаторы", &[]), ("sukhie-transformatory", "Сухие трансформаторы", &[])]),
        ("elektroustanovochnye-izdeliya", "Электроустановочные изделия", &[("rozetki", "Розетки", &[]), ("vyklyuchateli", "Выключатели", &[])]),
        ("nizkovoltnoe-oborudovanie", "Низковольтное оборудование", &[("avtomaticheskie-vyklyuchateli", "Автоматические выключатели", &[]), ("kontaktory", "Контакторы", &[])]),
        ("shchitovoe-oborudovanie", "Щитовое оборудование", &[("raspredelitelnye-shchity", "Распределительные щиты", &[]), ("telekommunikatsionnye-shkafy", "Телекоммуникационные шкафы", &[])]),
        ("schetchiki-elektroenergii", "Счетчики электроэнергии", &[("schetchiki", "Счетчики", &[]), ("komplektuyushchie-schetchikov", "Комплектующие счетчиков", &[])]),
        // категории из макета лендинга (редакция 06.10), товары придут из 1С
        ("instrumenty", "Инструменты", &[]),
        ("solnechnaya-energetika", "Солнечная энергетика", &[]),
        ("elektromontazhnaya-produktsiya", "Электромонтажная продукция", &[]),
    ];
    for (i, (slug, name, children)) in tree.iter().enumerate() {
        let id = insert_category(&mut tx, None, slug, name, i as i32).await?;
        sqlx::query("UPDATE categories SET image_url = $2, description = $3 WHERE id = $1")
            .bind(id)
            .bind(format!("/categories/{slug}.svg"))
            .bind(format!("{name}: оригинальная продукция ведущих мировых производителей со склада в Душанбе."))
            .execute(&mut *tx)
            .await?;
        ctx.cats.insert(slug, id);
        for (j, (cslug, cname, grand)) in children.iter().enumerate() {
            let cid = insert_category(&mut tx, Some((id, slug)), cslug, cname, j as i32).await?;
            ctx.cats.insert(cslug, cid);
            let cpath = format!("{slug}/{cslug}");
            for (k, (gslug, gname)) in grand.iter().enumerate() {
                let gid = insert_category(&mut tx, Some((cid, &cpath)), gslug, gname, k as i32).await?;
                ctx.cats.insert(gslug, gid);
            }
        }
    }
    // фото категорий (frontend/public/categories/*.png) — где есть; у остальных остаются иллюстрации
    sqlx::query("UPDATE categories SET image_url = '/categories/' || slug || '.png' WHERE parent_id IS NULL AND slug = ANY($1)")
        .bind(CATEGORY_PHOTOS)
        .execute(&mut *tx)
        .await?;

    // ---------- configurators ----------
    let conf_trays: i32 = sqlx::query_scalar(
        "INSERT INTO configurators (slug, name, description, url, image_url) VALUES ('fix-combitech', 'Конфигуратор подбора кабельных лотков', 'Fix Combitech — программа позволяет автоматически рассчитать количество требуемых элементов кабеленесущих систем и систем организации рабочих мест.', '/configurators/fix-combitech', '/configurators/fix-combitech.svg') RETURNING id",
    )
    .fetch_one(&mut *tx)
    .await?;
    let conf_channels: i32 = sqlx::query_scalar(
        "INSERT INTO configurators (slug, name, description, url, image_url) VALUES ('kabel-kanaly', 'Конфигуратор кабель-каналов', 'Подбор кабель-каналов, аксессуаров и комплектующих для организации рабочих мест.', '/configurators/kabel-kanaly', '/configurators/kabel-kanaly.svg') RETURNING id",
    )
    .fetch_one(&mut *tx)
    .await?;

    // ---------- documents ----------
    let mut docs: HashMap<&str, i32> = HashMap::new();
    for (key, title, kind, file, size) in [
        ("cert", "Сертификат соответствия ТР ТС 004/2011", "certificate", "sertifikat-sootvetstviya.pdf", 412),
        ("decl", "Декларация о соответствии", "declaration", "deklaratsiya-sootvetstviya.pdf", 236),
        ("draw-tray", "Чертёж лотка перфорированного", "drawing", "chertezh-lotka.pdf", 890),
        ("passport", "Паспорт изделия", "passport", "pasport-izdeliya.pdf", 154),
        ("cat-dks", "Каталог ДКС: металлические лотки и аксессуары", "catalog", "katalog-dks-lotki.pdf", 12800),
        ("cert-cable", "Сертификат соответствия ГОСТ 31996-2012", "certificate", "sertifikat-gost-31996.pdf", 380),
    ] {
        let id: i32 = sqlx::query_scalar("INSERT INTO documents (title, kind, file_name, size_kb) VALUES ($1,$2,$3,$4) RETURNING id")
            .bind(title).bind(kind).bind(file).bind(size).fetch_one(&mut *tx).await?;
        docs.insert(key, id);
    }

    // ---------- products ----------
    let mut all: Vec<(Uuid, &'static str)> = Vec::new(); // (id, cat)

    // trays group (Petrovich-style trade offers)
    let group_id: i32 = sqlx::query_scalar("INSERT INTO product_groups (name, axes) VALUES ('Лоток перфорированный 50х3000 ДКС', ARRAY['Ширина, мм']) RETURNING id").fetch_one(&mut *tx).await?;
    let tray_desc = "Перфорированный лоток ДКС имеет все необходимые конструктивные решения для быстрого и современного монтажа.\n\nМеталлический лоток серии «Стандарт» — это комплексная система, предназначенная для прокладки электрических силовых кабельных трасс, систем связи, пожарной и охранной сигнализации внутри и снаружи помещений. Лотки соответствуют основным техническим требованиям ГОСТ 20783-81 на «Лотки для металлических электропроводок».";
    let tray_features = json!([
        { "title": "Соединение мама-папа", "text": "Одна часть лотка вставляется в другую, образуя гладкий стык поверхности лотков без дополнительных соединителей." },
        { "title": "Цинкование по методу Сендзимира", "text": "Горячее цинкование стального листа обеспечивает стойкость к коррозии внутри и снаружи помещений." }
    ]);
    let mut tray_ids = Vec::new();
    for (w, price, sale, code, stock_d) in [
        (50, dec!(690.80), None, "101005", 620),
        (80, dec!(890.80), None, "101008", 480),
        (100, dec!(1090.80), None, "101011", 900),
        (150, dec!(1390.80), None, "101015", 300),
        (200, dec!(1780.80), Some(dec!(1690.80)), "101020", 900),
    ] {
        let mut p = P::basic(format!("Лоток перфорированный {w}х50х3000 ДКС"), "dks", "kabelnye-lotki-dks", "м", price);
        p.sale = sale;
        p.code = Some(code.to_string());
        p.group = Some((group_id, json!({ "Ширина, мм": w.to_string() })));
        p.pack = Some((dec!(3), "лоток 3 м".into()));
        p.attrs = vec![
            ("Тип".into(), "Лоток перфорированный".into()),
            ("Ширина, мм".into(), w.to_string()),
            ("Высота, мм".into(), "50".into()),
            ("Длина".into(), "3 м".into()),
            ("Стандарт".into(), "ГОСТ 20783-81".into()),
            ("Гарантия".into(), "5 лет".into()),
            ("Страна".into(), "Россия".into()),
            ("Покрытие".into(), "Цинкование по методу Сендзимира".into()),
        ];
        p.short = "Цинкование горячим способом по методу Сендзимира".into();
        p.desc = tray_desc.into();
        p.features = tray_features.clone();
        p.hit = w == 200 || w == 100;
        p.popularity = 990 - w as i64;
        p.configurator = Some(conf_trays);
        p.stock = Some((Decimal::from(stock_d), Decimal::ZERO, Decimal::from(if w == 100 { 60 } else { 0 })));
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        tray_ids.push((w, id));
        all.push((id, "kabelnye-lotki-dks"));
        for d in ["cert", "decl", "draw-tray", "cat-dks", "passport"] {
            sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2)").bind(id).bind(docs[d]).execute(&mut *tx).await?;
        }
    }
    // more trays
    for (kind, h) in [("Лоток лестничный", 50), ("Лоток лестничный", 100), ("Лоток неперфорированный", 50), ("Лоток проволочный", 30), ("Лоток проволочный", 50)] {
        for w in [100, 200, 300, 400] {
            let mut p = P::basic(format!("{kind} {w}х{h}х3000 ДКС"), "dks", "kabelnye-lotki-dks", "м", ctx.rng.money(300, 2400));
            p.pack = Some((dec!(3), "лоток 3 м".into()));
            p.attrs = vec![("Тип".into(), kind.into()), ("Ширина, мм".into(), w.to_string()), ("Высота, мм".into(), h.to_string()), ("Длина".into(), "3 м".into()), ("Стандарт".into(), "ГОСТ 20783-81".into())];
            p.configurator = Some(conf_trays);
            p.desc = tray_desc.into();
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "kabelnye-lotki-dks"));
            for d in ["cert", "cat-dks"] {
                sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2)").bind(id).bind(docs[d]).execute(&mut *tx).await?;
            }
        }
    }
    // tray accessories
    let mut acc_by_group: HashMap<&str, Vec<(i32, Uuid)>> = HashMap::new();
    for (cat, group, tmpl, lo, hi) in [
        ("kryshki", "Крышки", "Крышка на лоток {w} ДКС", 120, 900),
        ("ugly", "Углы", "Угол горизонтальный 90° {w}х50 ДКС", 250, 1600),
        ("otvetviteli", "Ответвители", "Ответвитель T-образный {w}х50 ДКС", 300, 1900),
        ("konsoli", "Консоли", "Консоль опорная BBL {w} мм ДКС", 90, 700),
    ] {
        for w in [50, 80, 100, 150, 200, 300] {
            let mut p = P::basic(tmpl.replace("{w}", &w.to_string()), "dks", cat, if cat == "kryshki" { "м" } else { "шт" }, ctx.rng.money(lo, hi));
            p.attrs = vec![("Тип".into(), group.into()), ("Подходит для лотка шириной".into(), format!("{w} мм")), ("Стандарт".into(), "ГОСТ 20783-81".into())];
            if cat == "kryshki" {
                p.pack = Some((dec!(3), "крышка 3 м".into()));
            }
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, cat));
            acc_by_group.entry(group).or_default().push((w, id));
            sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2)").bind(id).bind(docs["cert"]).execute(&mut *tx).await?;
        }
    }
    for (w, tray) in &tray_ids {
        let mut sort = 0;
        for group in ["Крышки", "Углы", "Ответвители", "Консоли"] {
            for (aw, aid) in &acc_by_group[group] {
                if aw == w || (group == "Консоли" && *aw >= *w && *aw <= *w + 100) {
                    sqlx::query("INSERT INTO accessories (product_id, accessory_id, group_name, sort) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING")
                        .bind(tray).bind(aid).bind(group).bind(sort).execute(&mut *tx).await?;
                    sort += 1;
                }
            }
        }
    }

    // socket from the design
    {
        let mut p = P::basic("Розетка Systeme Electric Этюд накладная белая (PA16-007B)", "systeme-electric", "rozetki", "шт", dec!(1200.00));
        p.code = Some("101010".into());
        p.attrs = vec![("Тип".into(), "Розетка накладная с заземлением".into()), ("Серия".into(), "Этюд".into()), ("Цвет".into(), "Белый".into()), ("Степень защиты".into(), "IP20".into()), ("Номинальный ток".into(), "16 А".into()), ("Стандарт".into(), "ГОСТ IEC 60884-1-2013".into()), ("Гарантия".into(), "3 года".into())];
        p.short = "Накладная розетка с заземлением, 16 А, IP20, белая".into();
        p.hit = true;
        p.popularity = 985;
        p.stock = Some((dec!(100), dec!(25), dec!(10)));
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "rozetki"));
        for d in ["cert", "decl", "passport"] {
            sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2)").bind(id).bind(docs[d]).execute(&mut *tx).await?;
        }
    }
    // cable from the design
    {
        let mut p = P::basic("Кабель H05VV-F 3x6 FL 5V HES Kablo", "hes-kablo", "silovye-kabeli", "м", dec!(29.70));
        p.sale = Some(dec!(29.00));
        p.code = Some("100230".into());
        p.pack = Some((dec!(100), "барабан 100 м".into()));
        p.attrs = vec![("Тип".into(), "H05VV-F".into()), ("Число жил".into(), "3".into()), ("Сечение, мм²".into(), "6".into()), ("Стандарт".into(), "ГОСТ 31996-2012".into()), ("Гарантия".into(), "5 лет".into())];
        p.hit = true;
        p.popularity = 999;
        p.stock = Some((dec!(100), dec!(0), dec!(0)));
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "silovye-kabeli"));
        sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2)").bind(id).bind(docs["cert-cable"]).execute(&mut *tx).await?;
    }

    // generic generators per leaf category
    let cable_brands: &[&'static str] = &["hascelik-kablo", "hes-kablo", "prysmian"];
    for s in ["1.5", "2.5", "4", "6", "10", "16", "25", "35"] {
        for c in [2, 3, 4, 5] {
            if ctx.rng.chance(35) {
                continue;
            }
            let brand = *ctx.rng.pick(cable_brands);
            let base: f64 = s.parse::<f64>().unwrap() * c as f64 * 1.9 + 3.0;
            let mut p = P::basic(format!("Кабель ВВГнг(А)-LS {c}x{s}"), brand, "silovye-kabeli", "м", round2(Decimal::try_from(base).unwrap()));
            p.pack = Some((dec!(100), "барабан 100 м".into()));
            p.attrs = vec![("Тип".into(), "ВВГнг(А)-LS".into()), ("Число жил".into(), c.to_string()), ("Сечение, мм²".into(), s.into()), ("Стандарт".into(), "ГОСТ 31996-2012".into())];
            if ctx.rng.chance(20) { p.sale = Some(round2(p.price * dec!(0.9))); }
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "silovye-kabeli"));
            sqlx::query("INSERT INTO product_documents (product_id, document_id) VALUES ($1, $2)").bind(id).bind(docs["cert-cable"]).execute(&mut *tx).await?;
        }
    }
    for s in ["0.5", "0.75", "1", "1.5", "2.5", "4", "6", "10", "16"] {
        for color in ["белый", "синий", "жёлто-зелёный", "чёрный"] {
            if ctx.rng.chance(45) { continue; }
            let brand = *ctx.rng.pick(cable_brands);
            let base: f64 = s.parse::<f64>().unwrap() * 2.1 + 1.2;
            let mut p = P::basic(format!("Провод ПуГВ 1x{s} {color}"), brand, "provoda-montazhnye", "м", round2(Decimal::try_from(base).unwrap()));
            p.pack = Some((dec!(100), "бухта 100 м".into()));
            p.attrs = vec![("Тип".into(), "ПуГВ".into()), ("Сечение, мм²".into(), s.into()), ("Цвет".into(), color.into()), ("Стандарт".into(), "ГОСТ 31947-2012".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "provoda-montazhnye"));
        }
    }
    for c in [4, 5, 7, 10, 14, 19, 27] {
        for s in ["1", "1.5", "2.5"] {
            if ctx.rng.chance(30) { continue; }
            let brand = *ctx.rng.pick(cable_brands);
            let base: f64 = s.parse::<f64>().unwrap() * c as f64 * 1.4 + 6.0;
            let mut p = P::basic(format!("Кабель контрольный КВВГнг(А)-LS {c}x{s}"), brand, "kontrolnye-kabeli", "м", round2(Decimal::try_from(base).unwrap()));
            p.pack = Some((dec!(100), "барабан 100 м".into()));
            p.attrs = vec![("Тип".into(), "КВВГнг(А)-LS".into()), ("Число жил".into(), c.to_string()), ("Сечение, мм²".into(), s.into()), ("Стандарт".into(), "ГОСТ 1508-78".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "kontrolnye-kabeli"));
        }
    }
    for (w, h) in [(16, 16), (25, 16), (40, 25), (60, 40), (80, 60), (100, 50), (150, 65), (200, 80)] {
        for brand in ["legrand", "dks", "iek"] {
            if ctx.rng.chance(30) { continue; }
            let series = match brand { "legrand" => "DLP", "dks" => "TA-GN", _ => "Элекор" };
            let mut p = P::basic(format!("Кабель-канал {w}х{h} {series} 2 м"), brand, "kabel-kanaly-i-aksessuary", "шт", ctx.rng.money(15, 480));
            p.attrs = vec![("Тип".into(), "Кабель-канал".into()), ("Ширина, мм".into(), w.to_string()), ("Высота, мм".into(), h.to_string()), ("Длина".into(), "2 м".into()), ("Цвет".into(), "Белый".into())];
            p.configurator = Some(conf_channels);
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "kabel-kanaly-i-aksessuary"));
        }
    }
    for d in [16, 20, 25, 32, 40, 50, 63] {
        for (kind, brand) in [("Труба гофрированная ПВХ лёгкая", "promrukav"), ("Труба гофрированная ПНД", "promrukav"), ("Труба жёсткая ПВХ", "dks")] {
            if ctx.rng.chance(25) { continue; }
            let mut p = P::basic(format!("{kind} d{d} мм"), brand, "kabelnye-truby-i-aksessuary", "м", ctx.rng.money(3, 60));
            p.pack = Some((dec!(100), if kind.contains("жёсткая") { "пруток 3 м".into() } else { "бухта 100 м".into() }));
            p.attrs = vec![("Тип".into(), kind.into()), ("Диаметр, мм".into(), d.to_string()), ("Стандарт".into(), "ГОСТ Р МЭК 61386".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "kabelnye-truby-i-aksessuary"));
        }
    }
    for w in [7, 9, 11, 13, 15, 18, 23] {
        for (base, temp) in [("E27", "3000K"), ("E27", "4000K"), ("E27", "6500K"), ("E14", "4000K")] {
            if ctx.rng.chance(40) { continue; }
            let mut p = P::basic(format!("Лампа светодиодная Philips LEDBulb {w}W {base} {temp}"), "philips-lighting", "lampy", "шт", ctx.rng.money(18, 95));
            p.attrs = vec![("Тип".into(), "Лампа светодиодная".into()), ("Мощность, Вт".into(), w.to_string()), ("Цоколь".into(), base.into()), ("Цветовая температура".into(), temp.into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "lampy"));
        }
    }
    for (model, w) in [("SmartBright Panel", 36), ("SmartBright Panel", 40), ("CoreLine Waterproof", 18), ("CoreLine Waterproof", 36), ("Ledinaire Batten", 20), ("Ledinaire Batten", 40), ("CoreLine Highbay", 100), ("CoreLine Highbay", 150), ("Ledinaire Downlight", 12), ("Ledinaire Downlight", 18)] {
        let mut p = P::basic(format!("Светильник светодиодный Philips {model} {w}W"), "philips-lighting", "svetilniki", "шт", ctx.rng.money(120, 2200));
        p.attrs = vec![("Тип".into(), "Светильник светодиодный".into()), ("Серия".into(), model.into()), ("Мощность, Вт".into(), w.to_string()), ("Степень защиты".into(), if model.contains("Waterproof") { "IP65".into() } else { "IP40".into() })];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "svetilniki"));
    }
    for w in [20, 30, 50, 70, 100, 150, 200, 300] {
        for brand in ["philips-lighting", "iek"] {
            if ctx.rng.chance(30) { continue; }
            let mut p = P::basic(format!("Прожектор светодиодный {w}W {}", if brand == "iek" { "IEK СДО 07" } else { "Philips BVP" }), brand, "prozhektory", "шт", ctx.rng.money(60, 1900));
            p.attrs = vec![("Тип".into(), "Прожектор светодиодный".into()), ("Мощность, Вт".into(), w.to_string()), ("Степень защиты".into(), "IP65".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "prozhektory"));
        }
    }
    for (model, kw) in [("AAP 3500", 3), ("AAP 5500", 5), ("AAP 7500", 6), ("AAP 10000", 8), ("AAP 12000", 10), ("AAP 15000", 12), ("ADJ 6000", 5), ("ADJ 9000", 7)] {
        let mut p = P::basic(format!("{} AKSA {model} {kw} кВт", if model.starts_with("ADJ") { "Дизельный генератор" } else { "Бензиновый генератор" }), "aksa", "portativnye-generatory", "шт", ctx.rng.money(6000, 45000));
        p.attrs = vec![("Тип".into(), "Портативный генератор".into()), ("Мощность, кВт".into(), kw.to_string()), ("Топливо".into(), if model.starts_with("ADJ") { "Дизель".into() } else { "Бензин".into() }), ("Гарантия".into(), "2 года".into())];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "portativnye-generatory"));
    }
    for (model, kva) in [("APD 33 A", 33), ("APD 50 A", 50), ("APD 75 A", 75), ("APD 110 C", 110), ("APD 165 C", 165), ("APD 250 C", 250), ("APD 330 C", 330), ("APD 500 C", 500), ("APD 700 C", 700), ("APD 1000 C", 1000)] {
        let mut p = P::basic(format!("Дизельная электростанция AKSA {model} {kva} кВА"), "aksa", "statsionarnye-generatory", "шт", round2(Decimal::from(kva) * dec!(1650) + dec!(40000)));
        p.attrs = vec![("Тип".into(), "Дизельная электростанция".into()), ("Мощность, кВА".into(), kva.to_string()), ("Исполнение".into(), if kva >= 250 { "В кожухе".into() } else { "Открытое".into() }), ("Гарантия".into(), "2 года".into())];
        p.short = "Бесплатная пуско-наладка и расчёт специалиста".into();
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "statsionarnye-generatory"));
    }
    for l in [1, 2, 3, 4, 5, 6] {
        for kind in ["Молниеприемник стержневой", "Молниеприемник-мачта"] {
            if ctx.rng.chance(30) { continue; }
            let mut p = P::basic(format!("{kind} {l} м ДКС"), "dks", "molniepriemniki", "шт", ctx.rng.money(250, 4800));
            p.attrs = vec![("Тип".into(), kind.into()), ("Длина".into(), format!("{l} м")), ("Материал".into(), "Сталь оцинкованная".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "molniepriemniki"));
        }
    }
    for n in [3, 6, 9, 12, 15, 30] {
        for brand in ["dks", "iek"] {
            if ctx.rng.chance(30) { continue; }
            let mut p = P::basic(format!("Комплект заземления {n} м (омедненный) {}", if brand == "dks" { "ДКС" } else { "IEK" }), brand, "komplekty-zazemleniya", "шт", ctx.rng.money(900, 9500));
            p.attrs = vec![("Тип".into(), "Комплект заземления".into()), ("Общая длина".into(), format!("{n} м")), ("Покрытие".into(), "Омеднение".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "komplekty-zazemleniya"));
        }
    }
    for (kind, dia) in [("Проводник круглый омедненный", 8), ("Проводник круглый омедненный", 10), ("Проводник круглый оцинкованный", 8), ("Проводник круглый оцинкованный", 10), ("Полоса оцинкованная 40х4", 0), ("Проводник алюминиевый", 8)] {
        let mut p = P::basic(if dia > 0 { format!("{kind} d{dia} мм ДКС") } else { format!("{kind} ДКС") }, "dks", "provodniki", "м", ctx.rng.money(8, 70));
        p.pack = Some((dec!(50), "бухта 50 м".into()));
        p.attrs = vec![("Тип".into(), kind.into()), ("Диаметр, мм".into(), if dia > 0 { dia.to_string() } else { "—".into() })];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "provodniki"));
    }
    for kva in [63, 100, 160, 250, 400, 630, 1000, 1600] {
        let mut p = P::basic(format!("Трансформатор масляный ТМГ-{kva}/10/0,4 У1"), "metz", "maslyanye-transformatory", "шт", round2(Decimal::from(kva) * dec!(120) + dec!(25000)));
        p.attrs = vec![("Тип".into(), "ТМГ".into()), ("Мощность, кВА".into(), kva.to_string()), ("Напряжение ВН/НН".into(), "10/0,4 кВ".into()), ("Гарантия".into(), "3 года".into())];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "maslyanye-transformatory"));
    }
    for kva in [100, 160, 250, 400, 630, 1000, 1250] {
        let mut p = P::basic(format!("Трансформатор сухой ТСЛ-{kva}/10/0,4"), "abb", "sukhie-transformatory", "шт", round2(Decimal::from(kva) * dec!(210) + dec!(38000)));
        p.attrs = vec![("Тип".into(), "ТСЛ".into()), ("Мощность, кВА".into(), kva.to_string()), ("Напряжение ВН/НН".into(), "10/0,4 кВ".into())];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "sukhie-transformatory"));
    }
    for (series, brand) in [("Этюд", "systeme-electric"), ("Glossa", "systeme-electric"), ("AtlasDesign", "systeme-electric"), ("Valena", "legrand"), ("Etika", "legrand")] {
        for (kind, color) in [("Розетка с заземлением скрытая", "белая"), ("Розетка с заземлением скрытая", "бежевая"), ("Розетка двойная с заземлением", "белая"), ("Розетка с крышкой IP44", "белая"), ("Розетка накладная", "белая")] {
            if ctx.rng.chance(35) { continue; }
            let mut p = P::basic(format!("{kind} {} {series} {color}", if brand == "legrand" { "Legrand" } else { "Systeme Electric" }), brand, "rozetki", "шт", ctx.rng.money(25, 260));
            p.attrs = vec![("Тип".into(), kind.into()), ("Серия".into(), series.into()), ("Цвет".into(), color.into()), ("Номинальный ток".into(), "16 А".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "rozetki"));
        }
        for kind in ["Выключатель одноклавишный", "Выключатель двухклавишный", "Переключатель одноклавишный", "Выключатель с подсветкой"] {
            if ctx.rng.chance(35) { continue; }
            let mut p = P::basic(format!("{kind} {} {series} белый", if brand == "legrand" { "Legrand" } else { "Systeme Electric" }), brand, "vyklyuchateli", "шт", ctx.rng.money(22, 240));
            p.attrs = vec![("Тип".into(), kind.into()), ("Серия".into(), series.into()), ("Цвет".into(), "Белый".into()), ("Номинальный ток".into(), "10 А".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "vyklyuchateli"));
        }
    }
    for a in [6, 10, 16, 20, 25, 32, 40, 50, 63] {
        for (series, brand, poles) in [("Easy9", "schneider-electric", 1), ("Easy9", "schneider-electric", 3), ("SH200", "abb", 1), ("SH200", "abb", 3), ("ВА47-29", "iek", 1), ("ВА47-29", "iek", 3)] {
            if ctx.rng.chance(40) { continue; }
            let mut p = P::basic(format!("Автоматический выключатель {series} {poles}P {a}A C {}", match brand { "abb" => "ABB", "iek" => "IEK", _ => "Schneider Electric" }), brand, "avtomaticheskie-vyklyuchateli", "шт", ctx.rng.money(18, 420));
            p.attrs = vec![("Тип".into(), "Автоматический выключатель".into()), ("Серия".into(), series.into()), ("Число полюсов".into(), poles.to_string()), ("Номинальный ток, А".into(), a.to_string()), ("Характеристика".into(), "C".into()), ("Стандарт".into(), "ГОСТ IEC 60898-1".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "avtomaticheskie-vyklyuchateli"));
        }
    }
    for a in [9, 12, 18, 25, 32, 40, 50, 65, 80, 95] {
        for (series, brand) in [("TeSys D LC1D", "schneider-electric"), ("AF", "abb"), ("КМИ", "iek")] {
            if ctx.rng.chance(40) { continue; }
            let mut p = P::basic(format!("Контактор {series}{a} {a}A 230В AC {}", match brand { "abb" => "ABB", "iek" => "IEK", _ => "Schneider Electric" }), brand, "kontaktory", "шт", ctx.rng.money(150, 2400));
            p.attrs = vec![("Тип".into(), "Контактор".into()), ("Серия".into(), series.into()), ("Номинальный ток, А".into(), a.to_string()), ("Катушка".into(), "230 В AC".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "kontaktory"));
        }
    }
    for n in [12, 18, 24, 36, 48, 54, 72] {
        for (kind, brand) in [("Щит распределительный навесной ЩРН", "iek"), ("Щит распределительный встраиваемый ЩРВ", "iek"), ("Щит Practibox S", "legrand"), ("Щит Kaedra", "schneider-electric")] {
            if ctx.rng.chance(40) { continue; }
            let mut p = P::basic(format!("{kind}-{n} модулей"), brand, "raspredelitelnye-shchity", "шт", ctx.rng.money(180, 3200));
            p.attrs = vec![("Тип".into(), kind.into()), ("Число модулей".into(), n.to_string()), ("Степень защиты".into(), "IP41".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "raspredelitelnye-shchity"));
        }
    }
    for u in [6, 9, 12, 18, 22, 27, 33, 42, 47] {
        for kind in ["Шкаф телекоммуникационный настенный 19\"", "Шкаф телекоммуникационный напольный 19\""] {
            if kind.contains("настенный") && u > 22 { continue; }
            if kind.contains("напольный") && u < 18 { continue; }
            let mut p = P::basic(format!("{kind} {u}U 600х{} ЦМО", if kind.contains("напольный") { 800 } else { 500 }), "tsmo", "telekommunikatsionnye-shkafy", "шт", ctx.rng.money(1200, 14000));
            p.attrs = vec![("Тип".into(), kind.into()), ("Высота, U".into(), u.to_string()), ("Ширина, мм".into(), "600".into())];
            let id = insert_product(&mut tx, &mut ctx, p).await?;
            all.push((id, "telekommunikatsionnye-shkafy"));
        }
    }
    for (model, phase, kind) in [("HXE110", "однофазный", "Счётчик электроэнергии"), ("HXE110-KP", "однофазный", "Счётчик электроэнергии с предоплатой"), ("HXE310", "трёхфазный", "Счётчик электроэнергии"), ("HXE310-KP", "трёхфазный", "Счётчик электроэнергии с предоплатой"), ("HXE34", "трёхфазный", "Счётчик электроэнергии трансформаторного включения"), ("HXE12", "однофазный", "Счётчик электроэнергии"), ("HXE115", "однофазный", "Счётчик электроэнергии split"), ("HXE330", "трёхфазный", "Счётчик электроэнергии split")] {
        let mut p = P::basic(format!("{kind} Hexing {model} {phase}"), "hexing", "schetchiki", "шт", ctx.rng.money(280, 2900));
        p.attrs = vec![("Тип".into(), kind.into()), ("Модель".into(), model.into()), ("Фазность".into(), phase.into()), ("Класс точности".into(), "1.0".into())];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "schetchiki"));
    }
    for a in [50, 75, 100, 150, 200, 300, 400, 600, 800, 1000] {
        let mut p = P::basic(format!("Трансформатор тока ТТИ-А {a}/5А 5ВА класс 0,5 IEK"), "iek", "komplektuyushchie-schetchikov", "шт", ctx.rng.money(90, 480));
        p.attrs = vec![("Тип".into(), "Трансформатор тока".into()), ("Первичный ток, А".into(), a.to_string()), ("Класс точности".into(), "0,5".into())];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "komplektuyushchie-schetchikov"));
    }
    for kind in ["Испытательная коробка ИКК", "Зажим наборный для счётчика", "Бокс для счётчика ЩУ-1", "Бокс для счётчика ЩУ-3", "Модуль связи RS-485 Hexing", "Модем GPRS Hexing"] {
        let mut p = P::basic(kind, if kind.contains("Hexing") { "hexing" } else { "iek" }, "komplektuyushchie-schetchikov", "шт", ctx.rng.money(40, 1600));
        p.attrs = vec![("Тип".into(), "Комплектующие счётчиков".into())];
        let id = insert_product(&mut tx, &mut ctx, p).await?;
        all.push((id, "komplektuyushchie-schetchikov"));
    }
    // generic cert for products without documents
    sqlx::query("INSERT INTO product_documents (product_id, document_id) SELECT p.id, $1 FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_documents d WHERE d.product_id = p.id)")
        .bind(docs["decl"])
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE categories c SET product_count = (SELECT count(*) FROM products p JOIN categories pc ON pc.id = p.category_id WHERE pc.path = c.path OR pc.path LIKE c.path || '/%')").execute(&mut *tx).await?;

    // sub-category tiles reuse the product illustration of the same slug (top-level categories have their own art)
    sqlx::query("UPDATE categories SET image_url = '/products/' || slug || '.svg' WHERE image_url IS NULL AND parent_id IS NOT NULL")
        .execute(&mut *tx)
        .await?;

    // photos exported from the Figma mockup (frontend /public/figma): cable trays and cable categories
    sqlx::query("UPDATE products p SET images = ARRAY['/figma/tray.webp'] FROM categories c WHERE c.id = p.category_id AND c.slug = 'kabelnye-lotki-dks' AND cardinality(p.images) = 0")
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE categories SET image_url = '/figma/cable-reel.webp' WHERE slug IN ('kabeli-i-provoda', 'silovye-kabeli', 'kontrolnye-kabeli', 'provoda-montazhnye')")
        .execute(&mut *tx)
        .await?;

    // product illustrations by leaf category (static SVGs served by the frontend from /public/products)
    sqlx::query("UPDATE products p SET images = ARRAY['/products/' || c.slug || '.svg'] FROM categories c WHERE c.id = p.category_id AND cardinality(p.images) = 0")
        .execute(&mut *tx)
        .await?;

    // ---------- content ----------
    sqlx::query(
        r#"INSERT INTO banners (title, text, cta_text, cta_url, image_url, sort) VALUES
           ('Fix Combitech', 'Программа позволяет автоматически рассчитать количество требуемых элементов кабеленесущих систем и систем организации рабочих мест', 'Перейти на страницу', '/configurators/fix-combitech', '/banners/fix-combitech.svg', 1),
           ('Бережно доставляем товары по Таджикистану за 48 часов', 'По Душанбе и Худжанду — за 1 рабочий день. Собственный автопарк и склад 3000 м².', 'В каталог', '/catalog', '/banners/delivery.svg', 2),
           ('Распродажа кабельных лотков ДКС', 'Скидки до 12% на перфорированные лотки серии «Стандарт» — только до конца месяца.', 'Смотреть', '/catalog/kabelnye-lotki-dks?sale=1', '/banners/sale.svg', 3)"#,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        r#"INSERT INTO usp (title, text, icon, sort) VALUES
           ('Большой ассортимент **оригинальных товаров** от мировых брендов', 'Прямые контракты с производителями, сертификаты на всё', 'assortment', 1),
           ('**Доставка товаров** по Душанбе в течение 24 часов с момента заказа', 'Собственная служба доставки, по Таджикистану — за 48 часов', 'truck', 2),
           ('**Квалифицированная техподдержка** по каждому товару', 'Инженеры помогут с подбором и расчётом', 'support', 3),
           ('**Удобный личный кабинет** для работы с заказами, оплатами и сметами', 'Персональные цены, акт сверки и бонусная карта', 'account', 4)"#,
    )
    .execute(&mut *tx)
    .await?;
    for (i, (slug, title, short)) in [
        ("obsluzhivanie-dgu-ibp", "Обслуживание ДГУ и ИБП", "Сервисное обслуживание, пуско-наладка и ремонт дизельных генераторов и ИБП."),
        ("solnechnye-elektrostantsii", "Солнечные электростанции под ключ", "Проектирование, поставка и монтаж СЭС для промышленных и частных объектов."),
        ("podderzhka-v-proektirovanii", "Поддержка в проектировании", "Консультации инженеров, подбор оборудования и подготовка спецификаций."),
    ]
    .iter()
    .enumerate()
    {
        sqlx::query("INSERT INTO services (slug, title, short, body, image_url, sort) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(slug).bind(title).bind(short)
            .bind(format!("<p>{short}</p><p>Свяжитесь с нами по телефону <a href=\"tel:+992446206060\">+992 446 20 60 60</a> или оставьте заявку — мы подготовим коммерческое предложение в течение одного рабочего дня.</p>"))
            .bind(match *slug {
                "obsluzhivanie-dgu-ibp" | "solnechnye-elektrostantsii" => "/figma/service-hero.webp".to_string(),
                _ => format!("/services/{slug}.svg"),
            })
            .bind(i as i32)
            .execute(&mut *tx).await?;
    }
    let projects: &[(&str, &str, &str, &str, &str)] = &[
        ("Резервное электроснабжение головного офиса ICB", "2025", "2025-08-10", "International Commercial Bank of Tajikistan", "Поставка, Монтаж, ПНР"),
        ("Резервное электроснабжение золотодобывающего предприятия", "2025", "2025-08-10", "Золотые прииски", "Поставка, ПНР"),
        ("Резервное электроснабжение филиала Нацбанка в Гисаре", "2025", "2025-08-10", "Национальный банк Таджикистана", "Поставка, ПНР"),
        ("Резервное электроснабжение Horizon Private School", "2025", "2025-07-02", "Horizon Private School", "Поставка, ПНР"),
        ("Резервное электроснабжение офиса Спитамен Банк", "2025", "2025-06-15", "Душанбе Сити Центр", "Поставка, ПНР"),
        ("ВЛ 110кВ Пойтахт-Маркази", "2025", "2025-05-20", "ВЛ 110кВ Пойтахт-Маркази", "Поставка"),
        ("7-этажная парковка в Душанбе", "2025", "2025-04-11", "Парковка", "Поставка"),
        ("ЦОД Коиноти Нав", "2024-2025", "2025-03-01", "ЦОД Коиноти Нав", "Поставка"),
        ("1000 кВт для крупнейшего супермаркета Relax", "2025", "2025-02-14", "Супермаркет Relax", "Поставка, ПНР"),
        ("Нурекская ГЭС — электроснабжение цеха роторов", "2025", "2025-01-25", "Andritz Hydro", "Поставка"),
        ("Отель Wyndham", "2025", "2025-01-10", "Отель Wyndham", "Поставка"),
        ("Резервное электроснабжение ангара в аэропорту Душанбе", "2024", "2024-11-05", "Аэропорт Душанбе", "Поставка, ПНР"),
        ("Резервное электроснабжение Фридом Банк", "2024", "2024-10-01", "Фридом Банк", "Поставка, ПНР"),
        ("Резервное электроснабжение базовых станций Мегафон", "2024", "2024-08-20", "Мегафон Таджикистан", "Поставка"),
        ("ВЛ 110кВ для нового Парламента РТ", "2024", "2024-06-12", "ВЛ 110кВ Парламент", "Поставка"),
        ("Резервное электроснабжение больницы в Файзабад", "2024", "2024-04-03", "Азиатский банк развития", "Поставка, ПНР"),
        ("ЦОД Газпром", "2023", "2023-09-15", "ЦОД Газпром", "Поставка"),
        ("Реабилитация дороги Кызылкала-Бохтар", "2023", "2023-05-10", "Дорога Кызылкала-Бохтар", "Проектирование, Поставка, Монтаж"),
        ("Нурекская ГЭС — КНС для ОРУ 500кВ", "2022", "2022-07-01", "Нурекская ГЭС", "Поставка"),
        ("ПС «Радиостанция» и «Промышленная» — РУ Legrand", "2019", "2019-10-01", "ПС Радиостанция", "Освещение, Поставка"),
        ("ПС «Промышленная» — Жесткая ошиновка на подстанции", "2019", "2019-06-01", "ПС «Промышленная»", "Поставка"),
        ("Реновация освещения Исмоилитского Центра в Душанбе", "2019", "2019-03-01", "Исмоилитский Центр", "Поставка"),
        ("Рынок Кушониён — освещение торговых рядов", "2020", "2020-05-05", "Рынок Кушониён", "Освещение"),
        ("ГАИ 33 — резервное питание", "2021", "2021-03-03", "ГАИ 33", "Поставка, ПНР"),
        ("Хундай центр — электроснабжение автосалона", "2022", "2022-02-02", "Хундай центр", "Поставка, Монтаж"),
    ];
    for (i, (title, year, date, object, service)) in projects.iter().enumerate() {
        sqlx::query("INSERT INTO projects (slug, title, year, project_date, object, service, image_url, excerpt, body, sort) VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10)")
            .bind(ctx.unique_slug(&slugify(title))).bind(title).bind(year).bind(date).bind(object).bind(service)
            .bind(format!("/figma/project-{}.webp", (i % 6) + 1))
            .bind(format!("Объект: {object}. Услуга: {service}."))
            .bind(format!("<p>ООО «Точикэлектрокомплект» выполнило работы на объекте «{object}» ({year}). Состав работ: {service}.</p><p>Поставлено оборудование ведущих брендов — Schneider Electric, ДКС, Legrand, AKSA. Все работы выполнены в срок с гарантией.</p>"))
            .bind(i as i32)
            .execute(&mut *tx).await?;
    }
    for (title, date, excerpt) in [
        ("Резервное электроснабжение золотодобывающего предприятия", "2025-08-10", "Поставили и запустили ДГУ AKSA 500 кВА для золотодобывающего предприятия в Согдийской области."),
        ("Резервное электроснабжение филиала Нацбанка в Гисаре", "2025-08-10", "Завершены работы по резервному питанию филиала Национального банка в Гисаре."),
        ("Запуск конфигуратора Fix Combitech", "2025-07-01", "Теперь количество элементов кабеленесущих систем можно рассчитать автоматически прямо на сайте."),
        ("Новый склад в Худжанде", "2025-05-15", "Открыт филиал в Худжанде: доставка по северу Таджикистана за 1 рабочий день."),
        ("ТЭК — официальный дистрибьютор ДКС в Таджикистане", "2025-03-20", "Подписан дистрибьюторский договор с ДКС: полный ассортимент лотков и аксессуаров со склада."),
        ("Кешбэк для электриков и закупщиков", "2025-02-01", "Зарегистрируйтесь в личном кабинете и получайте бонусы с каждого заказа."),
    ] {
        sqlx::query("INSERT INTO news (slug, title, published_at, excerpt, body, image_url) VALUES ($1,$2,$3::date,$4,$5,$6)")
            .bind(ctx.unique_slug(&slugify(title))).bind(title).bind(date).bind(excerpt)
            .bind(format!("<p>{excerpt}</p><p>Подробности — у вашего персонального менеджера или по телефону +992 446 20 60 60.</p>"))
            .bind("/news/default.svg")
            .execute(&mut *tx).await?;
    }
    for (slug, title, body) in [
        ("about", "О компании", "<p>ООО «Точикэлектрокомплект» (ТЭК) — поставщик электротехнической продукции в Республике Таджикистан с 2009 года. Официальный дистрибьютор Schneider Electric, ДКС, Legrand, Philips Lighting, AKSA.</p><p>Собственный склад 3000 м² в Душанбе, филиал в Худжанде, инженерный отдел, сервисная служба по обслуживанию ДГУ и ИБП, сборка щитового оборудования.</p><ul><li>Доставка по Душанбе и Худжанду за 1 рабочий день</li><li>Квалифицированная техническая поддержка</li><li>Соответствие стандартам качества</li><li>Только оригинальная брендовая продукция</li></ul>"),
        ("contacts", "Контакты", "<p><strong>Телефон:</strong> <a href=\"tel:+992446206060\">+992 446 20 60 60</a></p><p><strong>E-mail:</strong> <a href=\"mailto:info@tec.tj\">info@tec.tj</a>, <a href=\"mailto:sales@tec.tj\">sales@tec.tj</a></p><p><strong>Главный офис:</strong> г. Душанбе, ул. Бохтар 37/1, офис 704</p><p><strong>Склад:</strong> г. Душанбе, ул. Низоми Ганджави</p><p><strong>Магазин:</strong> г. Душанбе, рынок Кушониён, магазин №327</p><p><strong>Филиал:</strong> г. Худжанд, рынок Вахдат, вход 1</p><p>Режим работы офиса: Пн – Пт: 9:00–17:00, Сб – Вс — выходной</p>"),
        ("support", "Для проектировщиков", "<p>Технические материалы и онлайн-инструменты для подбора оборудования и подготовки проекта. Рассчитывайте комплектацию, изучайте решения производителей и обращайтесь к инженерам ТЭК за помощью с расчётами и спецификациями.</p><ul><li>Онлайн-калькуляторы и конфигураторы</li><li>Каталоги и брошюры производителей</li><li>Проработка проекта совместно с инженерами ТЭК</li><li>Сертификаты и декларации на продукцию</li></ul>"),
        ("help", "Помощь", "<h3>Как оформить заказ</h3><p>Добавьте товары в корзину, выберите доставку и способ оплаты, подтвердите заказ. Менеджер свяжется с вами для уточнения деталей.</p><h3>Регистрация</h3><p>Новые аккаунты проходят одобрение компанией в течение одного рабочего дня. После одобрения вам доступны персональные цены и кешбэк.</p><h3>Возврат</h3><p>Возврат товара надлежащего качества — в течение 30 дней при сохранении упаковки.</p>"),
        ("delivery", "Доставка", "<p>Бережно доставляем товары по Таджикистану за 48 часов. По Душанбе и Худжанду — за 1 рабочий день.</p><p>Стоимость доставки по городу — 30,00 с. Самовывоз со склада и из магазина на рынке Кушониён — бесплатно.</p><p><em>Подъем/спуск на этажи и разгрузка товара не входят в услугу доставки.</em></p>"),
        ("payment", "Оплата", "<ul><li><strong>Алиф Банк</strong> — онлайн-оплата картой</li><li><strong>Душанбе Сити Банк</strong> — онлайн-оплата картой</li><li><strong>Наличными</strong> — при получении</li><li><strong>По счёту</strong> — для юридических лиц</li></ul>"),
    ] {
        sqlx::query("INSERT INTO pages (slug, title, body_html) VALUES ($1,$2,$3)").bind(slug).bind(title).bind(body).execute(&mut *tx).await?;
    }

    // ---------- демо: аккаунты с известными паролями, их заказы, отзывы, купоны (только SEED_DEMO=full) ----------
    if demo {
        // ---------- companies & users ----------
        let company_id: Uuid = sqlx::query_scalar("INSERT INTO companies (name, inn, address, phone, email, verified) VALUES ('ООО «Точикэлектрокомплект»', '123123123', 'Таджикистан, 734060, г. Душанбе, ул. Исмоили Сомони 68/13', '+992446206060', 'info@tec.tj', true) RETURNING id")
            .fetch_one(&mut *tx).await?;
        let mk_user = |email: &str, phone: &str, pw: &str, fname: &str, lname: &str, role: &str, status: &str, ctype: &str, company: Option<Uuid>, manager: Option<Uuid>, lead: bool, d: Decimal, c: Decimal| {
            let hash = hash_password(pw).expect("hash");
            UserSeed { email: email.to_string(), phone: phone.to_string(), hash, first_name: fname.to_string(), last_name: lname.to_string(), role: role.to_string(), status: status.to_string(), ctype: ctype.to_string(), company, manager, lead, discount: d, cashback: c }
        };
        let admin_id = insert_user(&mut tx, mk_user("admin@tec.tj", "+992446206060", "Admin1234", "Администратор", "ТЭК", "admin", "approved", "purchaser", None, None, false, dec!(0), dec!(0))).await?;
        let manager_id = insert_user(&mut tx, mk_user("manager@tec.tj", "+992935000010", "Manager1234", "Абдурахим", "Фозилов", "manager", "approved", "purchaser", None, None, true, dec!(0), dec!(0))).await?;
        let client_id = insert_user(&mut tx, mk_user("client@tec.tj", "+992900000001", "Client1234", "Фаррух", "Назаров", "customer", "approved", "purchaser", Some(company_id), Some(manager_id), false, dec!(10), dec!(3))).await?;
        let electric_id = insert_user(&mut tx, mk_user("electric@tec.tj", "+992900000002", "Electric1234", "Далер", "Рахимов", "customer", "approved", "electrician", None, None, false, dec!(5), dec!(2))).await?;
        let _pending_id = insert_user(&mut tx, mk_user("pending@tec.tj", "+992900000003", "Pending1234", "Нозим", "Курбонов", "customer", "pending", "retail", None, None, false, dec!(0), dec!(0))).await?;
        let _ = admin_id;
        sqlx::query("INSERT INTO user_price_rules (user_id, category_id, discount_pct, cashback_pct) VALUES ($1, $2, 15, 5)")
            .bind(client_id).bind(ctx.cats["kabelenesushchie-sistemy"]).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO user_price_rules (user_id, brand_id, discount_pct, cashback_pct) VALUES ($1, $2, 8, 3)")
            .bind(electric_id).bind(ctx.brands["dks"]).execute(&mut *tx).await?;

        // ---------- coupons ----------
        sqlx::query("INSERT INTO coupons (code, kind, value, min_total, active) VALUES ('TEK10', 'percent', 10, 0, true), ('WELCOME50', 'fixed', 50, 500, true)").execute(&mut *tx).await?;

        // ---------- reviews & questions ----------
        let tray200 = tray_ids.iter().find(|(w, _)| *w == 200).unwrap().1;
        let socket_id: Uuid = sqlx::query_scalar("SELECT id FROM products WHERE code = '101010'").fetch_one(&mut *tx).await?;
        let reviewers = ["Таварали Пармалиевич", "Винттобак Чарогович", "Абдулло электрик", "Сухроб Н.", "Манучехр Р.", "Фируз Д.", "Умед К.", "Джамшед С.", "Бахтиёр А.", "Шерали М.", "Ойбек Т.", "Рустам Х.", "Нурали Ф.", "Комрон Б.", "Сино Ш.", "Хуршед Г.", "Азиз Р."];
        let long_text = "Покупал две ушм для работы сотрудниками в цеху. Положился на качество макиты. Одну болгарку проверил а вторую нет. Итог на второй клинила кнопка пуска. Спустя неделю работы перестал запускаться. Сдали по гарантии. Гарантийка длилась 1,5 месяца, купили новые болгарки. Гарантия отказала в ремонте и предложила вернуть деньги, но факт в том что потеряли время в простое работы и купили новые.";
        let texts = [long_text, "Покупал две ушм для работы сотрудниками в цеху. Положился на качество макиты.", "Отличное качество, всё пришло вовремя. Менеджер помог с подбором.", "Лоток ровный, оцинковка хорошая. Доставили на следующий день.", "Цена выше рынка, но зато оригинал и с документами.", "Брали для объекта в Худжанде, всё подошло по размерам.", "Нормальный товар, без нареканий."];
        for (pid, n, avg_hi) in [(tray200, 17usize, true), (socket_id, 13usize, false)] {
            for i in 0..n {
                let author = reviewers[i % reviewers.len()];
                let rating = if i == 0 { 4 } else if i == 1 { 5 } else if avg_hi { *ctx.rng.pick(&[5, 5, 4, 4, 5, 3]) } else { *ctx.rng.pick(&[5, 4, 4, 5, 3, 5, 4]) };
                let (pros, cons, body) = if i == 0 { ("Надёжность и простота.", "Не выявлено.", texts[0]) } else if i == 1 { ("Нет.", "Нет.", texts[1]) } else { (*ctx.rng.pick(&["Качество", "Цена/качество", "Быстрая доставка", "Оригинал"]), *ctx.rng.pick(&["Не выявлено", "Нет", "Дорого"]), *ctx.rng.pick(&texts[2..])) };
                let days = 1700 - (i as i64) * 37;
                let created = Utc::now() - Duration::days(days.max(1));
                let (reply, replied_at) = if i == 1 || ctx.rng.chance(40) { (Some("Спасибо за отзыв!"), Some(created + Duration::days(1))) } else { (None, None) };
                let user_id = if i == 2 && pid == socket_id { Some(client_id) } else { None };
                sqlx::query("INSERT INTO reviews (product_id, user_id, author_name, rating, pros, cons, body, reply_text, reply_author, replied_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)")
                    .bind(pid).bind(user_id).bind(author).bind(rating).bind(pros).bind(cons).bind(body).bind(reply).bind(reply.map(|_| "Точикэлектрокомплект")).bind(replied_at).bind(created)
                    .execute(&mut *tx).await?;
            }
        }
        for (pid, author, q, a) in [
            (tray200, "Таварали Пармалиевич", "Покупал две ушм для работы сотрудниками в цеху. Положился на качество макиты. Есть ли крышки на этот лоток в наличии?", Some("Да, крышки шириной 200 мм есть в наличии на складе в Душанбе — см. раздел «Комплектующие».")),
            (tray200, "Абдулло электрик", "Какой максимальный шаг опор при монтаже?", Some("Рекомендуемый шаг консолей — 1,5 м при равномерной нагрузке до 60 кг/м.")),
            (tray200, "Сухроб Н.", "Есть ли доставка в Худжанд и сколько по времени?", None),
            (socket_id, "Манучехр Р.", "Подходит ли для установки во влажных помещениях?", Some("Степень защиты IP20 — только для сухих помещений. Для влажных выбирайте розетку с крышкой IP44.")),
        ] {
            let created = Utc::now() - Duration::days(ctx.rng.range(5, 400));
            let user_id = if author == "Сухроб Н." { Some(client_id) } else { None };
            sqlx::query("INSERT INTO questions (product_id, user_id, author_name, body, answer_text, answer_author, answered_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
                .bind(pid).bind(user_id).bind(author).bind(q).bind(a).bind(a.map(|_| "Точикэлектрокомплект")).bind(a.map(|_| created + Duration::days(1))).bind(created)
                .execute(&mut *tx).await?;
        }
        sqlx::query(
            r#"UPDATE products p SET reviews_count = s.cnt, rating = s.avg, questions_count = (SELECT count(*) FROM questions q WHERE q.product_id = p.id)
               FROM (SELECT product_id, count(*) AS cnt, round(avg(rating)::numeric, 2) AS avg FROM reviews GROUP BY product_id) s WHERE s.product_id = p.id"#,
        )
        .execute(&mut *tx)
        .await?;
        // отзывы у популярных товаров — настоящими строками, чтобы счётчик на карточке совпадал с вкладкой «Отзывы»
        let popular: Vec<(Uuid, i32)> = sqlx::query_as("SELECT id, popularity FROM products WHERE reviews_count = 0 AND popularity > 600 ORDER BY code").fetch_all(&mut *tx).await?;
        for (pid, popularity) in popular {
            for i in 0..(popularity % 7) as usize {
                let rating = *ctx.rng.pick(&[5, 5, 4, 4, 5, 3]);
                let created = Utc::now() - Duration::days(ctx.rng.range(3, 600));
                sqlx::query("INSERT INTO reviews (product_id, author_name, rating, pros, cons, body, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)")
                    .bind(pid)
                    .bind(reviewers[(i + popularity as usize) % reviewers.len()])
                    .bind(rating)
                    .bind(*ctx.rng.pick(&["Качество", "Цена/качество", "Быстрая доставка", "Оригинал"]))
                    .bind(*ctx.rng.pick(&["Не выявлено", "Нет", "Дорого"]))
                    .bind(*ctx.rng.pick(&texts[2..]))
                    .bind(created)
                    .execute(&mut *tx)
                    .await?;
            }
        }
        sqlx::query(
            r#"UPDATE products p SET reviews_count = s.cnt, rating = s.avg
               FROM (SELECT product_id, count(*) AS cnt, round(avg(rating)::numeric, 2) AS avg FROM reviews GROUP BY product_id) s WHERE s.product_id = p.id"#,
        )
        .execute(&mut *tx)
        .await?;

        // ---------- client history: orders, ledger, bonus, notifications ----------
        let today = crate::services::delivery::today_local();
        let product_pool: Vec<(Uuid, String, String, String, Decimal)> = sqlx::query_as(
            "SELECT id, code, name, unit, list_price FROM products WHERE unit = 'шт' AND list_price BETWEEN 20 AND 3000 ORDER BY popularity DESC LIMIT 60",
        )
        .fetch_all(&mut *tx)
        .await?;
        let plan: [(i64, &str, &str, bool, bool); 8] = [
            // (days ago, status, payment, paid in full, overdue-69)
            (85, "delivered", "invoice", true, false),
            (72, "delivered", "invoice", true, false),
            (60, "delivered", "invoice", false, true),
            (45, "delivered", "alif", true, false),
            (30, "delivered", "invoice", true, false),
            (18, "shipped", "invoice", true, false),
            (9, "processing", "invoice", false, false),
            (2, "new", "cash", false, false),
        ];
        let mut receivable_from_orders = Decimal::ZERO;
        for (i, (days, status, payment, paid_full, overdue69)) in plan.iter().enumerate() {
            let created = Utc::now() - Duration::days(*days);
            let created_date = (created + Duration::hours(5)).date_naive();
            let seq: i64 = sqlx::query_scalar("SELECT nextval('order_number_seq')").fetch_one(&mut *tx).await?;
            let number = format!("TEK-{seq:06}");
            let n_items = 2 + (i % 3);
            let mut subtotal_list = Decimal::ZERO;
            let mut subtotal = Decimal::ZERO;
            let mut cashback = Decimal::ZERO;
            let mut lines = Vec::new();
            for j in 0..n_items {
                let (pid, code, name, unit, list) = product_pool[(i * 7 + j * 3) % product_pool.len()].clone();
                let qty = Decimal::from(ctx.rng.range(1, 6));
                let price = round2(list * dec!(0.9));
                let line_total = round2(price * qty);
                let line_cb = round2(line_total * dec!(0.03));
                subtotal_list += round2(list * qty);
                subtotal += line_total;
                cashback += line_cb;
                lines.push((pid, code, name, unit, qty, list, price, line_total, line_cb));
            }
            let delivery_price = if i % 2 == 0 { dec!(30) } else { dec!(0) };
            let total = round2(subtotal + delivery_price);
            let paid = if *paid_full { total } else if *overdue69 { round2(total - dec!(69)) } else { Decimal::ZERO };
            let due = if *payment == "invoice" { Some(created_date + Duration::days(14)) } else { None };
            let payment_status = if paid >= total { "paid" } else if *payment == "invoice" { "invoice_issued" } else { "pending" };
            let order_id: Uuid = sqlx::query_scalar(
                r#"INSERT INTO orders (number, user_id, company_id, first_name, last_name, phone, email, status, delivery_method, delivery_address, delivery_date, delivery_price,
                     payment_method, payment_status, subtotal_list, discount_total, subtotal, total, cashback_total, paid_amount, due_date, assigned_manager_id, crm_status, reservation_status, created_at, updated_at)
                   VALUES ($1,$2,$3,'Фаррух','Назаров','+992900000001','client@tec.tj',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'sent_mock','sent_mock',$19,$19) RETURNING id"#,
            )
            .bind(&number).bind(client_id).bind(company_id).bind(status)
            .bind(if i % 2 == 0 { "courier" } else { "pickup" })
            .bind(if i % 2 == 0 { Some("г. Душанбе, ул. Исмоили Сомони 68/13") } else { None })
            .bind(created_date + Duration::days(1))
            .bind(delivery_price).bind(payment).bind(payment_status)
            .bind(subtotal_list).bind(round2(subtotal_list - subtotal)).bind(subtotal).bind(total).bind(cashback).bind(paid).bind(due).bind(manager_id).bind(created)
            .fetch_one(&mut *tx)
            .await?;
            for (pid, code, name, unit, qty, list, price, line_total, line_cb) in &lines {
                sqlx::query("INSERT INTO order_items (order_id, product_id, code, name, unit, qty, list_price, price, discount_pct, cashback_pct, line_total, line_cashback) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,10,3,$9,$10)")
                    .bind(order_id).bind(pid).bind(code).bind(name).bind(unit).bind(qty).bind(list).bind(price).bind(line_total).bind(line_cb)
                    .execute(&mut *tx).await?;
            }
            let steps: Vec<(&str, &str, i64)> = match *status {
                "delivered" => vec![("created", "Заказ создан", 0), ("confirmed", "Подтверждён менеджером", 1), ("processing", "Собирается на складе", 2), ("shipped", "Передан в доставку", 3), ("delivered", "Доставлен", 4)],
                "shipped" => vec![("created", "Заказ создан", 0), ("confirmed", "Подтверждён менеджером", 1), ("processing", "Собирается на складе", 2), ("shipped", "Передан в доставку", 3)],
                "processing" => vec![("created", "Заказ создан", 0), ("confirmed", "Подтверждён менеджером", 1), ("processing", "Собирается на складе", 2)],
                _ => vec![("created", "Заказ создан", 0)],
            };
            for (kind, label, offset_h) in steps {
                sqlx::query("INSERT INTO order_events (order_id, kind, label, created_at) VALUES ($1,$2,$3,$4)")
                    .bind(order_id).bind(kind).bind(label).bind(created + Duration::hours(offset_h * 6))
                    .execute(&mut *tx).await?;
            }
            sqlx::query("INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, order_id, due_date, note) VALUES ($1,$2,$3,'invoice',$4,$5,0,$6,$7,$8)")
                .bind(client_id).bind(company_id).bind(created_date).bind(format!("СЧ-{seq:06}")).bind(total).bind(order_id).bind(due).bind(format!("Заказ {number}"))
                .execute(&mut *tx).await?;
            if paid > Decimal::ZERO {
                sqlx::query("INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, order_id, note) VALUES ($1,$2,$3,'payment',$4,0,$5,$6,$7)")
                    .bind(client_id).bind(company_id).bind(created_date + Duration::days(3)).bind(format!("ПЛ-{seq:06}")).bind(paid).bind(order_id).bind(format!("Оплата заказа {number}"))
                    .execute(&mut *tx).await?;
            }
            receivable_from_orders += total - paid;
            if *status == "delivered" || *status == "shipped" {
                sqlx::query("INSERT INTO bonus_transactions (user_id, order_id, entry_date, kind, amount, note) VALUES ($1,$2,$3,'accrual',$4,$5)")
                    .bind(client_id).bind(order_id).bind(created_date + Duration::days(2)).bind(cashback).bind(format!("Кешбэк по заказу {number}"))
                    .execute(&mut *tx).await?;
            }
            sqlx::query("INSERT INTO integration_outbox (target, event, payload, status, attempts, mock, created_at, sent_at) VALUES ('crm','order.created',$1,'sent',1,true,$2,$2), ('onec','stock.reserve',$1,'sent',1,true,$2,$2)")
                .bind(json!({ "number": number, "order_id": order_id, "seeded": true })).bind(created)
                .execute(&mut *tx).await?;
        }
        // opening balance so that receivable = 69 069.00 exactly
        let opening = dec!(69069) - receivable_from_orders;
        sqlx::query("INSERT INTO ledger_entries (user_id, company_id, entry_date, doc_type, doc_number, debit, credit, note) VALUES ($1,$2,$3,'invoice','СЧ-000900',$4,0,'Сальдо по договору поставки №12/2025')")
            .bind(client_id).bind(company_id).bind(today - Duration::days(100)).bind(opening.max(Decimal::ZERO))
            .execute(&mut *tx).await?;
        sqlx::query("INSERT INTO bonus_transactions (user_id, entry_date, kind, amount, note) VALUES ($1,$2,'spend',-200,'Оплата бонусами заказа TEK-001005')")
            .bind(client_id).bind(today - Duration::days(40))
            .execute(&mut *tx).await?;
        let socket_slug: String = sqlx::query_scalar("SELECT slug FROM products WHERE id = $1").bind(socket_id).fetch_one(&mut *tx).await?;
        sqlx::query("INSERT INTO notifications (user_id, kind, title, body, link, is_read) VALUES ($1,'review_reply','Ответ на ваш отзыв','Специалист ТЭК ответил на ваш отзыв о товаре «Розетка Systeme Electric Этюд накладная белая (PA16-007B)».',$2,false), ($1,'order_status','Заказ отгружен','Заказ передан в доставку.', '/account/orders', true)")
            .bind(client_id).bind(format!("/product/{socket_slug}#reviews"))
            .execute(&mut *tx).await?;
        // favorites for client
        sqlx::query("INSERT INTO favorites (user_id, product_id) VALUES ($1,$2), ($1,$3)").bind(client_id).bind(tray200).bind(socket_id).execute(&mut *tx).await?;
    }

    tx.commit().await?;
    Ok(true)
}

/// Идемпотентно дозаполняет данные, появившиеся после первой версии схемы (миграция 0002):
/// теги новостей, фото/бренды/продукты проектов. Выполняется при каждом старте и трогает только пустые поля,
/// поэтому работает и на свежей, и на уже засеянной базе.
pub async fn enrich(pool: &PgPool) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    // теги новостей по ключевым словам заголовка
    for (re, tags) in [
        ("семинар|презентац|тренинг|обучен", &["семинар", "тренинг"][..]),
        ("электроснабжен|дгу|генератор|aksa", &["проекты", "ДГУ"][..]),
        ("конфигуратор|combitech", &["сервис", "конфигураторы"][..]),
        ("дистрибьют|договор|партн", &["партнёры", "дистрибуция"][..]),
        ("склад|филиал", &["компания", "доставка"][..]),
        ("кешб|бонус|скидк|акци", &["акции", "кешбэк"][..]),
    ] {
        sqlx::query("UPDATE news SET tags = $2 WHERE cardinality(tags) = 0 AND title ~* $1")
            .bind(re)
            .bind(tags)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("UPDATE news SET tags = ARRAY['новости'] WHERE cardinality(tags) = 0").execute(&mut *tx).await?;

    // фото с объекта: главное фото + два соседних из выгрузки макета
    sqlx::query(
        r#"UPDATE projects SET photos = ARRAY[
             '/figma/project-' || ((sort % 6) + 1) || '.webp',
             '/figma/project-' || (((sort + 1) % 6) + 1) || '.webp',
             '/figma/project-' || (((sort + 2) % 6) + 1) || '.webp']
           WHERE cardinality(photos) = 0"#,
    )
    .execute(&mut *tx)
    .await?;

    // бренды проектов по характеру работ
    let has_brands: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM project_brands)").fetch_one(&mut *tx).await?;
    if !has_brands {
        for (re, brands) in [
            ("электроснабжен|кВт|ДГУ|генератор", &["aksa", "schneider-electric"][..]),
            ("освещени|Исмоилит|Кушониён", &["philips-lighting", "legrand"][..]),
            ("ВЛ |ошиновк|ПС |КНС|ГЭС", &["prysmian", "abb", "schneider-electric"][..]),
            ("ЦОД|парковк|Отель|автосалон", &["schneider-electric", "legrand", "dks"][..]),
            ("дорог", &["philips-lighting", "prysmian"][..]),
        ] {
            sqlx::query(
                r#"INSERT INTO project_brands (project_id, brand_id)
                   SELECT p.id, b.id FROM projects p JOIN brands b ON b.slug = ANY($2)
                   WHERE (p.title || ' ' || p.object) ~* $1 ON CONFLICT DO NOTHING"#,
            )
            .bind(re)
            .bind(brands)
            .execute(&mut *tx)
            .await?;
        }
        sqlx::query(
            r#"INSERT INTO project_brands (project_id, brand_id)
               SELECT p.id, b.id FROM projects p JOIN brands b ON b.slug IN ('schneider-electric', 'dks')
               WHERE NOT EXISTS (SELECT 1 FROM project_brands x WHERE x.project_id = p.id) ON CONFLICT DO NOTHING"#,
        )
        .execute(&mut *tx)
        .await?;
    }

    // применённые продукты: 4 самых популярных товара брендов проекта
    let has_products: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM project_products)").fetch_one(&mut *tx).await?;
    if !has_products {
        sqlx::query(
            r#"INSERT INTO project_products (project_id, product_id, sort)
               SELECT project_id, id, rn FROM (
                 SELECT pb.project_id, pr.id, row_number() OVER (PARTITION BY pb.project_id ORDER BY pr.popularity DESC, pr.id) AS rn
                 FROM project_brands pb JOIN products pr ON pr.brand_id = pb.brand_id
               ) t WHERE rn <= 4 ON CONFLICT DO NOTHING"#,
        )
        .execute(&mut *tx)
        .await?;
    }

    group_variants(&mut tx).await?;

    // счётчики отзывов/вопросов и рейтинг — строго по опубликованным строкам (на карточке столько же, сколько во вкладке)
    sqlx::query(
        r#"UPDATE products p SET reviews_count = s.cnt, rating = s.avg, questions_count = s.qcnt
           FROM (SELECT p2.id, count(r.id)::int AS cnt, COALESCE(round(avg(r.rating)::numeric, 2), 0) AS avg,
                        (SELECT count(*)::int FROM questions q WHERE q.product_id = p2.id) AS qcnt
                 FROM products p2 LEFT JOIN reviews r ON r.product_id = p2.id AND r.status = 'published' GROUP BY p2.id) s
           WHERE s.id = p.id AND (p.reviews_count <> s.cnt OR p.rating <> s.avg OR p.questions_count <> s.qcnt)"#,
    )
    .execute(&mut *tx)
    .await?;
    // «1 лет» → «1 год», «2 лет» → «2 года»
    for (from, to) in [("\"1 лет\"", "\"1 год\""), ("\"2 лет\"", "\"2 года\""), ("\"3 лет\"", "\"3 года\""), ("\"4 лет\"", "\"4 года\"")] {
        sqlx::query("UPDATE products SET attributes = replace(attributes::text, $1, $2)::jsonb WHERE attributes::text LIKE '%' || $1 || '%'")
            .bind(from)
            .bind(to)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

// ---------- торговые предложения ----------

/// Семейства товаров сида, которые на деле — один товар в разных исполнениях (как балка №16/№20 у Петровича).
/// (категория, атрибуты-ключ семейства, оси: (название оси, из каких атрибутов собрано значение — через «х»)).
type Family = (&'static str, &'static [&'static str], &'static [(&'static str, &'static [&'static str])]);
const FAMILIES: &[Family] = &[
    ("kabelnye-lotki-dks", &["Бренд", "Тип"], &[("Ширина, мм", &["Ширина, мм"]), ("Высота, мм", &["Высота, мм"])]),
    ("kryshki", &["Бренд", "Тип"], &[("Ширина лотка", &["Подходит для лотка шириной"])]),
    ("ugly", &["Бренд", "Тип"], &[("Ширина лотка", &["Подходит для лотка шириной"])]),
    ("otvetviteli", &["Бренд", "Тип"], &[("Ширина лотка", &["Подходит для лотка шириной"])]),
    ("konsoli", &["Бренд", "Тип"], &[("Ширина лотка", &["Подходит для лотка шириной"])]),
    ("silovye-kabeli", &["Тип"], &[("Число жил", &["Число жил"]), ("Сечение, мм²", &["Сечение, мм²"])]),
    ("kontrolnye-kabeli", &["Тип"], &[("Число жил", &["Число жил"]), ("Сечение, мм²", &["Сечение, мм²"])]),
    ("provoda-montazhnye", &["Тип"], &[("Сечение, мм²", &["Сечение, мм²"]), ("Цвет", &["Цвет"])]),
    ("kabel-kanaly-i-aksessuary", &["Бренд", "Тип"], &[("Размер, мм", &["Ширина, мм", "Высота, мм"])]),
    ("kabelnye-truby-i-aksessuary", &["Бренд", "Тип"], &[("Диаметр, мм", &["Диаметр, мм"])]),
    ("lampy", &["Бренд", "Тип"], &[("Цоколь", &["Цоколь"]), ("Цветовая температура", &["Цветовая температура"]), ("Мощность, Вт", &["Мощность, Вт"])]),
    ("svetilniki", &["Серия"], &[("Мощность, Вт", &["Мощность, Вт"])]),
    ("prozhektory", &["Бренд"], &[("Мощность, Вт", &["Мощность, Вт"])]),
    ("portativnye-generatory", &["Топливо"], &[("Мощность, кВт", &["Мощность, кВт"])]),
    ("statsionarnye-generatory", &["Бренд"], &[("Мощность, кВА", &["Мощность, кВА"])]),
    ("molniepriemniki", &["Тип"], &[("Длина", &["Длина"])]),
    ("komplekty-zazemleniya", &["Бренд"], &[("Общая длина", &["Общая длина"])]),
    ("maslyanye-transformatory", &["Тип"], &[("Мощность, кВА", &["Мощность, кВА"])]),
    ("sukhie-transformatory", &["Тип"], &[("Мощность, кВА", &["Мощность, кВА"])]),
    ("rozetki", &["Серия", "Тип"], &[("Цвет", &["Цвет"])]),
    ("vyklyuchateli", &["Серия"], &[("Исполнение", &["Тип"])]),
    ("avtomaticheskie-vyklyuchateli", &["Серия"], &[("Число полюсов", &["Число полюсов"]), ("Номинальный ток, А", &["Номинальный ток, А"])]),
    ("kontaktory", &["Серия"], &[("Номинальный ток, А", &["Номинальный ток, А"])]),
    ("raspredelitelnye-shchity", &["Тип"], &[("Число модулей", &["Число модулей"])]),
    ("telekommunikatsionnye-shkafy", &["Тип"], &[("Высота, U", &["Высота, U"])]),
    ("komplektuyushchie-schetchikov", &["Тип"], &[("Первичный ток, А", &["Первичный ток, А"])]),
];

/// Процентное кодирование сегмента URL (кириллица, пробелы, запятые в подписях картинок).
fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Короткая подпись значения оси с единицей: «20 Вт», «3P», «16х16 мм», «42 U».
fn short_value(axis: &str, value: &str) -> String {
    match axis {
        "Число полюсов" => return format!("{value}P"),
        "Число модулей" => return format!("{value} мод."),
        _ => {}
    }
    match axis.split_once(", ") {
        Some((_, unit)) if value.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | ',' | 'х')) => format!("{value} {unit}"),
        _ => value.to_string(),
    }
}

/// Фото исполнения: иллюстрация `/art/...` (рисует фронтенд, см. app/art) + «шильдик» с параметрами.
/// Для автоматов, кабелей, проводов и ламп картинка отражает исполнение (полюса, жилы, цвет, цоколь и свечение).
fn variant_images(cat: &str, values: &[(&str, String)]) -> Vec<String> {
    let get = |k: &str| values.iter().find(|(a, _)| *a == k).map(|(_, v)| enc(v)).unwrap_or_default();
    let label: Vec<String> = values.iter().map(|(a, v)| short_value(a, v)).collect();
    let main = match cat {
        "avtomaticheskie-vyklyuchateli" => format!("/art/breaker/{}/C{}.svg", get("Число полюсов"), get("Номинальный ток, А")),
        "silovye-kabeli" | "kontrolnye-kabeli" => format!("/art/cable/{}/{}.svg", get("Число жил"), get("Сечение, мм²")),
        "provoda-montazhnye" => format!("/art/wire/{}/{}.svg", get("Цвет"), get("Сечение, мм²")),
        "lampy" => format!("/art/lamp/{}/{}/{}.svg", get("Цоколь"), get("Цветовая температура"), get("Мощность, Вт")),
        _ => format!("/art/label/{cat}/{}.svg", enc(&label.join(" · "))),
    };
    let tag: Vec<String> = values.iter().map(|(a, v)| format!("{a}: {v}")).collect();
    vec![main, format!("/art/tag/{cat}/{}.svg", enc(&tag.join("|")))]
}

/// Собирает семейства из [`FAMILIES`] в группы торговых предложений (`auto:*`). Идемпотентно: запускается
/// при каждом старте, трогает только товары без группы или из auto-групп — ручные группы и выгрузку 1С не меняет.
async fn group_variants(tx: &mut Tx<'_>) -> anyhow::Result<()> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id: Uuid,
        category: String,
        attributes: Value,
        images: Vec<String>,
    }
    let rows = sqlx::query_as::<_, Row>(
        r#"SELECT p.id, c.slug AS category, p.attributes, p.images
           FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN product_groups g ON g.id = p.group_id
           WHERE p.group_id IS NULL OR g.name LIKE 'auto:%'
           ORDER BY p.code"#,
    )
    .fetch_all(&mut **tx)
    .await?;

    let (mut ids, mut gids, mut vars, mut imgs) = (Vec::<Uuid>::new(), Vec::<i32>::new(), Vec::<Value>::new(), Vec::<Value>::new());
    for (cat, by, axes) in FAMILIES {
        // семейство → [(товар, значения по осям, фото)], порядок — по коду товара
        let mut families: Vec<(Vec<String>, Vec<(&Row, Vec<(&str, String)>)>)> = Vec::new();
        for r in rows.iter().filter(|r| r.category == *cat) {
            let attr = |name: &str| -> Option<String> {
                r.attributes.as_array()?.iter().find(|a| a["name"] == name).and_then(|a| a["value"].as_str()).map(str::to_string)
            };
            let Some(key) = by.iter().map(|k| attr(k)).collect::<Option<Vec<_>>>() else { continue };
            let Some(values) = axes
                .iter()
                .map(|(name, from)| from.iter().map(|k| attr(k)).collect::<Option<Vec<_>>>().map(|v| (*name, v.join("х"))))
                .collect::<Option<Vec<_>>>()
            else {
                continue;
            };
            match families.iter_mut().find(|(k, _)| *k == key) {
                Some((_, members)) if members.iter().any(|(_, v)| *v == values) => {} // дубль исполнения — оставляем вне группы
                Some((_, members)) => members.push((r, values)),
                None => families.push((key, vec![(r, values)])),
            }
        }
        for (key, members) in families.into_iter().filter(|(_, m)| m.len() >= 2) {
            let axis_names: Vec<&str> = axes.iter().map(|(n, _)| *n).collect();
            let gid: i32 = sqlx::query_scalar(
                "INSERT INTO product_groups (name, axes) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET axes = EXCLUDED.axes RETURNING id",
            )
            .bind(format!("auto:{cat}:{}", key.join(" / ")))
            .bind(&axis_names)
            .fetch_one(&mut **tx)
            .await?;
            for (r, values) in members {
                let default_image = format!("/products/{cat}.svg");
                let images = if r.images.is_empty() || r.images == [default_image] || r.images[0].starts_with("/art/") {
                    variant_images(cat, &values)
                } else {
                    r.images.clone()
                };
                ids.push(r.id);
                gids.push(gid);
                vars.push(Value::Object(values.into_iter().map(|(a, v)| (a.to_string(), Value::String(v))).collect()));
                imgs.push(json!(images));
            }
        }
    }

    // одним запросом и только там, где что-то поменялось
    sqlx::query(
        r#"UPDATE products p
              SET group_id = x.gid, variant = x.v, images = ARRAY(SELECT jsonb_array_elements_text(x.imgs))
             FROM unnest($1::uuid[], $2::int[], $3::jsonb[], $4::jsonb[]) AS x(id, gid, v, imgs)
            WHERE p.id = x.id AND (p.group_id IS DISTINCT FROM x.gid OR p.variant <> x.v OR to_jsonb(p.images) <> x.imgs)"#,
    )
    .bind(&ids)
    .bind(&gids)
    .bind(&vars)
    .bind(&imgs)
    .execute(&mut **tx)
    .await?;
    // товары, выпавшие из семейств (удалены соседи, поменялись атрибуты), и опустевшие auto-группы
    sqlx::query(
        r#"UPDATE products SET group_id = NULL, variant = '{}'::jsonb
            WHERE group_id IN (SELECT id FROM product_groups WHERE name LIKE 'auto:%') AND NOT (id = ANY($1))"#,
    )
    .bind(&ids)
    .execute(&mut **tx)
    .await?;
    sqlx::query("DELETE FROM product_groups g WHERE g.name LIKE 'auto:%' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.group_id = g.id)")
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ---------- первый администратор ----------

/// Production: если в базе нет ни одного администратора, создаёт его из ADMIN_EMAIL / ADMIN_PASSWORD.
/// Демо-аккаунтов с известными паролями в production нет (SEED_DEMO=full запрещён валидацией конфига).
pub async fn bootstrap_admin(pool: &PgPool, cfg: &crate::config::Config) -> anyhow::Result<()> {
    let (Some(email), Some(password)) = (&cfg.admin_email, &cfg.admin_password) else {
        return Ok(());
    };
    let has_admin: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin')").fetch_one(pool).await?;
    if has_admin {
        return Ok(());
    }
    let hash = hash_password(password).map_err(|e| anyhow::anyhow!(e.message))?;
    sqlx::query(
        r#"INSERT INTO users (email, password_hash, first_name, last_name, role, status, customer_type)
           VALUES ($1, $2, 'Администратор', 'ТЭК', 'admin', 'approved', 'purchaser')
           ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'approved', password_hash = EXCLUDED.password_hash"#,
    )
    .bind(email)
    .bind(hash)
    .execute(pool)
    .await?;
    tracing::info!(%email, "administrator created from ADMIN_EMAIL");
    Ok(())
}

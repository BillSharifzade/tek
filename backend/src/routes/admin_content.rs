//! Панель: контент сайта — новости, проекты, вакансии, магазины / склады.
//! Тексты (новости, проекты) правятся простой разметкой (`services::markup`): на сайт уходит HTML, в котором
//! нет ничего, кроме абзацев, списков, заголовков, жирного и ссылок. Картинки — ссылкой или загруженным файлом
//! (`POST /admin/files` → `/api/v1/files/…`). После изменения сбрасывается кэш публичных ответов API.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{PgConnection, Postgres, Transaction};

use super::admin::{like_pattern, page_params, paged};
use crate::{
    auth::Manager,
    error::{AppError, AppResult},
    seed::slugify,
    services::{delivery, markup},
    state::AppState,
};

fn invalid(msg: impl Into<String>) -> AppError {
    AppError::unprocessable("invalid_content", msg)
}

/// Строка без лишних пробелов; `required` — не пустая; не длиннее `max` символов.
fn text(label: &str, v: Option<&str>, max: usize, required: bool) -> AppResult<String> {
    let t = v.unwrap_or("").split_whitespace().collect::<Vec<_>>().join(" ");
    if required && t.is_empty() {
        return Err(invalid(format!("Заполните поле «{label}»")));
    }
    if t.chars().count() > max {
        return Err(invalid(format!("«{label}» — не длиннее {max} символов")));
    }
    Ok(t)
}

/// Картинка: путь на сайте (`/news/…`), загруженный файл (`/api/v1/files/…`) или https-ссылка.
fn image(label: &str, v: Option<&str>) -> AppResult<Option<String>> {
    match v.map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(None),
        Some(u) if u.len() <= 1000 && !u.contains(char::is_whitespace) && ((u.starts_with('/') && !u.starts_with("//")) || u.starts_with("https://")) => Ok(Some(u.to_string())),
        Some(_) => Err(invalid(format!("{label}: загрузите файл или укажите ссылку https://…"))),
    }
}

/// Текст в разметке панели → HTML для сайта (не длиннее 50 000 символов).
fn body(v: Option<&str>) -> AppResult<String> {
    let src = v.unwrap_or("");
    if src.chars().count() > 50_000 {
        return Err(invalid("Текст — не длиннее 50 000 символов"));
    }
    Ok(markup::to_html(src))
}

fn date(label: &str, v: Option<&str>) -> AppResult<NaiveDate> {
    match v.map(str::trim).filter(|s| !s.is_empty()) {
        None => Ok(delivery::today_local()),
        Some(s) => NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| invalid(format!("{label}: дата в формате ГГГГ-ММ-ДД"))),
    }
}

/// Адрес страницы: указанный (латиница, цифры, «-») или из заголовка; занятый — с номером (`-2`, `-3`…).
async fn unique_slug(conn: &mut PgConnection, table: &str, wanted: Option<&str>, title: &str, own_id: Option<i32>) -> AppResult<String> {
    let base = match wanted.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => {
            let ok = s.len() <= 120 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') && !s.starts_with('-') && !s.ends_with('-');
            if !ok {
                return Err(invalid("Адрес страницы: латиница в нижнем регистре, цифры и «-», до 120 символов"));
            }
            s.to_string()
        }
        None => {
            let mut b = slugify(title);
            b.truncate(90);
            let b = b.trim_end_matches('-').to_string();
            if b.is_empty() { "page".to_string() } else { b }
        }
    };
    let explicit = wanted.is_some_and(|s| !s.trim().is_empty());
    let sql = format!("SELECT slug FROM {table} WHERE (slug = $1 OR slug LIKE $1 || '-%') AND ($2::int IS NULL OR id <> $2)");
    let taken: Vec<String> = sqlx::query_scalar(sqlx::AssertSqlSafe(sql)).bind(&base).bind(own_id).fetch_all(&mut *conn).await?;
    if !taken.contains(&base) {
        return Ok(base);
    }
    if explicit {
        return Err(AppError::conflict("slug_taken", format!("Адрес «{base}» уже занят")));
    }
    let mut n = 2;
    while taken.contains(&format!("{base}-{n}")) {
        n += 1;
    }
    Ok(format!("{base}-{n}"))
}

#[derive(Deserialize)]
struct ListQuery {
    q: Option<String>,
    page: Option<i64>,
    per_page: Option<i64>,
}

async fn finish(state: &AppState, tx: Transaction<'_, Postgres>) -> AppResult<()> {
    tx.commit().await?;
    state.invalidate_public();
    Ok(())
}

// ---------- новости ----------

#[derive(Deserialize)]
struct NewsInput {
    title: Option<String>,
    slug: Option<String>,
    published_at: Option<String>,
    excerpt: Option<String>,
    /// текст в разметке панели
    body_text: Option<String>,
    image_url: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

const NEWS_COLS: &str = "id, slug, title, published_at, excerpt, image_url, tags";

async fn news_json(conn: &mut PgConnection, id: i32) -> AppResult<Value> {
    let row: Option<(Value, String)> = sqlx::query_as(sqlx::AssertSqlSafe(format!("SELECT to_jsonb(t), t.body FROM (SELECT {NEWS_COLS}, body FROM news WHERE id = $1) t")))
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?;
    let (mut v, html) = row.ok_or_else(|| AppError::not_found("Новость не найдена"))?;
    v["body_text"] = json!(markup::from_html(&html));
    if let Some(o) = v.as_object_mut() {
        o.remove("body");
    }
    Ok(v)
}

async fn list_news(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<ListQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let pattern = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(like_pattern);
    let rows: Vec<(i64, Value)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
        "SELECT count(*) OVER(), to_jsonb(t) FROM (SELECT {NEWS_COLS} FROM news WHERE ($1::text IS NULL OR title ILIKE $1) ORDER BY published_at DESC, id DESC) t LIMIT $2 OFFSET $3"
    )))
    .bind(pattern)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&state.pool)
    .await?;
    let total = rows.first().map(|r| r.0).unwrap_or(0);
    Ok(Json(paged(rows.into_iter().map(|r| r.1).collect(), total, page, per)))
}

async fn get_news(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<Json<Value>> {
    let mut conn = state.pool.acquire().await?;
    Ok(Json(news_json(&mut conn, id).await?))
}

/// (заголовок, дата, анонс, HTML текста, картинка, теги)
type NewsFields = (String, NaiveDate, String, String, Option<String>, Vec<String>);

fn news_fields(b: &NewsInput) -> AppResult<NewsFields> {
    let title = text("Заголовок", b.title.as_deref(), 300, true)?;
    let published = date("Дата", b.published_at.as_deref())?;
    let excerpt = b.excerpt.as_deref().unwrap_or("").trim().to_string();
    if excerpt.chars().count() > 1000 {
        return Err(invalid("Анонс — не длиннее 1000 символов"));
    }
    let tags: Vec<String> = b.tags.iter().map(|t| t.split_whitespace().collect::<Vec<_>>().join(" ")).filter(|t| !t.is_empty()).collect();
    if tags.len() > 10 || tags.iter().any(|t| t.chars().count() > 40) {
        return Err(invalid("Не больше 10 тегов, тег — до 40 символов"));
    }
    Ok((title, published, excerpt, body(b.body_text.as_deref())?, image("Картинка", b.image_url.as_deref())?, tags))
}

async fn create_news(State(state): State<AppState>, Manager(_m): Manager, Json(b): Json<NewsInput>) -> AppResult<(StatusCode, Json<Value>)> {
    let (title, published, excerpt, html, image, tags) = news_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let slug = unique_slug(&mut tx, "news", b.slug.as_deref(), &title, None).await?;
    let id: i32 = sqlx::query_scalar("INSERT INTO news (slug, title, published_at, excerpt, body, image_url, tags) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id")
        .bind(&slug)
        .bind(&title)
        .bind(published)
        .bind(&excerpt)
        .bind(&html)
        .bind(&image)
        .bind(&tags)
        .fetch_one(&mut *tx)
        .await?;
    let v = news_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok((StatusCode::CREATED, Json(v)))
}

async fn update_news(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>, Json(b): Json<NewsInput>) -> AppResult<Json<Value>> {
    let (title, published, excerpt, html, image, tags) = news_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let current: Option<String> = sqlx::query_scalar("SELECT slug FROM news WHERE id = $1 FOR UPDATE").bind(id).fetch_optional(&mut *tx).await?;
    let current = current.ok_or_else(|| AppError::not_found("Новость не найдена"))?;
    let slug = unique_slug(&mut tx, "news", Some(b.slug.as_deref().filter(|s| !s.trim().is_empty()).unwrap_or(&current)), &title, Some(id)).await?;
    sqlx::query("UPDATE news SET slug = $2, title = $3, published_at = $4, excerpt = $5, body = $6, image_url = $7, tags = $8 WHERE id = $1")
        .bind(id)
        .bind(&slug)
        .bind(&title)
        .bind(published)
        .bind(&excerpt)
        .bind(&html)
        .bind(&image)
        .bind(&tags)
        .execute(&mut *tx)
        .await?;
    let v = news_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok(Json(v))
}

async fn delete_news(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let n = sqlx::query("DELETE FROM news WHERE id = $1").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(AppError::not_found("Новость не найдена"));
    }
    finish(&state, tx).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------- проекты ----------

#[derive(Deserialize)]
struct ProjectInput {
    title: Option<String>,
    slug: Option<String>,
    year: Option<String>,
    project_date: Option<String>,
    object: Option<String>,
    service: Option<String>,
    image_url: Option<String>,
    excerpt: Option<String>,
    body_text: Option<String>,
    #[serde(default)]
    photos: Vec<String>,
    video_url: Option<String>,
    sort: Option<i32>,
    /// слаги брендов (фильтр «Бренды» и логотипы на странице проекта)
    #[serde(default)]
    brands: Vec<String>,
    /// коды применённых товаров
    #[serde(default)]
    products: Vec<String>,
}

const PROJECT_COLS: &str = "p.id, p.slug, p.title, p.year, p.project_date, p.object, p.service, p.image_url, p.excerpt, p.photos, p.video_url, p.sort";

async fn project_json(conn: &mut PgConnection, id: i32) -> AppResult<Value> {
    let row: Option<(Value, String)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
        r#"SELECT to_jsonb(t) - 'body', t.body FROM (SELECT {PROJECT_COLS}, p.body,
             COALESCE((SELECT jsonb_agg(b.slug ORDER BY b.sort, b.id) FROM project_brands pb JOIN brands b ON b.id = pb.brand_id WHERE pb.project_id = p.id), '[]') AS brands,
             COALESCE((SELECT jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name) ORDER BY pp.sort, x.code) FROM project_products pp JOIN products x ON x.id = pp.product_id WHERE pp.project_id = p.id), '[]') AS products
           FROM projects p WHERE p.id = $1) t"#
    )))
    .bind(id)
    .fetch_optional(&mut *conn)
    .await?;
    let (mut v, html) = row.ok_or_else(|| AppError::not_found("Проект не найден"))?;
    v["body_text"] = json!(markup::from_html(&html));
    Ok(v)
}

async fn list_projects(State(state): State<AppState>, Manager(_m): Manager, Query(q): Query<ListQuery>) -> AppResult<Json<Value>> {
    let (page, per) = page_params(q.page, q.per_page, 50);
    let pattern = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(like_pattern);
    let rows: Vec<(i64, Value)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
        "SELECT count(*) OVER(), to_jsonb(t) FROM (SELECT {PROJECT_COLS} FROM projects p WHERE ($1::text IS NULL OR p.title ILIKE $1 OR p.object ILIKE $1) ORDER BY p.project_date DESC, p.sort, p.id) t LIMIT $2 OFFSET $3"
    )))
    .bind(pattern)
    .bind(per)
    .bind((page - 1) * per)
    .fetch_all(&state.pool)
    .await?;
    let total = rows.first().map(|r| r.0).unwrap_or(0);
    Ok(Json(paged(rows.into_iter().map(|r| r.1).collect(), total, page, per)))
}

async fn get_project(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<Json<Value>> {
    let mut conn = state.pool.acquire().await?;
    Ok(Json(project_json(&mut conn, id).await?))
}

struct ProjectFields {
    title: String,
    year: String,
    date: NaiveDate,
    object: String,
    service: String,
    image: Option<String>,
    excerpt: String,
    html: String,
    photos: Vec<String>,
    video: Option<String>,
}

fn project_fields(b: &ProjectInput) -> AppResult<ProjectFields> {
    let title = text("Название", b.title.as_deref(), 300, true)?;
    let date = date("Дата", b.project_date.as_deref())?;
    let year = match text("Год", b.year.as_deref(), 20, false)? {
        y if y.is_empty() => date.format("%Y").to_string(),
        y => y,
    };
    let excerpt = b.excerpt.as_deref().unwrap_or("").trim().to_string();
    if excerpt.chars().count() > 1000 {
        return Err(invalid("Анонс — не длиннее 1000 символов"));
    }
    if b.photos.len() > 30 {
        return Err(invalid("Не больше 30 фотографий"));
    }
    let mut photos = Vec::new();
    for p in &b.photos {
        if let Some(u) = image("Фото", Some(p))? {
            photos.push(u);
        }
    }
    let video = match b.video_url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(u) if u.starts_with("https://") && u.len() <= 1000 && !u.contains(char::is_whitespace) => Some(u.to_string()),
        Some(_) => return Err(invalid("Видео — ссылка https://… (YouTube и т. п.)")),
        None => None,
    };
    Ok(ProjectFields {
        title,
        year,
        date,
        object: text("Объект", b.object.as_deref(), 300, false)?,
        service: text("Услуга", b.service.as_deref(), 300, false)?,
        image: image("Картинка", b.image_url.as_deref())?,
        excerpt,
        html: body(b.body_text.as_deref())?,
        photos,
        video,
    })
}

/// Бренды и товары проекта: неизвестные слаги / коды — ошибка (список в сообщении).
async fn project_links(tx: &mut Transaction<'_, Postgres>, id: i32, b: &ProjectInput) -> AppResult<()> {
    let slugs: Vec<String> = b.brands.iter().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    let codes: Vec<String> = b.products.iter().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    if codes.len() > 100 || slugs.len() > 50 {
        return Err(invalid("Не больше 50 брендов и 100 товаров у проекта"));
    }
    let brands: Vec<(i32, String)> = sqlx::query_as("SELECT id, slug FROM brands WHERE slug = ANY($1)").bind(&slugs).fetch_all(&mut **tx).await?;
    let missing: Vec<&str> = slugs.iter().filter(|s| !brands.iter().any(|b| &b.1 == *s)).map(String::as_str).collect();
    if !missing.is_empty() {
        return Err(invalid(format!("Бренды не найдены: {}", missing.join(", "))));
    }
    let products: Vec<(uuid::Uuid, String)> = sqlx::query_as("SELECT id, code FROM products WHERE code = ANY($1)").bind(&codes).fetch_all(&mut **tx).await?;
    let missing: Vec<&str> = codes.iter().filter(|c| !products.iter().any(|p| &p.1 == *c)).map(String::as_str).collect();
    if !missing.is_empty() {
        return Err(invalid(format!("Товары с кодом {} не найдены", missing.join(", "))));
    }
    sqlx::query("DELETE FROM project_brands WHERE project_id = $1").bind(id).execute(&mut **tx).await?;
    sqlx::query("DELETE FROM project_products WHERE project_id = $1").bind(id).execute(&mut **tx).await?;
    let brand_ids: Vec<i32> = brands.iter().map(|b| b.0).collect();
    sqlx::query("INSERT INTO project_brands (project_id, brand_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING").bind(id).bind(&brand_ids).execute(&mut **tx).await?;
    for (sort, code) in codes.iter().enumerate() {
        let pid = products.iter().find(|p| &p.1 == code).map(|p| p.0).expect("checked above");
        sqlx::query("INSERT INTO project_products (project_id, product_id, sort) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING")
            .bind(id)
            .bind(pid)
            .bind(sort as i32)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

async fn create_project(State(state): State<AppState>, Manager(_m): Manager, Json(b): Json<ProjectInput>) -> AppResult<(StatusCode, Json<Value>)> {
    let f = project_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let slug = unique_slug(&mut tx, "projects", b.slug.as_deref(), &f.title, None).await?;
    let id: i32 = sqlx::query_scalar(
        r#"INSERT INTO projects (slug, title, year, project_date, object, service, image_url, excerpt, body, photos, video_url, sort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id"#,
    )
    .bind(&slug)
    .bind(&f.title)
    .bind(&f.year)
    .bind(f.date)
    .bind(&f.object)
    .bind(&f.service)
    .bind(&f.image)
    .bind(&f.excerpt)
    .bind(&f.html)
    .bind(&f.photos)
    .bind(&f.video)
    .bind(b.sort.unwrap_or(0))
    .fetch_one(&mut *tx)
    .await?;
    project_links(&mut tx, id, &b).await?;
    let v = project_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok((StatusCode::CREATED, Json(v)))
}

async fn update_project(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>, Json(b): Json<ProjectInput>) -> AppResult<Json<Value>> {
    let f = project_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let current: Option<String> = sqlx::query_scalar("SELECT slug FROM projects WHERE id = $1 FOR UPDATE").bind(id).fetch_optional(&mut *tx).await?;
    let current = current.ok_or_else(|| AppError::not_found("Проект не найден"))?;
    let slug = unique_slug(&mut tx, "projects", Some(b.slug.as_deref().filter(|s| !s.trim().is_empty()).unwrap_or(&current)), &f.title, Some(id)).await?;
    sqlx::query(
        r#"UPDATE projects SET slug = $2, title = $3, year = $4, project_date = $5, object = $6, service = $7, image_url = $8, excerpt = $9,
             body = $10, photos = $11, video_url = $12, sort = COALESCE($13, sort) WHERE id = $1"#,
    )
    .bind(id)
    .bind(&slug)
    .bind(&f.title)
    .bind(&f.year)
    .bind(f.date)
    .bind(&f.object)
    .bind(&f.service)
    .bind(&f.image)
    .bind(&f.excerpt)
    .bind(&f.html)
    .bind(&f.photos)
    .bind(&f.video)
    .bind(b.sort)
    .execute(&mut *tx)
    .await?;
    project_links(&mut tx, id, &b).await?;
    let v = project_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok(Json(v))
}

async fn delete_project(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let n = sqlx::query("DELETE FROM projects WHERE id = $1").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(AppError::not_found("Проект не найден"));
    }
    finish(&state, tx).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------- вакансии ----------

#[derive(Deserialize)]
struct VacancyBlock {
    title: String,
    #[serde(default)]
    items: Vec<String>,
}

#[derive(Deserialize)]
struct VacancyInput {
    title: Option<String>,
    slug: Option<String>,
    dept: Option<String>,
    city: Option<String>,
    experience: Option<String>,
    schedule: Option<String>,
    salary: Option<String>,
    #[serde(default)]
    blocks: Vec<VacancyBlock>,
    sort: Option<i32>,
    is_active: Option<bool>,
}

const VACANCY_COLS: &str = "id, slug, dept, title, city, experience, schedule, salary, blocks, sort, is_active";

async fn vacancy_json(conn: &mut PgConnection, id: i32) -> AppResult<Value> {
    sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT to_jsonb(t) FROM (SELECT {VACANCY_COLS} FROM vacancies WHERE id = $1) t")))
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| AppError::not_found("Вакансия не найдена"))
}

async fn list_vacancies(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT to_jsonb(t) FROM (SELECT {VACANCY_COLS} FROM vacancies ORDER BY sort, id) t")))
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows))
}

fn vacancy_fields(b: &VacancyInput) -> AppResult<(String, [String; 5], Value)> {
    let title = text("Должность", b.title.as_deref(), 200, true)?;
    let meta = [
        text("Отдел", b.dept.as_deref(), 100, false)?,
        text("Город", b.city.as_deref(), 100, false)?,
        text("Опыт", b.experience.as_deref(), 100, false)?,
        text("График", b.schedule.as_deref(), 100, false)?,
        text("Зарплата", b.salary.as_deref(), 100, false)?,
    ];
    if b.blocks.len() > 6 {
        return Err(invalid("Не больше 6 блоков (обязанности, требования, условия…)"));
    }
    let mut blocks = Vec::new();
    for blk in &b.blocks {
        let t = text("Заголовок блока", Some(&blk.title), 100, false)?;
        let items: Vec<String> = blk.items.iter().map(|i| i.split_whitespace().collect::<Vec<_>>().join(" ")).filter(|i| !i.is_empty()).collect();
        if items.len() > 30 || items.iter().any(|i| i.chars().count() > 300) {
            return Err(invalid("В блоке — не больше 30 пунктов, пункт — до 300 символов"));
        }
        if !t.is_empty() || !items.is_empty() {
            if t.is_empty() {
                return Err(invalid("Укажите заголовок блока, например «Обязанности»"));
            }
            blocks.push(json!({ "title": t, "items": items }));
        }
    }
    Ok((title, meta, Value::Array(blocks)))
}

async fn create_vacancy(State(state): State<AppState>, Manager(_m): Manager, Json(b): Json<VacancyInput>) -> AppResult<(StatusCode, Json<Value>)> {
    let (title, [dept, city, experience, schedule, salary], blocks) = vacancy_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let slug = unique_slug(&mut tx, "vacancies", b.slug.as_deref(), &title, None).await?;
    let id: i32 = sqlx::query_scalar(
        r#"INSERT INTO vacancies (slug, dept, title, city, experience, schedule, salary, blocks, sort, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9, (SELECT COALESCE(max(sort), 0) + 1 FROM vacancies)), COALESCE($10, true)) RETURNING id"#,
    )
    .bind(&slug)
    .bind(&dept)
    .bind(&title)
    .bind(&city)
    .bind(&experience)
    .bind(&schedule)
    .bind(&salary)
    .bind(&blocks)
    .bind(b.sort)
    .bind(b.is_active)
    .fetch_one(&mut *tx)
    .await?;
    let v = vacancy_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok((StatusCode::CREATED, Json(v)))
}

async fn update_vacancy(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>, Json(b): Json<VacancyInput>) -> AppResult<Json<Value>> {
    let (title, [dept, city, experience, schedule, salary], blocks) = vacancy_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let current: Option<String> = sqlx::query_scalar("SELECT slug FROM vacancies WHERE id = $1 FOR UPDATE").bind(id).fetch_optional(&mut *tx).await?;
    let current = current.ok_or_else(|| AppError::not_found("Вакансия не найдена"))?;
    let slug = unique_slug(&mut tx, "vacancies", Some(b.slug.as_deref().filter(|s| !s.trim().is_empty()).unwrap_or(&current)), &title, Some(id)).await?;
    sqlx::query(
        r#"UPDATE vacancies SET slug = $2, dept = $3, title = $4, city = $5, experience = $6, schedule = $7, salary = $8, blocks = $9,
             sort = COALESCE($10, sort), is_active = COALESCE($11, is_active) WHERE id = $1"#,
    )
    .bind(id)
    .bind(&slug)
    .bind(&dept)
    .bind(&title)
    .bind(&city)
    .bind(&experience)
    .bind(&schedule)
    .bind(&salary)
    .bind(&blocks)
    .bind(b.sort)
    .bind(b.is_active)
    .execute(&mut *tx)
    .await?;
    let v = vacancy_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok(Json(v))
}

async fn delete_vacancy(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let n = sqlx::query("DELETE FROM vacancies WHERE id = $1").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(AppError::not_found("Вакансия не найдена"));
    }
    finish(&state, tx).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------- магазины и склады ----------

#[derive(Deserialize)]
struct StoreInput {
    code: Option<String>,
    city: Option<String>,
    name: Option<String>,
    address: Option<String>,
    phone: Option<String>,
    hours: Option<String>,
    delivery_hint: Option<String>,
    lat: Option<f64>,
    lon: Option<f64>,
    sort: Option<i32>,
}

const STORE_COLS: &str = "s.id, s.code, s.city, s.name, s.address, s.phone, s.hours, s.delivery_hint, s.lat, s.lon, s.sort,
    (SELECT COALESCE(sum(qty), 0) FROM stock WHERE store_id = s.id) AS stock_total,
    (SELECT count(*) FROM stock WHERE store_id = s.id AND qty > 0) AS products";

async fn store_json(conn: &mut PgConnection, id: i32) -> AppResult<Value> {
    sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT to_jsonb(t) FROM (SELECT {STORE_COLS} FROM stores s WHERE s.id = $1) t")))
        .bind(id)
        .fetch_optional(conn)
        .await?
        .ok_or_else(|| AppError::not_found("Склад не найден"))
}

async fn list_stores(State(state): State<AppState>, Manager(_m): Manager) -> AppResult<Json<Vec<Value>>> {
    let rows: Vec<Value> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT to_jsonb(t) FROM (SELECT {STORE_COLS} FROM stores s ORDER BY s.sort, s.id) t")))
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows))
}

struct StoreFields {
    code: String,
    city: String,
    name: String,
    address: String,
    phone: Option<String>,
    hours: Option<String>,
    hint: String,
}

fn store_fields(b: &StoreInput) -> AppResult<StoreFields> {
    let code = b.code.as_deref().unwrap_or("").trim().to_lowercase();
    if code.is_empty() || code.len() > 40 || !code.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(invalid("Код склада: латиница, цифры и «-», до 40 символов (по нему столбец импорта «Остаток <код>»)"));
    }
    if b.lat.is_some() != b.lon.is_some() || b.lat.is_some_and(|v| !(-90.0..=90.0).contains(&v)) || b.lon.is_some_and(|v| !(-180.0..=180.0).contains(&v)) {
        return Err(invalid("Координаты: широта от -90 до 90 и долгота от -180 до 180 — обе или ни одной"));
    }
    let opt = |s: String| if s.is_empty() { None } else { Some(s) };
    let hint = text("Срок получения", b.delivery_hint.as_deref(), 40, false)?;
    Ok(StoreFields {
        code,
        city: text("Город", b.city.as_deref(), 100, true)?,
        name: text("Название", b.name.as_deref(), 150, true)?,
        address: text("Адрес", b.address.as_deref(), 300, true)?,
        phone: opt(text("Телефон", b.phone.as_deref(), 60, false)?),
        hours: opt(text("Режим работы", b.hours.as_deref(), 120, false)?),
        hint: if hint.is_empty() { "сегодня".into() } else { hint },
    })
}

async fn create_store(State(state): State<AppState>, Manager(_m): Manager, Json(b): Json<StoreInput>) -> AppResult<(StatusCode, Json<Value>)> {
    let f = store_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let dup: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stores WHERE code = $1)").bind(&f.code).fetch_one(&mut *tx).await?;
    if dup {
        return Err(AppError::conflict("code_taken", format!("Склад с кодом «{}» уже есть", f.code)));
    }
    let id: i32 = sqlx::query_scalar(
        r#"INSERT INTO stores (code, city, name, address, phone, hours, delivery_hint, lat, lon, sort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, COALESCE($10, (SELECT COALESCE(max(sort), 0) + 1 FROM stores))) RETURNING id"#,
    )
    .bind(&f.code)
    .bind(&f.city)
    .bind(&f.name)
    .bind(&f.address)
    .bind(&f.phone)
    .bind(&f.hours)
    .bind(&f.hint)
    .bind(b.lat)
    .bind(b.lon)
    .bind(b.sort)
    .fetch_one(&mut *tx)
    .await?;
    let v = store_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok((StatusCode::CREATED, Json(v)))
}

async fn update_store(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>, Json(b): Json<StoreInput>) -> AppResult<Json<Value>> {
    let f = store_fields(&b)?;
    let mut tx = state.pool.begin().await?;
    let found: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stores WHERE id = $1)").bind(id).fetch_one(&mut *tx).await?;
    if !found {
        return Err(AppError::not_found("Склад не найден"));
    }
    let dup: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stores WHERE code = $1 AND id <> $2)").bind(&f.code).bind(id).fetch_one(&mut *tx).await?;
    if dup {
        return Err(AppError::conflict("code_taken", format!("Склад с кодом «{}» уже есть", f.code)));
    }
    sqlx::query(
        r#"UPDATE stores SET code = $2, city = $3, name = $4, address = $5, phone = $6, hours = $7, delivery_hint = $8, lat = $9, lon = $10,
             sort = COALESCE($11, sort) WHERE id = $1"#,
    )
    .bind(id)
    .bind(&f.code)
    .bind(&f.city)
    .bind(&f.name)
    .bind(&f.address)
    .bind(&f.phone)
    .bind(&f.hours)
    .bind(&f.hint)
    .bind(b.lat)
    .bind(b.lon)
    .bind(b.sort)
    .execute(&mut *tx)
    .await?;
    let v = store_json(&mut tx, id).await?;
    finish(&state, tx).await?;
    Ok(Json(v))
}

/// Склад удаляется, только если на нём нет остатков и по нему не было заказов (самовывоз, резерв).
async fn delete_store(State(state): State<AppState>, Manager(_m): Manager, Path(id): Path<i32>) -> AppResult<StatusCode> {
    let mut tx = state.pool.begin().await?;
    let found: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stores WHERE id = $1)").bind(id).fetch_one(&mut *tx).await?;
    if !found {
        return Err(AppError::not_found("Склад не найден"));
    }
    let stocked: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM stock WHERE store_id = $1 AND qty > 0)").bind(id).fetch_one(&mut *tx).await?;
    if stocked {
        return Err(AppError::conflict("store_in_use", "На складе есть остатки — сначала обнулите их (импорт или карточка товара)"));
    }
    let used: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM orders WHERE store_id = $1) OR EXISTS (SELECT 1 FROM order_stock WHERE store_id = $1)")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    if used {
        return Err(AppError::conflict("store_in_use", "По складу есть заказы — удалить его нельзя, можно переименовать"));
    }
    sqlx::query("DELETE FROM stock WHERE store_id = $1").bind(id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM stores WHERE id = $1").bind(id).execute(&mut *tx).await?;
    finish(&state, tx).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/admin/news", get(list_news).post(create_news))
        .route("/admin/news/{id}", get(get_news).put(update_news).delete(delete_news))
        .route("/admin/projects", get(list_projects).post(create_project))
        .route("/admin/projects/{id}", get(get_project).put(update_project).delete(delete_project))
        .route("/admin/vacancies", get(list_vacancies).post(create_vacancy))
        .route("/admin/vacancies/{id}", axum::routing::put(update_vacancy).delete(delete_vacancy))
        .route("/admin/stores", get(list_stores).post(create_store))
        .route("/admin/stores/{id}", axum::routing::put(update_store).delete(delete_store))
}

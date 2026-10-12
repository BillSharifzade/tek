//! Загруженные файлы — документы товаров, картинки новостей и проектов — хранятся в таблице `files` (bytea):
//! резервная копия базы сохраняет и их, отдельный том на сервере не нужен. Отдаются публично по
//! `/api/v1/files/{id}/{имя}` (адрес не угадать — id случайный), кешируются браузером навсегда (файл не меняется).

use axum::{
    body::Bytes,
    extract::{multipart::MultipartError, Multipart, Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    state::AppState,
};

/// Лимит одного файла (и тела запроса загрузки).
pub const MAX_FILE_BYTES: usize = 20 * 1024 * 1024;

/// Тип файла по расширению. SVG не принимаем: в нём может быть скрипт, а файл открывается с адреса сайта.
pub fn content_type_for(name: &str) -> AppResult<&'static str> {
    let ext = name.rsplit_once('.').map(|(_, e)| e.to_lowercase()).unwrap_or_default();
    Ok(match ext.as_str() {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "dwg" => "application/acad",
        "dxf" => "application/dxf",
        "zip" => "application/zip",
        "rar" => "application/vnd.rar",
        "7z" => "application/x-7z-compressed",
        _ => {
            return Err(AppError::unprocessable(
                "unsupported_file",
                "Формат файла не поддерживается: PDF, JPG, PNG, WebP, GIF, DOC(X), XLS(X), DWG, DXF, ZIP, RAR, 7Z",
            ))
        }
    })
}

/// Вид документа товара по названию: «Сертификат…» → certificate, «Паспорт…» → passport и т. д.
pub fn guess_doc_kind(title: &str) -> &'static str {
    let t = title.to_lowercase().replace('ё', "е");
    if t.contains("сертифик") {
        "certificate"
    } else if t.contains("деклар") {
        "declaration"
    } else if t.contains("чертеж") || t.contains("схем") || t.contains("габарит") {
        "drawing"
    } else if t.contains("каталог") || t.contains("брошюр") || t.contains("буклет") {
        "catalog"
    } else if t.contains("паспорт") || t.contains("инструкц") || t.contains("руководств") {
        "passport"
    } else {
        "other"
    }
}

pub fn is_image(content_type: &str) -> bool {
    content_type.starts_with("image/")
}

/// Имя файла без пути и управляющих символов (браузеры присылают «C:\fakepath\…»), не длиннее 150 символов.
pub fn clean_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or("").trim();
    let name: String = base.chars().filter(|c| !c.is_control() && !matches!(c, '"' | '<' | '>')).take(150).collect();
    if name.is_empty() { "file".into() } else { name }
}

/// Публичный адрес файла: `/api/v1/files/{id}/{имя латиницей}` (имя — только для читаемости ссылки).
pub fn public_url(id: Uuid, name: &str) -> String {
    let slug: String = crate::services::pdf::translit(name)
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    format!("/api/v1/files/{id}/{}", if slug.is_empty() { "file".into() } else { slug })
}

/// Сохраняет файл и возвращает его id.
pub async fn store(conn: &mut PgConnection, name: &str, content_type: &str, data: &[u8]) -> AppResult<Uuid> {
    Ok(sqlx::query_scalar("INSERT INTO files (name, content_type, size_bytes, data) VALUES ($1, $2, $3, $4) RETURNING id")
        .bind(name)
        .bind(content_type)
        .bind(data.len() as i32)
        .bind(data)
        .fetch_one(conn)
        .await?)
}

/// Ошибка чтения multipart: слишком большой файл — 413 с понятным текстом.
pub fn multipart_error(e: MultipartError) -> AppError {
    if e.status() == StatusCode::PAYLOAD_TOO_LARGE {
        AppError::new(StatusCode::PAYLOAD_TOO_LARGE, "payload_too_large", "Файл больше 20 МБ")
    } else {
        AppError::bad_request("invalid_file", format!("Не удалось прочитать файл: {}", e.body_text()))
    }
}

/// Поля формы загрузки: файл (`file`) и текстовые поля.
#[derive(Default)]
pub struct Upload {
    pub file: Option<(String, Bytes)>,
    pub fields: Vec<(String, String)>,
}

impl Upload {
    pub async fn read(mut multipart: Multipart) -> AppResult<Self> {
        let mut out = Upload::default();
        while let Some(field) = multipart.next_field().await.map_err(multipart_error)? {
            let name = field.name().unwrap_or("").to_string();
            if name == "file" {
                let file_name = clean_name(field.file_name().unwrap_or(""));
                let bytes = field.bytes().await.map_err(multipart_error)?;
                if !bytes.is_empty() {
                    out.file = Some((file_name, bytes));
                }
            } else {
                let text = field.text().await.map_err(multipart_error)?;
                out.fields.push((name, text));
            }
        }
        Ok(out)
    }

    pub fn field(&self, name: &str) -> Option<&str> {
        self.fields.iter().find(|(n, _)| n == name).map(|(_, v)| v.trim()).filter(|v| !v.is_empty())
    }
}

/// `Content-Disposition` с именем файла: латиница — `filename`, оригинал (кириллица) — `filename*` (RFC 5987).
pub fn disposition(kind: &str, name: &str) -> Option<HeaderValue> {
    let ascii: String = crate::services::pdf::translit(name).chars().map(|c| if c.is_ascii_graphic() && c != '"' && c != '\\' { c } else { '_' }).collect();
    let encoded: String = name
        .bytes()
        .map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect();
    HeaderValue::from_str(&format!("{kind}; filename=\"{ascii}\"; filename*=UTF-8''{encoded}")).ok()
}

/// Ответ с содержимым файла: картинки и PDF открываются в браузере, остальное скачивается.
pub fn file_response(name: &str, content_type: &str, data: Vec<u8>, attachment: bool) -> Response {
    let mut resp = (StatusCode::OK, data).into_response();
    let h = resp.headers_mut();
    if let Ok(v) = HeaderValue::from_str(content_type) {
        h.insert(header::CONTENT_TYPE, v);
    }
    let inline = !attachment && (is_image(content_type) || content_type == "application/pdf");
    if let Some(v) = disposition(if inline { "inline" } else { "attachment" }, name) {
        h.insert(header::CONTENT_DISPOSITION, v);
    }
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=31536000, immutable"));
    resp
}

#[derive(sqlx::FromRow)]
struct FileRow {
    name: String,
    content_type: String,
    data: Vec<u8>,
}

/// `GET /files/{id}/{имя}` — имя в адресе не проверяется (только для читаемости ссылки).
pub async fn serve(State(state): State<AppState>, Path((id, _name)): Path<(Uuid, String)>) -> AppResult<Response> {
    serve_id(&state, id).await
}

pub async fn serve_bare(State(state): State<AppState>, Path(id): Path<Uuid>) -> AppResult<Response> {
    serve_id(&state, id).await
}

async fn serve_id(state: &AppState, id: Uuid) -> AppResult<Response> {
    let f = sqlx::query_as::<_, FileRow>("SELECT name, content_type, data FROM files WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Файл не найден"))?;
    Ok(file_response(&f.name, &f.content_type, f.data, false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn types_and_names() {
        assert_eq!(content_type_for("Сертификат.PDF").unwrap(), "application/pdf");
        assert_eq!(content_type_for("photo.jpeg").unwrap(), "image/jpeg");
        assert!(content_type_for("logo.svg").is_err());
        assert!(content_type_for("noext").is_err());
        assert_eq!(clean_name("C:\\fakepath\\Паспорт изделия.pdf"), "Паспорт изделия.pdf");
        assert_eq!(clean_name("  "), "file");
        let id = Uuid::nil();
        assert_eq!(public_url(id, "Паспорт изделия.pdf"), format!("/api/v1/files/{id}/pasport-izdeliya.pdf"));
    }

    #[test]
    fn content_disposition_keeps_cyrillic() {
        let v = disposition("attachment", "Паспорт.pdf").unwrap();
        let s = v.to_str().unwrap();
        assert!(s.starts_with("attachment; filename=\"Pasport.pdf\"; filename*=UTF-8''%D0%9F"));
    }
}

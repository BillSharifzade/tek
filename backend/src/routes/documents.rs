use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    services::{files, pdf},
    state::AppState,
};

#[derive(sqlx::FromRow)]
struct DownloadRow {
    title: String,
    kind: String,
    file_name: String,
    file_id: Option<Uuid>,
    url: Option<String>,
}

/// Скачивание документа товара: загруженный файл, переход по внешней ссылке или (документы демо-каталога) сгенерированный PDF.
async fn download(State(state): State<AppState>, Path(id): Path<i32>) -> AppResult<Response> {
    let doc = sqlx::query_as::<_, DownloadRow>("SELECT title, kind, file_name, file_id, url FROM documents WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Документ не найден"))?;
    if let Some(fid) = doc.file_id {
        let f: Option<(String, Vec<u8>)> = sqlx::query_as("SELECT content_type, data FROM files WHERE id = $1").bind(fid).fetch_optional(&state.pool).await?;
        if let Some((content_type, data)) = f {
            let mut resp = files::file_response(&doc.file_name, &content_type, data, true);
            // документ могут заменить в панели — кешируем на час, а не навсегда
            resp.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));
            return Ok(resp);
        }
    }
    if let Some(url) = doc.url.filter(|u| u.starts_with("https://") || u.starts_with("http://")) {
        return Ok(Redirect::temporary(&url).into_response());
    }
    let products: Vec<String> = sqlx::query_scalar(
        "SELECT p.name FROM product_documents pd JOIN products p ON p.id = pd.product_id WHERE pd.document_id = $1 ORDER BY p.name LIMIT 20",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await?;
    let mut lines = vec![
        "OOO Tochikelektrokomplekt (TEK) - www.tectj.com".to_string(),
        format!("Tip dokumenta: {}", doc.kind),
        format!("Fayl: {}", doc.file_name),
        String::new(),
        "Dokument otnositsya k tovaram:".to_string(),
    ];
    lines.extend(products.iter().map(|p| format!("  - {p}")));
    let bytes = pdf::simple_pdf(&doc.title, &lines);
    let mut resp = (StatusCode::OK, bytes).into_response();
    let h = resp.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/pdf"));
    let ascii = pdf::translit(&doc.file_name).replace(' ', "_");
    if let Ok(v) = HeaderValue::from_str(&format!("attachment; filename=\"{ascii}\"")) {
        h.insert(header::CONTENT_DISPOSITION, v);
    }
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=3600"));
    Ok(resp)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/documents/{id}/download", get(download))
        .route("/files/{id}", get(files::serve_bare))
        .route("/files/{id}/{name}", get(files::serve))
}

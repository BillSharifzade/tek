use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};

use crate::{
    error::{AppError, AppResult},
    models::DocumentRow,
    services::pdf,
    state::AppState,
};

async fn download(State(state): State<AppState>, Path(id): Path<i32>) -> AppResult<Response> {
    let doc = sqlx::query_as::<_, DocumentRow>("SELECT id, title, kind, file_name, size_kb, content_type FROM documents WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Документ не найден"))?;
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
    Router::new().route("/documents/{id}/download", get(download))
}

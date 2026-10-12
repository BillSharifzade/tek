//! Тексты новостей, проектов и вакансий из панели — простая разметка вместо HTML:
//! абзацы (пустая строка между ними), списки «- пункт» / «1. пункт», заголовки «## …» / «### …», **жирный**,
//! [текст ссылки](https://…). Всё остальное экранируется: сохранённый в панели текст не может внедрить на сайт скрипт.
//! Для правки уже сохранённых текстов (в том числе из сида) HTML переводится обратно в разметку — `from_html`.

use crate::services::mail::esc;

fn safe_url(u: &str) -> bool {
    let ok_scheme = u.starts_with("https://") || u.starts_with("http://") || u.starts_with("mailto:") || u.starts_with("tel:") || (u.starts_with('/') && !u.starts_with("//"));
    ok_scheme && !u.is_empty() && !u.contains(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == '<' || c == '>')
}

/// Строка текста: **жирный** и [ссылка](адрес), остальное экранируется.
fn inline(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(ch) = rest.chars().next() {
        if let Some(after) = rest.strip_prefix("**")
            && let Some(end) = after.find("**").filter(|e| *e > 0)
        {
            out.push_str("<strong>");
            out.push_str(&inline(&after[..end]));
            out.push_str("</strong>");
            rest = &after[end + 2..];
            continue;
        }
        if ch == '['
            && let Some(close) = rest.find("](")
            && let Some(end) = rest[close + 2..].find(')')
        {
            let label = &rest[1..close];
            let url = rest[close + 2..close + 2 + end].trim();
            if !label.trim().is_empty() && !label.contains('[') && safe_url(url) {
                out.push_str(&format!("<a href=\"{}\">{}</a>", esc(url), esc(label)));
                rest = &rest[close + 3 + end..];
                continue;
            }
        }
        out.push_str(&esc(&ch.to_string()));
        rest = &rest[ch.len_utf8()..];
    }
    out
}

fn list_item(line: &str) -> Option<(&'static str, &str)> {
    let t = line.trim_start();
    for marker in ["- ", "* ", "• ", "— "] {
        if let Some(rest) = t.strip_prefix(marker) {
            return Some(("ul", rest.trim()));
        }
    }
    let digits = t.chars().take_while(char::is_ascii_digit).count();
    if digits > 0 && digits <= 3 {
        let rest = &t[digits..];
        if let Some(r) = rest.strip_prefix(". ").or_else(|| rest.strip_prefix(") ")) {
            return Some(("ol", r.trim()));
        }
    }
    None
}

/// Разметка → HTML для сайта.
pub fn to_html(src: &str) -> String {
    let text = src.replace("\r\n", "\n").replace('\r', "\n");
    let mut out = String::new();
    let mut para: Vec<String> = Vec::new();
    let mut list: Option<(&str, Vec<String>)> = None;
    let flush_para = |para: &mut Vec<String>, out: &mut String| {
        if !para.is_empty() {
            out.push_str(&format!("<p>{}</p>", para.join("<br>")));
            para.clear();
        }
    };
    let flush_list = |list: &mut Option<(&str, Vec<String>)>, out: &mut String| {
        if let Some((tag, items)) = list.take() {
            out.push_str(&format!("<{tag}>{}</{tag}>", items.iter().map(|i| format!("<li>{i}</li>")).collect::<String>()));
        }
    };
    for raw in text.lines() {
        let line = raw.trim_end();
        if line.trim().is_empty() {
            flush_para(&mut para, &mut out);
            flush_list(&mut list, &mut out);
            continue;
        }
        let t = line.trim_start();
        if let Some(h) = t.strip_prefix("### ").or_else(|| t.strip_prefix("## ")) {
            flush_para(&mut para, &mut out);
            flush_list(&mut list, &mut out);
            let tag = if t.starts_with("### ") { "h3" } else { "h2" };
            out.push_str(&format!("<{tag}>{}</{tag}>", inline(h.trim())));
            continue;
        }
        if let Some((tag, item)) = list_item(line) {
            flush_para(&mut para, &mut out);
            if list.as_ref().is_some_and(|(t, _)| *t != tag) {
                flush_list(&mut list, &mut out);
            }
            list.get_or_insert((tag, Vec::new())).1.push(inline(item));
            continue;
        }
        flush_list(&mut list, &mut out);
        para.push(inline(t));
    }
    flush_para(&mut para, &mut out);
    flush_list(&mut list, &mut out);
    out
}

fn unescape(s: &str) -> String {
    s.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&#039;", "'").replace("&amp;", "&")
}

/// Значение атрибута `name="…"` из текста тега.
fn attr(tag: &str, name: &str) -> Option<String> {
    let lower = tag.to_lowercase();
    let pos = lower.find(&format!("{name}="))?;
    let rest = &tag[pos + name.len() + 1..];
    let quote = rest.chars().next()?;
    let value = if quote == '"' || quote == '\'' { rest[1..].split(quote).next()? } else { rest.split([' ', '>']).next()? };
    Some(unescape(value))
}

/// HTML (сохранённый текст или текст из сида) → разметка для правки в панели. Неизвестные теги отбрасываются.
pub fn from_html(html: &str) -> String {
    let mut out = String::new();
    let mut lists: Vec<(bool, usize)> = Vec::new(); // (нумерованный, номер пункта)
    let mut hrefs: Vec<Option<String>> = Vec::new();
    let mut rest = html;
    while !rest.is_empty() {
        let Some(lt) = rest.find('<') else {
            out.push_str(&unescape(&rest.replace('\n', " ")));
            break;
        };
        out.push_str(&unescape(&rest[..lt].replace('\n', " ")));
        let Some(gt) = rest[lt..].find('>') else {
            out.push_str(&unescape(&rest[lt..]));
            break;
        };
        let tag = &rest[lt + 1..lt + gt];
        rest = &rest[lt + gt + 1..];
        let closing = tag.starts_with('/');
        let name: String = tag.trim_start_matches('/').chars().take_while(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase();
        match (name.as_str(), closing) {
            ("p" | "div", true) | ("h2" | "h3" | "h4", true) => out.push_str("\n\n"),
            ("p" | "div", false) if !out.is_empty() && !out.ends_with("\n\n") => out.push_str("\n\n"),
            ("br", _) => out.push('\n'),
            ("h2", false) => out.push_str("\n\n## "),
            ("h3" | "h4", false) => out.push_str("\n\n### "),
            ("ul", false) => {
                out.push_str("\n\n");
                lists.push((false, 0));
            }
            ("ol", false) => {
                out.push_str("\n\n");
                lists.push((true, 0));
            }
            ("ul" | "ol", true) => {
                lists.pop();
                out.push_str("\n\n");
            }
            ("li", false) => {
                if !out.ends_with('\n') {
                    out.push('\n');
                }
                match lists.last_mut() {
                    Some((true, n)) => {
                        *n += 1;
                        out.push_str(&format!("{n}. "));
                    }
                    _ => out.push_str("- "),
                }
            }
            ("li", true) => out.push('\n'),
            ("strong" | "b", _) => out.push_str("**"),
            ("a", false) => {
                let href = attr(tag, "href").filter(|h| safe_url(h));
                if href.is_some() {
                    out.push('[');
                }
                hrefs.push(href);
            }
            ("a", true) => {
                if let Some(Some(h)) = hrefs.pop() {
                    out.push_str(&format!("]({h})"));
                }
            }
            _ => {}
        }
    }
    // строки без хвостовых пробелов, не больше одной пустой строки подряд
    let mut clean = String::new();
    let mut blank = 0;
    for line in out.lines() {
        let line = line.trim_end();
        let line = if line.trim_start().starts_with("- ") || line.trim_start().starts_with("## ") || line.trim_start().starts_with("### ") { line.trim_start() } else { line.trim() };
        if line.is_empty() {
            blank += 1;
            continue;
        }
        if !clean.is_empty() {
            clean.push_str(if blank > 0 { "\n\n" } else { "\n" });
        }
        blank = 0;
        clean.push_str(line);
    }
    clean
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markup_to_html_escapes_everything_else() {
        let src = "Первый абзац\nвторая строка\n\n## Заголовок\n- пункт **важно**\n- [сайт](https://tec.tj)\n\n1. раз\n2. два\n\n<script>alert(1)</script> [x](javascript:alert(1))";
        assert_eq!(
            to_html(src),
            "<p>Первый абзац<br>вторая строка</p><h2>Заголовок</h2><ul><li>пункт <strong>важно</strong></li><li><a href=\"https://tec.tj\">сайт</a></li></ul><ol><li>раз</li><li>два</li></ol><p>&lt;script&gt;alert(1)&lt;/script&gt; [x](javascript:alert(1))</p>"
        );
    }

    #[test]
    fn seed_html_round_trips() {
        let html = "<p>ООО «ТЭК» — поставщик с 2009 года.</p><p>Склад 3000 м².</p><ul><li>Доставка за 1 день</li><li><strong>Только</strong> оригинал</li></ul><h3>Возврат</h3><p>Звоните <a href=\"tel:+992446206060\">+992 446 20 60 60</a> &amp; пишите.</p>";
        let text = from_html(html);
        assert_eq!(text, "ООО «ТЭК» — поставщик с 2009 года.\n\nСклад 3000 м².\n\n- Доставка за 1 день\n- **Только** оригинал\n\n### Возврат\n\nЗвоните [+992 446 20 60 60](tel:+992446206060) & пишите.");
        assert_eq!(to_html(&text), html.replace("&amp;", "&amp;"));
    }
}

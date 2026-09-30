//! Поиск по каталогу: каждое слово запроса должно встретиться в названии, коде, бренде или категории.
//! Слова приводятся к основе (кабели → кабел, лоток → лотк) и нормализуются так же, как текст товара в SQL:
//! кириллические «двойники» латиницы → латиница (16А = 16A), «х»/«×» → x (3х2,5 = 3x2.5), запятая → точка.

/// SQL-выражение нормализации — применяется к тексту товара; к словам запроса — [`normalize`].
pub const SQL_NORMALIZE_FROM: &str = "аеокрсухё×,";
pub const SQL_NORMALIZE_TO: &str = "aeokpcyxex.";

pub fn normalize(s: &str) -> String {
    let from: Vec<char> = SQL_NORMALIZE_FROM.chars().collect();
    let to: Vec<char> = SQL_NORMALIZE_TO.chars().collect();
    s.to_lowercase().chars().map(|c| from.iter().position(|f| *f == c).map(|i| to[i]).unwrap_or(c)).collect()
}

const ENDINGS: &[&str] = &[
    "ями", "ами", "ого", "ему", "ыми", "ими", "ией", "ях", "ах", "ов", "ев", "ей", "ой", "ый", "ий", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "ом", "ем", "ам", "ям", "ы", "и",
    "а", "я", "о", "е", "у", "ю", "ь",
];

/// Основа слова: отрезаем падежное окончание, оставляя не меньше 4 букв (только для кириллических слов).
fn stem(word: &str) -> String {
    let w = word.to_lowercase();
    if w.chars().count() < 5 || !w.chars().all(|c| ('а'..='я').contains(&c) || c == 'ё') {
        return w;
    }
    for e in ENDINGS {
        if let Some(base) = w.strip_suffix(e) {
            if base.chars().count() >= 4 {
                return base.to_string();
            }
        }
    }
    w
}

/// Слова запроса; у каждого — варианты написания (беглая гласная: лоток → лотк, конец → конц).
pub fn terms(query: &str) -> Vec<Vec<String>> {
    query
        .split(|c: char| c.is_whitespace() || matches!(c, '(' | ')' | '"' | '«' | '»' | ';'))
        .map(|w| w.trim_matches(|c: char| matches!(c, ',' | '.' | '!' | '?' | ':')))
        .filter(|w| !w.is_empty())
        .take(8)
        .map(|w| {
            let s = stem(w);
            let mut variants = vec![normalize(&s)];
            for (from, to) in [("ок", "к"), ("ек", "к"), ("ец", "ц")] {
                if let Some(base) = s.strip_suffix(from) {
                    if base.chars().count() >= 3 {
                        variants.push(normalize(&format!("{base}{to}")));
                    }
                }
            }
            variants.dedup();
            variants
        })
        .collect()
}

/// `%…%` для LIKE с экранированием спецсимволов.
pub fn like(term: &str) -> String {
    format!("%{}%", term.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terms_match_product_text() {
        let hay = normalize("Кабель ВВГнг(А)-LS 3x2.5 Prysmian Силовые кабели");
        for q in ["кабель ВВГ 3х2,5", "кабели ввг", "3x2.5", "prysmian"] {
            assert!(terms(q).iter().all(|alts| alts.iter().any(|t| hay.contains(t.as_str()))), "{q}");
        }
        let hay = normalize("Автоматический выключатель Easy9 1P 16A C Schneider Electric");
        assert!(terms("Easy9 16А").iter().all(|alts| alts.iter().any(|t| hay.contains(t.as_str()))));
        let hay = normalize("Лоток перфорированный 100х50х3000 ДКС Кабельные лотки ДКС");
        assert!(terms("лоток").iter().all(|alts| alts.iter().any(|t| hay.contains(t.as_str()))));
        assert!(terms("лотки").iter().all(|alts| alts.iter().any(|t| hay.contains(t.as_str()))));
    }
}

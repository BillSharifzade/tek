/// Tiny PDF generator for placeholder documents (certificates, drawings).
/// Uses a base-14 font, so text is transliterated to ASCII.
pub fn translit(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        let s: &str = match ch {
            'а' => "a", 'б' => "b", 'в' => "v", 'г' => "g", 'д' => "d", 'е' => "e", 'ё' => "yo", 'ж' => "zh",
            'з' => "z", 'и' => "i", 'й' => "y", 'к' => "k", 'л' => "l", 'м' => "m", 'н' => "n", 'о' => "o",
            'п' => "p", 'р' => "r", 'с' => "s", 'т' => "t", 'у' => "u", 'ф' => "f", 'х' => "kh", 'ц' => "ts",
            'ч' => "ch", 'ш' => "sh", 'щ' => "sch", 'ъ' => "", 'ы' => "y", 'ь' => "", 'э' => "e", 'ю' => "yu",
            'я' => "ya",
            'А' => "A", 'Б' => "B", 'В' => "V", 'Г' => "G", 'Д' => "D", 'Е' => "E", 'Ё' => "Yo", 'Ж' => "Zh",
            'З' => "Z", 'И' => "I", 'Й' => "Y", 'К' => "K", 'Л' => "L", 'М' => "M", 'Н' => "N", 'О' => "O",
            'П' => "P", 'Р' => "R", 'С' => "S", 'Т' => "T", 'У' => "U", 'Ф' => "F", 'Х' => "Kh", 'Ц' => "Ts",
            'Ч' => "Ch", 'Ш' => "Sh", 'Щ' => "Sch", 'Ъ' => "", 'Ы' => "Y", 'Ь' => "", 'Э' => "E", 'Ю' => "Yu",
            'Я' => "Ya", 'ӣ' => "i", 'ӯ' => "u", 'қ' => "q", 'ҳ' => "h", 'ҷ' => "j", 'ғ' => "gh",
            c if c.is_ascii() => {
                out.push(c);
                continue;
            }
            _ => "?",
        };
        out.push_str(s);
    }
    out
}

fn escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('(', "\\(").replace(')', "\\)")
}

pub fn simple_pdf(title: &str, lines: &[String]) -> Vec<u8> {
    let mut content = String::new();
    content.push_str("BT\n/F1 18 Tf\n50 780 Td\n");
    content.push_str(&format!("({}) Tj\n", escape(&translit(title))));
    content.push_str("/F1 11 Tf\n0 -30 Td\n");
    for l in lines {
        content.push_str(&format!("({}) Tj\n0 -16 Td\n", escape(&translit(l))));
    }
    content.push_str("ET\n");

    let mut objects: Vec<String> = Vec::new();
    objects.push("<< /Type /Catalog /Pages 2 0 R >>".into());
    objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into());
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".into());
    objects.push(format!("<< /Length {} >>\nstream\n{}endstream", content.len(), content));
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".into());

    let mut pdf = String::from("%PDF-1.4\n");
    let mut offsets = Vec::new();
    for (i, obj) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", i + 1, obj));
    }
    let xref = pdf.len();
    pdf.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1));
    for off in offsets {
        pdf.push_str(&format!("{off:010} 00000 n \n"));
    }
    pdf.push_str(&format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n", objects.len() + 1, xref));
    pdf.into_bytes()
}

// Реальные логотипы брендов-партнёров (с tectj.com, обрезаны и переведены в webp — public/corporate/brands).
// Для брендов без оригинала — словесные знаки из public/brands, обрезанные по содержимому (public/corporate/brands/*.svg),
// иначе поле `logo` из API.

const LOGOS = new Set([
  "sata-tools",
  "schneider-electric",
  "hascelik-kablo",
  "omicron",
  "megger",
  "legrand",
  "hexing",
  "philips-lighting",
  "dks",
  "te-connectivity",
  "aksa",
  "prysmian",
]);

const WORDMARKS = new Set(["systeme-electric", "hes-kablo", "iek", "abb", "tsmo", "metz", "promrukav"]);

/** Есть ли у бренда настоящий логотип (webp с tectj.com), а не словесный знак-заглушка. */
export function hasRealLogo(slug: string): boolean {
  return LOGOS.has(slug);
}

export function brandLogo(b: { slug: string; logo?: string | null }): string | null {
  if (LOGOS.has(b.slug)) return `/corporate/brands/${b.slug}.webp`;
  if (WORDMARKS.has(b.slug)) return `/corporate/brands/${b.slug}.svg`;
  return b.logo ?? null;
}

/** Сертификаты дистрибьютора (сканы с tectj.com/company/certificates). */
export const CERTIFICATES: { n: number; brand: string; slug?: string; size: string }[] = [
  { n: 2, brand: "Schneider Electric", slug: "schneider-electric", size: "1,27 МБ" },
  { n: 3, brand: "ДКС", slug: "dks", size: "205,7 КБ" },
  { n: 5, brand: "AKSA Power Generation", slug: "aksa", size: "847,68 КБ" },
  { n: 4, brand: "Prysmian Россия", slug: "prysmian", size: "545,18 КБ" },
  { n: 8, brand: "Prysmian Турция", slug: "prysmian", size: "141,99 КБ" },
  { n: 6, brand: "Omicron", slug: "omicron", size: "301,93 КБ" },
  { n: 7, brand: "Megger", slug: "megger", size: "736,71 КБ" },
  { n: 1, brand: "SATA Tools", slug: "sata-tools", size: "158,75 КБ" },
];

/** «Нам доверяют» — логотипы заказчиков (tectj.com/company). */
export const CLIENTS: { file: string; name: string }[] = [
  { file: "rogun", name: "Рогунская ГЭС" },
  { file: "sangtuda", name: "Сангтудинская ГЭС-1" },
  { file: "pamir", name: "Pamir Energy" },
  { file: "talco_gold", name: "Talco Gold" },
  { file: "andritz", name: "Andritz Hydro" },
  { file: "webuild", name: "Webuild" },
  { file: "megafon", name: "МегаФон Таджикистан" },
  { file: "alif", name: "Алиф" },
  { file: "freedom", name: "Freedom Bank" },
  { file: "koinot", name: "Коиноти Нав" },
  { file: "takaoka", name: "Takaoka Engineering" },
  { file: "dnc", name: "Dai Nippon Construction" },
  { file: "tgem", name: "ТГЭМ" },
  { file: "cobra", name: "Cobra" },
  { file: "giz", name: "GIZ" },
  { file: "winrock", name: "Winrock International" },
  { file: "aga_khan", name: "Aga Khan" },
  { file: "barqi", name: "Барки Точик" },
];

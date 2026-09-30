import { imageOf, type NewsEntry } from "./types";

// Теги приходят из API (news.tags); если их нет — подбираем по тексту. Фото в API пока общее
// (/news/default.svg) — для обложки берём фото из макета того же сюжета.

const RULES: { re: RegExp; tags: string[]; cover?: { src: string; contain?: boolean } }[] = [
  { re: /семинар|презентац|тренинг|обучен|вебинар/i, tags: ["семинар", "тренинг"] },
  { re: /банк/i, tags: ["проекты", "ДГУ"], cover: { src: "/figma/service-to.webp" } },
  { re: /дгу|генератор|aksa|резервн/i, tags: ["проекты", "ДГУ"], cover: { src: "/figma/project-1.webp" } },
  { re: /конфигуратор|калькулятор|combitech/i, tags: ["сервис", "конфигураторы"], cover: { src: "/figma/tray-joint.webp", contain: true } },
  { re: /дистрибьют|договор|партн[её]р/i, tags: ["партнёры", "дистрибуция"], cover: { src: "/figma/tray.webp", contain: true } },
  { re: /склад|филиал/i, tags: ["компания", "доставка"], cover: { src: "/figma/project-2.webp" } },
  { re: /кешб[эе]к|бонус|скидк|акци/i, tags: ["акции", "кешбэк"], cover: { src: "/figma/cable-reel.webp", contain: true } },
];

const FALLBACK = ["/figma/project-3.webp", "/figma/project-6.webp", "/figma/service-to.webp", "/figma/project-5.webp"];

function text(n: Pick<NewsEntry, "title" | "excerpt">): string {
  return `${n.title} ${n.excerpt ?? ""}`;
}

export function newsTags(n: Pick<NewsEntry, "title" | "excerpt"> & { tags?: string[] | null }): string[] {
  if (n.tags && n.tags.length > 0) return n.tags.map((t) => t.replace(/^#/, ""));
  const t = text(n);
  const rule = RULES.find((r) => r.re.test(t));
  return rule ? rule.tags : ["новости"];
}

export function newsCover(n: NewsEntry): { src: string; contain: boolean } {
  const img = imageOf(n);
  if (img && !img.includes("default")) return { src: img, contain: false };
  const t = text(n);
  const rule = RULES.find((r) => r.re.test(t) && r.cover);
  if (rule?.cover) return { src: rule.cover.src, contain: Boolean(rule.cover.contain) };
  let h = 0;
  for (let i = 0; i < n.slug.length; i++) h = (h * 31 + n.slug.charCodeAt(i)) >>> 0;
  return { src: FALLBACK[h % FALLBACK.length], contain: false };
}

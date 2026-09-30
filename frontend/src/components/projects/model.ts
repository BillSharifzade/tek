// Модель проекта для карточки / фильтров / страницы проекта.
// Подходит и для `/content/projects` (Project, ProjectItem), и для `home.projects` (HomeProject).

import type { ProductCard } from "@/lib/types";

/** Минимум, который нужен карточке (общий для Project / ProjectItem / HomeProject). */
export interface ProjectLike {
  slug: string;
  title: string;
  year?: string | null;
  date?: string | null;
  object?: string | null;
  service?: string | null;
  image?: string | null;
  image_url?: string | null;
  /** верхние разделы каталога применённых продуктов (фильтр «Продукция») */
  categories?: { slug: string; name: string }[] | null;
}

export type ProjectBrandRef = string | { slug?: string | null; name: string; logo?: string | null };

/** Деталка проекта: бренды, фото с объекта, видео и применённые продукты приходят из /content/projects/{slug}. */
export interface ProjectDetail extends ProjectLike {
  excerpt?: string | null;
  body?: string | null;
  brands?: ProjectBrandRef[] | null;
  products?: ProductCard[] | null;
  photos?: string[] | null;
  video_url?: string | null;
}

export interface BrandLite {
  slug: string;
  name: string;
  logo?: string | null;
}

export function projectImage(p: { image?: string | null; image_url?: string | null }): string | null {
  return p.image ?? p.image_url ?? null;
}

// ── Услуги («Поставка, Монтаж, ПНР» → пилюли) ─────────────────────────────────────────────

const SERVICE_ALIASES: Record<string, string> = {
  пнр: "Пуско-наладка",
  "пуско-наладка": "Пуско-наладка",
  пусконаладка: "Пуско-наладка",
  "пуско-наладочные работы": "Пуско-наладка",
  поставка: "Поставка",
  монтаж: "Монтаж",
  проектирование: "Проектирование",
  освещение: "Освещение",
};

/** Порядок пилюль как в макете: Поставка → Пуско-наладка → Монтаж. */
const SERVICE_ORDER = ["Проектирование", "Поставка", "Пуско-наладка", "Монтаж"];

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function serviceTags(service: string | null | undefined): string[] {
  if (!service) return [];
  const out: string[] = [];
  for (const raw of service.split(/[,;/]+/)) {
    const t = raw.trim().replace(/\s+/g, " ");
    if (!t) continue;
    const label = SERVICE_ALIASES[t.toLowerCase()] ?? capitalize(t);
    if (!out.includes(label)) out.push(label);
  }
  const rank = (s: string) => {
    const i = SERVICE_ORDER.indexOf(s);
    return i === -1 ? SERVICE_ORDER.length : i;
  };
  return out.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}

// ── Бренды ─────────────────────────────────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&laquo;|&raquo;/g, '"');
}

/**
 * Бренды проекта. Если бэкенд отдаёт `brands` — берём их; иначе ищем названия брендов каталога
 * в названии, объекте и описании проекта.
 */
export function projectBrands(p: ProjectDetail, catalog: BrandLite[]): BrandLite[] {
  if (p.brands && p.brands.length > 0) {
    return p.brands.map((b) => {
      const name = typeof b === "string" ? b : b.name;
      const known = catalog.find((c) => c.name.toLowerCase() === name.toLowerCase() || (typeof b !== "string" && b.slug && c.slug === b.slug));
      return known ?? { slug: typeof b !== "string" && b.slug ? b.slug : "", name, logo: typeof b !== "string" ? b.logo : null };
    });
  }
  const text = [p.title, p.object, p.excerpt, p.body ? plainText(p.body) : ""].filter(Boolean).join(" \n ");
  if (!text) return [];
  return catalog.filter((b) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(b.name)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text));
}

import type { Query } from "./api";

export type SearchParams = Record<string, string | string[] | undefined>;

export const PER_PAGE = 24;

const KNOWN = new Set(["category", "brand", "q", "sort", "page", "per_page", "in_stock", "sale", "hit", "new", "price_min", "price_max", "ids"]);

/**
 * Сортировки из макета «Каталог»: 4 кнопки. `api` — значение `sort` для GET /catalog/products.
 * Бэкенд умеет только popular (по умолчанию) / new / price_asc / price_desc / name, поэтому
 * «по рейтингу» и «по отзывам» пока идут на ближайшую поддерживаемую — популярность.
 * Когда бэкенд научится `rating` / `reviews`, достаточно поменять `api` здесь.
 */
export const SORTS = [
  { key: "price_desc", label: "дороже", api: "price_desc", icon: "up" },
  { key: "price_asc", label: "дешевле", api: "price_asc", icon: "down" },
  { key: "rating", label: "по рейтингу", api: "rating", icon: null },
  { key: "reviews", label: "по отзывам", api: "reviews", icon: null },
] as const;

export type SortKey = (typeof SORTS)[number]["key"];

/** Сортировка без параметра в URL — «по рейтингу». */
export const DEFAULT_SORT: SortKey = "rating";

/** Active sort button for a `sort` URL value (null — a non-button sort like `new`). */
export function sortKeyOf(v: string | string[] | undefined | null): SortKey | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || s === "popular") return DEFAULT_SORT;
  return SORTS.find((x) => x.key === s)?.key ?? null;
}

/** Multi-value params (brand, attr.*) go to the API comma-separated: repeated keys would keep only the last value. */
function isMulti(k: string): boolean {
  return k === "brand" || k.startsWith("attr.");
}

/** Convert Next searchParams into the API query for GET /catalog/products. */
export function toProductsQuery(sp: SearchParams, fixed: Partial<Record<"category" | "brand" | "q", string>> = {}): Query {
  const q: Query = { per_page: PER_PAGE };
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (KNOWN.has(k) || k.startsWith("attr.")) {
      if (Array.isArray(v)) q[k] = isMulti(k) ? v.join(",") : v[0];
      else q[k] = v;
    }
  }
  {
    const raw = sp.sort !== undefined ? firstParam(sp.sort) : DEFAULT_SORT;
    // прямые значения API (например, ?sort=new со ссылок «Новинки») пропускаем как есть
    const api = SORTS.find((x) => x.key === raw)?.api ?? (raw === "new" || raw === "name" ? raw : "popular");
    if (api !== "popular") q.sort = api;
    else delete q.sort;
  }
  const page = Number(Array.isArray(sp.page) ? sp.page[0] : (sp.page ?? 1));
  q.page = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  if (fixed.category) q.category = fixed.category;
  if (fixed.brand) q.brand = fixed.brand;
  if (fixed.q) q.q = fixed.q;
  return q;
}

/** Build a relative href for the current path with modified params. */
export function buildHref(pathname: string, sp: SearchParams, patch: Record<string, string | string[] | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, v);
  }
  for (const [k, v] of Object.entries(patch)) {
    params.delete(k);
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, v);
  }
  if (!("page" in patch)) params.delete("page");
  const s = params.toString();
  return s ? `${pathname}?${s}` : pathname;
}

export function asArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

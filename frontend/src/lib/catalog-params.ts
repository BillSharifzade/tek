import type { Query } from "./api";

export type SearchParams = Record<string, string | string[] | undefined>;

export const PER_PAGE = 24;

const KNOWN = new Set(["category", "brand", "q", "sort", "page", "per_page", "in_stock", "sale", "hit", "new", "price_min", "price_max", "ids"]);

/** Convert Next searchParams into the API query for GET /catalog/products. */
export function toProductsQuery(sp: SearchParams, fixed: Partial<Record<"category" | "brand" | "q", string>> = {}): Query {
  const q: Query = { per_page: PER_PAGE };
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (KNOWN.has(k) || k.startsWith("attr.")) {
      q[k] = Array.isArray(v) ? v : v;
    }
  }
  const page = Number(sp.page ?? 1);
  q.page = Number.isFinite(page) && page > 0 ? page : 1;
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

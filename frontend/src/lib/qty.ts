import type { ProductCard } from "./types";

/** Шаг количества — кратность упаковки (лоток 3 м, барабан 100 м) или 1. */
export function packStep(p: Pick<ProductCard, "pack_qty">): number {
  const s = Number(p.pack_qty ?? 0);
  return Number.isFinite(s) && s > 0 ? s : 1;
}

/** Ближайшее допустимое количество: кратно шагу и не меньше одного шага. */
export function snapQty(n: number, step: number): number {
  if (!Number.isFinite(n) || n <= 0) return step;
  return Math.max(step, Math.round(n / step) * step);
}

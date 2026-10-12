import type { VariantItem, Variants } from "./types";

/**
 * Состояние значения оси относительно текущего исполнения (доработки R3):
 * active — выбрано; available — такое сочетание с остальными выбранными параметрами есть в наличии;
 * other — в выбранном сочетании нет (серая кнопка), клик откроет ближайшее исполнение в наличии и поменяет остальные параметры.
 * Исполнения, которых нет в наличии, кнопками не предлагаются.
 */
export type OptionState = "active" | "available" | "other";

export interface VariantOption {
  value: string;
  state: OptionState;
  /** исполнение, которое откроется по клику */
  target: VariantItem;
}

/**
 * Ближайшее исполнение со значением `value` по оси `axis`: максимум совпадений с текущим по остальным осям
 * (совпадение по более ранней оси важнее), затем ближайшие значения несовпавших осей.
 */
function nearest(v: Variants, pool: VariantItem[], current: VariantItem, axis: number, value: string): VariantItem | null {
  const name = v.axes[axis].name;
  const n = v.axes.length;
  let best: VariantItem | null = null;
  let bestScore: [number, number] = [-1, -Infinity];
  for (const it of pool) {
    if (it.values[name] !== value) continue;
    let match = 0;
    let distance = 0;
    v.axes.forEach((a, j) => {
      if (j === axis) return;
      if (it.values[a.name] === current.values[a.name]) match += 2 ** (n - j);
      else distance += Math.abs(a.values.indexOf(it.values[a.name]) - a.values.indexOf(current.values[a.name]));
    });
    if (match > bestScore[0] || (match === bestScore[0] && -distance > bestScore[1])) {
      best = it;
      bestScore = [match, -distance];
    }
  }
  return best;
}

/** Кнопки одной оси: для каждого значения — куда ведёт клик и как её показать. Значения без исполнений в наличии скрыты. */
export function axisOptions(v: Variants, current: VariantItem, axis: number): VariantOption[] {
  const name = v.axes[axis].name;
  // нет в наличии ни одного другого исполнения — показываем все, чтобы переключатель не пропал совсем
  const inStock = v.items.filter((it) => it.in_stock && it.slug !== current.slug);
  const pool = inStock.length > 0 ? inStock : v.items;
  const out: VariantOption[] = [];
  for (const value of v.axes[axis].values) {
    if (value === current.values[name]) {
      out.push({ value, state: "active", target: current });
      continue;
    }
    const target = nearest(v, pool, current, axis, value);
    if (!target) continue;
    const exact = v.axes.every((a, j) => j === axis || target.values[a.name] === current.values[a.name]);
    out.push({ value, target, state: exact ? "available" : "other" });
  }
  return out;
}

/** Что изменится кроме выбранной оси — для подсказки у «other»: «Число полюсов: 3». */
export function sideChanges(v: Variants, current: VariantItem, target: VariantItem, axis: number): string {
  return v.axes
    .filter((a, j) => j !== axis && target.values[a.name] !== current.values[a.name])
    .map((a) => `${a.name}: ${target.values[a.name]}`)
    .join(", ");
}

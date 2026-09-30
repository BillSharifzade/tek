import type { VariantItem, Variants } from "./types";

/**
 * Состояние значения оси относительно текущего исполнения:
 * active — выбрано; available — такое сочетание есть и в наличии; out — сочетание есть, но нет в наличии;
 * other — с остальными выбранными параметрами сочетания нет, клик переключит и их (как у Петровича).
 */
export type OptionState = "active" | "available" | "out" | "other";

export interface VariantOption {
  value: string;
  state: OptionState;
  /** исполнение, которое откроется по клику */
  target: VariantItem;
}

/**
 * Ближайшее исполнение со значением `value` по оси `axis`: максимум совпадений с текущим по остальным осям
 * (совпадение по более ранней оси важнее), затем в наличии, затем ближайшие значения несовпавших осей.
 */
function nearest(v: Variants, current: VariantItem, axis: number, value: string): VariantItem | null {
  const name = v.axes[axis].name;
  const n = v.axes.length;
  let best: VariantItem | null = null;
  let bestScore: [number, number, number] = [-1, -1, -Infinity];
  for (const it of v.items) {
    if (it.values[name] !== value) continue;
    let match = 0;
    let distance = 0;
    v.axes.forEach((a, j) => {
      if (j === axis) return;
      if (it.values[a.name] === current.values[a.name]) match += 2 ** (n - j);
      else distance += Math.abs(a.values.indexOf(it.values[a.name]) - a.values.indexOf(current.values[a.name]));
    });
    const score: [number, number, number] = [match, it.in_stock ? 1 : 0, -distance];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && (score[1] > bestScore[1] || (score[1] === bestScore[1] && score[2] > bestScore[2])))) {
      best = it;
      bestScore = score;
    }
  }
  return best;
}

/** Кнопки одной оси: для каждого значения — куда ведёт клик и как её показать. */
export function axisOptions(v: Variants, current: VariantItem, axis: number): VariantOption[] {
  const name = v.axes[axis].name;
  const out: VariantOption[] = [];
  for (const value of v.axes[axis].values) {
    if (value === current.values[name]) {
      out.push({ value, state: "active", target: current });
      continue;
    }
    const target = nearest(v, current, axis, value);
    if (!target) continue;
    const exact = v.axes.every((a, j) => j === axis || target.values[a.name] === current.values[a.name]);
    out.push({ value, target, state: !exact ? "other" : target.in_stock ? "available" : "out" });
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

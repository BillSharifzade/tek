"use client";

import { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { qty as fmtQty } from "@/lib/format";

const WIDTHS = ["50", "80", "100", "150", "200"];
const TRAY_LEN = 3; // стандартная длина лотка, м

interface Inputs {
  length: string;
  width: string;
  turns: string;
  branches: string;
  step: string;
}

function num(v: string, fallback = 0): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function TrayCalculator() {
  const [v, setV] = useState<Inputs>({ length: "100", width: "100", turns: "4", branches: "2", step: "1.5" });
  const set = (k: keyof Inputs, val: string) => setV((p) => ({ ...p, [k]: val }));

  const rows = useMemo(() => {
    const length = num(v.length);
    const step = Math.max(0.5, num(v.step, 1.5));
    const trays = Math.ceil(length / TRAY_LEN);
    const turns = Math.round(num(v.turns));
    const branches = Math.round(num(v.branches));
    const consoles = length > 0 ? Math.ceil(length / step) + 1 : 0;
    const joints = Math.max(0, trays - 1);
    return [
      { name: `Лоток перфорированный ${v.width}х50х3000`, qty: trays, unit: "шт", note: `${TRAY_LEN} м · всего ${fmtQty(trays * TRAY_LEN)} м` },
      { name: `Крышка на лоток ${v.width} мм`, qty: trays, unit: "шт", note: "по одной на каждый лоток" },
      { name: `Угол горизонтальный 90° ${v.width} мм`, qty: turns, unit: "шт", note: "по числу поворотов" },
      { name: `Ответвитель Т-образный ${v.width} мм`, qty: branches, unit: "шт", note: "по числу ответвлений" },
      { name: "Консоль опорная", qty: consoles, unit: "шт", note: `шаг ${fmtQty(step)} м` },
      { name: "Соединитель лотков", qty: joints, unit: "шт", note: "на стыках секций" },
      { name: "Комплект крепежа (болт М6 + гайка)", qty: joints * 4 + consoles * 2, unit: "шт", note: "4 на стык, 2 на консоль" },
    ];
  }, [v]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <form className="flex flex-col gap-4 rounded-[8px] border border-line bg-white p-6" onSubmit={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2">
          <Calculator className="size-5 text-brand-hover" />
          <h3>Параметры трассы</h3>
        </div>
        <Field label="Длина трассы, м" htmlFor="tc-len">
          <Input id="tc-len" type="number" inputMode="decimal" min={0} step="0.5" value={v.length} onChange={(e) => set("length", e.target.value)} />
        </Field>
        <Field label="Ширина лотка, мм" htmlFor="tc-width">
          <Select id="tc-width" value={v.width} onChange={(e) => set("width", e.target.value)} options={WIDTHS.map((w) => ({ value: w, label: w }))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Количество поворотов" htmlFor="tc-turns">
            <Input id="tc-turns" type="number" inputMode="numeric" min={0} step={1} value={v.turns} onChange={(e) => set("turns", e.target.value)} />
          </Field>
          <Field label="Количество ответвлений" htmlFor="tc-branches">
            <Input id="tc-branches" type="number" inputMode="numeric" min={0} step={1} value={v.branches} onChange={(e) => set("branches", e.target.value)} />
          </Field>
        </div>
        <Field label="Шаг консолей, м" htmlFor="tc-step" hint="Рекомендуемый шаг опор — 1,5 м">
          <Input id="tc-step" type="number" inputMode="decimal" min={0.5} step="0.5" value={v.step} onChange={(e) => set("step", e.target.value)} />
        </Field>
      </form>

      <div className="rounded-[8px] border border-line bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h3>Расчёт комплектации</h3>
          <span className="text-sm text-sub tnum">Лоток {v.width} мм · {fmtQty(num(v.length))} м</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-sub">
                <th className="px-6 py-3 font-medium">Элемент</th>
                <th className="px-4 py-3 text-right font-medium">Кол-во</th>
                <th className="px-6 py-3 font-medium">Примечание</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-6 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-right tnum">
                    {fmtQty(r.qty)} {r.unit}
                  </td>
                  <td className="px-6 py-3 text-sm text-sub">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-sub">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Подбор артикулов — в следующей версии
          </p>
          <Button disabled title="Подбор артикулов — в следующей версии">
            Добавить в корзину
          </Button>
        </div>
      </div>
    </div>
  );
}

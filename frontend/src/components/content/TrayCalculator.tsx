"use client";

import { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

  const field =
    "h-[36px] w-full rounded-[7px] border border-line bg-white px-[13px] text-[14px] leading-[20px] text-black transition-colors hover:border-outline focus:border-outline-hover focus:outline-none tnum";
  const label = "mb-[6px] block text-[14px] leading-[18px] text-sub";

  return (
    <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-[417px_minmax(0,1fr)] lg:gap-[34px]">
      {/* Параметры — белая карта с тенью, как прайс-карта «Сервис центр ДГУ» */}
      <form className="self-start rounded-[10px] bg-white px-[24px] py-[26px] shadow-card md:px-[34px] md:py-[32px]" onSubmit={(e) => e.preventDefault()}>
        <div className="flex items-center gap-[10px]">
          <span className="flex size-[36px] items-center justify-center rounded-full bg-brand">
            <Calculator className="size-[18px]" aria-hidden />
          </span>
          <h2 className="text-[18px] font-bold leading-[22px]">Параметры трассы</h2>
        </div>
        <div className="mt-[24px] flex flex-col gap-[16px]">
          <div>
            <label htmlFor="tc-len" className={label}>
              Длина трассы, м
            </label>
            <input id="tc-len" className={field} type="number" inputMode="decimal" min={0} step="0.5" value={v.length} onChange={(e) => set("length", e.target.value)} />
          </div>
          <div>
            <label htmlFor="tc-width" className={label}>
              Ширина лотка, мм
            </label>
            <Select id="tc-width" value={v.width} onChange={(e) => set("width", e.target.value)} options={WIDTHS.map((w) => ({ value: w, label: `${w} мм` }))} className="[&>select]:rounded-[7px] [&>select]:border-line" />
          </div>
          <div className="grid grid-cols-2 gap-[13px]">
            <div>
              <label htmlFor="tc-turns" className={label}>
                Повороты, шт
              </label>
              <input id="tc-turns" className={field} type="number" inputMode="numeric" min={0} step={1} value={v.turns} onChange={(e) => set("turns", e.target.value)} />
            </div>
            <div>
              <label htmlFor="tc-branches" className={label}>
                Ответвления, шт
              </label>
              <input id="tc-branches" className={field} type="number" inputMode="numeric" min={0} step={1} value={v.branches} onChange={(e) => set("branches", e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="tc-step" className={label}>
              Шаг консолей, м
            </label>
            <input id="tc-step" className={field} type="number" inputMode="decimal" min={0.5} step="0.5" value={v.step} onChange={(e) => set("step", e.target.value)} />
            <p className="mt-[6px] text-[13px] leading-[18px] text-muted">Рекомендуемый шаг опор — 1,5 м</p>
          </div>
        </div>
      </form>

      {/* Результат — таблица в стиле «Периодичность ТО генераторов» (шапка #E4EAF0, зебра #F5F7F9) */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 className="text-[22px] font-bold leading-[28px] md:text-[26px] md:leading-[30px]">Расчёт комплектации</h2>
          <span className="text-[14px] leading-[20px] text-sub tnum">
            Лоток {v.width} мм · {fmtQty(num(v.length))} м
          </span>
        </div>
        <div className="-mx-4 mt-[18px] overflow-x-auto sm:mx-0">
          <table className="w-full border-collapse text-[14px] leading-[19px] sm:text-[15px] sm:leading-[20px]">
            <thead>
              <tr className="bg-[#E4EAF0] text-left">
                <th className="px-[14px] py-[14px] font-bold text-g333">Элемент</th>
                <th className="px-[14px] py-[14px] text-right font-bold text-g333">Кол-во</th>
                <th className="hidden px-[14px] py-[14px] font-bold text-g333 sm:table-cell">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-[#E4E8EC] even:bg-[#F5F7F9]">
                  <td className="px-[12px] py-[12px] text-g333 sm:px-[14px] sm:py-[14px]">
                    {r.name}
                    <span className="mt-[2px] block text-[13px] leading-[17px] text-muted sm:hidden">{r.note}</span>
                  </td>
                  <td className="whitespace-nowrap px-[12px] py-[12px] text-right align-top font-semibold tnum sm:px-[14px] sm:py-[14px] sm:align-middle">
                    {fmtQty(r.qty)} {r.unit}
                  </td>
                  <td className="hidden px-[14px] py-[14px] text-[14px] text-sub sm:table-cell">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-[20px] flex flex-col gap-[14px] sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-[8px] text-[14px] leading-[20px] text-sub">
            <Info className="mt-[2px] size-[16px] shrink-0" aria-hidden />
            Подбор артикулов и добавление в корзину — в следующей версии
          </p>
          <Button disabled title="Подбор артикулов — в следующей версии" className="px-[24px]">
            Добавить в корзину
          </Button>
        </div>
      </div>
    </div>
  );
}

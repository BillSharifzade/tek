"use client";

import { useRef, useState } from "react";
import { dateSlash, isoDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface Period {
  from: string;
  to: string;
}

/** Default period: last N days up to today (ISO dates). */
export function defaultPeriod(days = 30): Period {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return { from: isoDate(from), to: isoDate(to) };
}

export const periodKey = (p: Period) => `${p.from}_${p.to}`;

export function periodFromParams(sp: URLSearchParams | null, days = 30): Period {
  const d = defaultPeriod(days);
  const from = sp?.get("from");
  const to = sp?.get("to");
  return { from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : d.from, to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : d.to };
}

const plausible = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000;

/**
 * Поле даты из макета «Заказы» (9097:672): 98×35, рамка #E5E5E5, радиус 7, значение «05/10/2024» 14px #808080 по центру.
 * Под ним — нативный <input type="date"> (прозрачный), клик открывает системный календарь.
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  label,
  invalid,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  label: string;
  invalid?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span
      className={cn(
        "relative inline-flex h-[35px] w-[98px] shrink-0 items-center justify-center rounded-[7px] border bg-white text-[14px] leading-[20px] text-muted tnum transition-colors hover:border-outline focus-within:border-outline-hover",
        invalid ? "border-sale" : "border-line",
        className,
      )}
    >
      <span aria-hidden>{value ? dateSlash(value) : "дд/мм/гггг"}</span>
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => {
          try {
            ref.current?.showPicker?.();
          } catch {
            /* showPicker is not allowed in some contexts — the native field still works */
          }
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </span>
  );
}

/**
 * «Период с [дата] по [дата]» (Figma 9097:650): подписи 15/23 #555; «с» через 17px после «Период», поля через 9px, «по» через 18px.
 * Период применяется сразу при выборе даты.
 * Родитель передаёт `key={periodKey(value)}`, чтобы поля сбрасывались при смене применённого периода.
 */
export function PeriodFilter({ value, onApply, busy, className }: { value: Period; onApply: (p: Period) => void; busy?: boolean; className?: string }) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const invalid = Boolean(from && to && from > to);

  const change = (next: Period) => {
    setFrom(next.from);
    setTo(next.to);
    if (plausible(next.from) && plausible(next.to) && next.from <= next.to && periodKey(next) !== periodKey(value)) onApply(next);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-y-2 text-[15px] leading-[23px] text-[#555]", className)} role="group" aria-label="Период" aria-busy={busy || undefined}>
      <span className="mr-[17px]">Период</span>
      <span className="mr-[9px]">с</span>
      <DateField label="Начало периода" value={from} max={to || undefined} invalid={invalid} onChange={(v) => change({ from: v, to })} />
      <span className="ml-[18px] mr-[9px]">по</span>
      <DateField label="Конец периода" value={to} min={from || undefined} invalid={invalid} onChange={(v) => change({ from, to: v })} />
      {invalid ? <span className="ml-[16px] text-[13px] leading-[17px] text-sale-text">Дата начала позже даты окончания</span> : null}
      {busy ? <span className="ml-[16px] size-4 animate-spin rounded-full border-2 border-line-3 border-t-outline-hover" aria-label="Загрузка" /> : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { dayMonth, isoDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useClickOutside, useEscape } from "@/lib/hooks";

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

/** `null` — «За все время». */
export const periodKey = (p: Period | null) => (p ? `${p.from}_${p.to}` : "all");

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Период из адреса страницы: `from`/`to`, `all=1` — за все время. Без параметров — последние `days` дней
 * или (days = null) за все время.
 */
export function periodFromParams(sp: URLSearchParams | null, days: number | null = 30): Period | null {
  if (sp?.get("all") === "1") return null;
  const from = sp?.get("from");
  const to = sp?.get("to");
  if (from && to && ISO.test(from) && ISO.test(to) && from <= to) return { from, to };
  return days === null ? null : defaultPeriod(days);
}

/** Адрес страницы с выбранным периодом; `allParam` — «за все время» явным `all=1` (когда по умолчанию период). */
export function periodSearch(sp: URLSearchParams | null, p: Period | null, allParam: boolean): string {
  const next = new URLSearchParams(sp?.toString());
  next.delete("from");
  next.delete("to");
  next.delete("all");
  if (p) {
    next.set("from", p.from);
    next.set("to", p.to);
  } else if (allParam) {
    next.set("all", "1");
  }
  const s = next.toString();
  return s ? `?${s}` : "";
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** «2026-10-14» → дата в местном времени (new Date("2026-10-14") — это полночь UTC). */
function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** «2026-09-08» → «08.09.26» */
const short = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(2, 4)}`;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width={7} height={12} viewBox="0 0 7 12" fill="none" aria-hidden className={dir === "left" ? "rotate-180" : undefined}>
      <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Календарь периода «как у Петровича» для всех страниц ЛК с выбором дат (доработки R5): узкая плашка «Дата /
 * 08.09.26 - 06.11.26» с треугольником, под ней — месяц с выделенным диапазоном и «За все время».
 * Первый клик по дню — начало периода, второй — конец (порядок не важен); период применяется сразу.
 */
export function PeriodPicker({ value, onApply, busy, className }: { value: Period | null; onApply: (p: Period | null) => void; busy?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const today = isoDate(new Date());
  const [view, setView] = useState(() => monthIndex(parseDay(value?.to ?? today)));
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setStart(null);
    setHover(null);
  };
  useEscape(() => {
    close();
    button.current?.focus();
  }, open);
  useClickOutside(box, close, open);

  const apply = (p: Period | null) => {
    close();
    onApply(p);
  };

  const pick = (iso: string) => {
    if (!start) {
      setStart(iso);
      return;
    }
    apply(start <= iso ? { from: start, to: iso } : { from: iso, to: start });
  };

  // выделение: при выборе — от первого дня до дня под курсором, иначе — применённый период
  const range: [string, string] | null = start ? (hover && hover !== start ? (hover < start ? [hover, start] : [start, hover]) : [start, start]) : value ? [value.from, value.to] : null;

  const year = Math.floor(view / 12);
  const month = view % 12;
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  // шестую неделю показываем, только если в ней есть дни месяца
  const shown = cells[35].getMonth() === month ? cells : cells.slice(0, 35);

  return (
    <div ref={box} className={cn("relative inline-flex items-center gap-[16px]", className)} aria-busy={busy || undefined}>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) return close();
          setView(monthIndex(parseDay(value?.to ?? today)));
          setOpen(true);
        }}
        className={cn(
          "flex h-[52px] items-center gap-[22px] rounded-[7px] pl-[14px] pr-[16px] text-left transition-colors",
          open || value ? "bg-brand hover:bg-brand-hover" : "bg-btn hover:bg-btn-hover",
        )}
      >
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold leading-[16px] text-black">Дата</span>
          <span className="mt-[2px] whitespace-nowrap text-[14px] leading-[18px] text-g333 tnum">{value ? `${short(value.from)} - ${short(value.to)}` : "За все время"}</span>
        </span>
        <svg width={10} height={6} viewBox="0 0 10 6" aria-hidden className={cn("shrink-0 text-black transition-transform", open && "rotate-180")}>
          <path d="M0 0h10L5 6z" fill="currentColor" />
        </svg>
      </button>
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-line-3 border-t-outline-hover" aria-label="Загрузка" /> : null}

      {open ? (
        <div role="dialog" aria-label="Выбор периода" className="absolute left-0 top-[calc(100%+6px)] z-30 w-[270px] rounded-[10px] bg-white px-[12px] pb-[12px] pt-[12px] shadow-pop animate-fade-in">
          <div className="flex items-center justify-center gap-[14px]">
            <button type="button" aria-label="Предыдущий месяц" onClick={() => setView((v) => v - 1)} className="flex size-[28px] items-center justify-center rounded-[5px] text-g333 transition-colors hover:bg-btn">
              <Chevron dir="left" />
            </button>
            <p className="min-w-[150px] text-center text-[13px] font-bold uppercase leading-[20px] tracking-[0.04em] text-black" aria-live="polite">
              {MONTHS[month]} {year}
            </p>
            <button
              type="button"
              aria-label="Следующий месяц"
              disabled={view >= monthIndex(new Date())}
              onClick={() => setView((v) => v + 1)}
              className="flex size-[28px] items-center justify-center rounded-[5px] text-g333 transition-colors hover:bg-btn disabled:text-[#C4C4C4] disabled:hover:bg-transparent"
            >
              <Chevron dir="right" />
            </button>
          </div>
          <div className="mt-[8px] grid grid-cols-7 text-center" onMouseLeave={() => setHover(null)}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-[6px] text-[12px] font-medium uppercase leading-[16px] text-g333">
                {w}
              </span>
            ))}
            {shown.map((d) => {
              const iso = isoDate(d);
              const future = iso > today;
              const inRange = range !== null && iso >= range[0] && iso <= range[1];
              const edge = range !== null && (iso === range[0] || iso === range[1]);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={future}
                  aria-pressed={edge}
                  aria-label={`${dayMonth(d)} ${d.getFullYear()}`}
                  onClick={() => pick(iso)}
                  onMouseEnter={() => setHover(iso)}
                  className={cn(
                    "flex h-[34px] items-center justify-center text-[13px] font-bold leading-[16px] tnum transition-colors",
                    future ? "cursor-default text-[#C4C4C4]" : d.getMonth() === month ? "text-black" : "text-[#8A8A8A]",
                    edge ? "rounded-[4px] bg-brand" : inRange ? "bg-[#FFEAB5]" : !future && "rounded-[4px] hover:bg-btn",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <p className="mt-[6px] text-[12px] leading-[16px] text-muted">{start ? "Выберите последний день периода" : "Выберите первый день периода"}</p>
          <button
            type="button"
            onClick={() => apply(null)}
            className={cn("mt-[10px] flex h-[40px] w-full items-center justify-center rounded-[7px] text-[14px] font-medium leading-[20px] text-black transition-colors", value ? "bg-btn hover:bg-btn-hover" : "bg-brand hover:bg-brand-hover")}
          >
            За все время
          </button>
        </div>
      ) : null}
    </div>
  );
}

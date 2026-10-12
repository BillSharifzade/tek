"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { dayMonth } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useEscape } from "@/lib/hooks";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** «2026-10-14» → дата в местном времени (new Date("2026-10-14") — это полночь UTC). */
function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Номер месяца от нулевого года — удобно сравнивать и листать. */
function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width={7} height={12} viewBox="0 0 7 12" fill="none" aria-hidden className={dir === "left" ? "rotate-180" : undefined}>
      <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Поле «Дата» (Figma Group 106, 166×56) и свой календарь под ним вместо системного (доработки R4):
 * любая дата с сегодняшнего дня до `max`, кроме воскресенья; выбранная дата — жёлтая.
 * Календарь показывает текущее значение, в т.ч. выбранное кнопками «Завтра», «Вторник»… рядом (они внутри `area`),
 * и закрывается кликом в любом другом месте, Escape или выбором дня.
 */
export function DateField({
  value,
  min,
  max,
  onChange,
  invalid,
  area,
}: {
  value: string;
  /** сегодня (по Душанбе) — раньше выбрать нельзя */
  min: string;
  max: string;
  onChange: (d: string) => void;
  invalid?: boolean;
  /** блок с полем и кнопками дат: клик внутри не закрывает календарь */
  area: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const minDay = parseDay(min);
  const maxDay = parseDay(max);
  const [view, setView] = useState(() => monthIndex(value ? parseDay(value) : minDay));
  // выбрали дату снаружи (кнопками рядом) — календарь перелистывается на её месяц
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    if (value) setView(monthIndex(parseDay(value)));
  }

  useEscape(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, area]);

  const year = Math.floor(view / 12);
  const month = view % 12;
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
  const today = isoDay(minDay);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Дата доставки: ${dayMonth(parseDay(value))}` : "Выбрать дату доставки"}
        onClick={() => {
          if (!open) setView(monthIndex(value ? parseDay(value) : minDay));
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-[56px] w-[166px] items-center rounded-[7px] border bg-white pb-[4px] pl-[12px] text-left text-[14px] leading-[12px] transition-colors hover:border-outline",
          invalid ? "border-sale" : open ? "border-outline" : "border-line",
          value ? "text-black" : "text-sub",
        )}
      >
        {value ? dayMonth(parseDay(value)) : "Дата"}
      </button>

      {open ? (
        <div role="dialog" aria-label="Календарь доставки" className="absolute left-0 top-[calc(100%+6px)] z-30 w-[280px] rounded-[10px] bg-white p-[14px] shadow-pop animate-fade-in">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              disabled={view <= monthIndex(minDay)}
              onClick={() => setView((v) => v - 1)}
              className="flex size-[28px] items-center justify-center rounded-[5px] text-g333 transition-colors hover:bg-btn disabled:text-[#C4C4C4] disabled:hover:bg-transparent"
            >
              <Chevron dir="left" />
            </button>
            <p className="text-[15px] font-semibold leading-[20px] text-black" aria-live="polite">
              {MONTHS[month]} {year}
            </p>
            <button
              type="button"
              aria-label="Следующий месяц"
              disabled={view >= monthIndex(maxDay)}
              onClick={() => setView((v) => v + 1)}
              className="flex size-[28px] items-center justify-center rounded-[5px] text-g333 transition-colors hover:bg-btn disabled:text-[#C4C4C4] disabled:hover:bg-transparent"
            >
              <Chevron dir="right" />
            </button>
          </div>
          <div className="mt-[10px] grid grid-cols-7 gap-[2px] text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-[4px] text-[12px] leading-[16px] text-muted">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const iso = isoDay(d);
              const disabled = d < minDay || d > maxDay || d.getDay() === 0;
              const selected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${dayMonth(d)} ${year}${disabled ? ", доставка недоступна" : ""}`}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-[34px] items-center justify-center rounded-[6px] text-[14px] leading-[16px] tnum transition-colors",
                    selected
                      ? "bg-brand font-medium text-black"
                      : disabled
                        ? "cursor-default text-[#C4C4C4]"
                        : cn("text-black hover:bg-btn", iso === today && "shadow-[inset_0_0_0_1px_#D9DDE4]"),
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <p className="mt-[10px] text-[12px] leading-[16px] text-muted">Воскресенье — выходной, доставки нет.</p>
        </div>
      ) : null}
    </div>
  );
}

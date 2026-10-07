"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** "figma" — степпер блока цены из макета: 247×42, поле #F6F7F8, кнопки 51×42 #EEF0F2, r7 */
  variant?: "default" | "figma";
  /** не показывать число (товара нет в наличии) */
  blank?: boolean;
}

function snap(v: number, step: number, min: number, max: number | undefined): number {
  if (!Number.isFinite(v)) return min;
  let n = step > 0 ? Math.round(v / step) * step : v;
  n = Number(n.toFixed(3));
  if (n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}

export function Stepper({ value, onChange, min = 1, max, step = 1, size = "md", disabled, className, ariaLabel = "Количество", variant = "default", blank }: StepperProps) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    // controlled value changed from outside → resync the editable text (React "derive state" pattern)
    setLastValue(value);
    setText(String(value));
  }

  const h = size === "sm" ? "h-8" : size === "lg" ? "h-12" : "h-10";
  const w = size === "sm" ? "w-14" : size === "lg" ? "w-24" : "w-20";
  const btn = size === "sm" ? "w-8" : size === "lg" ? "w-12" : "w-10";

  const commit = (raw: string) => {
    // поле стёрли кликом и ничего не ввели — остаётся прежнее количество
    if (!raw.trim()) {
      setText(String(value));
      return;
    }
    const parsed = Number(raw.replace(",", ".").replace(/\s/g, ""));
    const next = snap(parsed, step, min, max);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const dec = () => onChange(snap(value - step, step, min, max));
  const inc = () => onChange(snap(value + step, step, min, max));

  const keys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
    if (e.key === "ArrowUp") {
      e.preventDefault();
      inc();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      dec();
    }
  };

  if (variant === "figma") {
    const btnCls =
      "flex w-[51px] shrink-0 items-center justify-center rounded-[7px] bg-btn text-[20px] font-light leading-[20px] text-sub transition-colors hover:bg-btn-hover disabled:hover:bg-btn";
    return (
      <div className={cn("flex h-[42px] items-stretch rounded-[7px] bg-surface", className)} role="group" aria-label={ariaLabel}>
        <button type="button" onClick={dec} disabled={disabled || value <= min} aria-label="Уменьшить" className={btnCls}>
          <span className="relative top-[-0.5px]">–</span>
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={blank ? "" : text}
          disabled={disabled}
          aria-label={ariaLabel}
          onFocus={() => setText("")}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={keys}
          className="min-w-0 flex-1 bg-transparent text-center text-[16px] font-medium leading-[12px] text-black tnum outline-none"
        />
        <button type="button" onClick={inc} disabled={disabled || (max !== undefined && value >= max)} aria-label="Увеличить" className={btnCls}>
          <span className="relative top-[-0.5px]">+</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn("inline-flex items-stretch rounded-[6px] border border-line bg-white overflow-hidden", h, disabled && "opacity-50", className)}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Уменьшить"
        className={cn("flex items-center justify-center text-ink transition-colors hover:bg-btn disabled:text-muted disabled:hover:bg-transparent", btn)}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={() => setText("")}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            inc();
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            dec();
          }
        }}
        className={cn("border-x border-line text-center text-base font-medium tnum outline-none focus:bg-brand-light/40", w)}
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (max !== undefined && value >= max)}
        aria-label="Увеличить"
        className={cn("flex items-center justify-center text-ink transition-colors hover:bg-btn disabled:text-muted disabled:hover:bg-transparent", btn)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

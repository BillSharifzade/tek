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
}

function snap(v: number, step: number, min: number, max: number | undefined): number {
  if (!Number.isFinite(v)) return min;
  let n = step > 0 ? Math.round(v / step) * step : v;
  n = Number(n.toFixed(3));
  if (n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}

export function Stepper({ value, onChange, min = 1, max, step = 1, size = "md", disabled, className, ariaLabel = "Количество" }: StepperProps) {
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
    const parsed = Number(raw.replace(",", ".").replace(/\s/g, ""));
    const next = snap(parsed, step, min, max);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const dec = () => onChange(snap(value - step, step, min, max));
  const inc = () => onChange(snap(value + step, step, min, max));

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
        className={cn("flex items-center justify-center text-ink hover:bg-surface disabled:text-muted disabled:hover:bg-transparent", btn)}
      >
        <Minus className="size-4" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-label={ariaLabel}
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
        className={cn("flex items-center justify-center text-ink hover:bg-surface disabled:text-muted disabled:hover:bg-transparent", btn)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

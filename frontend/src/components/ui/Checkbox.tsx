"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  indeterminate?: boolean;
  /** сторона квадрата в px (Figma: 18 — «Выбрать все», 16 — строки корзины) */
  box?: number;
  labelClassName?: string;
}

/**
 * Чекбокс из макета корзины (8641:438): отмечен — жёлтый #F7BF4A, r3, белая галка;
 * не отмечен — белый с рамкой #B3BAC7 (hover #4F5A6D).
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, className, labelClassName, indeterminate, box = 18, ...rest }, ref) {
  return (
    <label className={cn("group/cb inline-flex cursor-pointer select-none items-center gap-[8px] text-[14px] leading-[20px]", rest.disabled && "cursor-not-allowed opacity-50", className)}>
      <span className="relative inline-flex shrink-0" style={{ width: box, height: box }}>
        <input ref={ref} type="checkbox" className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0" {...rest} />
        <span
          aria-hidden
          className={cn(
            "flex size-full items-center justify-center rounded-[2px] border border-outline bg-white text-white transition-colors group-hover/cb:border-outline-hover",
            "peer-checked:border-[#F7BF4A] peer-checked:bg-[#F7BF4A] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
            "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
            indeterminate && "border-[#F7BF4A] bg-[#F7BF4A] [&>svg]:opacity-100",
          )}
        >
          {indeterminate ? (
            <svg width={box} height={box} viewBox="0 0 18 18" fill="none">
              <path d="M5 9h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width={box} height={box} viewBox="0 0 18 18" fill="none">
              <path d="M4.1 9l3.4 3.1 5.8-6.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      {label ? <span className={labelClassName}>{label}</span> : null}
    </label>
  );
});

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, description, className, ...rest }, ref) {
  return (
    <label className={cn("group/rd inline-flex cursor-pointer select-none items-start gap-[8px] text-[14px] leading-[20px]", rest.disabled && "cursor-not-allowed opacity-50", className)}>
      <span className="relative mt-[1px] inline-flex size-[18px] shrink-0">
        <input ref={ref} type="radio" className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0" {...rest} />
        <span
          aria-hidden
          className="size-[18px] rounded-full border border-outline bg-white transition-colors group-hover/rd:border-outline-hover peer-checked:border-[5px] peer-checked:border-[#F7BF4A] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
        />
      </span>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="font-medium">{label}</span> : null}
          {description ? <span className="text-[13px] leading-[17px] text-sub">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});

export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  return (
    <label className={cn("flex cursor-pointer select-none items-center justify-between gap-4", disabled && "cursor-not-allowed opacity-50", className)}>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-[14px] font-medium leading-[20px]">{label}</span> : null}
          {description ? <span className="text-[13px] leading-[17px] text-sub">{description}</span> : null}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-brand" : "bg-line-3")}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

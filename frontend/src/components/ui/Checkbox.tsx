"use client";

import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, className, indeterminate, ...rest }, ref) {
  return (
    <label className={cn("inline-flex items-center gap-2.5 cursor-pointer select-none text-base", rest.disabled && "opacity-50 cursor-not-allowed", className)}>
      <span className="relative inline-flex size-5 shrink-0">
        <input ref={ref} type="checkbox" className="peer absolute inset-0 size-5 cursor-pointer opacity-0" {...rest} />
        <span
          aria-hidden
          className={cn(
            "size-5 rounded-[4px] border border-muted bg-white transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2 flex items-center justify-center",
            indeterminate && "border-brand bg-brand",
          )}
        >
          {indeterminate ? (
            <span className="block h-0.5 w-2.5 rounded bg-ink" />
          ) : (
            <Check className="size-3.5 text-ink opacity-0 transition-opacity peer-checked:opacity-100 [.peer:checked~span_&]:opacity-100" strokeWidth={3} />
          )}
        </span>
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  );
});

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, description, className, ...rest }, ref) {
  return (
    <label className={cn("inline-flex items-start gap-2.5 cursor-pointer select-none text-base", rest.disabled && "opacity-50 cursor-not-allowed", className)}>
      <span className="relative mt-0.5 inline-flex size-5 shrink-0">
        <input ref={ref} type="radio" className="peer absolute inset-0 size-5 cursor-pointer opacity-0" {...rest} />
        <span
          aria-hidden
          className="size-5 rounded-full border border-muted bg-white transition-colors peer-checked:border-[6px] peer-checked:border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2"
        />
      </span>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="font-medium">{label}</span> : null}
          {description ? <span className="text-sm text-sub">{description}</span> : null}
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
    <label className={cn("flex items-center justify-between gap-4 cursor-pointer select-none", disabled && "opacity-50 cursor-not-allowed", className)}>
      {label || description ? (
        <span className="flex flex-col">
          {label ? <span className="text-base font-medium">{label}</span> : null}
          {description ? <span className="text-sm text-sub">{description}</span> : null}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")}
        />
      </button>
    </label>
  );
}

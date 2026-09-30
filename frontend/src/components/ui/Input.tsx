import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Поле из макета: высота 36, рамка #D9DDE4 1px, r5, текст 14px, плейсхолдер #808080.
 * hover — рамка #B3BAC7, focus — #4F5A6D. pb-2px: глифы стоят как в Figma (14/12 по центру 36).
 */
const control =
  "block w-full h-[36px] rounded-[5px] border border-line-3 bg-white px-[13px] pb-[2px] pt-0 text-[14px] leading-[20px] text-black placeholder:text-muted transition-colors hover:border-outline focus:border-outline-hover focus:outline-none disabled:bg-surface disabled:text-sub";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  left?: ReactNode;
  right?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, left, right, ...rest }, ref) {
  if (left || right) {
    return (
      <div className="relative">
        {left ? <span className="pointer-events-none absolute left-[12px] top-1/2 flex -translate-y-1/2 text-sub">{left}</span> : null}
        <input
          ref={ref}
          className={cn(control, left ? "pl-[36px]" : null, right ? "pr-[36px]" : null, invalid && "border-sale hover:border-sale focus:border-sale", className)}
          {...rest}
        />
        {right ? <span className="absolute right-[12px] top-1/2 flex -translate-y-1/2 text-sub">{right}</span> : null}
      </div>
    );
  }
  return <input ref={ref} className={cn(control, invalid && "border-sale hover:border-sale focus:border-sale", className)} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(control, "h-auto min-h-[72px] resize-y py-[8px]", invalid && "border-sale hover:border-sale focus:border-sale", className)}
      {...rest}
    />
  );
});

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-[6px]", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[14px] leading-[18px] text-sub">
          {label}
          {required ? <span className="text-sale"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[13px] leading-[17px] text-sale" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-[17px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

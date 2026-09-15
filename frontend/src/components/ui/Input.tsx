import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full h-10 rounded-[6px] border border-line bg-white px-3 text-base text-ink placeholder:text-muted transition-colors hover:border-muted focus:border-ink focus:outline-none disabled:bg-surface disabled:text-sub";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  left?: ReactNode;
  right?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, left, right, ...rest }, ref) {
  if (left || right) {
    return (
      <div className="relative">
        {left ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sub">{left}</span> : null}
        <input
          ref={ref}
          className={cn(control, left ? "pl-9" : null, right ? "pr-9" : null, invalid && "border-sale focus:border-sale", className)}
          {...rest}
        />
        {right ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sub">{right}</span> : null}
      </div>
    );
  }
  return <input ref={ref} className={cn(control, invalid && "border-sale focus:border-sale", className)} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(control, "h-auto min-h-[96px] resize-y py-2.5", invalid && "border-sale focus:border-sale", className)}
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-sm text-sub">
          {label}
          {required ? <span className="text-sale"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-sm text-sale" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-sub">{hint}</p>
      ) : null}
    </div>
  );
}

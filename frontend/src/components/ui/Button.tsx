import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Кнопки по ТЗ/макету:
 *  primary   — жёлтая заливка #FFCC33 → hover #FED75B
 *  secondary — серая заливка #EEF0F2 → hover #D9DDE3
 *  outline   — серая обводка #B3BAC7 → hover #4F5A6D
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "dark" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium text-[14px] rounded-[6px] transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-black hover:bg-brand-hover",
  secondary: "bg-btn text-black hover:bg-btn-hover",
  outline: "border border-outline bg-white text-g333 hover:border-outline-hover hover:text-black",
  ghost: "bg-transparent text-g333 hover:bg-btn hover:text-black",
  danger: "bg-sale-bg text-sale-text hover:bg-[#f7d3d3]",
  dark: "bg-black text-white hover:bg-g333",
  link: "bg-transparent text-info hover:text-black px-0 h-auto",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-[32px] px-[16px] leading-[15px]",
  md: "h-[44px] px-[24px] leading-[15px]",
  lg: "h-[54px] px-[24px] text-[16px] leading-[20px] rounded-[7px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  full?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, full, icon, className, children, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(base, variants[variant], variant !== "link" && sizes[size], full && "w-full", className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
  target?: string;
  rel?: string;
}

export function ButtonLink({ href, variant = "primary", size = "md", full, icon, className, children, prefetch, target, rel }: ButtonLinkProps) {
  const cls = cn(base, variants[variant], variant !== "link" && sizes[size], full && "w-full", className);
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={cls} target={target ?? "_blank"} rel={rel ?? "noopener noreferrer"}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} prefetch={prefetch} target={target} rel={rel}>
      {icon}
      {children}
    </Link>
  );
}

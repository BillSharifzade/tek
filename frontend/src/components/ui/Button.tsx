import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold rounded-[6px] transition-colors select-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-ink hover:bg-brand-hover active:bg-[#dcab22]",
  dark: "bg-ink text-white hover:bg-ink-hover",
  secondary: "bg-white text-ink border border-line hover:border-muted hover:bg-surface-2",
  ghost: "bg-transparent text-ink hover:bg-surface",
  danger: "bg-sale text-white hover:bg-[#c0100b]",
  link: "bg-transparent text-info hover:underline px-0 h-auto font-medium",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-5 text-base",
  lg: "h-12 px-6 text-md",
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

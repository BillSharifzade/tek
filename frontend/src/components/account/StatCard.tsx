import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  href?: string;
  hint?: React.ReactNode;
  tone?: "default" | "brand" | "danger";
  className?: string;
}

/** Dashboard widget: icon, small label, large value. */
export function StatCard({ icon: Icon, label, value, href, hint, tone = "default", className }: StatCardProps) {
  const inner = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[8px]",
          tone === "brand" ? "bg-brand text-ink" : tone === "danger" ? "bg-sale/10 text-sale" : "bg-surface text-ink",
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-sub">{label}</span>
        <span className={cn("block truncate font-semibold tnum", typeof value === "string" && value.length > 14 ? "text-base leading-6" : "text-xl", tone === "danger" && "text-sale")} title={typeof value === "string" ? value : undefined}>
          {value}
        </span>
        {hint ? <span className="block text-xs text-sub">{hint}</span> : null}
      </span>
    </>
  );
  const cls = cn("flex items-center gap-3 rounded-[8px] border border-line bg-white p-4", href && "transition-colors hover:border-brand", className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

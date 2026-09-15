import type { Badge as BadgeKind } from "@/lib/types";
import { cn } from "@/lib/cn";

const styles: Record<BadgeKind | "discount", string> = {
  sale: "bg-sale text-white",
  hit: "bg-brand text-ink",
  new: "bg-success text-white",
  discount: "bg-ink text-white",
};

const labels: Record<BadgeKind, string> = {
  sale: "Распродажа",
  hit: "Хит продаж",
  new: "Новинка",
};

export function Badge({ kind, children, className }: { kind: BadgeKind | "discount"; children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-[4px] px-2 text-xs font-semibold leading-none", styles[kind], className)}>
      {children ?? (kind === "discount" ? null : labels[kind])}
    </span>
  );
}

export function BadgeList({ badges, discountPct, className }: { badges: BadgeKind[]; discountPct?: number; className?: string }) {
  if (badges.length === 0 && !discountPct) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <Badge key={b} kind={b} />
      ))}
      {discountPct ? <Badge kind="discount">-{Math.round(discountPct)}%</Badge> : null}
    </div>
  );
}

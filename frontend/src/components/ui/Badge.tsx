import type { Badge as BadgeKind } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Плашки товара (Figma «Инфо поле»): 17px, r3, Roboto Medium 11/12, отступ текста 6px. */
const styles: Record<BadgeKind | "discount", string> = {
  sale: "bg-sale-bg text-sale-text",
  hit: "bg-hit-bg text-hit",
  new: "bg-new-bg text-new",
  discount: "bg-[#00ba00] text-white",
};

export const BADGE_LABELS: Record<BadgeKind, string> = {
  sale: "Распродажа",
  hit: "Хит продаж",
  new: "Новинка",
};

const ORDER: BadgeKind[] = ["sale", "hit", "new"];

export function Badge({ kind, children, className }: { kind: BadgeKind | "discount"; children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block h-[17px] whitespace-nowrap rounded-[3px] px-[6px] pt-[2.5px] text-[11px] font-medium leading-[12px]", styles[kind], className)}>
      {children ?? (kind === "discount" ? null : BADGE_LABELS[kind])}
    </span>
  );
}

/** Вертикальная стопка плашек с шагом 22px (17 + 5), как на карточке товара. */
export function BadgeList({ badges, discountPct, className, row }: { badges: BadgeKind[]; discountPct?: number; className?: string; row?: boolean }) {
  if (badges.length === 0 && !discountPct) return null;
  const sorted = ORDER.filter((b) => badges.includes(b));
  return (
    <div className={cn("flex items-start", row ? "flex-row gap-[6px]" : "flex-col gap-[5px]", className)}>
      {sorted.map((b) => (
        <Badge key={b} kind={b} />
      ))}
      {discountPct ? <Badge kind="discount">-{Math.round(discountPct)}%</Badge> : null}
    </div>
  );
}

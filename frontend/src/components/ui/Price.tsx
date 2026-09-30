import type { Price as PriceT } from "@/lib/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface PriceProps {
  price: PriceT;
  unitLabel?: string; // "за шт" | "за метр"
  size?: "sm" | "md" | "lg" | "xl";
  showSavings?: boolean;
  className?: string;
}

const sizes = {
  sm: "text-base font-semibold",
  md: "text-lg font-semibold",
  lg: "text-2xl font-bold",
  xl: "text-4xl font-bold",
};

/** Price with struck list price and savings when discounted / on sale. */
export function Price({ price, unitLabel, size = "md", showSavings = true, className }: PriceProps) {
  const discounted = price.price < price.list - 0.004;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tnum", className)}>
      <span className={cn(sizes[size], "text-ink whitespace-nowrap")}>{money(price.price)}</span>
      {unitLabel ? <span className="text-sm text-sub">{unitLabel}</span> : null}
      {discounted ? (
        <>
          <span className="text-sm text-muted line-through whitespace-nowrap">{money(price.list)}</span>
          {showSavings && price.savings > 0 ? (
            <span className="text-sm font-medium text-sale whitespace-nowrap">выгода {money(price.savings)}</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function Cashback({ amount, className }: { amount: number; className?: string }) {
  if (!amount || amount <= 0) return null;
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full bg-brand-light px-2.5 text-xs font-semibold text-ink tnum", className)}>
      Кешбэк {money(amount)}
    </span>
  );
}

/** "1 029,00 с." → ["1 029", ",00 с."] */
export function splitMoney(value: number): [string, string] {
  const s = money(value);
  const i = s.lastIndexOf(",");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i)];
}

/**
 * Цена как в макете: целая часть крупно, копейки и «с.» мельче (Figma: 20/800 + 14/800 и т.п.).
 */
export function SplitPrice({
  value,
  big = 20,
  small = 14,
  weight = 800,
  lh = 20,
  strike,
  className,
}: {
  value: number;
  big?: number;
  small?: number;
  weight?: number;
  lh?: number;
  strike?: boolean;
  className?: string;
}) {
  const [a, b] = splitMoney(value);
  return (
    <span className={cn("whitespace-nowrap tnum", strike && "line-through", className)} style={{ fontWeight: weight, lineHeight: `${lh}px` }}>
      <span style={{ fontSize: big }}>{a}</span>
      <span style={{ fontSize: small }}>{b}</span>
    </span>
  );
}

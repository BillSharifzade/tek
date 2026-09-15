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

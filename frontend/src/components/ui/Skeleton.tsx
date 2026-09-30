import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Каркас карточки «Товар» 226×483: фото 226², рейтинг/код, наличие, название, цена, кнопки. */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-[483px] w-full flex-col xl:w-[226px]">
      <Skeleton className="aspect-square w-full rounded-[8px]" />
      <div className="mt-[14px] flex justify-between">
        <Skeleton className="h-[14px] w-[96px]" />
        <Skeleton className="h-[14px] w-[48px]" />
      </div>
      <Skeleton className="mt-[10px] h-[14px] w-[120px]" />
      <Skeleton className="mt-[12px] h-[14px] w-full" />
      <Skeleton className="mt-[7px] h-[14px] w-4/5" />
      <Skeleton className="mt-auto h-[12px] w-[90px]" />
      <Skeleton className="mt-[8px] h-[20px] w-[110px]" />
      <div className="mt-[14px] flex gap-[10px]">
        <Skeleton className="h-[32px] flex-1" />
        <Skeleton className="h-[32px] w-[110px]" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 8, cols = 4 }: { count?: number; cols?: 4 | 5 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:justify-between xl:gap-x-0",
        cols === 5 ? "xl:grid-cols-[repeat(5,226px)] xl:gap-y-[48px]" : "xl:grid-cols-[repeat(4,226px)] xl:gap-y-[82px]",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

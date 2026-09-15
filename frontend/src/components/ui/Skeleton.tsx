import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-line bg-white p-4">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function GridSkeleton({ count = 8, cols = 4 }: { count?: number; cols?: 4 | 5 }) {
  return (
    <div className={cn("grid gap-4", cols === 5 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4")}>
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

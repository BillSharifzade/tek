import { GridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-page mt-5">
      <Skeleton className="h-[320px] w-full rounded-[8px]" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="mt-14 h-7 w-64" />
      <div className="mt-6">
        <GridSkeleton count={5} cols={5} />
      </div>
    </div>
  );
}

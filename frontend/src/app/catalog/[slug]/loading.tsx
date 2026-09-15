import { GridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-page">
      <Skeleton className="my-4 h-4 w-72" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="hidden h-[520px] lg:block" />
        <div>
          <div className="mb-5 flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-48" />
          </div>
          <GridSkeleton count={8} cols={4} />
        </div>
      </div>
    </div>
  );
}

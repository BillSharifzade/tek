import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-page">
      <Skeleton className="my-4 h-4 w-96" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_520px]">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandsView } from "@/components/admin/BrandsView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Бренды" };

export default function AdminBrandsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[300px] rounded-[7px]" />}>
      <BrandsView />
    </Suspense>
  );
}

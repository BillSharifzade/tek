import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsView } from "@/components/admin/ProductsView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Товары" };

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[347px] rounded-[7px]" />}>
      <ProductsView />
    </Suspense>
  );
}

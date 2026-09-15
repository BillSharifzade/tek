import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersView } from "@/components/account/OrdersView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Заказы" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <OrdersView />
    </Suspense>
  );
}

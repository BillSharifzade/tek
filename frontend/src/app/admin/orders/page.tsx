import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersView } from "@/components/admin/OrdersView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Заказы" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[347px] rounded-[7px]" />}>
      <OrdersView />
    </Suspense>
  );
}

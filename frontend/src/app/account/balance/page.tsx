import type { Metadata } from "next";
import { Suspense } from "react";
import { BalanceView } from "@/components/account/BalanceView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Баланс" };

export default function BalancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <BalanceView />
    </Suspense>
  );
}

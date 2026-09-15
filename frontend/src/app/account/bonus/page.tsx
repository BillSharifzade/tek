import type { Metadata } from "next";
import { Suspense } from "react";
import { BonusView } from "@/components/account/BonusView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Бонусная карта" };

export default function BonusPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <BonusView />
    </Suspense>
  );
}

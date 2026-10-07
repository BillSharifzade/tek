import type { Metadata } from "next";
import { Suspense } from "react";
import { OutboxView } from "@/components/admin/OutboxView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Интеграции" };

export default function AdminOutboxPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[347px] rounded-[7px]" />}>
      <OutboxView />
    </Suspense>
  );
}

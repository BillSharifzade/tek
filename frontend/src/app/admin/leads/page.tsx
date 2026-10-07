import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadsView } from "@/components/admin/LeadsView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Заявки" };

export default function AdminLeadsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[347px] rounded-[7px]" />}>
      <LeadsView />
    </Suspense>
  );
}

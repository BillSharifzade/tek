import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsAdminView } from "@/components/admin/NewsAdminView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Новости" };

export default function AdminNewsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[300px] rounded-[7px]" />}>
      <NewsAdminView />
    </Suspense>
  );
}

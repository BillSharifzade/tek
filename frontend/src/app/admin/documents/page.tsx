import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsView } from "@/components/admin/DocumentsView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Документы" };

export default function AdminDocumentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[300px] rounded-[7px]" />}>
      <DocumentsView />
    </Suspense>
  );
}

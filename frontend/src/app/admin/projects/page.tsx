import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsAdminView } from "@/components/admin/ProjectsAdminView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Проекты" };

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[300px] rounded-[7px]" />}>
      <ProjectsAdminView />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersView } from "@/components/admin/UsersView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Пользователи" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[347px] rounded-[7px]" />}>
      <UsersView />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewsView } from "@/components/admin/ReviewsView";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Отзывы и вопросы" };

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[347px] rounded-[7px]" />}>
      <ReviewsView />
    </Suspense>
  );
}

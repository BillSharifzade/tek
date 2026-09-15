import type { Metadata } from "next";
import { ReviewsView } from "@/components/account/ReviewsView";

export const metadata: Metadata = { title: "Отзывы и вопросы" };

export default function ReviewsPage() {
  return <ReviewsView />;
}

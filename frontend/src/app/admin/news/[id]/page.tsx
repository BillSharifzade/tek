import type { Metadata } from "next";
import { NewsEditView } from "@/components/admin/NewsAdminView";

export const metadata: Metadata = { title: "Новость" };

export default async function AdminNewsItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewsEditView id={id} />;
}

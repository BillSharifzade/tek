import type { Metadata } from "next";
import { ProductEditView } from "@/components/admin/ProductEditView";

export const metadata: Metadata = { title: "Карточка товара" };

export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditView id={decodeURIComponent(id)} />;
}

import type { Metadata } from "next";
import { OrderDetailView } from "@/components/admin/OrderDetailView";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await params;
  return { title: `Заказ №${number}` };
}

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <OrderDetailView number={decodeURIComponent(number)} />;
}

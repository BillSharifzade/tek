import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SharedCartView } from "@/components/cart/SharedCartView";

export const metadata: Metadata = { title: "Корзина, которой поделились" };

export default async function SharedCartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="container-page">
      <Breadcrumbs items={[{ href: "/cart", label: "Корзина" }, { label: "Общая корзина" }]} />
      <h1 className="mb-2">Корзина, которой с вами поделились</h1>
      <p className="mb-6 text-sub">Состав и количество товаров сохранены. Цены пересчитаны для вашего аккаунта.</p>
      <SharedCartView token={token} />
    </div>
  );
}

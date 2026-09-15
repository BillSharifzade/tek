import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Корзина" };

export default function CartPage() {
  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Корзина" }]} />
      <h1 className="mb-6">Корзина</h1>
      <CartView />
    </div>
  );
}

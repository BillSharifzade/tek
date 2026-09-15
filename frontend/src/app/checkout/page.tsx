import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = { title: "Оформление заказа" };

export default function CheckoutPage() {
  return (
    <div className="container-page">
      <Breadcrumbs items={[{ href: "/cart", label: "Корзина" }, { label: "Оформление заказа" }]} />
      <h1 className="mb-6">Оформление заказа</h1>
      <CheckoutView />
    </div>
  );
}

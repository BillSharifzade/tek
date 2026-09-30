import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Корзина" };

/** Figma «Корзина» 8641:438: заголовок @126,162 (26/12 Bold), без хлебных крошек. */
export default function CartPage() {
  return (
    <div className="container-page pb-[80px] pt-[48px]">
      <h1 className="text-[26px] font-bold leading-[12px] text-black">Корзина</h1>
      <CartView />
    </div>
  );
}

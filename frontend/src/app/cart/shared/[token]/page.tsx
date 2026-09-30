import type { Metadata } from "next";
import { SharedCartView } from "@/components/cart/SharedCartView";

export const metadata: Metadata = { title: "Корзина, которой поделились" };

export default async function SharedCartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="container-page pb-[80px] pt-[48px]">
      <h1 className="text-[26px] font-bold leading-[12px] text-black">Корзина, которой с вами поделились</h1>
      <p className="mt-[20px] text-[14px] leading-[20px] text-sub">Состав и количество товаров сохранены. Цены пересчитаны для вашего аккаунта.</p>
      <SharedCartView token={token} />
    </div>
  );
}

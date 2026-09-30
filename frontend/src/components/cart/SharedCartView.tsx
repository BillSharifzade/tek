"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Cart } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { CartItemRow } from "./CartItemRow";
import { CartSummary } from "./CartSummary";
import { bigYellowBtn } from "./parts";

export function SharedCartView({ token }: { token: string }) {
  const router = useRouter();
  const setCart = useCart((s) => s.setCart);
  const [cart, setShared] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get<Cart>(`/cart/shared/${token}`)
      .then((c) => {
        if (!cancelled) setShared(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError && e.status === 404 ? "Ссылка на корзину недействительна или устарела." : "Не удалось загрузить корзину.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="mt-[31px] flex max-w-[831px] flex-col items-center rounded-[7px] bg-surface px-6 py-[56px] text-center">
        <p className="text-[20px] font-bold leading-[24px]">{error}</p>
        <Link href="/catalog" className={cn(bigYellowBtn, "mt-[24px] w-auto px-[32px]")}>
          Перейти в каталог
        </Link>
      </div>
    );
  }
  if (!cart) return <Skeleton className="mt-[31px] h-64" />;

  const apply = async () => {
    setBusy(true);
    try {
      const c = await client.post<Cart>(`/cart/shared/${token}/apply`);
      setCart(c);
      toast.success("Товары добавлены в вашу корзину", { actionLabel: "Перейти в корзину", actionHref: "/cart" });
      router.push("/cart");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось добавить товары");
      setBusy(false);
    }
  };

  return (
    <div className="mt-[31px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-[85px]">
      <ul className="min-w-0">
        {cart.items.map((item) => (
          <CartItemRow key={item.id} item={item} readOnly onQty={() => undefined} onSelect={() => undefined} onRemove={() => undefined} />
        ))}
      </ul>
      <div className="lg:sticky lg:top-[134px] lg:self-start">
        <CartSummary
          cart={cart}
          action={
            <button type="button" className={bigYellowBtn} onClick={apply} disabled={busy}>
              {busy ? "Добавляем…" : "Добавить в мою корзину"}
            </button>
          }
          note="Цены показаны с учётом условий вашего аккаунта."
        />
      </div>
    </div>
  );
}

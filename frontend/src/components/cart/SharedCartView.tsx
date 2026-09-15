"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Cart } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CartItemRow } from "./CartItemRow";
import { CartSummary } from "./CartSummary";

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
      <div className="rounded-[8px] border border-dashed border-line py-16 text-center">
        <p className="text-lg font-semibold">{error}</p>
        <ButtonLink href="/catalog" className="mt-6">
          Перейти в каталог
        </ButtonLink>
      </div>
    );
  }
  if (!cart) return <Skeleton className="h-64" />;

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ul className="rounded-[8px] border border-line bg-white px-5">
        {cart.items.map((item) => (
          <CartItemRow key={item.id} item={item} readOnly onQty={() => undefined} onSelect={() => undefined} onRemove={() => undefined} />
        ))}
      </ul>
      <div className="lg:sticky lg:top-[100px] lg:self-start">
        <CartSummary
          cart={cart}
          action={
            <Button full size="lg" onClick={apply} loading={busy}>
              Добавить в мою корзину
            </Button>
          }
          note="Цены показаны с учётом условий вашего аккаунта."
        />
      </div>
    </div>
  );
}

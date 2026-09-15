"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Info, Package, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { money, qty as fmtQty, unitLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCart } from "@/store/cart";
import { inCity, useCity } from "@/store/city";
import { useAuth } from "@/store/auth";
import { useHydrated } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { Badge } from "@/components/ui/Badge";
import { Cashback } from "@/components/ui/Price";
import { FavoriteButton } from "./FavoriteButton";

export function BuyBox({ product }: { product: Product }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.cart?.items.find((i) => i.product.id === product.id) ?? null);
  const city = useCity((s) => s.city);
  const user = useAuth((s) => s.user);

  const step = product.pack?.qty && product.pack.qty > 0 ? product.pack.qty : 1;
  const [qty, setQty] = useState(step);
  const [busy, setBusy] = useState<"cart" | "checkout" | null>(null);

  const total = useMemo(() => Math.round(qty * product.price.price * 100) / 100, [qty, product.price.price]);
  const cashback = useMemo(() => Math.round(qty * product.price.cashback * 100) / 100, [qty, product.price.cashback]);
  const unitPriceLabel = unitLabel(product.unit);
  const priceTitle = product.unit === "м" ? "Цена за метр" : "Цена за штуку";
  const stockHere = product.stock.find((s) => s.city === (hydrated ? city : "Душанбе"));
  const others = product.stock.filter((s) => s !== stockHere);

  const addToCart = async () => {
    setBusy("cart");
    try {
      await add(product.id, qty);
    } catch {
      /* toast from store */
    } finally {
      setBusy(null);
    }
  };
  const buyNow = async () => {
    setBusy("checkout");
    try {
      await add(product.id, qty, { silent: true });
      router.push("/checkout");
    } catch {
      setBusy(null);
    }
  };

  const discounted = product.price.price < product.price.list - 0.004;

  return (
    <div className="rounded-[8px] border border-line bg-white p-6">
      {product.short_description ? <p className="mb-4 text-base text-sub">{product.short_description}</p> : null}

      {product.group && product.group.siblings.length > 0 ? (
        <div className="mb-5">
          <p className="mb-2 text-sm text-sub">
            {product.group.param_name}: <span className="font-semibold text-ink">{product.group.siblings.find((s) => s.slug === product.slug)?.param_value ?? ""}</span>
          </p>
          <ul className="flex flex-wrap gap-2" aria-label={product.group.param_name}>
            {product.group.siblings.map((s) => {
              const active = s.slug === product.slug;
              return (
                <li key={s.slug}>
                  <Link
                    href={`/product/${s.slug}`}
                    prefetch
                    aria-current={active ? "page" : undefined}
                    aria-disabled={!s.in_stock}
                    className={cn(
                      "inline-flex h-9 min-w-[52px] items-center justify-center rounded-[6px] border px-3 text-base font-medium transition-colors",
                      active ? "border-brand bg-brand text-ink" : "border-line bg-white hover:border-ink",
                      !s.in_stock && !active && "border-dashed text-muted hover:border-line",
                    )}
                    title={s.in_stock ? `Код: ${s.code}` : "Нет в наличии"}
                  >
                    {s.param_value}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-sub">{priceTitle}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 tnum">
            <span className="text-4xl font-bold leading-none">{money(product.price.price)}</span>
            {discounted ? (
              <>
                <span className="text-base text-muted line-through">{money(product.price.list)}</span>
                {product.price.savings > 0 ? <span className="text-base font-semibold text-sale">выгода {money(product.price.savings)}</span> : null}
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {product.price.sale ? <Badge kind="sale" /> : null}
            {hydrated && user && product.price.discount_pct > 0 ? (
              <span className="inline-flex h-6 items-center rounded-[4px] bg-brand-light px-2 text-xs font-semibold">Ваша скидка {Math.round(product.price.discount_pct)}%</span>
            ) : null}
            {hydrated && user ? <Cashback amount={product.price.cashback} /> : null}
          </div>
        </div>
        <FavoriteButton product={product} withLabel />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Stepper value={qty} onChange={setQty} min={step} step={step} max={product.stock_total > 0 ? Math.max(product.stock_total, step) : undefined} size="lg" disabled={!product.in_stock} />
        <span className="text-base text-sub tnum">
          {money(product.price.price)} {unitPriceLabel}
        </span>
        <span className="ml-auto text-2xl font-bold tnum">{money(total)}</span>
      </div>
      {product.pack ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-sub">
          <Package className="size-4" />
          Кратность упаковки: {product.pack.label}
        </p>
      ) : null}
      {hydrated && user && cashback > 0 ? <p className="mt-1 text-sm text-sub">Кешбэк на бонусный счёт: {money(cashback)}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {hydrated && inCart ? (
          <Link href="/cart" className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-success/40 bg-success/10 text-md font-semibold text-success hover:bg-success/15">
            <Check className="size-5" strokeWidth={2.5} />В корзине ({fmtQty(inCart.qty)} {product.unit})
          </Link>
        ) : (
          <Button size="lg" onClick={addToCart} loading={busy === "cart"} disabled={!product.in_stock || busy !== null} icon={<ShoppingCart className="size-5" />}>
            В корзину
          </Button>
        )}
        <Button size="lg" variant="dark" onClick={buyNow} loading={busy === "checkout"} disabled={!product.in_stock || busy !== null}>
          Оформить заказ
        </Button>
      </div>

      <ul className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4 text-base">
        {stockHere ? (
          <li className="flex flex-wrap gap-x-2">
            <span className={stockHere.qty > 0 ? "text-ink" : "text-sale"}>
              {inCity(stockHere.city)}: {stockHere.qty > 0 ? `${fmtQty(stockHere.qty)} ${product.unit}` : "нет в наличии"}
            </span>
            {stockHere.qty > 0 ? <span className="text-sub">Доставка: {stockHere.delivery_hint}</span> : null}
          </li>
        ) : null}
        {others.map((s) => (
          <li key={s.store_id} className="flex flex-wrap gap-x-2 text-sm text-sub">
            <span>
              {s.city === stockHere?.city ? s.name : inCity(s.city)}: {s.qty > 0 ? `${fmtQty(s.qty)} ${product.unit}` : "нет в наличии"}
            </span>
            {s.qty > 0 ? <span>Доставка: {s.delivery_hint}</span> : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 rounded-[6px] bg-brand-light px-3 py-2.5 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">Бесплатная пуско-наладка</span> и расчет специалиста
        </span>
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Accessory, Product } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { CartItemRow } from "./CartItemRow";
import { CartSummary } from "./CartSummary";
import { AddProductPanel } from "./AddProductPanel";
import { AccessoriesModal, SaveEstimateModal, ShareCartModal } from "./CartModals";
import { IconDownload, IconEstimate, IconShare, IconTrash } from "./icons";
import { bigYellowBtn } from "./parts";

const actionCls = "link-hover flex items-center text-[14px] leading-[12px] text-sub disabled:pointer-events-none disabled:opacity-50";

function CartSkeleton() {
  return (
    <div className="mt-[31px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-[85px]">
      <div>
        <Skeleton className="h-[18px] w-full" />
        <Skeleton className="mt-[21px] h-[50px] w-full" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="mt-[27px] flex gap-[16px]">
            <Skeleton className="size-[81px]" />
            <div className="flex-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="mt-4 h-3 w-2/3" />
              <Skeleton className="mt-4 h-3 w-1/2" />
              <Skeleton className="mt-4 h-8 w-36" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-[324px] lg:mt-[4px]" />
    </div>
  );
}

export function CartView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const { cart, loaded, loading, update, remove, removeSelected, selectAll, applyCoupon, removeCoupon } = useCart();
  const [accessoriesFor, setAccessoriesFor] = useState<{ name: string; items: Accessory[] } | null>(null);
  const [accBusy, setAccBusy] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!hydrated || !loaded) return <CartSkeleton />;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mt-[31px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-[85px]">
        <div>
          <AddProductPanel />
          <div className="mt-[27px] flex flex-col items-center rounded-[7px] bg-surface px-6 py-[56px] text-center">
            <p className="text-[20px] font-bold leading-[24px]">Корзина пуста</p>
            <p className="mt-[8px] max-w-[420px] text-[14px] leading-[20px] text-sub">
              Найдите товар по коду или названию выше либо перейдите в каталог — персональные цены и кэшбэк рассчитаются автоматически.
            </p>
            <Link href="/catalog" className={cn(bigYellowBtn, "mt-[24px] w-auto px-[32px]")}>
              Перейти в каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allSelected = cart.items.every((i) => i.selected);
  const someSelected = cart.items.some((i) => i.selected);
  const selectedCount = cart.items.filter((i) => i.selected).length;
  const hasErrors = cart.items.some((i) => i.selected && (i.error || i.qty > i.stock_total));

  const openAccessories = async (slug: string, name: string) => {
    if (accBusy) return;
    setAccBusy(slug);
    try {
      const p = await client.get<Product>(`/catalog/products/${slug}`);
      setAccessoriesFor({ name, items: p.accessories });
    } catch {
      toast.error("Не удалось загрузить комплектующие");
    } finally {
      setAccBusy(null);
    }
  };

  const exportXlsx = async () => {
    setBusy("export");
    try {
      await downloadFile("/cart/export.xlsx", `smeta-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось скачать смету");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const r = await client.post<{ token: string; url: string }>("/cart/share");
      setShareUrl(`${window.location.origin}/cart/shared/${r.token}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось поделиться корзиной");
    } finally {
      setBusy(null);
    }
  };

  const saveEstimate = async (name: string) => {
    setBusy("save");
    try {
      await client.post("/cart/estimates", { name: name.trim() || `Смета от ${new Date().toLocaleDateString("ru-RU")}` });
      toast.success("Смета сохранена", { actionLabel: "Мои сметы", actionHref: "/account/estimates" });
      setSaveOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить смету");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-[31px] grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-[85px]">
      <div className="min-w-0">
        {/* Figma Group 58 @127,205 830×18 */}
        <div className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-3 lg:h-[18px] lg:flex-nowrap">
          <div className="flex items-center">
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              onChange={(e) => void selectAll(e.target.checked)}
              label="Выбрать все"
              labelClassName="mt-[2px] leading-[12px] text-sub"
              className="ml-[1px] hover:[&>span:last-child]:text-black"
            />
            <button type="button" disabled={!someSelected || loading} onClick={() => void removeSelected()} className={cn(actionCls, "ml-[21px] gap-[4px]")}>
              <IconTrash className="shrink-0" />
              <span className="mt-[2px]">Удалить выбранные ({selectedCount})</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
            <button type="button" onClick={exportXlsx} disabled={busy === "export"} className={cn(actionCls, "gap-[5px]")}>
              <IconDownload className="mt-[2px] shrink-0" />
              <span className="mt-[2px]">Скачать смету</span>
            </button>
            <button
              type="button"
              onClick={() => (user ? setSaveOpen(true) : router.push("/login?next=/cart"))}
              title={user ? undefined : "Войдите, чтобы сохранить смету"}
              className={cn(actionCls, "gap-[5px]")}
            >
              <IconEstimate className="shrink-0" />
              <span className="mt-[2px]">Сохранить смету</span>
            </button>
            <button type="button" onClick={share} disabled={busy === "share"} className={cn(actionCls, "gap-[4px]")}>
              <IconShare className="mt-[1px] shrink-0" />
              <span className="mt-[2px]">Поделиться</span>
            </button>
          </div>
        </div>

        <div className="mt-[21px]">
          <AddProductPanel />
        </div>

        <ul className={cn("mt-[27px] transition-opacity", loading && "opacity-70")}>
          {cart.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onQty={(q) => void update(item.id, { qty: q }).catch(() => undefined)}
              onSelect={(s) => void update(item.id, { selected: s }).catch(() => undefined)}
              onRemove={() => void remove(item.id).catch(() => undefined)}
              onAccessories={() => void openAccessories(item.product.slug, item.product.name)}
            />
          ))}
        </ul>
      </div>

      <div className="lg:sticky lg:top-[134px] lg:mt-[4px] lg:self-start">
        <CartSummary
          cart={cart}
          deliveryPrice={null}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={removeCoupon}
          action={
            <button type="button" className={bigYellowBtn} disabled={!someSelected || hasErrors || loading} onClick={() => router.push("/checkout")}>
              Оформить заказ
            </button>
          }
          note={
            hasErrors ? (
              <span className="text-sale">Количество некоторых товаров больше остатка — уменьшите его, чтобы оформить заказ.</span>
            ) : !user ? (
              <>
                <Link href="/login?next=/cart" className="link-hover text-link">
                  Войдите
                </Link>
                , чтобы увидеть персональные цены и кэшбэк.
              </>
            ) : null
          }
        />
      </div>

      <AccessoriesModal data={accessoriesFor} onClose={() => setAccessoriesFor(null)} />
      <ShareCartModal url={shareUrl} onClose={() => setShareUrl(null)} />
      <SaveEstimateModal open={saveOpen} busy={busy === "save"} onClose={() => setSaveOpen(false)} onSave={(n) => void saveEstimate(n)} />
    </div>
  );
}

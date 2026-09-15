"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Save, Share2, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Accessory, Product } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Accessories } from "@/components/product/Accessories";
import { CartItemRow } from "./CartItemRow";
import { CartSummary } from "./CartSummary";

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-[8px] border border-line bg-white px-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-line py-5 last:border-b-0">
            <Skeleton className="size-24" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-4 h-10 w-40" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function CartView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const { cart, loaded, loading, update, remove, removeSelected, selectAll, applyCoupon, removeCoupon } = useCart();
  const [accessoriesFor, setAccessoriesFor] = useState<{ name: string; items: Accessory[] } | null>(null);
  const [accBusy, setAccBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (!hydrated || !loaded) return <CartSkeleton />;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[8px] border border-dashed border-line py-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-surface">
          <ShoppingCart className="size-7 text-muted" />
        </span>
        <p className="mt-5 text-lg font-semibold">Корзина пуста</p>
        <p className="mt-1 max-w-sm text-sm text-sub">Добавьте товары из каталога — персональные цены и кешбэк рассчитаются автоматически.</p>
        <ButtonLink href="/catalog" className="mt-6">
          Перейти в каталог
        </ButtonLink>
      </div>
    );
  }

  const allSelected = cart.items.every((i) => i.selected);
  const someSelected = cart.items.some((i) => i.selected);
  const selectedCount = cart.items.filter((i) => i.selected).length;
  const hasErrors = cart.items.some((i) => i.selected && (i.error || i.qty > i.stock_total));

  const openAccessories = async (slug: string, name: string) => {
    setAccBusy(true);
    try {
      const p = await client.get<Product>(`/catalog/products/${slug}`);
      setAccessoriesFor({ name, items: p.accessories });
    } catch {
      toast.error("Не удалось загрузить комплектующие");
    } finally {
      setAccBusy(false);
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
      const url = `${window.location.origin}/cart/shared/${r.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка на корзину скопирована");
      } catch {
        toast.info(`Ссылка: ${url}`);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось поделиться корзиной");
    } finally {
      setBusy(null);
    }
  };

  const saveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    try {
      await client.post("/cart/estimates", { name: saveName.trim() || `Смета от ${new Date().toLocaleDateString("ru-RU")}` });
      toast.success("Смета сохранена", { actionLabel: "Мои сметы", actionHref: "/account/estimates" });
      setSaveOpen(false);
      setSaveName("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить смету");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-t-[8px] border border-b-0 border-line bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={(e) => selectAll(e.target.checked)} label="Выбрать все" />
            <button
              type="button"
              disabled={!someSelected || loading}
              onClick={() => removeSelected()}
              className="inline-flex items-center gap-1.5 text-sm text-sub transition-colors hover:text-sale disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Удалить выбранные ({selectedCount})
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <button type="button" onClick={exportXlsx} disabled={busy === "export"} className="inline-flex items-center gap-1.5 font-medium hover:text-brand-hover disabled:opacity-50">
              <Download className="size-4" />
              Скачать смету
            </button>
            <button
              type="button"
              onClick={() => (user ? setSaveOpen(true) : router.push("/login?next=/cart"))}
              className="inline-flex items-center gap-1.5 font-medium hover:text-brand-hover"
            >
              <Save className="size-4" />
              Сохранить смету
            </button>
            <button type="button" onClick={share} disabled={busy === "share"} className="inline-flex items-center gap-1.5 font-medium hover:text-brand-hover disabled:opacity-50">
              <Share2 className="size-4" />
              Поделиться
            </button>
          </div>
        </div>
        <ul className={`rounded-b-[8px] border border-line bg-white px-5 ${loading ? "opacity-70" : ""}`}>
          {cart.items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onQty={(q) => update(item.id, { qty: q })}
              onSelect={(s) => update(item.id, { selected: s })}
              onRemove={() => remove(item.id)}
              onAccessories={accBusy ? undefined : () => openAccessories(item.product.slug, item.product.name)}
            />
          ))}
        </ul>
      </div>

      <div className="lg:sticky lg:top-[100px] lg:self-start">
        <CartSummary
          cart={cart}
          deliveryPrice={null}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={removeCoupon}
          action={
            <Button full size="lg" disabled={!someSelected || hasErrors || loading} onClick={() => router.push("/checkout")}>
              Оформить заказ
            </Button>
          }
          note={hasErrors ? <span className="text-sale">Исправьте количество у товаров с ошибкой наличия.</span> : "Стоимость доставки рассчитается при оформлении заказа."}
        />
        {!user ? (
          <p className="mt-3 text-center text-xs text-sub">
            <Link href="/login?next=/cart" className="text-info hover:underline">
              Войдите
            </Link>
            , чтобы увидеть персональные цены и кешбэк.
          </p>
        ) : null}
      </div>

      <Modal open={accessoriesFor !== null} onClose={() => setAccessoriesFor(null)} title={`Комплектующие — ${accessoriesFor?.name ?? ""}`} drawer>
        {accessoriesFor ? <Accessories items={accessoriesFor.items} compact /> : null}
      </Modal>

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Сохранить смету" size="sm">
        <form onSubmit={saveEstimate} className="flex flex-col gap-4">
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Название сметы" aria-label="Название сметы" autoFocus />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={busy === "save"}>
              Сохранить
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

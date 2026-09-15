"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { date, money, qty as fmtQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ImageBox } from "@/components/ui/ImageBox";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Input";
import { StatusBadge, StatusTimeline } from "./OrderStatus";
import { EmptyState, ErrorLine, PageTitle, errorMessage } from "./shared";

/** Extra fields the backend returns beyond the base contract. */
type OrderData = Order & {
  contact?: { first_name: string; last_name: string; phone: string; email: string };
  manager?: { name: string; phone: string; email: string } | null;
  delivery: Order["delivery"] & { date_label?: string | null };
  payment: Order["payment"] & { sublabel?: string | null };
  subtotal_list?: number;
  coupon_code?: string | null;
};

interface EditItem {
  product_id: string;
  qty: number;
}

export function OrderDetailView({ number }: { number: string }) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get<OrderData>(`/account/orders/${number}`)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        setState("ok");
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setState("notfound");
        else {
          setState("error");
          setError(errorMessage(e, "Не удалось загрузить заказ"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  const startEdit = () => {
    if (!order) return;
    setEditItems(order.items.map((i) => ({ product_id: i.product.id, qty: i.qty })));
    setEditComment(order.comment ?? "");
    setEditing(true);
  };

  const setQty = (productId: string, q: number) => setEditItems((items) => items.map((i) => (i.product_id === productId ? { ...i, qty: q } : i)));
  const removeItem = (productId: string) => setEditItems((items) => items.filter((i) => i.product_id !== productId));

  const saveEdit = async () => {
    if (editItems.length === 0) {
      toast.error("В заказе должен остаться хотя бы один товар");
      return;
    }
    setSaving(true);
    try {
      const o = await client.put<OrderData>(`/account/orders/${number}`, { items: editItems, comment: editComment.trim() || null });
      setOrder(o);
      setEditing(false);
      toast.success("Заказ обновлён. Изменения отправлены менеджеру");
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить изменения"));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      const o = await client.post<OrderData>(`/account/orders/${number}/cancel`, {});
      setOrder(o);
      setConfirmCancel(false);
      toast.success("Заказ отменён");
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось отменить заказ"));
    } finally {
      setCancelling(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (state === "notfound") {
    return (
      <div className="flex flex-col gap-4">
        <PageTitle>Заказ №{number}</PageTitle>
        <EmptyState>
          Заказ не найден.{" "}
          <Link href="/account/orders" className="text-info hover:underline">
            К списку заказов
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (!order) return <ErrorLine error={error} />;

  const receiving = [
    order.delivery.method_label,
    order.delivery.address,
    order.delivery.store,
    order.delivery.date ? (order.delivery.date_label ?? date(order.delivery.date)) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-sub hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />К списку заказов
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tnum">Заказ №{order.number}</h2>
          <StatusBadge status={order.status} label={order.status_label} />
        </div>
        <span className="text-sm text-sub tnum">от {date(order.created_at)}</span>
      </div>

      <div className="rounded-[8px] border border-line bg-white p-6">
        <StatusTimeline order={order} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard title="Получение">{receiving}</InfoCard>
        <InfoCard title="Оплата">
          {order.payment.method_label}
          {order.payment.sublabel ? ` (${order.payment.sublabel})` : ""}
          <span className="block text-sm text-sub">{order.payment.status_label}</span>
          {order.due_date ? <span className="block text-sm text-sub tnum">Срок оплаты: {date(order.due_date)}</span> : null}
        </InfoCard>
        <InfoCard title="Комментарий">{order.comment ? order.comment : <span className="text-sub">—</span>}</InfoCard>
      </div>

      <section className="rounded-[8px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h3>Состав заказа</h3>
          {!editing ? (
            <div className="flex gap-2">
              {order.can_edit ? (
                <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={startEdit}>
                  Редактировать
                </Button>
              ) : null}
              {order.can_cancel ? (
                <Button variant="secondary" size="sm" className="text-sale hover:border-sale" icon={<X className="size-4" />} onClick={() => setConfirmCancel(true)}>
                  Отменить заказ
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Отмена
              </Button>
              <Button size="sm" loading={saving} onClick={saveEdit}>
                Сохранить изменения
              </Button>
            </div>
          )}
        </div>

        <ul className="divide-y divide-line">
          {order.items.map((i) => {
            const edit = editItems.find((e) => e.product_id === i.product.id);
            const removed = editing && !edit;
            return (
              <li key={i.product.id} className={cn("flex flex-wrap items-center gap-4 px-6 py-4", removed && "opacity-40")}>
                <ImageBox src={i.product.image} alt={i.product.name} className="size-16 shrink-0 border border-line" sizes="64px" rounded="rounded-[6px]" />
                <div className="min-w-[200px] flex-1">
                  <Link href={`/product/${i.product.slug}`} className="line-clamp-2 text-base font-medium hover:text-brand-hover">
                    {i.product.name}
                  </Link>
                  <p className="text-xs text-sub tnum">
                    Код: {i.product.code} · {money(i.price.price)} {i.product.price_unit_label}
                    {i.price.discount_pct > 0 ? <span className="ml-2 text-success">−{i.price.discount_pct}%</span> : null}
                  </p>
                </div>
                {editing ? (
                  removed ? (
                    <button type="button" className="text-sm text-info hover:underline" onClick={() => setEditItems((items) => [...items, { product_id: i.product.id, qty: i.qty }])}>
                      Вернуть
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Stepper value={edit?.qty ?? i.qty} onChange={(q) => setQty(i.product.id, q)} min={1} max={i.product.stock_total || undefined} size="sm" />
                      <span className="text-sm text-sub">{i.product.unit}</span>
                      <button type="button" onClick={() => removeItem(i.product.id)} className="rounded p-1 text-sub hover:bg-surface hover:text-sale" aria-label="Удалить из заказа">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                ) : (
                  <span className="text-sm text-sub tnum">
                    {fmtQty(i.qty)} {i.product.unit}
                  </span>
                )}
                {!editing ? <span className="w-[120px] text-right text-base font-semibold tnum">{money(i.line_total)}</span> : null}
              </li>
            );
          })}
        </ul>

        {editing ? (
          <div className="border-t border-line px-6 py-4">
            <label htmlFor="order-comment" className="mb-1.5 block text-sm text-sub">
              Комментарий к заказу
            </label>
            <Textarea id="order-comment" value={editComment} onChange={(e) => setEditComment(e.target.value)} className="min-h-[72px]" />
            <p className="mt-2 text-xs text-sub">Итоговая сумма будет пересчитана по вашим персональным ценам после сохранения.</p>
          </div>
        ) : (
          <dl className="ml-auto flex max-w-[360px] flex-col gap-1.5 px-6 py-4 text-base tnum">
            <Row label={`Товары (${order.items.length})`} value={money(order.subtotal_list ?? order.subtotal + order.discount_total)} />
            {order.discount_total > 0 ? <Row label="Скидка" value={`− ${money(order.discount_total)}`} className="text-success" /> : null}
            {order.coupon_discount > 0 ? <Row label={`Купон${order.coupon_code ? ` ${order.coupon_code}` : ""}`} value={`− ${money(order.coupon_discount)}`} className="text-success" /> : null}
            <Row label="Доставка" value={order.delivery_price > 0 ? money(order.delivery_price) : "бесплатно"} />
            <Row label="Итого" value={money(order.total)} className="mt-1 border-t border-line pt-2 text-lg font-semibold" />
            {order.cashback_total > 0 ? <Row label="Кешбэк" value={money(order.cashback_total)} className="text-sm" valueClassName="rounded bg-brand px-1.5 py-0.5 text-xs font-semibold" /> : null}
            {order.paid_amount > 0 || order.remaining > 0 ? (
              <>
                <Row label="Оплачено" value={money(order.paid_amount)} className="text-sm text-sub" />
                {order.status !== "cancelled" && order.remaining > 0 ? <Row label="Остаток" value={money(order.remaining)} className="text-sm text-sale" /> : null}
              </>
            ) : null}
          </dl>
        )}
      </section>

      {order.manager ? (
        <p className="text-sm text-sub">
          Ваш менеджер по заказу: <span className="font-medium text-ink">{order.manager.name}</span>, {order.manager.phone}
        </p>
      ) : null}

      <section className="rounded-[8px] border border-line bg-white p-6">
        <h3 className="mb-3">История</h3>
        <ol className="flex flex-col gap-2">
          {order.events.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="flex items-start gap-3 text-base">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="flex-1">{e.label}</span>
              <span className="shrink-0 text-sm text-sub tnum">{formatDateTime(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {order.status === "delivered" ? (
        <div>
          <ButtonLink href="/catalog" variant="secondary">
            Повторить покупки в каталоге
          </ButtonLink>
        </div>
      ) : null}

      <Modal
        open={confirmCancel}
        onClose={() => (cancelling ? undefined : setConfirmCancel(false))}
        title="Отменить заказ?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
              Нет, оставить
            </Button>
            <Button variant="danger" loading={cancelling} onClick={cancel}>
              Да, отменить
            </Button>
          </div>
        }
      >
        <p className="text-base">
          Заказ №{order.number} будет отменён, резерв на складе снят, а менеджер получит уведомление. Это действие нельзя отменить.
        </p>
      </Modal>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line bg-white p-5">
      <p className="mb-1 text-sm text-sub">{title}</p>
      <div className="text-base font-medium">{children}</div>
    </div>
  );
}

function Row({ label, value, className, valueClassName }: { label: string; value: string; className?: string; valueClassName?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6", className)}>
      <dt className="text-sub">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date(d)} ${hh}:${mm}`;
}

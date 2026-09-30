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
import { Card, CardTitle, EmptyState, ErrorLine, errorMessage, fieldCls } from "./shared";

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
      <div className="flex flex-col gap-[16px] lg:gap-[27px]" aria-busy>
        <Skeleton className="h-[140px] rounded-[10px]" />
        <Skeleton className="h-[320px] rounded-[10px]" />
      </div>
    );
  }
  if (state === "notfound") {
    return (
      <Card>
        <CardTitle>Заказ №{number}</CardTitle>
        <EmptyState className="mt-[21px]">
          Заказ не найден.{" "}
          <Link href="/account/orders" className="text-black underline underline-offset-[3px]">
            К списку заказов
          </Link>
        </EmptyState>
      </Card>
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
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <CardTitle
          right={
            <span className="flex items-center gap-[12px]">
              <span className="text-[14px] leading-[20px] text-sub tnum">от {date(order.created_at)}</span>
              <StatusBadge status={order.status} label={order.status_label} />
            </span>
          }
        >
          Статус заказа
        </CardTitle>
        <div className="mt-[24px]">
          <StatusTimeline order={order} />
        </div>
        <dl className="mt-[26px] grid grid-cols-1 gap-[16px] border-t border-line pt-[20px] md:grid-cols-3 md:gap-[27px]">
          <Info title="Получение">{receiving}</Info>
          <Info title="Оплата">
            {order.payment.method_label}
            {order.payment.sublabel ? ` (${order.payment.sublabel})` : ""}
            <span className="block font-normal text-sub">{order.payment.status_label}</span>
            {order.due_date && order.status !== "cancelled" ? <span className="block font-normal text-sub tnum">Срок оплаты: {date(order.due_date)}</span> : null}
          </Info>
          <Info title="Комментарий">{order.comment ? order.comment : <span className="font-normal text-muted">—</span>}</Info>
        </dl>
      </Card>

      <Card>
        <CardTitle
          right={
            !editing ? (
              order.can_edit || order.can_cancel ? (
                <div className="flex flex-wrap gap-[10px]">
                  {order.can_edit ? (
                    <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={startEdit}>
                      Редактировать
                    </Button>
                  ) : null}
                  {order.can_cancel ? (
                    <Button variant="danger" icon={<X className="size-4" aria-hidden />} onClick={() => setConfirmCancel(true)}>
                      Отменить заказ
                    </Button>
                  ) : null}
                </div>
              ) : null
            ) : (
              <div className="flex flex-wrap gap-[10px]">
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  Отмена
                </Button>
                <Button loading={saving} onClick={saveEdit}>
                  Сохранить изменения
                </Button>
              </div>
            )
          }
        >
          Состав заказа
        </CardTitle>

        <ul className="mt-[21px] divide-y divide-line border-y border-line">
          {order.items.map((i) => {
            const edit = editItems.find((e) => e.product_id === i.product.id);
            const removed = editing && !edit;
            return (
              <li key={i.product.id} className={cn("flex flex-wrap items-center gap-x-[16px] gap-y-[10px] py-[14px]", removed && "opacity-40")}>
                <ImageBox src={i.product.image} alt={i.product.name} className="size-[64px] shrink-0 border border-line" sizes="64px" rounded="rounded-[7px]" />
                <div className="min-w-[200px] flex-1">
                  <Link href={`/product/${i.product.slug}`} className="line-clamp-2 text-[14px] font-medium leading-[20px] text-black underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-black">
                    {i.product.name}
                  </Link>
                  <p className="mt-[2px] text-[13px] leading-[18px] text-sub tnum">
                    Код: {i.product.code} · {money(i.price.price)} {i.product.price_unit_label}
                    {i.price.discount_pct > 0 ? <span className="ml-[8px] text-[#00A000]">−{i.price.discount_pct}%</span> : null}
                  </p>
                </div>
                {editing ? (
                  removed ? (
                    <button type="button" className="text-[14px] leading-[20px] text-sub underline underline-offset-[3px] hover:text-black" onClick={() => setEditItems((items) => [...items, { product_id: i.product.id, qty: i.qty }])}>
                      Вернуть
                    </button>
                  ) : (
                    <div className="flex items-center gap-[10px]">
                      <Stepper value={edit?.qty ?? i.qty} onChange={(q) => setQty(i.product.id, q)} min={1} max={i.product.stock_total || undefined} size="sm" />
                      <span className="text-[14px] text-sub">{i.product.unit}</span>
                      <button type="button" onClick={() => removeItem(i.product.id)} className="flex size-[32px] items-center justify-center rounded-[6px] text-sub transition-colors hover:bg-sale-bg hover:text-sale-text" aria-label="Удалить из заказа">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                ) : (
                  <span className="text-[14px] leading-[20px] text-sub tnum">
                    {fmtQty(i.qty)} {i.product.unit}
                  </span>
                )}
                {!editing ? <span className="w-[120px] text-right text-[14px] font-medium leading-[20px] tnum">{money(i.line_total)}</span> : null}
              </li>
            );
          })}
        </ul>

        {editing ? (
          <div className="mt-[20px]">
            <Textarea aria-label="Комментарий к заказу" placeholder="Комментарий к заказу" value={editComment} onChange={(e) => setEditComment(e.target.value)} className={cn(fieldCls, "h-auto min-h-[72px] py-[8px]")} />
            <p className="mt-[8px] text-[13px] leading-[18px] text-sub">Итоговая сумма будет пересчитана по вашим персональным ценам после сохранения; менеджер получит обновление заказа.</p>
          </div>
        ) : (
          <dl className="ml-auto mt-[16px] flex max-w-[344px] flex-col gap-[6px] text-[14px] leading-[20px] tnum">
            <Row label={`Товары (${order.items.length})`} value={money(order.subtotal_list ?? order.subtotal + order.discount_total)} />
            {order.discount_total > 0 ? <Row label="Скидка" value={`− ${money(order.discount_total)}`} valueClassName="text-[#0FB500]" /> : null}
            {order.coupon_discount > 0 ? <Row label={`Купон${order.coupon_code ? ` ${order.coupon_code}` : ""}`} value={`− ${money(order.coupon_discount)}`} valueClassName="text-[#0FB500]" /> : null}
            <Row label="Доставка" value={order.delivery_price > 0 ? money(order.delivery_price) : "бесплатно"} />
            <Row label="Итого" value={money(order.total)} className="mt-[6px] border-t border-line pt-[10px] text-[19px] font-semibold leading-[24px]" labelClassName="text-black" />
            {order.cashback_total > 0 ? <Row label="Кешбэк на бонусный счёт" value={`+ ${money(order.cashback_total)}`} valueClassName="font-medium" /> : null}
            {order.paid_amount > 0 || order.remaining > 0 ? (
              <>
                <Row label="Оплачено" value={money(order.paid_amount)} />
                {order.status !== "cancelled" && order.remaining > 0 ? <Row label="Остаток" value={money(order.remaining)} valueClassName="text-[#D13B3E]" /> : null}
              </>
            ) : null}
          </dl>
        )}
      </Card>

      <Card>
        <CardTitle>История заказа</CardTitle>
        <ol className="mt-[21px] flex flex-col gap-[10px]">
          {order.events.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="flex items-start gap-[12px] text-[14px] leading-[20px]">
              <span className="mt-[7px] size-[6px] shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="flex-1">{e.label}</span>
              <span className="shrink-0 text-[13px] text-muted tnum">{formatDateTime(e.at)}</span>
            </li>
          ))}
        </ol>
        {order.manager ? (
          <p className="mt-[20px] border-t border-line pt-[16px] text-[14px] leading-[20px] text-sub">
            Менеджер по заказу: <span className="font-medium text-black">{order.manager.name}</span>,{" "}
            <a href={`tel:${order.manager.phone.replace(/[^\d+]/g, "")}`} className="link-hover tnum">
              {order.manager.phone}
            </a>
          </p>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-[10px]">
        <ButtonLink href="/account/orders" variant="outline" icon={<ArrowLeft className="size-4" aria-hidden />}>
          К списку заказов
        </ButtonLink>
        {order.status === "delivered" ? (
          <ButtonLink href="/catalog" variant="secondary">
            Повторить покупки в каталоге
          </ButtonLink>
        ) : null}
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => (cancelling ? undefined : setConfirmCancel(false))}
        title="Отменить заказ?"
        size="sm"
        footer={
          <div className="flex justify-end gap-[10px]">
            <Button variant="outline" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
              Нет, оставить
            </Button>
            <Button variant="danger" loading={cancelling} onClick={cancel}>
              Да, отменить
            </Button>
          </div>
        }
      >
        <p className="text-[14px] leading-[20px]">
          Заказ №{order.number} будет отменён, резерв на складе снят, а менеджер получит уведомление. Это действие нельзя отменить.
        </p>
      </Modal>
    </div>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[14px] leading-[20px] text-sub">{title}</dt>
      <dd className="mt-[4px] text-[14px] font-medium leading-[20px] text-black">{children}</dd>
    </div>
  );
}

function Row({ label, value, className, labelClassName, valueClassName }: { label: string; value: string; className?: string; labelClassName?: string; valueClassName?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-[24px]", className)}>
      <dt className={cn("text-sub", labelClassName)}>{label}</dt>
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

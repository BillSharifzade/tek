"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { useState } from "react";
import { adminApi, type AdminOrderDetail } from "@/lib/admin-api";
import type { AdminManager, AdminOrder } from "@/lib/admin-types";
import { downloadFile, ensureFreshAccess } from "@/lib/client";
import { cn } from "@/lib/cn";
import { date, money, phoneHref, qty as fmtQty } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ImageBox } from "@/components/ui/ImageBox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge, StatusTimeline } from "@/components/account/OrderStatus";
import { Card, CardTitle, EmptyState, btnCls, errorMessage, fieldCls, labelCls } from "@/components/account/shared";
import {
  ConfirmModal,
  ErrorLine,
  INTEGRATION_LABEL,
  InfoRow,
  ORDER_ACTION_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_TRANSITIONS,
  SYNC_STATUS_LABEL,
  dateTime,
  fullName,
  label,
  parseNum,
  useLoad,
} from "./shared";

/** Карточка заказа для менеджера: состав, покупатель, получение и оплата, смена статуса, приём оплаты, менеджер, история. */
export function OrderDetailView({ number }: { number: string }) {
  const order = useLoad(`order:${number}`, () => adminApi.order(number), "Не удалось загрузить заказ");
  // служебные поля (компания, синхронизация с CRM/складом, менеджер) — из админского списка
  const meta = useLoad(`order-meta:${number}`, () => adminApi.orders({ q: number }).then((r) => r.find((o) => o.number === number) ?? null));
  const managers = useLoad("managers", () => adminApi.managers(), "Список менеджеров недоступен");

  if (order.data === null) {
    if (order.error) {
      return (
        <Card>
          <CardTitle>Заказ №{number}</CardTitle>
          {order.status === 404 ? (
            <EmptyState className="mt-[21px]">
              Заказ не найден.{" "}
              <Link href="/admin/orders" className="text-black underline underline-offset-[3px]">
                К списку заказов
              </Link>
            </EmptyState>
          ) : (
            <ErrorLine error={order.error} className="mt-[21px]" />
          )}
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-[16px] lg:gap-[27px]" aria-busy>
        <Skeleton className="h-[180px] rounded-[7px]" />
        <Skeleton className="h-[320px] rounded-[7px]" />
      </div>
    );
  }

  const o = order.data;
  const m = meta.data;
  const setOrder = (next: AdminOrderDetail) => order.mutate(() => next);

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <StatusCard
        order={o}
        onChange={(next) => {
          setOrder(next);
          meta.reload();
        }}
      />

      <ItemsCard order={o} />

      <div className="grid grid-cols-1 gap-[16px] lg:gap-[27px] xl:grid-cols-2">
        <Card>
          <CardTitle>Покупатель</CardTitle>
          <dl className="mt-[21px] flex flex-col gap-[6px]">
            <InfoRow title="Контакт">{(o.contact ? fullName(o.contact) : m ? fullName(m) : "") || "—"}</InfoRow>
            <InfoRow title="Телефон">
              {(o.contact?.phone ?? m?.phone) ? (
                <a href={phoneHref(o.contact?.phone ?? m?.phone ?? "")} className="link-hover tnum">
                  {o.contact?.phone ?? m?.phone}
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow title="E-mail">{(o.contact?.email ?? m?.email) ? <a href={`mailto:${o.contact?.email ?? m?.email}`} className="link-hover">{o.contact?.email ?? m?.email}</a> : "—"}</InfoRow>
            {m?.company_name ? <InfoRow title="Компания">{m.company_name}</InfoRow> : null}
            <InfoRow title="Комментарий">{o.comment ? <span className="font-normal">{o.comment}</span> : <span className="font-normal text-muted">—</span>}</InfoRow>
          </dl>
        </Card>

        <Card>
          <CardTitle>Получение и оплата</CardTitle>
          <dl className="mt-[21px] flex flex-col gap-[6px]">
            <InfoRow title="Получение">{o.delivery.method_label}</InfoRow>
            {o.delivery.address ? <InfoRow title="Адрес">{o.delivery.address}</InfoRow> : null}
            {o.delivery.store ? (
              <InfoRow title="Склад">
                {o.delivery.store.name}
                <span className="block font-normal text-[#555]">{o.delivery.store.address}</span>
              </InfoRow>
            ) : null}
            {o.delivery.date ? <InfoRow title="Дата">{o.delivery.date_label ?? date(o.delivery.date)}</InfoRow> : null}
            <InfoRow title="Оплата">
              {o.payment.method_label}
              {o.payment.sublabel ? <span className="font-normal text-[#555]"> ({o.payment.sublabel})</span> : null}
              <span className="block font-normal text-[#555]">{o.payment.status_label}</span>
            </InfoRow>
            {o.due_date && o.status !== "cancelled" ? (
              <InfoRow title="Срок оплаты">
                <span className="tnum">{date(o.due_date)}</span>
              </InfoRow>
            ) : null}
            {m ? (
              <InfoRow title="Интеграции">
                <span className="font-normal">
                  {INTEGRATION_LABEL.crm}: {label(SYNC_STATUS_LABEL, m.crm_status)} · {INTEGRATION_LABEL.reservation}: {label(SYNC_STATUS_LABEL, m.reservation_status)}
                </span>
              </InfoRow>
            ) : null}
          </dl>
          {o.payment.method === "invoice" ? <InvoiceLink number={o.number} /> : null}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-[16px] lg:gap-[27px] xl:grid-cols-2">
        <PaymentCard key={`${o.paid_amount}`} order={o} onChange={setOrder} />
        <ManagerCard
          key={`${m?.manager_id ?? o.manager?.email ?? ""}`}
          order={o}
          meta={m}
          managers={managers.data}
          managersError={managers.error}
          onSaved={(next) => {
            setOrder(next);
            meta.reload();
          }}
        />
      </div>

      <Card>
        <CardTitle>История заказа</CardTitle>
        <ol className="mt-[21px] flex flex-col gap-[10px]">
          {o.events.map((e, i) => (
            <li key={`${e.kind}-${i}`} className="flex items-start gap-[12px] text-[15px] leading-[20px]">
              <span className="mt-[7px] size-[6px] shrink-0 rounded-full bg-brand" aria-hidden />
              <span className="flex-1">{e.label}</span>
              <span className="shrink-0 text-[13px] text-muted tnum">{dateTime(e.at)}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-wrap gap-[10px]">
        <ButtonLink href="/admin/orders" variant="outline" className={btnCls} icon={<ArrowLeft className="size-4" aria-hidden />}>
          К списку заказов
        </ButtonLink>
      </div>
    </div>
  );
}

function StatusCard({ order: o, onChange }: { order: AdminOrderDetail; onChange: (o: AdminOrderDetail) => void }) {
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = ORDER_TRANSITIONS[o.status] ?? [];

  const apply = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await adminApi.setOrderStatus(o.number, target);
      onChange(r);
      toast.success(`Статус заказа: ${label(ORDER_STATUS_LABEL, target)}`);
      setTarget(null);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось изменить статус"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle
        right={
          <span className="flex items-center gap-[12px]">
            <span className={cn(labelCls, "tnum")}>от {dateTime(o.created_at)}</span>
            <StatusBadge status={o.status} label={o.status_label} />
          </span>
        }
      >
        Статус заказа
      </CardTitle>
      <div className="mt-[24px]">
        <StatusTimeline order={o} />
      </div>
      {next.length > 0 ? (
        <div className="mt-[24px] flex flex-wrap items-center gap-[10px] border-t border-line pt-[20px]">
          <span className={cn(labelCls, "mr-[6px]")}>Перевести в статус:</span>
          {next.map((s, i) => (
            <Button key={s} variant={s === "cancelled" ? "danger" : i === 0 ? "primary" : "secondary"} className={cn(btnCls, s === "cancelled" && "sm:ml-auto")} onClick={() => setTarget(s)}>
              {ORDER_ACTION_LABEL[s] ?? label(ORDER_STATUS_LABEL, s)}
            </Button>
          ))}
        </div>
      ) : null}
      <ConfirmModal
        open={target !== null}
        title={target === "cancelled" ? "Отменить заказ?" : "Изменить статус?"}
        confirmLabel={target === "cancelled" ? "Да, отменить" : "Изменить"}
        danger={target === "cancelled"}
        busy={busy}
        onConfirm={apply}
        onClose={() => setTarget(null)}
      >
        {target === "cancelled" ? (
          <>Заказ №{o.number} будет отменён, резерв на складе снят, клиент получит уведомление. Это действие нельзя отменить.</>
        ) : (
          <>
            Заказ №{o.number}: «{o.status_label}» → «{label(ORDER_STATUS_LABEL, target)}». Изменение уйдёт в CRM, клиент увидит новый статус в личном кабинете.
            {target === "delivered" && o.payment.method === "cash" && o.remaining > 0 ? " Оплата наличными будет зачтена автоматически." : null}
          </>
        )}
      </ConfirmModal>
    </Card>
  );
}

function ItemsCard({ order: o }: { order: AdminOrderDetail }) {
  return (
    <Card>
      <CardTitle>Состав заказа</CardTitle>
      <ul className="mt-[21px] divide-y divide-line border-y border-line">
        {o.items.map((i) => (
          <li key={i.product.id} className="flex flex-wrap items-center gap-x-[16px] gap-y-[10px] py-[14px]">
            <ImageBox src={i.product.image} alt={i.product.name} className="size-[56px] shrink-0 border border-line" sizes="56px" rounded="rounded-[7px]" />
            <div className="min-w-[200px] flex-1">
              <Link href={`/product/${i.product.slug}`} target="_blank" className="line-clamp-2 text-[15px] font-medium leading-[20px] text-black underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-black">
                {i.product.name}
              </Link>
              <p className="mt-[2px] text-[13px] leading-[18px] text-[#555] tnum">
                Код: {i.product.code} · {money(i.price.price)} {i.product.price_unit_label}
                {i.price.discount_pct > 0 ? <span className="ml-[8px] text-[#00A000]">−{i.price.discount_pct}%</span> : null}
              </p>
            </div>
            <span className={cn(labelCls, "tnum")}>
              {fmtQty(i.qty)} {i.product.unit}
            </span>
            <span className="w-[130px] text-right text-[15px] font-semibold leading-[20px] tnum">{money(i.line_total)}</span>
          </li>
        ))}
      </ul>
      <dl className="ml-auto mt-[16px] flex max-w-[360px] flex-col gap-[6px] text-[15px] leading-[20px] tnum">
        <Row label={`Товары (${o.items.length})`} value={money(o.subtotal_list ?? o.subtotal + o.discount_total)} />
        {o.discount_total > 0 ? <Row label="Скидка" value={`− ${money(o.discount_total)}`} valueClassName="text-[#0FB500]" /> : null}
        {o.coupon_discount > 0 ? <Row label={`Купон${o.coupon_code ? ` ${o.coupon_code}` : ""}`} value={`− ${money(o.coupon_discount)}`} valueClassName="text-[#0FB500]" /> : null}
        <Row label="Доставка" value={o.delivery_price > 0 ? money(o.delivery_price) : "бесплатно"} />
        <Row label="Итого" value={money(o.total)} className="mt-[6px] border-t border-line pt-[10px] text-[19px] font-semibold leading-[24px]" labelClassName="text-black" />
        {o.cashback_total > 0 ? <Row label="Кешбэк клиенту" value={`+ ${money(o.cashback_total)}`} /> : null}
        <Row label="Оплачено" value={money(o.paid_amount)} />
        {o.status !== "cancelled" && o.remaining > 0 ? <Row label="Остаток" value={money(o.remaining)} valueClassName="text-[#D13B3E]" /> : null}
      </dl>
    </Card>
  );
}

function PaymentCard({ order: o, onChange }: { order: AdminOrderDetail; onChange: (o: AdminOrderDetail) => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = o.status !== "cancelled" && o.remaining > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const a = amount.trim() ? parseNum(amount) : null;
    if (amount.trim() && (a === null || a <= 0 || a > o.remaining + 0.001)) {
      setError(`Сумма — больше 0 и не больше остатка ${money(o.remaining)}`);
      return;
    }
    setBusy(true);
    try {
      const r = await adminApi.registerPayment(o.number, { ...(a !== null ? { amount: a } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      onChange(r);
      toast.success(`Оплата ${money(a ?? o.remaining)} зарегистрирована`);
    } catch (err) {
      setError(errorMessage(err, "Не удалось зарегистрировать оплату"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="payment">
      <CardTitle>Оплата</CardTitle>
      <dl className="mt-[21px] flex flex-col gap-[6px]">
        <InfoRow title="Сумма заказа">
          <span className="tnum">{money(o.total)}</span>
        </InfoRow>
        <InfoRow title="Оплачено">
          <span className="tnum">{money(o.paid_amount)}</span>
        </InfoRow>
        <InfoRow title="Остаток">
          <span className={cn("tnum", open && "text-[#D13B3E]")}>{money(o.status === "cancelled" ? 0 : o.remaining)}</span>
        </InfoRow>
      </dl>
      {open ? (
        <form className="mt-[20px] border-t border-line pt-[18px]" onSubmit={submit}>
          <p className={labelCls}>Поступление (перевод по счёту, в том числе частичный). Пустая сумма — весь остаток.</p>
          <div className="mt-[12px] flex flex-wrap gap-[10px]">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Сумма, до ${money(o.remaining)}`} aria-label="Сумма оплаты" className={cn(fieldCls, "w-[190px] tnum")} />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий (№ платёжки)" aria-label="Комментарий к оплате" maxLength={300} className={cn(fieldCls, "min-w-[180px] flex-1")} />
          </div>
          <ErrorLine error={error} className="mt-[12px]" />
          <Button type="submit" className={cn(btnCls, "mt-[14px]")} loading={busy}>
            Зарегистрировать оплату
          </Button>
        </form>
      ) : (
        <p className={cn("mt-[20px] border-t border-line pt-[16px]", labelCls)}>{o.status === "cancelled" ? "Заказ отменён." : "Заказ оплачен полностью."}</p>
      )}
    </Card>
  );
}

function ManagerCard({
  order: o,
  meta,
  managers,
  managersError,
  onSaved,
}: {
  order: AdminOrderDetail;
  meta: AdminOrder | null;
  managers: AdminManager[] | null;
  managersError: string | null;
  onSaved: (o: AdminOrderDetail) => void;
}) {
  const currentId = meta?.manager_id ?? managers?.find((x) => o.manager && x.email === o.manager.email)?.id ?? "";
  const [value, setValue] = useState(currentId);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!value) return;
    setBusy(true);
    try {
      const r = await adminApi.setOrderManager(o.number, value);
      toast.success("Менеджер заказа назначен");
      onSaved(r);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось назначить менеджера"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardTitle>Менеджер заказа</CardTitle>
      {o.manager ? (
        <p className={cn("mt-[21px]", labelCls)}>
          <span className="font-semibold text-black">{o.manager.name}</span>
          <span className="block tnum">
            <a href={phoneHref(o.manager.phone)} className="link-hover">
              {o.manager.phone}
            </a>
            {" · "}
            <a href={`mailto:${o.manager.email}`} className="link-hover">
              {o.manager.email}
            </a>
          </span>
        </p>
      ) : (
        <p className={cn("mt-[21px]", labelCls)}>Менеджер не назначен.</p>
      )}
      {managers ? (
        <div className="mt-[16px] flex flex-wrap items-center gap-[10px]">
          <Select
            options={[{ value: "", label: "Выберите менеджера" }, ...managers.map((x) => ({ value: x.id, label: `${x.name}${x.is_lead_manager ? " (ведущий)" : ""}` }))]}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Менеджер заказа"
            className="min-w-[220px] flex-1"
          />
          <Button className={btnCls} loading={busy} disabled={!value || value === currentId} onClick={save}>
            Назначить
          </Button>
        </div>
      ) : managersError ? (
        <ErrorLine error={managersError} className="mt-[16px]" />
      ) : (
        <Skeleton className="mt-[16px] h-[36px] rounded-[5px]" />
      )}
    </Card>
  );
}

/** Счёт .xlsx требует токен — скачиваем через fetch, а не ссылкой. */
function InvoiceLink({ number }: { number: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await ensureFreshAccess();
      await downloadFile(`/orders/${encodeURIComponent(number)}/invoice.xlsx`, `invoice-${number}.xlsx`);
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось скачать счёт"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={download} disabled={busy} className="mt-[16px] inline-flex items-center gap-[6px] text-[15px] leading-[20px] text-[#555] transition-colors hover:text-black disabled:opacity-50">
      <Download className="size-4" aria-hidden />
      {busy ? "Загрузка…" : "Счёт на оплату (.xlsx)"}
    </button>
  );
}

function Row({ label: l, value, className, labelClassName, valueClassName }: { label: string; value: string; className?: string; labelClassName?: string; valueClassName?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-[24px]", className)}>
      <dt className={cn("text-[#555]", labelClassName)}>{l}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { moneyBare } from "@/lib/format";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/account/OrderStatus";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle } from "@/components/account/shared";
import {
  Chips,
  DELIVERY_LABEL,
  ErrorLine,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  SearchField,
  Spinner,
  dateTime,
  fullName,
  label,
  useLoad,
} from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

const STATUSES = ["", "new", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
type StatusKey = (typeof STATUSES)[number] | "all";

const CHIP_LABEL: Record<string, string> = {
  all: "Все",
  new: "Новые",
  confirmed: "Подтверждённые",
  processing: "В обработке",
  shipped: "Отгруженные",
  delivered: "Доставленные",
  cancelled: "Отменённые",
};

export const remainingOf = (o: Pick<AdminOrder, "status" | "total" | "paid_amount" | "remaining">) =>
  o.status === "cancelled" ? 0 : (o.remaining ?? Math.max(0, Math.round((o.total - o.paid_amount) * 100) / 100));

/** «Заказы»: фильтр по статусу, поиск (номер, клиент, телефон), «Мои»; строка → карточка заказа. */
export function OrdersView() {
  const router = useRouter();
  const qs = useQueryState();
  const status = (STATUSES as readonly string[]).includes(qs.get("status")) ? qs.get("status") : "";
  const mine = qs.get("mine") === "1";
  const q = qs.get("q");
  const [text, setText] = useSearchText(qs);

  const list = useLoad(`orders:${status}:${mine}:${q}`, () => adminApi.orders({ status, q, mine }), "Не удалось загрузить заказы");
  const rows = list.data ?? [];

  const columns: Column<AdminOrder>[] = [
    {
      key: "number",
      header: "№",
      className: "w-[118px]",
      cell: (o) => (
        <Link href={`/admin/orders/${o.number}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-medium tnum text-black underline decoration-line-3 underline-offset-[3px] hover:decoration-black">
          {o.number}
        </Link>
      ),
    },
    { key: "date", header: "Создан", className: "w-[100px]", cell: (o) => <span className="block text-[14px] leading-[18px] tnum">{dateTime(o.created_at)}</span> },
    {
      key: "client",
      header: "Клиент",
      cell: (o) => (
        <span className="block min-w-[150px]">
          <span className="line-clamp-1 block">{o.company_name || fullName(o) || "—"}</span>
          <span className="block text-[13px] leading-[18px] text-[#555] tnum">{o.company_name && fullName(o) ? `${fullName(o)} · ${o.phone}` : o.phone}</span>
        </span>
      ),
    },
    {
      key: "total",
      header: "Сумма, с.",
      align: "right",
      className: "w-[120px]",
      cell: (o) => {
        const rest = remainingOf(o);
        return (
          <span className="block whitespace-nowrap">
            <span className="block font-medium tnum">{moneyBare(o.total)}</span>
            {rest > 0 ? <span className="block text-[13px] leading-[18px] text-[#D13B3E] tnum">долг {moneyBare(rest)}</span> : null}
          </span>
        );
      },
    },
    {
      key: "payment",
      header: "Оплата",
      hideBelow: "md",
      cell: (o) => (
        <span className="block whitespace-nowrap">
          <span className="block">{o.payment_method_label ?? label(PAYMENT_METHOD_LABEL, o.payment_method)}</span>
          <span className={cn("block text-[13px] leading-[18px]", o.payment_status === "paid" ? "text-new" : "text-[#555]")}>{o.payment_status_label ?? label(PAYMENT_STATUS_LABEL, o.payment_status)}</span>
        </span>
      ),
    },
    { key: "delivery", header: "Получение", hideBelow: "lg", cell: (o) => <span className="whitespace-nowrap">{o.delivery_method_label ?? label(DELIVERY_LABEL, o.delivery_method)}</span> },
    { key: "manager", header: "Менеджер", hideBelow: "lg", cell: (o) => <span className="line-clamp-2 text-[14px] leading-[18px]">{o.manager_name ?? o.manager_email ?? <span className="text-muted">—</span>}</span> },
    { key: "status", header: "Статус", className: "w-[120px]", cell: (o) => <StatusBadge status={o.status} label={o.status_label ?? label(ORDER_STATUS_LABEL, o.status)} /> },
  ];

  return (
    <Card className="min-h-[347px]">
      <CardTitle right={list.loading && list.data ? <Spinner /> : null}>Заказы</CardTitle>
      <Chips<StatusKey>
        className="mt-[22px]"
        label="Статус заказа"
        value={(status || "all") as StatusKey}
        onChange={(k) => qs.set({ status: k === "all" ? null : k })}
        items={(["all", ...STATUSES.slice(1)] as StatusKey[]).map((k) => ({ key: k, label: CHIP_LABEL[k] }))}
      />
      <div className="mt-[16px] flex flex-wrap items-center gap-x-[20px] gap-y-[10px]">
        <SearchField value={text} onChange={setText} placeholder="Номер заказа, клиент, телефон, e-mail" className="flex-1 sm:max-w-[420px]" />
        <Checkbox checked={mine} onChange={(e) => qs.set({ mine: e.target.checked ? 1 : null })} label="Только мои заказы" labelClassName="text-[15px]" />
      </div>
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[28px]">
        {list.data === null ? (
          list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(o) => o.id}
            onRowClick={(o) => router.push(`/admin/orders/${o.number}`)}
            empty={q || status || mine ? "Заказов с такими условиями нет" : "Заказов пока нет"}
          />
        )}
      </div>
    </Card>
  );
}

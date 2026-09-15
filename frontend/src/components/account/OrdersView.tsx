"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OrderListItem } from "@/lib/types";
import { client } from "@/lib/client";
import { date, money } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "./OrderStatus";
import { DataTable, type Column } from "./DataTable";
import { PeriodFilter, periodFromParams, periodKey, type Period } from "./PeriodFilter";
import { ErrorLine, PageTitle, errorMessage } from "./shared";

interface OrdersResponse {
  items: OrderListItem[];
  total: number;
}

export function OrdersView() {
  const router = useRouter();
  const sp = useSearchParams();
  const period = useMemo(() => periodFromParams(sp), [sp]);
  const key = periodKey(period);
  const [result, setResult] = useState<{ key: string; data: OrdersResponse | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get<OrdersResponse>("/account/orders", { from: period.from, to: period.to, per_page: 100 })
      .then((r) => {
        if (!cancelled) setResult({ key, data: r, error: null });
      })
      .catch((e) => {
        if (!cancelled) setResult({ key, data: null, error: errorMessage(e, "Не удалось загрузить заказы") });
      });
    return () => {
      cancelled = true;
    };
  }, [key, period.from, period.to]);

  const busy = result?.key !== key;
  const data = result?.data ?? null;
  const error = result?.error ?? null;

  const apply = (p: Period) => {
    const next = new URLSearchParams(sp?.toString());
    next.set("from", p.from);
    next.set("to", p.to);
    router.replace(`/account/orders?${next.toString()}`, { scroll: false });
  };

  const columns: Column<OrderListItem>[] = [
    { key: "number", header: "№", cell: (o) => <span className="font-semibold tnum">{o.number}</span> },
    { key: "date", header: "Дата", cell: (o) => <span className="tnum">{date(o.date)}</span> },
    { key: "total", header: "Сумма, с.", align: "right", cell: (o) => <span className="font-semibold tnum">{money(o.total)}</span> },
    { key: "paid", header: "Оплачено, с.", align: "right", hideBelow: "md", cell: (o) => <span className="tnum">{money(o.paid_amount)}</span> },
    {
      key: "remaining",
      header: "Остаток, с.",
      align: "right",
      hideBelow: "md",
      cell: (o) => <span className={o.remaining > 0 && o.status !== "cancelled" ? "font-medium text-sale tnum" : "tnum"}>{money(o.status === "cancelled" ? 0 : o.remaining)}</span>,
    },
    { key: "due", header: "Срок оплаты", hideBelow: "lg", cell: (o) => <span className="tnum">{o.due_date ? date(o.due_date) : "—"}</span> },
    { key: "status", header: "Статус", cell: (o) => <StatusBadge status={o.status} label={o.status_label} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Заказы</PageTitle>
      <PeriodFilter key={key} value={period} onApply={apply} busy={busy} />
      <ErrorLine error={error} />
      {data === null && !error ? (
        <Skeleton className="h-64" />
      ) : data ? (
        <DataTable
          columns={columns}
          rows={data.items}
          rowKey={(o) => o.id}
          onRowClick={(o) => router.push(`/account/orders/${o.number}`)}
          empty="За выбранный период заказов нет"
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <p className="text-sm text-sub">
          Показаны заказы с {date(period.from)} по {date(period.to)}. Нажмите на строку, чтобы открыть состав заказа и статус доставки.
        </p>
      ) : null}
    </div>
  );
}

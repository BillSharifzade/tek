"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OrderListItem } from "@/lib/types";
import { client } from "@/lib/client";
import { date, moneyBare } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "./OrderStatus";
import { DataTable, type Column } from "./DataTable";
import { PeriodFilter, periodFromParams, periodKey, type Period } from "./PeriodFilter";
import { Card, CardTitle, ErrorLine, errorMessage } from "./shared";

interface OrdersResponse {
  items: OrderListItem[];
  total: number;
}

/**
 * «Заказы» (Figma 9097:650): карточка 347px с заголовком, период «с … по …» (в 22px под заголовком) и таблица
 * №/Дата/Сумма/Оплачено/Остаток/Срок оплаты (шапка в 38px под полями дат) + статус заказа (ТЗ). По умолчанию — последние 30 дней (ТЗ).
 * Строка кликабельна → состав заказа и статус доставки.
 */
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
    {
      key: "number",
      header: "№",
      className: "w-[128px]",
      cell: (o) => (
        <Link href={`/account/orders/${o.number}`} onClick={(e) => e.stopPropagation()} className="font-medium tnum text-black underline decoration-line-3 underline-offset-[3px] hover:decoration-black">
          {o.number}
        </Link>
      ),
    },
    { key: "date", header: "Дата", className: "w-[118px]", cell: (o) => <span className="tnum">{date(o.date)}</span> },
    { key: "total", header: "Сумма, с.", className: "w-[140px]", cell: (o) => <span className="font-medium tnum">{moneyBare(o.total)}</span> },
    { key: "paid", header: "Оплачено, с.", hideBelow: "md", className: "w-[140px]", cell: (o) => <span className="tnum">{moneyBare(o.paid_amount)}</span> },
    {
      key: "remaining",
      header: "Остаток, с.",
      hideBelow: "md",
      className: "w-[140px]",
      cell: (o) => {
        const rest = o.status === "cancelled" ? 0 : o.remaining;
        return <span className={cn("tnum", rest > 0 && "text-[#D13B3E]")}>{moneyBare(rest)}</span>;
      },
    },
    { key: "due", header: "Срок оплаты", hideBelow: "lg", className: "w-[130px]", cell: (o) => <span className="tnum">{o.due_date && o.status !== "cancelled" ? date(o.due_date) : "—"}</span> },
    { key: "status", header: "Статус", cell: (o) => <StatusBadge status={o.status} label={o.status_label} /> },
  ];

  return (
    <Card className="min-h-[347px]">
      <CardTitle>Заказы</CardTitle>
      <PeriodFilter key={key} value={period} onApply={apply} busy={busy && result !== null} className="mt-[22px]" />
      <ErrorLine error={error} className="mt-[20px]" />
      <div className="mt-[38px]">
        {data === null && !error ? (
          <Skeleton className="h-[160px] rounded-[7px]" />
        ) : data ? (
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(o) => o.id}
            onRowClick={(o) => router.push(`/account/orders/${o.number}`)}
            empty="За выбранный период заказов нет"
          />
        ) : null}
      </div>
      {data && data.items.length > 0 ? (
        <p className="mt-[16px] text-[13px] leading-[18px] text-sub">
          Заказы с {date(period.from)} по {date(period.to)}. Нажмите на заказ, чтобы увидеть состав и статус доставки; недоставленные заказы можно изменить или отменить.
        </p>
      ) : null}
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BonusEntry, BonusStatement } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money, moneyBare } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, cellPad, type Column } from "./DataTable";
import { PeriodFilter, periodFromParams, periodKey, type Period } from "./PeriodFilter";
import { Card, CardTitle, ErrorLine, errorMessage } from "./shared";

type Entry = BonusEntry & { kind_label?: string };
type Statement = BonusStatement & { entries: Entry[]; accrued?: number; spent?: number; period?: { from: string; to: string } };

const KIND_LABEL: Record<BonusEntry["kind"], string> = { accrual: "Начисление", spend: "Списание", adjust: "Корректировка" };

/**
 * «Бонусная карта» (макета нет — в стиле карточек ЛК): бонусный счёт и детализация по каждому заказу
 * за выбранный период — «подобие акта сверки» (ТЗ), с выгрузкой в Excel.
 */
export function BonusView() {
  const router = useRouter();
  const sp = useSearchParams();
  const user = useAuth((s) => s.user);
  const period = useMemo(() => periodFromParams(sp, 365), [sp]);
  const key = periodKey(period);
  const [result, setResult] = useState<{ key: string; data: Statement | null; error: string | null } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get<Statement>("/account/bonus", { from: period.from, to: period.to })
      .then((r) => {
        if (!cancelled) setResult({ key, data: r, error: null });
      })
      .catch((e) => {
        if (!cancelled) setResult({ key, data: null, error: errorMessage(e, "Не удалось загрузить бонусный счёт") });
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
    router.replace(`/account/bonus?${next.toString()}`, { scroll: false });
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile("/account/bonus.xlsx", `bonus-${period.from}-${period.to}.xlsx`, { from: period.from, to: period.to });
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось скачать детализацию"));
    } finally {
      setDownloading(false);
    }
  };

  const columns: Column<Entry>[] = [
    { key: "date", header: "Дата", className: "w-[110px]", cell: (r) => <span className="tnum">{date(r.date)}</span> },
    {
      key: "order",
      header: "Заказ",
      className: "w-[130px]",
      cell: (r) =>
        r.order_number ? (
          <Link href={`/account/orders/${r.order_number}`} className="font-medium tnum text-black underline decoration-line-3 underline-offset-[3px] hover:decoration-black">
            {r.order_number}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "kind",
      header: "Операция",
      cell: (r) => (
        <span>
          {r.kind_label ?? KIND_LABEL[r.kind]}
          {r.note ? <span className="block text-[13px] leading-[17px] text-sub">{r.note}</span> : null}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Сумма, с.",
      align: "right",
      className: "w-[130px]",
      cell: (r) => <span className={cn("font-medium tnum", r.amount >= 0 ? "text-[#00A000]" : "text-[#D13B3E]")}>{r.amount >= 0 ? `+${moneyBare(r.amount)}` : `−${moneyBare(Math.abs(r.amount))}`}</span>,
    },
    { key: "balance", header: "Баланс, с.", align: "right", className: "w-[130px]", cell: (r) => <span className="tnum">{moneyBare(r.balance)}</span> },
  ];

  const balance = data?.balance ?? user?.bonus_balance ?? 0;
  const accrued = data ? (data.accrued ?? data.entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)) : 0;
  const spent = data ? (data.spent ?? Math.abs(data.entries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0))) : 0;

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <CardTitle>Бонусная карта</CardTitle>
        <div className="mt-[21px] flex flex-col gap-[20px] sm:flex-row sm:items-stretch sm:gap-[27px]">
          <div className="flex w-full shrink-0 flex-col justify-between rounded-[10px] bg-brand px-[22px] pb-[18px] pt-[18px] sm:w-[304px]" aria-label="Бонусный счёт">
            <span className="text-[14px] font-medium leading-[20px] text-black">Бонусный счёт ТЭК</span>
            <span className="mt-[18px] text-[28px] font-bold leading-[32px] text-black tnum">{money(balance)}</span>
            <span className="mt-[10px] text-[13px] leading-[17px] text-g333">
              {user ? `${user.first_name} ${user.last_name}`.trim() : ""}
              {user ? ` · кешбэк ${user.cashback_pct}%` : ""}
            </span>
          </div>
          <div className="flex flex-col justify-center gap-[8px] text-[14px] leading-[20px] text-sub">
            <p className="text-black">Кешбэк начисляется на бонусный счёт после оплаты заказа и доступен для оплаты следующих заказов.</p>
            {data ? (
              <p className="tnum">
                За период: начислено <span className="font-medium text-[#00A000]">{money(accrued)}</span>, списано <span className="font-medium text-black">{money(spent)}</span>
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle
          right={
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} loading={downloading} onClick={download} disabled={!data}>
              Скачать в Excel
            </Button>
          }
        >
          Детализация бонусов
        </CardTitle>
        <PeriodFilter key={key} value={period} onApply={apply} busy={busy && result !== null} className="mt-[22px]" />
        <ErrorLine error={error} className="mt-[20px]" />
        <div className="mt-[37px]">
          {data === null && !error ? (
            <Skeleton className="h-[200px] rounded-[10px]" />
          ) : data ? (
            <DataTable
              columns={columns}
              rows={data.entries}
              rowKey={(r, i) => `${r.date}-${i}`}
              empty="За выбранный период операций по бонусному счёту нет"
              prepend={
                <tr className="border-b border-line bg-surface-2">
                  <td colSpan={4} className={cn(cellPad, "text-sub")}>
                    Баланс на {date(data.period?.from ?? period.from)}
                  </td>
                  <td className={cn(cellPad, "text-right font-medium tnum")}>{moneyBare(data.opening)}</td>
                </tr>
              }
              footer={
                <tr className="bg-surface-2 font-semibold">
                  <td colSpan={4} className={cellPad}>
                    Баланс на {date(data.period?.to ?? period.to)}
                  </td>
                  <td className={cn(cellPad, "text-right tnum")}>{moneyBare(data.closing)}</td>
                </tr>
              }
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}

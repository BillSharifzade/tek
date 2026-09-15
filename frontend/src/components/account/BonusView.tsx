"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download, Gift } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BonusEntry, BonusStatement } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "./DataTable";
import { PeriodFilter, periodFromParams, periodKey, type Period } from "./PeriodFilter";
import { ErrorLine, PageTitle, errorMessage } from "./shared";

type Entry = BonusEntry & { kind_label?: string };
type Statement = BonusStatement & { entries: Entry[]; accrued?: number; spent?: number; period?: { from: string; to: string } };

const KIND_LABEL: Record<BonusEntry["kind"], string> = { accrual: "Начисление", spend: "Списание", adjust: "Корректировка" };

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
    { key: "date", header: "Дата", cell: (r) => <span className="tnum">{date(r.date)}</span> },
    { key: "order", header: "Заказ", cell: (r) => (r.order_number ? <span className="font-medium tnum">{r.order_number}</span> : <span className="text-sub">—</span>) },
    {
      key: "kind",
      header: "Операция",
      cell: (r) => (
        <span>
          {r.kind_label ?? KIND_LABEL[r.kind]}
          {r.note ? <span className="block text-xs text-sub">{r.note}</span> : null}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Сумма",
      align: "right",
      cell: (r) => <span className={cn("font-semibold tnum", r.amount >= 0 ? "text-success" : "text-sale")}>{r.amount >= 0 ? `+ ${money(r.amount)}` : `− ${money(Math.abs(r.amount))}`}</span>,
    },
    { key: "balance", header: "Баланс", align: "right", cell: (r) => <span className="tnum">{money(r.balance)}</span> },
  ];

  const balance = data?.balance ?? user?.bonus_balance ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Бонусная карта</PageTitle>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex items-center gap-5 rounded-[8px] bg-ink p-6 text-white">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
            <Gift className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white/70">Бонусный счёт</p>
            <p className="text-4xl font-semibold text-brand tnum">{money(balance)}</p>
            {user ? <p className="mt-1 text-sm text-white/70">Кешбэк {user.cashback_pct}% с каждого оплаченного заказа</p> : null}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-[8px] border border-line bg-white p-6 text-base">
          <p>Кешбэк начисляется после оплаты заказа и доступен для оплаты следующих заказов.</p>
          {data ? (
            <p className="text-sm text-sub tnum">
              За период: начислено {money(data.accrued ?? data.entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0))}, списано{" "}
              {money(data.spent ?? Math.abs(data.entries.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0)))}
            </p>
          ) : null}
        </div>
      </section>

      <PeriodFilter
        key={key}
        value={period}
        onApply={apply}
        busy={busy}
        right={
          <Button variant="secondary" icon={<Download className="size-4" />} loading={downloading} onClick={download} disabled={!data}>
            Скачать
          </Button>
        }
      />
      <ErrorLine error={error} />

      {data === null && !error ? (
        <Skeleton className="h-64" />
      ) : data ? (
        <DataTable
          columns={columns}
          rows={data.entries}
          rowKey={(r, i) => `${r.date}-${i}`}
          empty="За выбранный период операций по бонусному счёту нет"
          prepend={
            <tr className="bg-surface-2 text-sm">
              <td colSpan={4} className="px-4 py-2.5 text-sub">
                Баланс на {date(data.period?.from ?? period.from)}
              </td>
              <td className="px-4 py-2.5 text-right font-medium tnum">{money(data.opening)}</td>
            </tr>
          }
          footer={
            <>
              <tr className="border-t border-line bg-surface font-semibold">
                <td colSpan={4} className="px-4 py-3">
                  Баланс на {date(data.period?.to ?? period.to)}
                </td>
                <td className="px-4 py-3 text-right tnum">{money(data.closing)}</td>
              </tr>
            </>
          }
        />
      ) : null}
    </div>
  );
}

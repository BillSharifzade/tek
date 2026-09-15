"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Download, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dashboard, Reconciliation, ReconciliationEntry } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "./StatCard";
import { DataTable, type Column } from "./DataTable";
import { PeriodFilter, periodFromParams, periodKey, type Period } from "./PeriodFilter";
import { ErrorLine, PageTitle, errorMessage } from "./shared";

type Entry = ReconciliationEntry & { doc_type_label?: string; note?: string | null; due_date?: string | null };
type Statement = Reconciliation & { entries: Entry[]; company?: string; overdue?: number };

const DOC_LABEL: Record<string, string> = {
  invoice: "Реализация (счёт)",
  payment: "Оплата",
  credit_note: "Корректировка",
  act: "Акт",
};

export function BalanceView() {
  const router = useRouter();
  const sp = useSearchParams();
  const period = useMemo(() => periodFromParams(sp, 90), [sp]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const key = periodKey(period);
  const [result, setResult] = useState<{ key: string; data: Statement | null; error: string | null } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    client
      .get<Dashboard>("/account/dashboard")
      .then(setDash)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    client
      .get<Statement>("/account/reconciliation", { from: period.from, to: period.to })
      .then((r) => {
        if (!cancelled) setResult({ key, data: r, error: null });
      })
      .catch((e) => {
        if (!cancelled) setResult({ key, data: null, error: errorMessage(e, "Не удалось загрузить акт сверки") });
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
    router.replace(`/account/balance?${next.toString()}`, { scroll: false });
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile("/account/reconciliation.xlsx", `akt-sverki-${period.from}-${period.to}.xlsx`, { from: period.from, to: period.to });
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось скачать акт сверки"));
    } finally {
      setDownloading(false);
    }
  };

  const columns: Column<Entry>[] = [
    { key: "date", header: "Дата", cell: (r) => <span className="tnum">{date(r.date)}</span> },
    {
      key: "doc",
      header: "Документ",
      cell: (r) => (
        <span>
          {r.doc_type_label ?? DOC_LABEL[r.doc_type] ?? r.doc_type}
          {r.note ? <span className="block text-xs text-sub">{r.note}</span> : null}
        </span>
      ),
    },
    { key: "num", header: "№", cell: (r) => <span className="tnum">{r.doc_number}</span> },
    { key: "debit", header: "Дебет", align: "right", cell: (r) => <span className="tnum">{r.debit > 0 ? money(r.debit) : "—"}</span> },
    { key: "credit", header: "Кредит", align: "right", cell: (r) => <span className="tnum">{r.credit > 0 ? money(r.credit) : "—"}</span> },
    { key: "balance", header: "Сальдо", align: "right", cell: (r) => <span className={cn("font-medium tnum", r.balance < 0 && "text-success")}>{money(r.balance)}</span> },
  ];

  const receivable = dash?.balance.receivable ?? data?.closing_balance ?? 0;
  const overdue = dash?.balance.overdue ?? data?.overdue ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Баланс</PageTitle>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dash || data ? (
          <>
            <StatCard icon={Wallet} label="Дебиторская задолженность" value={money(receivable)} hint="сумма к оплате по выставленным счетам" />
            <StatCard icon={AlertTriangle} label="Просроченная задолженность" value={money(overdue)} tone={overdue > 0 ? "danger" : "default"} hint={overdue > 0 ? "оплатите, чтобы не потерять скидку" : "просрочек нет"} />
          </>
        ) : (
          <>
            <Skeleton className="h-[74px]" />
            <Skeleton className="h-[74px]" />
          </>
        )}
      </div>

      <h3 className="mt-2">Акт сверки</h3>
      <PeriodFilter
        key={key}
        value={period}
        onApply={apply}
        busy={busy}
        right={
          <Button variant="secondary" icon={<Download className="size-4" />} loading={downloading} onClick={download} disabled={!data}>
            Скачать акт сверки
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
          rowKey={(r, i) => `${r.doc_number}-${i}`}
          empty="За выбранный период движений нет"
          prepend={
            <tr className="bg-surface-2 text-sm">
              <td colSpan={3} className="px-4 py-2.5 text-sub">
                Сальдо на {date(data.period.from)}
              </td>
              <td colSpan={2} />
              <td className="px-4 py-2.5 text-right font-medium tnum">{money(data.opening_balance)}</td>
            </tr>
          }
          footer={
            <>
              <tr className="border-t border-line bg-surface-2 text-sm">
                <td colSpan={3} className="px-4 py-2.5 text-sub">
                  Обороты за период
                </td>
                <td className="px-4 py-2.5 text-right tnum">{money(data.turnover.debit)}</td>
                <td className="px-4 py-2.5 text-right tnum">{money(data.turnover.credit)}</td>
                <td />
              </tr>
              <tr className="border-t border-line bg-surface font-semibold">
                <td colSpan={3} className="px-4 py-3">
                  Сальдо на {date(data.period.to)}
                </td>
                <td colSpan={2} />
                <td className="px-4 py-3 text-right tnum">{money(data.closing_balance)}</td>
              </tr>
            </>
          }
        />
      ) : null}
      {data?.company ? <p className="text-sm text-sub">Акт сверки взаиморасчётов между ООО «Точикэлектрокомплект» и {data.company}. Положительное сальдо — задолженность покупателя.</p> : null}
    </div>
  );
}

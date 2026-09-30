"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dashboard, Reconciliation, ReconciliationEntry } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money, moneyBare } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, cellPad, type Column } from "./DataTable";
import { PeriodFilter, periodFromParams, periodKey, type Period } from "./PeriodFilter";
import { Card, CardTitle, ErrorLine, errorMessage } from "./shared";

type Entry = ReconciliationEntry & { doc_type_label?: string; note?: string | null; due_date?: string | null };
type Statement = Reconciliation & { entries: Entry[]; company?: string; overdue?: number };

const DOC_LABEL: Record<string, string> = {
  invoice: "Реализация (счёт)",
  payment: "Оплата",
  credit_note: "Корректировка",
  act: "Акт",
};

/**
 * «Баланс» (макета нет — в стиле карточек 9085:497): дебиторская / просроченная задолженность,
 * акт сверки за выбранный период (ТЗ) с выгрузкой в Excel.
 */
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
    { key: "date", header: "Дата", className: "w-[110px]", cell: (r) => <span className="tnum">{date(r.date)}</span> },
    {
      key: "doc",
      header: "Документ",
      cell: (r) => (
        <span>
          {r.doc_type_label ?? DOC_LABEL[r.doc_type] ?? r.doc_type}
          {r.note ? <span className="block text-[13px] leading-[17px] text-sub">{r.note}</span> : null}
        </span>
      ),
    },
    { key: "num", header: "№", className: "w-[120px]", cell: (r) => <span className="tnum">{r.doc_number}</span> },
    { key: "debit", header: "Дебет, с.", align: "right", className: "w-[120px]", cell: (r) => <span className="tnum">{r.debit > 0 ? moneyBare(r.debit) : "—"}</span> },
    { key: "credit", header: "Кредит, с.", align: "right", className: "w-[120px]", cell: (r) => <span className="tnum">{r.credit > 0 ? moneyBare(r.credit) : "—"}</span> },
    { key: "balance", header: "Сальдо, с.", align: "right", className: "w-[130px]", cell: (r) => <span className={cn("font-medium tnum", r.balance < 0 && "text-[#00A000]")}>{moneyBare(r.balance)}</span> },
  ];

  const receivable = dash?.balance.receivable ?? data?.closing_balance ?? 0;
  const overdue = dash?.balance.overdue ?? data?.overdue ?? 0;
  const loaded = Boolean(dash || data);

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card className="lg:min-h-[167px]">
        <CardTitle>Баланс</CardTitle>
        {loaded ? (
          <div className="mt-[21px] grid grid-cols-1 gap-[16px] sm:grid-cols-[repeat(2,minmax(0,257px))_minmax(0,1fr)] sm:gap-[20px]">
            <div className="flex flex-col gap-[6px]">
              <span className="text-[14px] leading-[20px] text-sub">Дебиторская задолженность</span>
              <span className="text-[18px] font-bold leading-[22px] tnum">{money(receivable)}</span>
            </div>
            <div className="flex flex-col gap-[6px]">
              <span className="text-[14px] leading-[20px] text-sub">Просроченная задолженность</span>
              <span className={cn("text-[18px] font-bold leading-[22px] tnum", overdue > 0 ? "text-[#D13B3E]" : "text-black")}>{money(overdue)}</span>
            </div>
            <p className="self-end text-[13px] leading-[18px] text-muted">
              {overdue > 0 ? "Оплатите просроченную задолженность, чтобы сохранить персональные условия." : "Просроченной задолженности нет."}
            </p>
          </div>
        ) : (
          <Skeleton className="mt-[21px] h-[48px] rounded-[10px]" />
        )}
      </Card>

      <Card>
        <CardTitle
          right={
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} loading={downloading} onClick={download} disabled={!data}>
              Скачать в Excel
            </Button>
          }
        >
          Акт сверки
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
              rowKey={(r, i) => `${r.doc_number}-${i}`}
              empty="За выбранный период движений нет"
              prepend={
                <tr className="border-b border-line bg-surface-2">
                  <td colSpan={5} className={cn(cellPad, "text-sub")}>
                    Сальдо на {date(data.period.from)}
                  </td>
                  <td className={cn(cellPad, "text-right font-medium tnum")}>{moneyBare(data.opening_balance)}</td>
                </tr>
              }
              footer={
                <>
                  <tr className="border-b border-line">
                    <td colSpan={3} className={cn(cellPad, "text-sub")}>
                      Обороты за период
                    </td>
                    <td className={cn(cellPad, "text-right tnum")}>{moneyBare(data.turnover.debit)}</td>
                    <td className={cn(cellPad, "text-right tnum")}>{moneyBare(data.turnover.credit)}</td>
                    <td />
                  </tr>
                  <tr className="bg-surface-2 font-semibold">
                    <td colSpan={5} className={cellPad}>
                      Сальдо на {date(data.period.to)}
                    </td>
                    <td className={cn(cellPad, "text-right tnum")}>{moneyBare(data.closing_balance)}</td>
                  </tr>
                </>
              }
            />
          ) : null}
        </div>
        {data ? (
          <p className="mt-[16px] text-[13px] leading-[18px] text-sub">
            Акт сверки взаиморасчётов между ООО «Точикэлектрокомплект»{data.company ? ` и ${data.company}` : ""}. Положительное сальдо — задолженность покупателя.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { BonusEntry, BonusStatement } from "@/lib/types";
import { client, downloadFile } from "@/lib/client";
import { date, money, moneyBare } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, type Column } from "./DataTable";
import { Card, CardTitle, ErrorLine, btnCls, errorMessage } from "./shared";

type Entry = BonusEntry;

/**
 * «Бонусная карта» (макета нет — в стиле карточек ЛК): бонусный счёт и вся история операций — «подобие акта сверки»
 * (ТЗ), с выгрузкой в Excel. Доработки R5: без выбора периода, последние операции — сверху.
 */
export function BonusView() {
  const user = useAuth((s) => s.user);
  const [result, setResult] = useState<{ data: BonusStatement | null; error: string | null } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .get<BonusStatement>("/account/bonus")
      .then((r) => {
        if (!cancelled) setResult({ data: r, error: null });
      })
      .catch((e) => {
        if (!cancelled) setResult({ data: null, error: errorMessage(e, "Не удалось загрузить бонусный счёт") });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = result?.data ?? null;
  const error = result?.error ?? null;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile("/account/bonus.xlsx", "bonus.xlsx");
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
          {r.kind_label}
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

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <CardTitle>Бонусная карта</CardTitle>
        <div className="mt-[21px] flex flex-col gap-[20px] sm:flex-row sm:items-stretch sm:gap-[27px]">
          <div className="flex w-full shrink-0 flex-col justify-between rounded-[7px] bg-brand px-[22px] pb-[18px] pt-[18px] sm:w-[304px]" aria-label="Бонусный счёт">
            <span className="text-[14px] font-medium leading-[20px] text-black">Бонусный счёт ТЭК</span>
            <span className="mt-[18px] text-[28px] font-bold leading-[32px] text-black tnum">{money(balance)}</span>
            <span className="mt-[10px] text-[13px] leading-[17px] text-g333">{user ? `${user.first_name} ${user.last_name}`.trim() : ""}</span>
          </div>
          <div className="flex flex-col justify-center gap-[6px] text-[15px] leading-[20px] text-[#555]">
            <p className="text-black">Кешбэк по товарам с кешбэком начисляется на бонусный счёт после получения заказа.</p>
            <p>Бонусами можно оплатить покупки при оформлении заказа.</p>
            {data ? (
              <p className="tnum">
                Всего начислено <span className="font-medium text-[#00A000]">{money(data.accrued)}</span>, списано <span className="font-medium text-black">{money(data.spent)}</span>
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle
          right={
            <Button variant="secondary" className={btnCls} icon={<Download className="size-4" aria-hidden />} loading={downloading} onClick={download} disabled={!data}>
              Скачать в Excel
            </Button>
          }
        >
          Детализация бонусов
        </CardTitle>
        <ErrorLine error={error} className="mt-[20px]" />
        <div className="mt-[24px]">
          {data === null && !error ? (
            <Skeleton className="h-[200px] rounded-[7px]" />
          ) : data ? (
            <DataTable
              columns={columns}
              rows={data.entries}
              rowKey={(r, i) => `${r.date}-${i}`}
              empty="Операций по бонусному счёту пока нет"
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}

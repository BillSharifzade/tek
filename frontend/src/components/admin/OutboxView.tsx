"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import { Fragment, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { OutboxEvent } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cellPad } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls } from "@/components/account/shared";
import { Chips, ErrorLine, INTEGRATION_LABEL, OUTBOX_STATUS_LABEL, OUTBOX_STATUS_TONE, Tag, dateTime, label, useLoad } from "./shared";
import { useQueryState } from "./useQueryState";

type Filter = "all" | "pending" | "sent" | "failed";

/** «Интеграции»: очередь событий для CRM и склада (последние 200), статусы отправки; данные события — в раскрывающейся строке. */
export function OutboxView() {
  const qs = useQueryState();
  const filter = (["pending", "sent", "failed"].includes(qs.get("status")) ? qs.get("status") : "all") as Filter;
  const list = useLoad("outbox", () => adminApi.outbox(), "Не удалось загрузить события интеграций");
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  const all = list.data ?? [];
  const count = (s: Filter) => (s === "all" ? all.length : all.filter((e) => e.status === s).length);
  const rows = filter === "all" ? all : all.filter((e) => e.status === filter);
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const th = "whitespace-nowrap px-[10px] pb-[8px] pt-0 text-left font-normal leading-[23px]";

  return (
    <Card className="min-h-[347px]">
      <CardTitle
        right={
          <Button variant="ghost" className={cn(btnCls, "px-[10px]")} icon={<RefreshCw className={cn("size-4", list.loading && "animate-spin")} aria-hidden />} onClick={list.reload} disabled={list.loading}>
            Обновить
          </Button>
        }
      >
        Интеграции
      </CardTitle>
      <p className="mt-[21px] text-[15px] leading-[20px] text-[#555]">Заказы, оплаты и резервы отправляются в CRM и складскую систему через очередь: при сбое событие повторяется, после нескольких неудач получает статус «Ошибка». «Тест» — внешняя система не настроена, отправка имитируется.</p>
      <Chips<Filter>
        className="mt-[18px]"
        label="Статус события"
        value={filter}
        onChange={(k) => qs.set({ status: k === "all" ? null : k })}
        items={(["all", "pending", "sent", "failed"] as Filter[]).map((k) => ({ key: k, label: k === "all" ? "Все" : OUTBOX_STATUS_LABEL[k], count: list.data ? count(k) : undefined }))}
      />
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[28px]">
        {list.data === null ? (
          list.error ? null : <Skeleton className="h-[280px] rounded-[7px]" />
        ) : (
          <div className="-mx-[20px] overflow-x-auto px-[20px] sm:mx-0 sm:px-0">
            <table className="w-full min-w-[760px] border-collapse text-[15px] leading-[20px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={cn(th, "w-[64px]")}>ID</th>
                  <th scope="col" className={cn(th, "w-[150px]")}>Создано</th>
                  <th scope="col" className={th}>Система</th>
                  <th scope="col" className={th}>Событие</th>
                  <th scope="col" className={th}>Статус</th>
                  <th scope="col" className={cn(th, "text-right")}>Попыток</th>
                  <th scope="col" className={th}>Отправлено</th>
                  <th scope="col" className="w-[40px]" aria-label="Подробнее" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-[10px] py-[40px] text-center text-[#555]">
                      {filter === "failed" ? "Ошибок отправки нет" : "Событий нет"}
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => <EventRow key={e.id} event={e} open={open.has(e.id)} onToggle={() => toggle(e.id)} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function EventRow({ event: e, open, onToggle }: { event: OutboxEvent; open: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <tr onClick={onToggle} className={cn("cursor-pointer transition-colors hover:bg-surface-2", !open && "border-b border-line")} aria-expanded={open}>
        <td className={cn(cellPad, "text-[14px] text-muted tnum")}>{e.id}</td>
        <td className={cn(cellPad, "text-[14px] tnum")}>{dateTime(e.created_at)}</td>
        <td className={cellPad}>{label(INTEGRATION_LABEL, e.target)}</td>
        <td className={cn(cellPad, "font-mono text-[13px]")}>{e.event}</td>
        <td className={cellPad}>
          <span className="flex flex-wrap items-center gap-[6px]">
            <Tag tone={OUTBOX_STATUS_TONE[e.status] ?? "neutral"}>{label(OUTBOX_STATUS_LABEL, e.status)}</Tag>
            {e.mock ? <Tag title="Внешняя система не настроена — отправка имитируется">тест</Tag> : null}
          </span>
        </td>
        <td className={cn(cellPad, "text-right tnum")}>{e.attempts}</td>
        <td className={cn(cellPad, "text-[14px] tnum")}>{e.sent_at ? dateTime(e.sent_at) : e.last_error ? <span className="line-clamp-1 text-sale-text" title={e.last_error}>{e.last_error}</span> : <span className="text-muted">—</span>}</td>
        <td className={cn(cellPad, "text-right")}>
          <button type="button" className="inline-flex size-[28px] items-center justify-center rounded-[6px] text-sub hover:bg-btn hover:text-black" aria-label={open ? "Свернуть" : "Показать данные события"}>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={8} className="px-[10px] pb-[14px] pt-[4px]">
            {e.last_error ? (
              <p className="mb-[8px] text-[14px] leading-[19px] text-sale-text">
                <span className="font-medium">Последняя ошибка:</span> {e.last_error}
              </p>
            ) : null}
            <pre className="max-h-[360px] overflow-auto rounded-[7px] border border-line bg-white px-[14px] py-[10px] font-mono text-[12px] leading-[17px] text-g333">{JSON.stringify(e.payload, null, 2)}</pre>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminLead, LeadPatch, LeadStatus } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { phoneHref } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage, fieldCls } from "@/components/account/shared";
import { ErrorLine, LEAD_KIND_LABEL, LEAD_STATUS_LABEL, SearchField, Spinner, dateTime, label, useLoad } from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

type Tab = LeadStatus | "all";
const TABS: Tab[] = ["new", "in_progress", "done", "all"];
const TAB_LABEL: Record<Tab, string> = { new: "Новые", in_progress: "В работе", done: "Завершённые", all: "Все" };

const KIND_OPTIONS = [{ value: "", label: "Все типы" }, ...Object.entries(LEAD_KIND_LABEL).map(([value, l]) => ({ value, label: l }))];
const STATUS_OPTIONS = (["new", "in_progress", "done"] as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }));

/** «Заявки» с сайта (обратная связь, услуги, консультации): статус меняется прямо в таблице, заметка менеджера — по «Изменить». */
export function LeadsView() {
  const qs = useQueryState();
  const tab = (TABS.includes(qs.get("status") as Tab) ? qs.get("status") : "new") as Tab;
  const kind = qs.get("kind");
  const q = qs.get("q");
  const [text, setText] = useSearchText(qs);
  const page = Math.max(1, Number(qs.get("page", "1")) || 1);
  const status = tab === "all" ? "" : tab;
  const list = useLoad(`leads:${status}:${kind}:${q}:${page}`, () => adminApi.leads({ status, kind, q, page, per_page: 50 }), "Не удалось загрузить заявки");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const patch = async (l: AdminLead, p: LeadPatch, success: string) => {
    const id = String(l.id);
    setSavingId(id);
    try {
      const r = await adminApi.updateLead(l.id, p);
      const next = r && typeof r === "object" && "id" in r ? r : { ...l, ...p };
      list.mutate((d) => ({ ...d, items: d.items.map((x) => (String(x.id) === id ? { ...x, ...next } : x)) }));
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось сохранить заявку"));
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const saveNote = async (l: AdminLead) => {
    if (await patch(l, { manager_note: draft.trim() || null }, "Заметка сохранена")) setEditId(null);
  };

  const columns: Column<AdminLead>[] = [
    { key: "date", header: "Дата", className: "w-[100px]", cell: (l) => <span className="block text-[14px] leading-[18px] tnum">{dateTime(l.created_at)}</span> },
    {
      key: "who",
      header: "Контакт",
      cell: (l) => (
        <span className="block min-w-[150px]">
          <span className="block font-medium">{l.name}</span>
          <a href={phoneHref(l.phone)} onClick={(e) => e.stopPropagation()} className="block text-[13px] leading-[18px] text-[#555] tnum link-hover">
            {l.phone}
          </a>
          {l.email ? <span className="block text-[13px] leading-[18px] text-[#555]">{l.email}</span> : null}
        </span>
      ),
    },
    {
      key: "what",
      header: "Заявка",
      cell: (l) => (
        <span className="block min-w-[200px] max-w-[360px]">
          <span className="block text-[13px] font-medium leading-[18px] text-sub">
            {label(LEAD_KIND_LABEL, l.kind)}
            {l.service ? ` · ${l.service}` : ""}
          </span>
          {l.note ? <span className="mt-[2px] line-clamp-3 block whitespace-pre-line text-[14px] leading-[19px]" title={l.note}>{l.note}</span> : null}
          {l.page ? <span className="mt-[2px] block truncate text-[12px] leading-[16px] text-muted">{l.page}</span> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Статус",
      className: "w-[150px]",
      cell: (l) => (
        <span className="flex items-center gap-[6px]">
          <Select
            options={STATUS_OPTIONS}
            value={l.status}
            disabled={savingId === String(l.id)}
            onChange={(e) => void patch(l, { status: e.target.value as LeadStatus }, `Заявка: ${LEAD_STATUS_LABEL[e.target.value]}`)}
            aria-label="Статус заявки"
            className={cn("w-[140px]", l.status === "new" && "[&_select]:border-hit [&_select]:font-medium")}
          />
        </span>
      ),
    },
    {
      key: "note",
      header: "Заметка менеджера",
      className: "w-[260px]",
      cell: (l) =>
        editId === String(l.id) ? (
          <span className="block">
            <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Заметка менеджера" maxLength={2000} className={cn(fieldCls, "h-auto min-h-[64px] py-[6px]")} />
            <span className="mt-[6px] flex gap-[6px]">
              <Button size="sm" className={btnCls} loading={savingId === String(l.id)} onClick={() => saveNote(l)}>
                Сохранить
              </Button>
              <Button size="sm" variant="outline" className={btnCls} onClick={() => setEditId(null)}>
                Отмена
              </Button>
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditId(String(l.id));
              setDraft(l.manager_note ?? "");
            }}
            className="group flex w-full items-start gap-[6px] text-left text-[14px] leading-[19px]"
          >
            <span className={cn("line-clamp-3 flex-1 whitespace-pre-line", !l.manager_note && "text-muted")}>{l.manager_note || "Добавить заметку"}</span>
            <Pencil className="mt-[2px] size-[14px] shrink-0 text-muted group-hover:text-black" aria-label="Изменить заметку" />
          </button>
        ),
    },
  ];

  const data = list.data;
  return (
    <Card className="min-h-[347px]">
      <CardTitle right={list.loading && data ? <Spinner /> : data ? <span className="text-[15px] leading-[20px] text-[#555] tnum">Всего: {data.total}</span> : null}>Заявки</CardTitle>
      <Tabs<Tab> className="mt-[18px]" value={tab} onChange={(t) => qs.set({ status: t === "new" ? null : t })} items={TABS.map((t) => ({ key: t, label: TAB_LABEL[t] }))} />
      <div className="mt-[20px] flex flex-wrap items-center gap-[10px]">
        <SearchField value={text} onChange={setText} placeholder="Имя, телефон, e-mail, текст заявки" className="flex-1 sm:max-w-[420px]" />
        <Select options={KIND_OPTIONS} value={kind} onChange={(e) => qs.set({ kind: e.target.value })} aria-label="Тип заявки" className="w-[200px]" />
      </div>
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[24px]">
        {data === null ? (
          list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
        ) : (
          <DataTable columns={columns} rows={data.items} rowKey={(l) => String(l.id)} empty={q ? "Ничего не нашли — измените запрос" : tab === "new" ? "Новых заявок нет" : "Заявок нет"} />
        )}
      </div>
      {data ? <Pagination page={data.page} pages={data.pages} hrefFor={(p) => qs.hrefFor({ page: p })} className="mt-[24px]" /> : null}
    </Card>
  );
}

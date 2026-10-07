"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";
import type { AdminUser } from "@/lib/admin-types";
import { date } from "@/lib/format";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, btnCls, errorMessage } from "@/components/account/shared";
import {
  CUSTOMER_TYPE_LABEL,
  ErrorLine,
  ROLE_LABEL,
  SearchField,
  Spinner,
  Tag,
  USER_STATUS_LABEL,
  USER_STATUS_TONE,
  fullName,
  label,
  useLoad,
} from "./shared";
import { useQueryState, useSearchText } from "./useQueryState";

type Tab = "pending" | "all" | "blocked";

const ROLE_OPTIONS = [
  { value: "", label: "Все роли" },
  { value: "customer", label: "Клиенты" },
  { value: "manager", label: "Менеджеры" },
  { value: "admin", label: "Администраторы" },
];

const pct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1).replace(".", ",")}%`;

/** «Пользователи»: вкладки по статусу, поиск, фильтр по роли; строка → карточка пользователя. */
export function UsersView() {
  const router = useRouter();
  const qs = useQueryState();
  const tab = (["pending", "all", "blocked"].includes(qs.get("tab")) ? qs.get("tab") : "pending") as Tab;
  const role = qs.get("role");
  const q = qs.get("q");
  const [text, setText] = useSearchText(qs);
  const [approving, setApproving] = useState<string | null>(null);

  const status = tab === "all" ? "" : tab;
  const list = useLoad(`users:${status}:${role}:${q}`, () => adminApi.users({ status, role, q }), "Не удалось загрузить пользователей");
  const pending = useLoad("users:pending-count", () => adminApi.users({ status: "pending" }).then((r) => r.length));

  const rows = list.data ?? [];

  const approve = async (u: AdminUser) => {
    setApproving(u.id);
    try {
      await adminApi.approveUser(u.id);
      toast.success(`${fullName(u) || u.email || u.phone} — аккаунт одобрен`);
      list.reload();
      pending.reload();
    } catch (e) {
      toast.error(errorMessage(e, "Не удалось одобрить пользователя"));
    } finally {
      setApproving(null);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: "Пользователь",
      cell: (u) => (
        <span className="block min-w-[170px]">
          <span className="block font-medium text-black">{fullName(u) || "Без имени"}</span>
          {u.email ? <span className="block break-all text-[13px] leading-[18px] text-[#555]">{u.email}</span> : null}
          {u.phone ? <span className="block text-[13px] leading-[18px] text-[#555] tnum">{u.phone}</span> : null}
        </span>
      ),
    },
    {
      key: "company",
      header: "Компания",
      hideBelow: "md",
      cell: (u) =>
        u.company_name ? (
          <span className="block min-w-[140px]">
            <span className="block">{u.company_name}</span>
            <span className="flex items-center gap-[6px] text-[13px] leading-[18px] text-[#555] tnum">
              {u.company_inn ? `ИНН ${u.company_inn}` : null}
              {u.company_verified ? <Tag tone="green">проверена</Tag> : null}
            </span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "type",
      header: "Тип / роль",
      hideBelow: "lg",
      cell: (u) => (
        <span className="block whitespace-nowrap">
          <span className="block">{u.role === "customer" ? label(CUSTOMER_TYPE_LABEL, u.customer_type) : label(ROLE_LABEL, u.role)}</span>
          {u.role !== "customer" ? <span className="block text-[13px] leading-[18px] text-[#555]">{u.is_lead_manager ? "ведущий менеджер" : "сотрудник"}</span> : null}
        </span>
      ),
    },
    {
      key: "terms",
      header: "Скидка / кешбэк",
      hideBelow: "lg",
      cell: (u) => (u.role === "customer" ? <span className="tnum">{pct(u.discount_pct)} / {pct(u.cashback_pct)}</span> : <span className="text-muted">—</span>),
    },
    { key: "manager", header: "Менеджер", hideBelow: "md", cell: (u) => (u.manager_name ? <span>{u.manager_name}</span> : <span className="text-muted">{u.manager_id ? "назначен" : "—"}</span>) },
    { key: "created", header: "Регистрация", hideBelow: "sm", className: "w-[100px]", cell: (u) => <span className="tnum">{date(u.created_at)}</span> },
  ];
  // во вкладке «Ожидают одобрения» статус у всех один — вместо него кнопка «Одобрить»
  if (tab !== "pending") {
    columns.push({ key: "status", header: "Статус", cell: (u) => <Tag tone={USER_STATUS_TONE[u.status]}>{label(USER_STATUS_LABEL, u.status)}</Tag> });
  } else {
    columns.push({
      key: "approve",
      header: "",
      align: "right",
      className: "w-[120px]",
      cell: (u) => (
        <Button
          variant="secondary"
          className={btnCls}
          loading={approving === u.id}
          onClick={(e) => {
            e.stopPropagation();
            void approve(u);
          }}
        >
          Одобрить
        </Button>
      ),
    });
  }

  return (
    <Card className="min-h-[347px]">
      <CardTitle right={list.loading && list.data ? <Spinner /> : null}>Пользователи</CardTitle>
      <Tabs<Tab>
        className="mt-[18px]"
        value={tab}
        onChange={(t) => qs.set({ tab: t === "pending" ? null : t })}
        items={[
          { key: "pending", label: "Ожидают одобрения", count: pending.data ?? undefined },
          { key: "all", label: "Все" },
          { key: "blocked", label: "Заблокированные" },
        ]}
      />
      <div className="mt-[20px] flex flex-wrap items-center gap-[10px]">
        <SearchField value={text} onChange={setText} placeholder="Имя, e-mail, телефон, компания, ИНН" className="flex-1 sm:max-w-[420px]" />
        <Select options={ROLE_OPTIONS} value={role} onChange={(e) => qs.set({ role: e.target.value })} aria-label="Роль" className="w-[190px]" />
      </div>
      <ErrorLine error={list.error} className="mt-[20px]" />
      <div className="mt-[28px]">
        {list.data === null ? (
          list.error ? null : <Skeleton className="h-[240px] rounded-[7px]" />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(u) => u.id}
            onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
            empty={tab === "pending" ? "Новых регистраций нет" : q ? "Никого не нашли — измените запрос" : "Пользователей нет"}
          />
        )}
      </div>
      {list.data && rows.length >= 500 ? <p className="mt-[16px] text-[13px] leading-[18px] text-sub">Показаны первые 500 — уточните поиск.</p> : null}
    </Card>
  );
}

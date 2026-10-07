"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Inbox, MessageSquare, Plug, ShoppingCart, Ticket, Upload, UserCheck, Package, Users } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/admin-types";
import { cn } from "@/lib/cn";
import { int, moneyBare } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/account/OrderStatus";
import { DataTable, type Column } from "@/components/account/DataTable";
import { Card, CardTitle, ErrorLine, labelCls, linkCls } from "@/components/account/shared";
import { ORDER_STATUS_LABEL, dateTime, fullName, isAdmin, label, useLoad, type Loaded } from "./shared";

const iconCls = "size-[22px] shrink-0";

/** Плитка счётчика (как виджеты «Основной информации» ЛК): иконка + подпись, крупное число, подсказка. */
function Counter({ href, icon, title, state, hint, alert }: { href: string; icon: React.ReactNode; title: string; state: Loaded<number>; hint: string; alert?: boolean }) {
  const value = state.data;
  const hot = alert && (value ?? 0) > 0;
  return (
    <Link href={href} className="group flex min-h-[124px] flex-col rounded-[7px] bg-surface-2 px-[20px] pb-[18px] pt-[18px] transition-colors hover:bg-btn">
      <span className={cn("flex items-center gap-[10px] group-hover:text-black", labelCls)}>
        <span className="flex size-[23px] shrink-0 items-center justify-center text-black">{icon}</span>
        {title}
      </span>
      {value === null && state.loading ? (
        <Skeleton className="mt-[14px] h-[24px] w-[56px] rounded-[4px]" />
      ) : (
        <span className={cn("mt-[14px] text-[24px] font-bold leading-[28px] tnum", hot ? "text-[#D13B3E]" : "text-black")}>{value === null ? "—" : int(value)}</span>
      )}
      <span className="mt-auto pt-[6px] text-[13px] leading-[17px] text-muted">{state.error && value === null ? "Нет данных — раздел недоступен" : hint}</span>
    </Link>
  );
}

const QUICK: { href: string; title: string; text: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { href: "/admin/users", title: "Пользователи", text: "Одобрение регистраций, роли, менеджеры, персональные скидки", icon: <Users className={iconCls} strokeWidth={1.6} aria-hidden /> },
  { href: "/admin/orders?mine=1", title: "Мои заказы", text: "Заказы, закреплённые за вами: статусы, оплаты", icon: <ShoppingCart className={iconCls} strokeWidth={1.6} aria-hidden /> },
  { href: "/admin/coupons", title: "Купоны", text: "Промокоды на скидку: создать, изменить, выключить", icon: <Ticket className={iconCls} strokeWidth={1.6} aria-hidden /> },
  { href: "/admin/products", title: "Товары", text: "Цены, распродажа, публикация и остатки по складам", icon: <Package className={iconCls} strokeWidth={1.6} aria-hidden /> },
  { href: "/admin/import", title: "Импорт каталога", text: "Загрузка товаров и остатков из Excel / CSV", icon: <Upload className={iconCls} strokeWidth={1.6} aria-hidden />, adminOnly: true },
  { href: "/admin/outbox", title: "Интеграции", text: "Очередь событий для CRM и склада, ошибки отправки", icon: <Plug className={iconCls} strokeWidth={1.6} aria-hidden /> },
];

/** «Обзор» панели: что требует внимания (счётчики), последние заказы и быстрые ссылки. */
export function AdminDashboardView() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const admin = isAdmin(user);

  const pending = useLoad("pending", () => adminApi.users({ status: "pending" }).then((r) => r.length));
  const orders = useLoad("orders", () => adminApi.orders());
  const leads = useLoad("leads", () => adminApi.leads({ status: "new", per_page: 1 }).then((r) => r.total));
  const answers = useLoad("answers", async () => {
    const [r, q] = await Promise.all([adminApi.reviews({ unanswered: true, per_page: 1 }), adminApi.questions({ unanswered: true, per_page: 1 })]);
    return r.total + q.total;
  });
  const failed = useLoad("outbox", () => adminApi.outbox().then((r) => r.filter((e) => e.status === "failed").length));

  const newOrders: Loaded<number> = { ...orders, data: orders.data ? orders.data.filter((o) => o.status === "new").length : null, mutate: () => undefined };
  const recent = orders.data?.slice(0, 6) ?? null;

  const columns: Column<AdminOrder>[] = [
    {
      key: "number",
      header: "№",
      className: "w-[120px]",
      cell: (o) => (
        <Link href={`/admin/orders/${o.number}`} onClick={(e) => e.stopPropagation()} className="font-medium tnum text-black underline decoration-line-3 underline-offset-[3px] hover:decoration-black">
          {o.number}
        </Link>
      ),
    },
    { key: "date", header: "Создан", className: "w-[150px]", cell: (o) => <span className="tnum">{dateTime(o.created_at)}</span> },
    { key: "client", header: "Клиент", cell: (o) => <span className="line-clamp-1">{o.company_name || fullName(o) || o.phone}</span> },
    { key: "total", header: "Сумма, с.", align: "right", className: "w-[130px]", cell: (o) => <span className="font-medium tnum">{moneyBare(o.total)}</span> },
    { key: "status", header: "Статус", className: "w-[130px]", cell: (o) => <StatusBadge status={o.status} label={o.status_label ?? label(ORDER_STATUS_LABEL, o.status)} /> },
  ];

  return (
    <div className="flex flex-col gap-[16px] lg:gap-[27px]">
      <Card>
        <CardTitle>Требует внимания</CardTitle>
        <div className="mt-[24px] grid grid-cols-1 gap-[16px] sm:grid-cols-2 xl:grid-cols-3">
          <Counter href="/admin/users" icon={<UserCheck className={iconCls} strokeWidth={1.6} aria-hidden />} title="Регистрации" state={pending} hint="Ожидают одобрения" alert />
          <Counter href="/admin/orders?status=new" icon={<ShoppingCart className={iconCls} strokeWidth={1.6} aria-hidden />} title="Новые заказы" state={newOrders} hint="Ждут подтверждения" alert />
          <Counter href="/admin/leads" icon={<ClipboardList className={iconCls} strokeWidth={1.6} aria-hidden />} title="Заявки" state={leads} hint="Новые заявки с сайта" alert />
          <Counter href="/admin/reviews" icon={<MessageSquare className={iconCls} strokeWidth={1.6} aria-hidden />} title="Отзывы и вопросы" state={answers} hint="Без ответа магазина" alert />
          <Counter href="/admin/outbox?status=failed" icon={<Inbox className={iconCls} strokeWidth={1.6} aria-hidden />} title="Интеграции" state={failed} hint="Событий с ошибкой отправки" alert />
        </div>
      </Card>

      <Card>
        <CardTitle
          right={
            <Link href="/admin/orders" className={linkCls}>
              Все заказы
            </Link>
          }
        >
          Последние заказы
        </CardTitle>
        <ErrorLine error={orders.error} className="mt-[20px]" />
        <div className="mt-[28px]">
          {recent === null ? (
            orders.error ? null : <Skeleton className="h-[200px] rounded-[7px]" />
          ) : (
            <DataTable columns={columns} rows={recent} rowKey={(o) => o.id} onRowClick={(o) => router.push(`/admin/orders/${o.number}`)} empty="Заказов пока нет" />
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Разделы</CardTitle>
        <ul className="mt-[21px] grid grid-cols-1 gap-[16px] sm:grid-cols-2 xl:grid-cols-3">
          {QUICK.filter((q) => admin || !q.adminOnly).map((q) => (
            <li key={q.href}>
              <Link href={q.href} className="group flex h-full items-start gap-[12px] rounded-[7px] border border-line px-[18px] py-[16px] transition-colors hover:border-outline">
                <span className="mt-[1px] text-black">{q.icon}</span>
                <span>
                  <span className="block text-[15px] font-semibold leading-[20px] text-black">{q.title}</span>
                  <span className="mt-[4px] block text-[13px] leading-[17px] text-[#555] group-hover:text-black">{q.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

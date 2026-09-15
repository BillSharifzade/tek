"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Building2, FileText, Heart, Mail, Package, Phone, ShoppingCart, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dashboard, Notification } from "@/lib/types";

/** The backend also returns pricing info on the dashboard payload. */
type DashboardData = Dashboard & { cashback_pct?: number; discount_pct?: number; user_name?: string };
import { client } from "@/lib/client";
import { SITE } from "@/lib/site";
import { date, money, phoneHref } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "./StatCard";
import { ErrorLine, PageTitle, errorMessage } from "./shared";

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  return date(iso);
}

export function DashboardView() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [notes, setNotes] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([client.get<DashboardData>("/account/dashboard"), client.get<Notification[]>("/account/notifications")])
      .then(([d, n]) => {
        if (cancelled) return;
        setData(d);
        setNotes(n);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markAll = async () => {
    setMarking(true);
    try {
      await client.post("/account/notifications/read", {});
      setNotes((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev);
      setData((prev) => (prev ? { ...prev, notifications_unread: 0 } : prev));
    } catch (e) {
      setError(errorMessage(e, "Не удалось отметить уведомления"));
    } finally {
      setMarking(false);
    }
  };

  const openNote = async (n: Notification) => {
    if (!n.is_read) {
      setNotes((prev) => prev?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? prev);
      client.post("/account/notifications/read", { ids: [n.id] }).catch(() => undefined);
    }
    if (n.link) router.push(n.link);
  };

  const unread = notes?.filter((n) => !n.is_read).length ?? 0;
  const manager = data?.manager ?? user?.manager ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Основная информация</PageTitle>
      <ErrorLine error={error} />

      {data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard icon={Building2} label="Название компании" value={data.company_name ?? "—"} href="/account/company" />
          <StatCard icon={Wallet} label="Баланс" value={money(data.balance.receivable)} href="/account/balance" tone={data.balance.overdue > 0 ? "danger" : "default"} hint={data.balance.overdue > 0 ? `просрочено ${money(data.balance.overdue)}` : "задолженности нет"} />
          <StatCard icon={Package} label="Заказы" value={data.orders_count} href="/account/orders" />
          <StatCard icon={FileText} label="Документы" value={data.documents_count} href="/account/documents" />
          <StatCard icon={Heart} label="Избранное" value={data.favorites_count} href="/account/favorites" />
          <StatCard icon={ShoppingCart} label="Корзина" value={data.cart_count} href="/cart" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px]" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-[8px] border border-line bg-white p-6">
          <h3 className="mb-4">Персональный менеджер</h3>
          {manager ? (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">{manager.name}</p>
              <a href={phoneHref(manager.phone)} className="inline-flex items-center gap-2 text-base hover:text-brand-hover">
                <Phone className="size-4 text-sub" aria-hidden />
                {manager.phone}
              </a>
              <a href={`mailto:${manager.email}`} className="inline-flex items-center gap-2 text-base hover:text-brand-hover">
                <Mail className="size-4 text-sub" aria-hidden />
                {manager.email}
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-base">
              <p className="text-sub">Ваш менеджер будет назначен после первого заказа.</p>
              <a href={SITE.phoneHref} className="inline-flex items-center gap-2 font-semibold hover:text-brand-hover">
                <Phone className="size-4 text-sub" aria-hidden />
                {SITE.phoneShort}
              </a>
            </div>
          )}
        </section>

        <section className="rounded-[8px] border border-line bg-white p-6">
          <h3 className="mb-4">Бонусная карта</h3>
          {data ? (
            <div className="flex flex-col gap-3">
              <span className="inline-flex w-fit items-center rounded-[8px] bg-brand px-4 py-2 text-2xl font-semibold tnum">{money(data.bonus_balance)}</span>
              <p className="text-sm text-sub">
                Ваш кешбэк: {data.cashback_pct ?? user?.cashback_pct ?? 0}% · скидка {data.discount_pct ?? user?.discount_pct ?? 0}%
              </p>
              <Link href="/account/bonus" className="text-base font-medium text-info hover:underline">
                Детализация
              </Link>
            </div>
          ) : (
            <Skeleton className="h-20" />
          )}
        </section>
      </div>

      <section className="rounded-[8px] border border-line bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2">
            <Bell className="size-4 text-sub" aria-hidden />
            Уведомления
            {unread > 0 ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold">{unread}</span> : null}
          </h3>
          {unread > 0 ? (
            <Button variant="secondary" size="sm" loading={marking} onClick={markAll}>
              Отметить прочитанными
            </Button>
          ) : null}
        </div>
        {notes === null ? (
          <Skeleton className="h-24" />
        ) : notes.length === 0 ? (
          <p className="text-sub">Уведомлений пока нет.</p>
        ) : (
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openNote(n)} className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-surface-2">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.is_read ? "bg-line" : "bg-brand")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-base", !n.is_read && "font-semibold")}>{n.title}</span>
                    <span className="block text-sm text-sub">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-xs text-sub tnum">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FileText, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dashboard, Notification } from "@/lib/types";
import { client } from "@/lib/client";
import { date, int, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconBasket, IconBox, IconHeart } from "@/components/icons/figma";
import { Card, CardTitle, ErrorLine, errorMessage } from "./shared";

/** The backend also returns pricing info on the dashboard payload. */
type DashboardData = Dashboard & { cashback_pct?: number; discount_pct?: number; user_name?: string; active_orders?: number };

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

const iconCls = "size-[23px] shrink-0";

/** Widget tile inside the «Основная информация» card: icon + label, large value, hint. */
function Widget({ href, icon, label, value, hint, hintTone }: { href: string; icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode; hintTone?: "danger" }) {
  return (
    <Link href={href} className="group flex min-h-[124px] flex-col rounded-[10px] bg-surface-2 px-[20px] pb-[18px] pt-[18px] transition-colors hover:bg-btn">
      <span className="flex items-center gap-[10px] text-[14px] leading-[20px] text-sub group-hover:text-black">
        <span className="flex size-[23px] shrink-0 items-center justify-center text-black">{icon}</span>
        {label}
      </span>
      <span className={cn("mt-[14px] line-clamp-2 font-bold text-black tnum", typeof value === "string" && value.length > 16 ? "text-[17px] leading-[22px]" : "text-[20px] leading-[24px]")}>{value}</span>
      {hint ? <span className={cn("mt-auto pt-[6px] text-[13px] leading-[17px]", hintTone === "danger" ? "text-[#D13B3E]" : "text-muted")}>{hint}</span> : null}
    </Link>
  );
}

/**
 * «Основная информация» (Figma 9063:200): белая карточка с виджетами
 * «название компании, баланс, заказы, документы, избранное, корзина» (пометка дизайнера) + уведомления об ответах (ТЗ).
 */
export function DashboardView() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [notes, setNotes] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
  const name = data?.user_name ?? (user ? `${user.first_name} ${user.last_name}`.trim() : "");
  const discount = data?.discount_pct ?? user?.discount_pct ?? 0;
  const cashback = data?.cashback_pct ?? user?.cashback_pct ?? 0;

  return (
    <div className="flex flex-col gap-[27px]">
      <Card>
        <CardTitle
          right={
            data ? (
              <span className="text-[14px] leading-[20px] text-sub">
                Скидка <span className="font-medium text-black">{discount}%</span> · кешбэк <span className="font-medium text-black">{cashback}%</span> ·{" "}
                <Link href="/account/bonus" className="link-hover">
                  бонусы <span className="font-medium text-black tnum">{money(data.bonus_balance)}</span>
                </Link>
              </span>
            ) : null
          }
        >
          {name ? `Здравствуйте, ${name}` : "Основная информация"}
        </CardTitle>
        <ErrorLine error={error} className="mt-[20px]" />

        {data ? (
          <div className="mt-[24px] grid grid-cols-1 gap-[16px] sm:grid-cols-2 xl:grid-cols-3">
            <Widget
              href="/account/company"
              icon={<Building2 className={iconCls} strokeWidth={1.6} aria-hidden />}
              label="Компания"
              value={data.company_name ?? "Не указана"}
              hint={user?.company?.inn ? `ИНН ${user.company.inn}` : "Заполните данные компании"}
            />
            <Widget
              href="/account/balance"
              icon={<Wallet className={iconCls} strokeWidth={1.6} aria-hidden />}
              label="Баланс"
              value={money(data.balance.receivable)}
              hint={data.balance.overdue > 0 ? `Просрочено ${money(data.balance.overdue)}` : "Просроченной задолженности нет"}
              hintTone={data.balance.overdue > 0 ? "danger" : undefined}
            />
            <Widget
              href="/account/orders"
              icon={<IconBox className={iconCls} />}
              label="Заказы"
              value={int(data.orders_count)}
              hint={data.active_orders ? `В работе: ${int(data.active_orders)}` : "Активных заказов нет"}
            />
            <Widget href="/account/documents" icon={<FileText className={iconCls} strokeWidth={1.6} aria-hidden />} label="Документы" value={int(data.documents_count)} hint="Счета, акты, сметы" />
            <Widget href="/account/favorites" icon={<IconHeart className={iconCls} />} label="Избранное" value={int(data.favorites_count)} hint="Сохранённые товары" />
            <Widget href="/cart" icon={<IconBasket className="h-[20px] w-[25px] shrink-0" />} label="Корзина" value={int(data.cart_count)} hint={data.cart_count > 0 ? "Перейти к оформлению" : "Корзина пуста"} />
          </div>
        ) : !error ? (
          <div className="mt-[24px] grid grid-cols-1 gap-[16px] sm:grid-cols-2 xl:grid-cols-3" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[124px] rounded-[10px]" />
            ))}
          </div>
        ) : null}

        {data?.manager ? (
          <p className="mt-[24px] text-[14px] leading-[20px] text-sub">
            Персональный менеджер: <span className="font-medium text-black">{data.manager.name}</span>
            {" · "}
            <a href={`tel:${data.manager.phone.replace(/[^\d+]/g, "")}`} className="link-hover tnum">
              {data.manager.phone}
            </a>
            {" · "}
            <a href={`mailto:${data.manager.email}`} className="link-hover">
              {data.manager.email}
            </a>
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle
          right={
            unread > 0 ? (
              <Button variant="secondary" loading={marking} onClick={markAll}>
                Отметить прочитанными
              </Button>
            ) : null
          }
        >
          <span className="inline-flex items-center gap-[10px]">
            Уведомления
            {unread > 0 ? <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-brand px-[6px] text-[12px] font-bold leading-[12px]">{unread}</span> : null}
          </span>
        </CardTitle>
        {notes === null ? (
          error ? null : <Skeleton className="mt-[20px] h-[96px] rounded-[10px]" />
        ) : notes.length === 0 ? (
          <p className="mt-[20px] text-[14px] leading-[20px] text-sub">Уведомлений пока нет. Здесь появятся ответы на ваши отзывы и вопросы и изменения по заказам.</p>
        ) : (
          <ul className="mt-[14px] divide-y divide-line">
            {(showAll ? notes : notes.slice(0, 5)).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => openNote(n)} className="group flex w-full items-start gap-[12px] py-[12px] text-left">
                  <span className={cn("mt-[7px] size-[7px] shrink-0 rounded-full", n.is_read ? "bg-line-3" : "bg-brand")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[14px] leading-[20px] text-black", !n.is_read && "font-medium")}>{n.title}</span>
                    <span className="block text-[13px] leading-[18px] text-sub group-hover:text-black">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[13px] leading-[20px] text-muted tnum">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {notes && notes.length > 5 ? (
          <Button variant="outline" className="mt-[16px]" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Свернуть" : `Показать все (${notes.length})`}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}

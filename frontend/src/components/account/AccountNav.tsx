"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";

/**
 * Меню ЛК (Figma 9063:200, «Group 72»): карточка 246px, r7, обводка #E5E5E5, пункты по 56px (текст 16/56 с x=29),
 * активный пункт — фон #FBFCFD, SemiBold #000; остальные — Regular #808080 (→ #000 при наведении).
 * Пункты из макета + недостающие разделы по ТЗ (Баланс, Документы, Избранное) и «Выйти».
 */
export const ACCOUNT_MENU: { href: string; label: string; exact?: boolean }[] = [
  { href: "/account", label: "Основная информация", exact: true },
  { href: "/account/personal", label: "Личные данные" },
  { href: "/account/company", label: "Данные компании" },
  { href: "/account/orders", label: "Заказы" },
  { href: "/account/balance", label: "Баланс" },
  { href: "/account/bonus", label: "Бонусная карта" },
  { href: "/account/reviews", label: "Отзывы и вопросы" },
  { href: "/account/documents", label: "Документы" },
  { href: "/account/favorites", label: "Избранное" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Page heading for the current account route (h1 above the menu). */
export function accountTitle(pathname: string): string {
  const order = pathname.match(/^\/account\/orders\/([^/]+)/);
  if (order) return `Заказ №${decodeURIComponent(order[1])}`;
  if (pathname === "/account" || pathname === "/account/") return "Личный кабинет пользователя";
  const item = ACCOUNT_MENU.find((i) => !i.exact && isActive(pathname, i.href));
  return item?.label ?? "Личный кабинет пользователя";
}

export function AccountHeading() {
  const pathname = usePathname() ?? "/account";
  // Figma 9064:284: 700 29/30; центр строки — в 35px под центром крошек
  return <h1 className="mt-[16px] text-[22px] font-bold leading-[26px] sm:mt-[13px] sm:text-[29px] sm:leading-[30px]">{accountTitle(pathname)}</h1>;
}

const row = "flex h-[48px] shrink-0 items-center whitespace-nowrap px-[20px] text-[15px] leading-[20px] transition-colors lg:h-[55px] lg:px-[28px] lg:text-[16px]";

export function AccountNav() {
  const pathname = usePathname() ?? "/account";
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const staff = useAuth((s) => s.user?.role === "manager" || s.user?.role === "admin");
  const listRef = useRef<HTMLUListElement>(null);

  // on narrow screens the menu is a horizontal strip — keep the active item in view (without scrolling the page)
  useEffect(() => {
    const ul = listRef.current;
    const active = ul?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!ul || !active || ul.scrollWidth <= ul.clientWidth) return;
    ul.scrollLeft = Math.max(0, active.parentElement!.offsetLeft - 16);
  }, [pathname]);

  const onLogout = async () => {
    await logout();
    toast.info("Вы вышли из аккаунта");
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="min-w-0 lg:w-[246px] lg:shrink-0">
      <nav aria-label="Личный кабинет" className="overflow-hidden rounded-[7px] border border-line bg-white">
        <ul ref={listRef} className="relative flex overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible">
          {ACCOUNT_MENU.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <li key={item.href} className="shrink-0 border-r border-line lg:border-b lg:border-r-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(row, active ? "bg-[#FBFCFD] font-semibold text-black" : "text-muted hover:text-black")}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          {staff ? (
            // менеджерам и администраторам — вход в панель управления
            <li className="shrink-0 border-r border-line lg:border-b lg:border-r-0">
              <Link href="/admin" className={cn(row, "gap-[8px] font-medium text-black hover:bg-[#FBFCFD]")}>
                <LayoutDashboard className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden />
                Панель управления
              </Link>
            </li>
          ) : null}
          <li className="shrink-0">
            <button type="button" onClick={onLogout} className={cn(row, "w-full text-muted hover:text-black lg:h-[56px]")}>
              Выйти
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

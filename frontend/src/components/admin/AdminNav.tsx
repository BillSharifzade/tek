"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Breadcrumbs, type CrumbItem } from "@/components/ui/Breadcrumbs";
import { isAdmin } from "./shared";

/**
 * Меню панели управления — та же карточка, что и меню ЛК (246px, r7, пункты 56px, активный — #FBFCFD SemiBold).
 * «Импорт каталога» — только для администратора.
 */
export const ADMIN_MENU: { href: string; label: string; exact?: boolean; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Обзор", exact: true },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/leads", label: "Заявки" },
  { href: "/admin/reviews", label: "Отзывы и вопросы" },
  { href: "/admin/coupons", label: "Купоны" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/import", label: "Импорт каталога", adminOnly: true },
  { href: "/admin/outbox", label: "Интеграции" },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function section(pathname: string) {
  return ADMIN_MENU.find((i) => !i.exact && isActive(pathname, i.href));
}

/** Заголовок страницы панели (h1 над меню). */
export function adminTitle(pathname: string): string {
  const order = pathname.match(/^\/admin\/orders\/([^/]+)/);
  if (order) return `Заказ №${decodeURIComponent(order[1])}`;
  if (/^\/admin\/users\/[^/]+/.test(pathname)) return "Карточка пользователя";
  return section(pathname)?.label ?? "Панель управления";
}

export function AdminHeading() {
  const pathname = usePathname() ?? "/admin";
  return <h1 className="mt-[16px] text-[22px] font-bold leading-[26px] sm:mt-[13px] sm:text-[29px] sm:leading-[30px]">{adminTitle(pathname)}</h1>;
}

/** Крошки «Главная / Панель управления / Раздел / …» (11px #8F8F8F, как в ЛК). */
export function AdminBreadcrumbs() {
  const pathname = usePathname() ?? "/admin";
  const items: CrumbItem[] = [{ href: "/admin", label: "Панель управления" }];
  const s = section(pathname);
  if (s) {
    items.push({ href: s.href, label: s.label });
    if (pathname !== s.href) items.push({ label: adminTitle(pathname) });
  }
  return <Breadcrumbs items={items} separator="/" className="pt-[43px] text-[11px] leading-[15px] text-[#8F8F8F]" />;
}

const row = "flex h-[48px] shrink-0 items-center whitespace-nowrap px-[20px] text-[15px] leading-[20px] transition-colors lg:h-[55px] lg:px-[28px] lg:text-[16px]";

export function AdminNav() {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const listRef = useRef<HTMLUListElement>(null);
  const admin = isAdmin(user);

  // на узких экранах меню — горизонтальная лента: держим активный пункт в поле зрения
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
      <nav aria-label="Панель управления" className="overflow-hidden rounded-[7px] border border-line bg-white">
        <ul ref={listRef} className="relative flex overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible">
          {ADMIN_MENU.filter((i) => admin || !i.adminOnly).map((item) => {
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
          <li className="shrink-0 border-r border-line lg:border-b lg:border-r-0">
            <Link href="/account" className={cn(row, "text-muted hover:text-black")}>
              Личный кабинет
            </Link>
          </li>
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

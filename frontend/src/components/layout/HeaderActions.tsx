"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/lib/hooks";
import { useCart, selectCartCount } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { IconBasket, IconBox, IconHeart, IconProfile } from "@/components/icons/figma";
import { cn } from "@/lib/cn";
import { MiniCart, type MiniCartTriggerState } from "./MiniCart";

/**
 * Иконки справа в шапке (Figma: Group 49–52). Ширины колонок и отступы — из макета:
 * Избранное 72 · 22 · Заказы 50 · 26 · Профиль 60 · 23 · Корзина 56 → правый край на x=1386.
 * Подписи всегда #333 (в макете нет «активного» чёрного состояния), чёрные только при наведении.
 */
function Action({
  href,
  label,
  width,
  className,
  iconTop,
  icon,
  badge,
  active,
  highlight,
  linkProps,
}: {
  href: string;
  label: string;
  width: number;
  className?: string;
  iconTop: number;
  icon: React.ReactNode;
  badge?: number;
  active?: boolean;
  /** подсветить как при наведении (открыта мини-корзина) */
  highlight?: boolean;
  linkProps?: MiniCartTriggerState["triggerProps"] & { "data-minicart-trigger"?: boolean };
}) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${label}: ${badge}` : label}
      aria-current={active ? "page" : undefined}
      style={{ width }}
      className={cn("group relative block h-[46px] shrink-0 text-g333 transition-colors hover:text-black", highlight && "text-black", className)}
      {...linkProps}
    >
      <span className="absolute left-1/2 flex -translate-x-1/2 justify-center text-black" style={{ top: iconTop }}>
        {icon}
      </span>
      <span className="absolute left-1/2 top-[34px] hidden -translate-x-1/2 whitespace-nowrap text-[14px] leading-[12px] lg:block">{label}</span>
      {badge ? (
        <span className="absolute left-[37.2px] top-0 flex h-[15.8px] min-w-[15.8px] items-center justify-center rounded-full bg-sale px-[3px] text-[11px] font-bold leading-[12px] text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function HeaderActions() {
  const hydrated = useHydrated();
  const cartCount = useCart(selectCartCount);
  const user = useAuth((s) => s.user);
  const pathname = usePathname();
  const staff = hydrated && (user?.role === "manager" || user?.role === "admin");

  return (
    <nav aria-label="Пользователь" className="flex items-start">
      {staff ? (
        // только для менеджеров и администраторов (в макете пункта нет — клиенты видят шапку 1:1)
        <Action
          href="/admin"
          label="Панель"
          width={50}
          iconTop={4}
          icon={<LayoutDashboard className="size-[24px]" strokeWidth={1.5} aria-hidden />}
          active={pathname.startsWith("/admin")}
          className="mr-[22px] hidden sm:block"
        />
      ) : null}
      <Action
        href={hydrated && user ? "/account/favorites" : "/favorites"}
        label="Избранное"
        width={72}
        iconTop={5}
        icon={<IconHeart />}
        active={pathname === "/account/favorites" || pathname === "/favorites"}
        className="hidden sm:block"
      />
      <Action
        href={user ? "/account/orders" : "/login?next=/account/orders"}
        label="Заказы"
        width={50}
        iconTop={5}
        icon={<IconBox />}
        active={pathname.startsWith("/account/orders")}
        className="ml-[22px] hidden sm:block"
      />
      <Action
        href={user ? "/account" : "/login"}
        label="Профиль"
        width={60}
        iconTop={4}
        icon={<IconProfile />}
        active={pathname === "/account"}
        className="ml-[26px]"
      />
      <MiniCart className="ml-[23px]" disabled={pathname.startsWith("/cart")}>
        {({ open, triggerProps }) => (
          <Action
            href="/cart"
            label="Корзина"
            width={56}
            iconTop={6.5}
            icon={<IconBasket />}
            badge={hydrated ? cartCount : 0}
            active={pathname === "/cart"}
            highlight={open}
            linkProps={{ ...triggerProps, "data-minicart-trigger": true }}
          />
        )}
      </MiniCart>
    </nav>
  );
}

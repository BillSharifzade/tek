"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Package, ShoppingCart, User } from "lucide-react";
import { useHydrated } from "@/lib/hooks";
import { useCart, selectCartCount } from "@/store/cart";
import { useFavorites } from "@/store/favorites";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";

function Action({
  href,
  label,
  icon,
  count,
  active,
  compact,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-[6px] px-2 text-ink transition-colors hover:text-brand-hover",
        compact ? "h-10 min-w-[48px]" : "h-12 min-w-[64px]",
        active && "text-brand-hover",
      )}
      aria-label={count ? `${label}: ${count}` : label}
    >
      <span className="relative">
        {icon}
        {count ? (
          <span className="absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-ink">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
      {!compact ? <span className="text-xs leading-none">{label}</span> : null}
    </Link>
  );
}

export function HeaderActions({ compact }: { compact?: boolean }) {
  const hydrated = useHydrated();
  const cartCount = useCart(selectCartCount);
  const favCount = useFavorites((s) => s.ids.length);
  const user = useAuth((s) => s.user);
  const pathname = usePathname();

  return (
    <nav aria-label="Пользователь" className="flex items-center gap-1">
      <Action href="/account/favorites" label="Избранное" icon={<Heart className="size-6" strokeWidth={1.75} />} count={hydrated ? favCount : 0} active={pathname === "/account/favorites"} compact={compact} />
      <Action href={user ? "/account/orders" : "/login?next=/account/orders"} label="Заказы" icon={<Package className="size-6" strokeWidth={1.75} />} active={pathname.startsWith("/account/orders")} compact={compact} />
      <Action href={user ? "/account" : "/login"} label={hydrated && user ? user.first_name || "Профиль" : "Профиль"} icon={<User className="size-6" strokeWidth={1.75} />} active={pathname === "/account"} compact={compact} />
      <Action href="/cart" label="Корзина" icon={<ShoppingCart className="size-6" strokeWidth={1.75} />} count={hydrated ? cartCount : 0} active={pathname === "/cart"} compact={compact} />
    </nav>
  );
}

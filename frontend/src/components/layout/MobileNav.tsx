"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, ShoppingCart, User, Package } from "lucide-react";
import { useHydrated } from "@/lib/hooks";
import { useCart, selectCartCount } from "@/store/cart";
import { useFavorites } from "@/store/favorites";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";

export function MobileNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const cartCount = useCart(selectCartCount);
  const favCount = useFavorites((s) => s.ids.length);
  const user = useAuth((s) => s.user);

  const items = [
    { href: "/", label: "Главная", icon: Home, count: 0 },
    { href: "/account/favorites", label: "Избранное", icon: Heart, count: hydrated ? favCount : 0 },
    { href: user ? "/account/orders" : "/login", label: "Заказы", icon: Package, count: 0 },
    { href: user ? "/account" : "/login", label: "Профиль", icon: User, count: 0 },
    { href: "/cart", label: "Корзина", icon: ShoppingCart, count: hydrated ? cartCount : 0 },
  ];

  return (
    <nav aria-label="Мобильная навигация" className="fixed inset-x-0 bottom-0 z-[85] border-t border-line bg-white md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <li key={it.label}>
              <Link href={it.href} className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-brand-hover" : "text-sub")}>
                <span className="relative">
                  <Icon className="size-5" />
                  {it.count ? (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-ink">
                      {it.count}
                    </span>
                  ) : null}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

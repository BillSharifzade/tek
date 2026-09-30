"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBasket, IconHeart, IconProfile } from "@/components/icons/figma";
import { useHydrated } from "@/lib/hooks";
import { useCart, selectCartCount } from "@/store/cart";
import { useFavorites } from "@/store/favorites";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/cn";

/** Дом — в толщине линий иконок шапки (≈2px), 23×23. */
function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={23} height={23} viewBox="0 0 23 23" fill="none" aria-hidden="true" {...props}>
      <path d="M3 9.6 11.5 2.6 20 9.6V19a1.6 1.6 0 0 1-1.6 1.6h-4.2v-6.2H8.8v6.2H4.6A1.6 1.6 0 0 1 3 19V9.6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Три линии — как у жёлтой кнопки «Каталог» в шапке. */
function IconCatalog(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={23} height={23} viewBox="0 0 23 23" fill="none" aria-hidden="true" {...props}>
      <path d="M4 6h15M4 11.5h15M4 17h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Нижняя навигация (мобайл) в цветах макета: белая, линия #EBEDF8 как под шапкой, иконки шапки,
 * подписи 11px #666 → активный пункт чёрный с жёлтой полосой #FFCC33, счётчик — красный кружок #DF3128 как у корзины.
 */
export function MobileNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const cartCount = useCart(selectCartCount);
  const favCount = useFavorites((s) => s.ids.length);
  const user = useAuth((s) => s.user);

  const items = [
    { href: "/", label: "Главная", Icon: IconHome, count: 0, match: (p: string) => p === "/" },
    { href: "/catalog", label: "Каталог", Icon: IconCatalog, count: 0, match: (p: string) => p.startsWith("/catalog") || p.startsWith("/product") || p.startsWith("/brands") },
    { href: "/account/favorites", label: "Избранное", Icon: IconHeart, count: hydrated ? favCount : 0, match: (p: string) => p.startsWith("/account/favorites") },
    { href: "/cart", label: "Корзина", Icon: IconBasket, count: hydrated ? cartCount : 0, match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout") },
    { href: user ? "/account" : "/login", label: "Профиль", Icon: IconProfile, count: 0, match: (p: string) => (p.startsWith("/account") && !p.startsWith("/account/favorites")) || p === "/login" || p === "/register" },
  ];

  return (
    <nav aria-label="Мобильная навигация" className="fixed inset-x-0 bottom-0 z-[85] border-t border-line-2 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon, count, match }) => {
          const active = match(pathname);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-[56px] flex-col items-center justify-center gap-[4px] text-[11px] leading-[12px] transition-colors", active ? "text-black" : "text-sub hover:text-black")}
              >
                {active ? <span aria-hidden className="absolute inset-x-[22%] top-0 h-[3px] rounded-b-[3px] bg-brand" /> : null}
                <span className="relative flex h-[23px] items-center">
                  <Icon className="h-[21px] w-auto" />
                  {count ? (
                    <span className="absolute -right-[10px] -top-[5px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-sale px-[4px] text-[11px] font-bold leading-[12px] text-white tnum">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

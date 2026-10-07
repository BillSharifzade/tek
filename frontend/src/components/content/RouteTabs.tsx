"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

export interface RouteTab {
  href: string;
  label: string;
  /** старый якорь раздела (/help#delivery) — такие ссылки переводятся на вкладку */
  anchor?: string;
}

/**
 * Кнопки-переключатели разделов (как сегмент-меню «Сервис центр ДГУ», 10877:3563): плашка #EEF0F2 r10 высотой 41,
 * активный пункт — белый r7 с тенью. Каждый пункт — отдельная страница; переход без перезагрузки и без прокрутки наверх,
 * меняется только содержимое под переключателем.
 */
export function RouteTabs({ tabs, label, className }: { tabs: RouteTab[]; label: string; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  // закладки и ссылки старого вида /help#delivery открывают нужную вкладку
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const t = hash ? tabs.find((x) => x.anchor === hash) : undefined;
    if (t && t.href !== pathname) router.replace(t.href, { scroll: false });
  }, [pathname, router, tabs]);

  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-[4px] rounded-[10px] bg-btn p-[4px] md:min-w-0">
        {tabs.map((t) => {
          const on = pathname === t.href;
          return (
            <li key={t.href} className="md:flex-1">
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-[33px] items-center justify-center whitespace-nowrap rounded-[7px] px-[18px] text-[15px] font-semibold leading-[20px] transition-colors",
                  on ? "bg-white text-black shadow-soft" : "text-g333 hover:bg-btn-hover hover:text-black",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ACCOUNT_NAV } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  // anchor links (e.g. "Настройка уведомлений" → /account/personal#notifications) never own the active state
  if (href.includes("#")) return false;
  const base = href;
  if (exact) return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const onLogout = async () => {
    await logout();
    toast.info("Вы вышли из аккаунта");
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="lg:w-[240px] lg:shrink-0">
      <nav aria-label="Личный кабинет" className="rounded-[8px] border border-line bg-white">
        {user ? (
          <div className="border-b border-line px-5 py-4">
            <p className="truncate text-base font-semibold">
              {user.first_name} {user.last_name}
            </p>
            <p className="truncate text-sm text-sub">{user.email}</p>
          </div>
        ) : null}
        <ul className="flex flex-row gap-1 overflow-x-auto p-2 scrollbar-none lg:flex-col lg:overflow-visible">
          {ACCOUNT_NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center rounded-[6px] border-l-[3px] px-3 text-base transition-colors",
                    active ? "border-brand bg-brand-light font-semibold text-ink" : "border-transparent text-ink hover:bg-surface",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-full items-center gap-2 rounded-[6px] px-3 text-base text-sub transition-colors hover:bg-surface hover:text-sale"
          >
            <LogOut className="size-4" aria-hidden />
            Выход
          </button>
        </div>
      </nav>
    </aside>
  );
}

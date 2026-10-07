"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { ButtonLink } from "@/components/ui/Button";
import { AccountSkeleton } from "@/components/account/AccountGuard";
import { Card, CardTitle, btnCls, labelCls } from "@/components/account/shared";
import { isStaff } from "./shared";

/**
 * Клиентский вход в панель: ждёт гидратации авторизации; гость → /login?next=…; клиент (role customer) — «Нет доступа».
 * Настоящая проверка прав — на сервере (каждый /admin/* требует роль ≥ manager).
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, pathname]);

  if (!hydrated) return <AccountSkeleton />;
  if (!user) return null;
  if (!isStaff(user)) {
    return (
      <Card className="max-w-[640px]">
        <CardTitle>Нет доступа</CardTitle>
        <p className={`mt-[21px] ${labelCls}`}>Панель управления доступна только менеджерам и администраторам магазина.</p>
        <div className="mt-[24px] flex flex-wrap gap-[10px]">
          <ButtonLink href="/" className={btnCls}>
            На главную
          </ButtonLink>
          <ButtonLink href="/account" variant="outline" className={btnCls}>
            Личный кабинет
          </ButtonLink>
        </div>
      </Card>
    );
  }
  return <>{children}</>;
}

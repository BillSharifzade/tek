import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <AuthShell
      crumb="Вход"
      title="Вход в личный кабинет"
      subtitle="Персональные цены, кешбэк на бонусный счёт и история заказов"
      footer={<p className="mx-auto mt-[16px] max-w-[360px] text-center text-[13px] leading-[18px] text-muted">Регистрация новых аккаунтов проходит через одобрение компании</p>}
    >
      <Suspense fallback={<Skeleton className="h-[220px] rounded-[10px]" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Skeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <div className="container-page">
      <div className="mx-auto my-12 w-full max-w-[440px]">
        <div className="rounded-[8px] border border-line bg-white p-8 shadow-card">
          <h1 className="text-2xl">Вход в личный кабинет</h1>
          <p className="mt-1.5 text-sub">Персональные цены, кешбэк и история заказов</p>
          <div className="mt-6">
            <Suspense fallback={<Skeleton className="h-56" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="mx-auto mt-5 flex max-w-[360px] items-start gap-2 text-sm text-sub">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <span>Регистрация новых аккаунтов проходит через одобрение компании</span>
        </p>
      </div>
    </div>
  );
}

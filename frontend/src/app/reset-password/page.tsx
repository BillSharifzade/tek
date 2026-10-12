import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/PasswordResetForms";
import { Skeleton } from "@/components/ui/Skeleton";

// ссылка из письма содержит токен — не отдаём её в Referer и не индексируем
export const metadata: Metadata = { title: "Новый пароль", robots: { index: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <AuthShell crumb="Новый пароль" title="Новый пароль" subtitle="Придумайте новый пароль для входа в личный кабинет">
      <Suspense fallback={<Skeleton className="h-[220px] rounded-[10px]" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}

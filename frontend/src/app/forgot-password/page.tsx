import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/PasswordResetForms";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell crumb="Восстановление пароля" title="Восстановление пароля" subtitle="Укажите e-mail или телефон аккаунта — пришлём на e-mail ссылку для смены пароля">
      <ForgotPasswordForm />
    </AuthShell>
  );
}

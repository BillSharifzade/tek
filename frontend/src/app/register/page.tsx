import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <AuthShell crumb="Регистрация" title="Регистрация" width={640} subtitle="После проверки заявки менеджером вам откроется доступ к персональным ценам и кешбэку">
      <RegisterForm />
    </AuthShell>
  );
}

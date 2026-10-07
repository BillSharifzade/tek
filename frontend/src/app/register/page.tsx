import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <AuthShell crumb="Регистрация" title="Регистрация" width={640}>
      <RegisterForm />
    </AuthShell>
  );
}

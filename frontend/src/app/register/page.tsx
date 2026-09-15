import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <div className="container-page">
      <div className="mx-auto my-12 w-full max-w-[640px]">
        <div className="rounded-[8px] border border-line bg-white p-8 shadow-card">
          <h1 className="text-2xl">Регистрация</h1>
          <p className="mt-1.5 max-w-lg text-sub">После проверки заявки менеджером вам откроется доступ к персональным ценам и кешбэку</p>
          <div className="mt-6">
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}

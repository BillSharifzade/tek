"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { AuthAlert } from "./AuthShell";

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const login = useAuth((s) => s.login);
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; text?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginValue.trim() || !password) {
      setError({ title: "Введите e-mail или телефон и пароль" });
      return;
    }
    setBusy(true);
    try {
      const user = await login(loginValue.trim(), password);
      toast.success(`Добро пожаловать, ${user.first_name || user.email}!`);
      router.push(safeNext(sp.get("next")));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === "account_pending") {
        setError({ title: "Аккаунт ожидает одобрения", text: "Регистрация проходит проверку компанией. Мы сообщим на e-mail, когда доступ будет открыт." });
      } else if (err instanceof ApiError && err.status === 401) {
        setError({ title: "Неверный логин или пароль" });
      } else {
        setError({ title: err instanceof ApiError ? err.message : "Не удалось войти. Попробуйте позже" });
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[16px]">
      {error ? <AuthAlert title={error.title} text={error.text} /> : null}
      <Field label="E-mail или телефон" htmlFor="login-id">
        <Input id="login-id" value={loginValue} onChange={(e) => setLoginValue(e.target.value)} autoComplete="username" placeholder="client@tec.tj" autoFocus />
      </Field>
      <Field label="Пароль" htmlFor="login-pass">
        <Input
          id="login-pass"
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          right={
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть пароль" : "Показать пароль"} className="transition-colors hover:text-black">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </Field>
      <Button type="submit" full loading={busy} className="mt-[8px]">
        Войти
      </Button>
      <p className="text-center text-[14px] leading-[20px] text-sub">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-black underline decoration-line-3 underline-offset-[3px] transition-colors hover:decoration-black">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}

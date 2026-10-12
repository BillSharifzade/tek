"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { client } from "@/lib/client";
import { passwordValid } from "@/lib/password";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { AuthAlert } from "./AuthShell";
import { PasswordRules } from "./PasswordRules";

const linkCls = "font-medium text-black underline decoration-line-3 underline-offset-[3px] transition-colors hover:decoration-black";

/** «Забыли пароль?»: логин (e-mail или телефон) → письмо со ссылкой на смену пароля. Ответ один и тот же, есть аккаунт или нет. */
export function ForgotPasswordForm() {
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!login.trim()) {
      setError("Введите e-mail или телефон");
      return;
    }
    setBusy(true);
    try {
      const r = await client.post<{ message: string }>("/auth/password/forgot", { login: login.trim() });
      setSent(r.message);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Слишком много запросов. Попробуйте через несколько минут" : err instanceof ApiError ? err.message : "Не удалось отправить письмо. Попробуйте позже");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-[16px]">
        <AuthAlert tone="info" title="Проверьте почту" text={sent} />
        <p className="text-[14px] leading-[20px] text-sub">
          Письмо не пришло за несколько минут — проверьте папку «Спам». Если в аккаунте не указан e-mail, восстановить доступ поможет ваш менеджер или телефон{" "}
          <a href="tel:+992446206060" className="whitespace-nowrap text-black">
            +992 446 20 60 60
          </a>
          .
        </p>
        <ButtonLink href="/login" full variant="outline">
          Вернуться ко входу
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[16px]">
      {error ? <AuthAlert title={error} /> : null}
      <Field label="E-mail или телефон" htmlFor="forgot-login">
        <Input id="forgot-login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" placeholder="E-mail или телефон" autoFocus />
      </Field>
      <Button type="submit" full loading={busy} className="mt-[8px]">
        Отправить ссылку
      </Button>
      <p className="text-center text-[14px] leading-[20px] text-sub">
        Вспомнили пароль?{" "}
        <Link href="/login" className={linkCls}>
          Войти
        </Link>
      </p>
    </form>
  );
}

/** Новый пароль по ссылке из письма (`/reset-password?token=…`): ссылка проверяется сразу, после смены — вход заново. */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [check, setCheck] = useState<"checking" | "valid" | "invalid">(token ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    client
      .post("/auth/password/check", { token })
      .then(() => !cancelled && setCheck("valid"))
      // сеть / сервер недоступны — даём попробовать: ошибку покажет отправка формы
      .catch((e) => !cancelled && setCheck(e instanceof ApiError && e.code === "invalid_reset_token" ? "invalid" : "valid"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordValid(password)) {
      setError("Пароль не соответствует требованиям");
      return;
    }
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await client.post("/auth/password/reset", { token, password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_reset_token") setCheck("invalid");
      else setError(err instanceof ApiError ? err.message : "Не удалось сменить пароль. Попробуйте позже");
    } finally {
      setBusy(false);
    }
  };

  if (check === "checking") return <Skeleton className="h-[220px] rounded-[10px]" />;

  if (check === "invalid") {
    return (
      <div className="flex flex-col gap-[16px]">
        <AuthAlert title="Ссылка недействительна" text="Ссылка для смены пароля устарела или уже использована. Запросите новую — она действует 1 час." />
        <ButtonLink href="/forgot-password" full>
          Запросить новую ссылку
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-[16px]">
        <AuthAlert tone="info" title="Пароль изменён" text="Войдите с новым паролем. На других устройствах вход нужно будет выполнить заново." />
        <ButtonLink href="/login" full>
          Войти
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[16px]">
      {error ? <AuthAlert title={error} /> : null}
      <Field label="Новый пароль" htmlFor="reset-pass">
        <Input
          id="reset-pass"
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
          right={
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть пароль" : "Показать пароль"} className="transition-colors hover:text-black">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </Field>
      <Field label="Подтверждение пароля" htmlFor="reset-pass2">
        <Input id="reset-pass2" type={show ? "text" : "password"} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
      </Field>
      <PasswordRules password={password} className="-mt-[8px]" />
      <Button type="submit" full loading={busy} className="mt-[8px]">
        Сохранить пароль
      </Button>
    </form>
  );
}

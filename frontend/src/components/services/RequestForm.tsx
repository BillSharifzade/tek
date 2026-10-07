"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isValidPhone, PHONE_ERROR, phoneInputProps } from "@/lib/phone";
import { toast } from "@/store/toast";
import { submitServiceRequest } from "./actions";
import { REQUEST_EVENT } from "./RequestButton";

const field =
  "block w-full rounded-[7px] border border-line bg-white px-[13px] text-[14px] text-black outline-none transition-colors placeholder:text-sub hover:border-outline focus:border-outline-hover";

/** «Оставьте заявку» (Figma 10972:2084): Имя, Телефон, Примечание 584×36/36/77, жёлтая кнопка 175×54. */
export function RequestForm({ service, className = "mt-[25px]" }: { service: string; className?: string }) {
  const id = useId();
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setNote((prev) => (prev.trim() && !prev.startsWith("Интересует:") ? prev : `Интересует: ${detail}`));
    };
    window.addEventListener(REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REQUEST_EVENT, onRequest);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Укажите имя";
    if (!isValidPhone(phone)) next.phone = PHONE_ERROR;
    setErrors(next);
    if (next.name || next.phone) return;
    start(async () => {
      try {
        const res = await submitServiceRequest({ name, phone, note, service, page: pathname });
        if (res.ok) {
          setName("");
          setPhone("");
          setNote("");
          setErrors({});
          toast.success("Заявка отправлена. Мы свяжемся с вами");
        } else if (res.errors) {
          setErrors(res.errors);
        } else {
          toast.error(res.message ?? "Не удалось отправить заявку");
        }
      } catch {
        toast.error("Не удалось отправить заявку. Проверьте соединение");
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className={className} aria-label="Заявка на услугу">
      <div>
        <label htmlFor={`${id}-name`} className="sr-only">
          Имя
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя"
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          className={cn(field, "h-[36px]", errors.name && "border-sale hover:border-sale")}
        />
        {errors.name ? <p className="mt-1 text-[13px] leading-[16px] text-sale-text">{errors.name}</p> : null}
      </div>
      <div className="mt-[13px]">
        <label htmlFor={`${id}-phone`} className="sr-only">
          Телефон
        </label>
        <input
          id={`${id}-phone`}
          {...phoneInputProps(phone, setPhone)}
          placeholder="Телефон"
          aria-invalid={Boolean(errors.phone)}
          className={cn(field, "h-[36px]", errors.phone && "border-sale hover:border-sale")}
        />
        {errors.phone ? <p className="mt-1 text-[13px] leading-[16px] text-sale-text">{errors.phone}</p> : null}
      </div>
      <div className="mt-[13px]">
        <label htmlFor={`${id}-note`} className="sr-only">
          Примечание
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Примечание"
          rows={2}
          className={cn(field, "block h-[77px] min-h-[77px] resize-none pb-[8px] pt-[13px] leading-[20px]")}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-[25px] h-[54px] w-[175px] rounded-[7px] bg-brand text-[16px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Отправляем…" : "Оставить заявку"}
      </button>
    </form>
  );
}

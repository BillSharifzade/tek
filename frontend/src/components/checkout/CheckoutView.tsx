"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Cart, CheckoutOptions, CheckoutPayload, CheckoutResult } from "@/lib/types";
import { client } from "@/lib/client";
import { ApiError } from "@/lib/api";
import { dayMonth, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/toast";
import { useHydrated } from "@/lib/hooks";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { rememberOrderEmail } from "@/components/account/OrderSummaryCard";
import { SummaryRow } from "@/components/cart/CartSummary";
import { Chip, DashLine, Leader } from "@/components/cart/parts";
import { IconAlif, IconCoins, IconDcBank, IconLift, IconLocateBtn } from "@/components/cart/icons";
import { DUSHANBE, DeliveryMap, geocode, reverseGeocode } from "./DeliveryMap";

interface FormState {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  method: string;
  address: string;
  date: string;
  store_id: number | null;
  payment: string;
  comment: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

/** Поля чекаута в макете: рамка #E5E5E5, r7, плейсхолдер #666. */
const coField = "rounded-[7px] border-line placeholder:text-sub";

const confirmBtn =
  "flex w-[253px] max-w-full shrink-0 items-center justify-center rounded-[4px] bg-brand text-[15px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[17px] font-semibold leading-[12px] text-black">{children}</h2>;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="mt-[6px] text-[13px] leading-[17px] text-sale" role="alert">
      {children}
    </p>
  );
}

/** «Итого ……… 1 660,00 с.» 19/40 SemiBold, лидер Line 5 (Figma 10545:213–215). */
function TotalLine({ total, className }: { total: number; className?: string }) {
  return (
    <div className={cn("flex w-[253px] max-w-full items-baseline text-[19px] font-semibold leading-[40px] text-black tnum", className)}>
      <span className="shrink-0">Итого</span>
      <Leader className="relative top-[4px] mb-[-2px] ml-[7px] mr-[5px] self-baseline" />
      <span className="shrink-0 whitespace-nowrap">{money(total)}</span>
    </div>
  );
}

function IconInvoice(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={22} height={26} viewBox="0 0 22 26" fill="none" aria-hidden {...props}>
      <path d="M3 1.2h11l6.8 6.8V23a1.8 1.8 0 0 1-1.8 1.8H3A1.8 1.8 0 0 1 1.2 23V3A1.8 1.8 0 0 1 3 1.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13.6 1.6V8.4h6.8M5.5 13h11M5.5 17h11M5.5 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Поле «Дата» (Figma Group 106, 166×56): открывает нативный календарь в пределах доступных дат. */
function DateField({ value, options, onChange, invalid }: { value: string; options: CheckoutOptions["delivery_dates"]; onChange: (d: string) => void; invalid?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const available = options.filter((d) => d.available).map((d) => d.date);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
        className={cn(
          "flex h-[56px] w-[166px] items-center rounded-[7px] border bg-white pb-[4px] pl-[13px] text-left text-[14px] leading-[12px] transition-colors hover:border-outline",
          invalid ? "border-sale" : "border-line",
          value ? "text-black" : "text-sub",
        )}
      >
        {value ? dayMonth(value) : "Дата"}
      </button>
      <input
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-label="Дата доставки"
        value={value}
        min={available[0]}
        max={available[available.length - 1]}
        onChange={(e) => {
          const d = e.target.value;
          if (!d) return;
          if (available.includes(d)) onChange(d);
          else toast.error("На эту дату доставка недоступна");
        }}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
      />
    </div>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const { cart, loaded, setCart } = useCart();
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [form, setForm] = useState<FormState>({ first_name: "", last_name: "", phone: "", email: "", method: "courier", address: "", date: "", store_id: null, payment: "", comment: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [center, setCenter] = useState<[number, number]>(DUSHANBE);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    client
      .get<CheckoutOptions>("/checkout/options")
      .then((o) => {
        setOptions(o);
        setForm((f) => ({
          ...f,
          method: f.method || o.delivery_methods[0]?.code || "courier",
          date: f.date || o.delivery_dates.find((d) => d.available)?.date || "",
          store_id: f.store_id ?? o.stores[0]?.id ?? null,
          payment: f.payment || o.payment_methods.find((p) => p.available)?.code || "",
        }));
      })
      .catch(() => toast.error("Не удалось загрузить параметры доставки"));
  }, []);

  if (user && !prefilled) {
    // первый рендер с известным пользователем → один раз подставляем контакты (derived state, без эффекта)
    setPrefilled(true);
    setForm((f) => ({ ...f, first_name: user.first_name, last_name: user.last_name, phone: user.phone, email: user.email, address: user.company?.address ?? f.address }));
  }

  const selectedItems = useMemo(() => cart?.items.filter((i) => i.selected) ?? [], [cart]);
  const deliveryMethod = options?.delivery_methods.find((m) => m.code === form.method);
  const deliveryPrice = form.method === "pickup" ? 0 : (deliveryMethod?.price ?? 0);

  if (!hydrated || !loaded || !options) {
    return (
      <div className="mt-[32px] grid grid-cols-1 gap-6 lg:grid-cols-[740px_297px] lg:gap-x-[36px]">
        <Skeleton className="h-[1284px] rounded-[10px]" />
        <Skeleton className="h-[137px] rounded-[10px]" />
      </div>
    );
  }

  if (!cart || selectedItems.length === 0) {
    return (
      <div className="mt-[32px] max-w-[740px] rounded-[10px] border border-line-3 bg-white px-[38px] py-[48px] text-center">
        <p className="text-[20px] font-bold leading-[24px]">В корзине нет выбранных товаров</p>
        <p className="mt-[8px] text-[14px] leading-[20px] text-sub">Отметьте товары в корзине, чтобы оформить заказ.</p>
        <Link href="/cart" className={cn(confirmBtn, "mx-auto mt-[24px] h-[44px]")}>
          Перейти в корзину
        </Link>
      </div>
    );
  }

  const total = Math.round((cart.total + deliveryPrice) * 100) / 100;
  const pickup = form.method === "pickup";

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Браузер не поддерживает определение местоположения");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setCenter(c);
        const addr = await reverseGeocode(c[0], c[1]);
        if (addr) set("address", addr);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Не удалось определить местоположение");
      },
      { timeout: 10000 },
    );
  };

  const findOnMap = async () => {
    const q = form.address.trim();
    if (q.length < 4) return;
    const c = await geocode(q);
    if (c) setCenter(c);
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.first_name.trim()) e.first_name = "Укажите имя";
    if (!/^\+?\d[\d\s()-]{6,}$/.test(form.phone.trim())) e.phone = "Укажите корректный номер телефона";
    if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Укажите e-mail — на него придёт подтверждение заказа";
    if (!pickup && !form.address.trim()) e.address = "Укажите адрес доставки";
    if (!pickup && !form.date) e.date = "Выберите дату доставки";
    if (pickup && !form.store_id) e.store_id = "Выберите магазин";
    if (!form.payment) e.payment = "Выберите способ оплаты";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast.error("Проверьте заполнение формы");
      return;
    }
    setBusy(true);
    const email = form.email.trim() || user?.email || "";
    const payload: CheckoutPayload = {
      contact: { first_name: form.first_name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim(), email },
      delivery: pickup ? { method: "pickup", store_id: form.store_id ?? undefined } : { method: form.method, address: form.address.trim(), date: form.date },
      payment: { method: form.payment },
      comment: form.comment.trim() || undefined,
    };
    try {
      const r = await client.post<CheckoutResult>("/checkout", payload);
      rememberOrderEmail(email);
      try {
        setCart(await client.get<Cart>("/cart"));
      } catch {
        /* ignore */
      }
      if (r.payment.kind === "redirect" && r.payment.url) {
        window.location.href = r.payment.url;
        return;
      }
      router.push(`/checkout/success/${r.order.number}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "insufficient_stock") {
        toast.error("Некоторых товаров недостаточно в наличии. Проверьте корзину.");
        router.push("/cart");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Не удалось оформить заказ");
      }
      setBusy(false);
    }
  };

  const payIcon = (code: string) => {
    switch (code) {
      case "alif":
        return { icon: <IconAlif className="mr-[13px] shrink-0" />, cls: "pl-[17px]" };
      case "dc":
        return { icon: <IconDcBank className="mr-[15px] shrink-0" />, cls: "pl-[15px]" };
      case "cash":
        return { icon: <IconCoins className="mr-[12px] shrink-0 text-[#5F6061]" />, cls: "pl-[15px]" };
      default:
        return { icon: <IconInvoice className="mr-[12px] shrink-0 text-[#5F6061]" />, cls: "pl-[17px]" };
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-[32px] grid grid-cols-1 gap-6 lg:grid-cols-[740px_297px] lg:items-start lg:gap-x-[36px]">
      <div className="min-w-0 rounded-[10px] border border-line-3 bg-white">
        {/* Способ получения — из API (доставка / самовывоз), в стиле чипсов макета */}
        <section className="px-[16px] pb-[23px] pt-[30px] sm:pl-[38px] sm:pr-[35px]">
          <SectionTitle>Способ получения</SectionTitle>
          <div className="mt-[22px] flex flex-wrap gap-[9px]" role="radiogroup" aria-label="Способ получения">
            {options.delivery_methods.map((m) => (
              <Chip
                key={m.code}
                role="radio"
                aria-checked={form.method === m.code}
                active={form.method === m.code}
                onClick={() => set("method", m.code)}
                title={m.label}
                sub={m.price > 0 ? money(m.price) : "бесплатно"}
              />
            ))}
          </div>
        </section>
        <DashLine />

        {!pickup ? (
          <>
            <section className="px-[16px] pb-[28px] pt-[25px] sm:pl-[38px] sm:pr-[35px]">
              <p className="inline-flex min-h-[38px] items-center rounded-[7px] bg-brand-light py-[8px] pl-[16px] pr-[15px] text-[14px] leading-[16px] text-g333">
                <IconLift className="mr-[9px] shrink-0 text-g333" />
                {options.note}
              </p>
              <div className="mt-[20px]">
                <SectionTitle>Адрес доставки</SectionTitle>
              </div>
              <div className="mt-[19px] flex gap-[7px]">
                <button
                  type="button"
                  onClick={locate}
                  disabled={locating}
                  aria-label="Определить моё местоположение"
                  title="Определить моё местоположение"
                  className="flex size-[36px] shrink-0 items-center justify-center rounded-[6px] bg-btn text-[#5F6061] transition-colors hover:bg-btn-hover hover:text-black disabled:animate-pulse"
                >
                  <IconLocateBtn />
                </button>
                <div className="min-w-0 flex-1">
                  <Input
                    id="co-address"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    onBlur={() => void findOnMap()}
                    invalid={Boolean(errors.address)}
                    placeholder="Адрес"
                    aria-label="Адрес доставки"
                    autoComplete="street-address"
                    className={coField}
                  />
                  <FieldError>{errors.address}</FieldError>
                </div>
              </div>
              <DeliveryMap center={center} className="mt-[17px]" />
            </section>
            <DashLine />

            <section className="px-[16px] pb-[23px] pt-[25px] sm:pl-[38px] sm:pr-[35px]">
              <SectionTitle>Дата доставки</SectionTitle>
              <div className="mt-[20px] flex flex-wrap gap-[9px]" role="radiogroup" aria-label="Дата доставки">
                <DateField value={form.date} options={options.delivery_dates} onChange={(d) => set("date", d)} invalid={Boolean(errors.date)} />
                {options.delivery_dates.map((d) => (
                  <Chip
                    key={d.date}
                    role="radio"
                    aria-checked={form.date === d.date}
                    active={form.date === d.date}
                    disabled={!d.available}
                    onClick={() => set("date", d.date)}
                    title={d.label}
                    sub={d.available ? d.day_label : "недоступно"}
                  />
                ))}
              </div>
              <FieldError>{errors.date}</FieldError>
            </section>
          </>
        ) : (
          <section className="px-[16px] pb-[23px] pt-[25px] sm:pl-[38px] sm:pr-[35px]">
            <SectionTitle>Пункт самовывоза</SectionTitle>
            <div className="mt-[20px] flex flex-wrap gap-[9px]" role="radiogroup" aria-label="Магазин самовывоза">
              {options.stores.map((s) => (
                <Chip
                  key={s.id}
                  role="radio"
                  aria-checked={form.store_id === s.id}
                  active={form.store_id === s.id}
                  onClick={() => set("store_id", s.id)}
                  title={`${s.city} · ${s.name}`}
                  sub={s.address}
                  className="h-auto min-h-[56px] max-w-full py-[13px] [&_span]:whitespace-normal [&_span:last-child]:leading-[16px] [&_span:last-child]:mt-[4px]"
                />
              ))}
            </div>
            <FieldError>{errors.store_id}</FieldError>
            <p className="mt-[16px] text-[14px] leading-[18px] text-sub">{deliveryMethod?.description}</p>
          </section>
        )}
        <DashLine />

        <section className="px-[16px] pb-[25px] pt-[26px] sm:pl-[38px] sm:pr-[35px]">
          <SectionTitle>Способ оплаты</SectionTitle>
          <div className="mt-[22px] flex flex-wrap gap-[9px]" role="radiogroup" aria-label="Способ оплаты">
            {options.payment_methods
              .filter((p) => p.available || p.code !== "invoice")
              .map((p) => {
                const { icon, cls } = payIcon(p.code);
                return (
                  <Chip
                    key={p.code}
                    role="radio"
                    aria-checked={form.payment === p.code}
                    active={form.payment === p.code}
                    disabled={!p.available}
                    onClick={() => set("payment", p.code)}
                    icon={icon}
                    title={p.label}
                    sub={p.sublabel}
                    className={cn("pb-[2px]", cls)}
                  />
                );
              })}
          </div>
          <FieldError>{errors.payment}</FieldError>
        </section>
        <DashLine />

        <section className="px-[16px] pb-[28px] pt-[27px] sm:pl-[38px] sm:pr-[35px]">
          <SectionTitle>Контактные данные</SectionTitle>
          <div className="mt-[22px] grid grid-cols-1 gap-x-[17px] gap-y-[12px] sm:grid-cols-2">
            <div>
              <Input
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                invalid={Boolean(errors.first_name)}
                placeholder="Имя"
                aria-label="Имя"
                autoComplete="given-name"
                className={coField}
              />
              <FieldError>{errors.first_name}</FieldError>
            </div>
            <div>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                invalid={Boolean(errors.phone)}
                placeholder="Телефон"
                aria-label="Телефон"
                autoComplete="tel"
                className={coField}
              />
              <FieldError>{errors.phone}</FieldError>
            </div>
            {!user ? (
              <div>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  invalid={Boolean(errors.email)}
                  placeholder="E-mail"
                  aria-label="E-mail"
                  autoComplete="email"
                  className={coField}
                />
                <FieldError>{errors.email}</FieldError>
              </div>
            ) : null}
          </div>
          {!user ? (
            <p className="mt-[12px] text-[13px] leading-[17px] text-muted">
              <Link href="/login?next=/checkout" className="link-hover text-link">
                Войдите
              </Link>
              , чтобы получить персональные цены, кэшбэк и оплату по счёту для юрлиц.
            </p>
          ) : null}
        </section>
        <DashLine />

        <section className="px-[16px] pb-[29px] pt-[25px] sm:pl-[36px] sm:pr-[35px]">
          <SectionTitle>Комментарий к заказу</SectionTitle>
          <Textarea
            value={form.comment}
            onChange={(e) => set("comment", e.target.value)}
            placeholder="Комментарий"
            aria-label="Комментарий к заказу"
            className={cn(coField, "mt-[20px] h-[72px] min-h-[72px] resize-none py-[7px] sm:w-[667px]")}
          />
        </section>
        <DashLine />

        <div className="flex flex-wrap items-start gap-x-[93px] gap-y-4 px-[16px] pb-[34px] pt-[29px] sm:pl-[36px] sm:pr-[35px]">
          <TotalLine total={total} className="mt-[4px]" />
          <button type="submit" disabled={busy} className={cn(confirmBtn, "h-[45px]")}>
            {busy ? "Оформляем…" : "Подтвердить заказ"}
          </button>
        </div>
      </div>

      <aside className="rounded-[10px] border border-line-3 bg-white px-[21px] pb-[24px] pt-[21px] lg:sticky lg:top-[134px] lg:pt-[14px]">
        <div className="hidden lg:block">
          <TotalLine total={total} />
          <button type="submit" disabled={busy} className={cn(confirmBtn, "mt-[12px] h-[44px]")}>
            {busy ? "Оформляем…" : "Подтвердить заказ"}
          </button>
        </div>
        <div className="flex flex-col gap-[7px] lg:mt-[16px]">
          <SummaryRow label={`Товары (${selectedItems.length})`} value={money(cart.subtotal_list)} />
          {cart.discount_total > 0 ? <SummaryRow label="Скидка" value={money(cart.discount_total)} green /> : null}
          {cart.coupon ? <SummaryRow label={`Промокод ${cart.coupon.code}`} value={money(cart.coupon.discount)} green /> : null}
          <SummaryRow label="Доставка" value={deliveryPrice > 0 ? money(deliveryPrice) : "бесплатно"} />
          {cart.cashback_total > 0 ? <SummaryRow label="Кэшбэк" value={money(cart.cashback_total)} className="text-[#4938F8]" /> : null}
        </div>
        <p className="mt-[12px] text-[12px] leading-[16px] text-muted">
          Нажимая «Подтвердить заказ», вы соглашаетесь с условиями продажи и обработкой персональных данных.
        </p>
      </aside>
    </form>
  );
}

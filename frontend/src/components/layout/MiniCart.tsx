"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/types";
import { countLabel, money, stockQty } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useCart } from "@/store/cart";
import { ImageBox } from "@/components/ui/ImageBox";
import { IconTrash } from "@/components/cart/icons";
import { packStep, snapQty } from "@/lib/qty";

/**
 * Мини-корзина под иконкой «Корзина» в шапке (референс — «Прочие дополнительные элементы» 10522:1897, как у Петровича):
 * «Корзина: N товаров», «Всего», кнопка «Перейти в корзину», строки товаров (фото, код, название, цена, количество, «Удалить»).
 * Открывается наведением мыши (задержка 150 мс, закрытие 200 мс) и фокусом с клавиатуры; Escape закрывает.
 * На сенсорных экранах не показывается — только устройства с (hover: hover) and (pointer: fine).
 */

const HOVER_MQ = "(hover: hover) and (pointer: fine)";
const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;

function subscribeHover(cb: () => void) {
  const m = window.matchMedia(HOVER_MQ);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** true, если у устройства есть «настоящий» курсор (мышь/тачпад). На SSR — false. */
function useCanHover(): boolean {
  return useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia(HOVER_MQ).matches,
    () => false,
  );
}

/**
 * Компактный степпер строки: «−  1  +» (14 Medium #666, кнопки 24×24 r5), число редактируется.
 * Как в референсе и в строках корзины макета (8641:438) — голые «−»/«+»; серый квадрат #EEF0F2 только при наведении
 * (то же правило, что у степпера карточки).
 */
function MiniQty({ value, onChange, label, step = 1 }: { value: number; onChange: (v: number) => void; label: string; step?: number }) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setText(String(value));
  }
  const commit = (raw: string) => {
    // поле стёрли кликом и ничего не ввели — остаётся прежнее количество
    if (!raw.trim()) {
      setText(String(value));
      return;
    }
    const next = snapQty(Math.min(Math.floor(Number(raw.replace(",", ".").replace(/\s/g, ""))), 99999), step);
    setText(String(next));
    if (next !== value) onChange(next);
  };
  const btn =
    "flex size-[24px] shrink-0 items-center justify-center rounded-[5px] text-sub transition-colors hover:bg-btn hover:text-black disabled:text-[#C4C4C4] disabled:hover:bg-transparent disabled:hover:text-[#C4C4C4]";
  return (
    <div className="flex items-center gap-[4px]" role="group" aria-label={label}>
      <button type="button" onClick={() => value > step && onChange(value - step)} disabled={value <= step} aria-label="Уменьшить" className={btn}>
        <svg width={8} height={2} viewBox="0 0 8 2" aria-hidden>
          <rect y="0.35" width="8" height="1.3" fill="currentColor" />
        </svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        aria-label={label}
        onFocus={() => setText("")}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(value + step);
          }
          if (e.key === "ArrowDown" && value > step) {
            e.preventDefault();
            onChange(value - step);
          }
        }}
        className="h-[24px] w-[44px] min-w-0 rounded-[4px] bg-transparent p-0 text-center text-[14px] font-medium leading-[20px] text-g333 tnum outline-none transition-colors hover:bg-surface focus:bg-surface"
      />
      <button type="button" onClick={() => onChange(value + step)} aria-label="Увеличить" className={btn}>
        <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden>
          <path d="M0 4h8M4 0v8" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
    </div>
  );
}

function MiniCartRow({ item }: { item: CartItem }) {
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const p = item.product;
  const href = `/product/${p.slug}`;
  const shortage = item.error ?? (item.qty > item.stock_total && item.stock_total >= 0 ? { available: item.stock_total } : null);

  return (
    <li className="flex gap-[14px] border-t border-line py-[16px] first:border-t-0 last:pb-0">
      <Link href={href} tabIndex={-1} aria-hidden className="shrink-0">
        <ImageBox src={p.image} alt={p.name} className="size-[56px] bg-white" sizes="56px" rounded="rounded-[5px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[15px] text-muted tnum">Код: {p.code}</p>
        <Link href={href} className="link-hover mt-[4px] line-clamp-2 text-[14px] leading-[18px] text-black">
          {p.name}
        </Link>
        <div className="mt-[9px] flex items-center justify-between gap-[10px]">
          <div className="min-w-0 tnum">
            <p className="whitespace-nowrap text-[16px] font-bold leading-[18px] text-black">{money(item.line_total)}</p>
            {item.qty !== 1 ? (
              <p className="mt-[2px] whitespace-nowrap text-[12px] leading-[14px] text-muted">
                {money(item.price.price)} {p.price_unit_label}
              </p>
            ) : null}
          </div>
          <MiniQty value={item.qty} step={packStep(p)} label={`Количество ${p.name}`} onChange={(v) => void update(item.id, { qty: v }).catch(() => {})} />
        </div>
        {shortage ? (
          <p role="alert" className="mt-[4px] text-[12px] leading-[14px] text-sale tnum">
            В наличии {stockQty(shortage.available)} {p.unit}
          </p>
        ) : null}
        <button type="button" onClick={() => void remove(item.id).catch(() => {})} className="link-hover mt-[8px] flex items-center gap-[4px] text-[13px] leading-[15px] text-sub">
          <IconTrash className="-mt-px size-[14px] shrink-0" />
          Удалить
        </button>
      </div>
    </li>
  );
}

export interface MiniCartTriggerState {
  open: boolean;
  /** aria-атрибуты для ссылки «Корзина» (пустой объект, если поповер недоступен) */
  triggerProps: {
    "aria-haspopup"?: "dialog";
    "aria-expanded"?: boolean;
    "aria-controls"?: string;
  };
}

/**
 * Обёртка вокруг ссылки «Корзина»: следит за наведением/фокусом и рисует выпадающую мини-корзину,
 * выровненную по правому краю шапки (x=1386) сразу под линией шапки (y=113).
 */
export function MiniCart({
  className,
  disabled,
  children,
}: {
  className?: string;
  /** не показывать (страница корзины) */
  disabled?: boolean;
  children: (state: MiniCartTriggerState) => React.ReactNode;
}) {
  const cart = useCart((s) => s.cart);
  const canHover = useCanHover();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFocusOpen = useRef(false);
  const id = useId();

  const count = cart?.items_count ?? cart?.items.length ?? 0;
  const available = canHover && !disabled && !!cart;
  const shown = available && open;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const schedule = (next: boolean, delay: number) => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(next), delay);
  };
  const close = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => clearTimer, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape" || !shown) return;
    e.stopPropagation();
    close();
    const trigger = rootRef.current?.querySelector<HTMLAnchorElement>("a[data-minicart-trigger]");
    if (trigger && document.activeElement !== trigger) {
      skipFocusOpen.current = true; // возврат фокуса на ссылку не должен снова раскрыть поповер
      trigger.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch" || !available) return;
        if (count > 0 || open) schedule(true, open ? 0 : OPEN_DELAY);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "touch") return;
        schedule(false, CLOSE_DELAY);
      }}
      onFocus={(e) => {
        if (skipFocusOpen.current) {
          skipFocusOpen.current = false;
          return;
        }
        // только фокус с клавиатуры: клик мышью/тап по ссылке не должен раскрывать поповер
        if (available && count > 0 && e.target.matches(":focus-visible")) {
          clearTimer();
          setOpen(true);
        }
      }}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
      onKeyDown={onKeyDown}
    >
      {children({
        open: shown,
        triggerProps: available && count > 0 ? { "aria-haspopup": "dialog", "aria-expanded": shown, "aria-controls": shown ? id : undefined } : {},
      })}
      {shown && cart ? (
        // pt-[23px] — прозрачный «мостик» от низа иконки (y=91) до линии шапки (y=113 + 1px), чтобы курсор не терял наведение
        <div className="absolute right-0 top-full z-[90] pt-[23px]">
          <div
            id={id}
            role="dialog"
            aria-label="Корзина"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) close();
            }}
            className="w-[400px] rounded-[7px] bg-white p-[24px] text-left shadow-pop animate-fade-in"
          >
            {cart.items.length === 0 ? (
              <p className="py-[8px] text-center text-[15px] leading-[20px] text-sub">Корзина пуста</p>
            ) : (
              <>
                <p className="text-[16px] leading-[20px] text-g333">
                  <span className="font-semibold text-black">Корзина:</span> {countLabel(count, ["товар", "товара", "товаров"])}
                </p>
                <p className="mt-[10px] text-[22px] font-bold leading-[26px] text-black tnum">Всего: {money(cart.total)}</p>
                <Link
                  href="/cart"
                  className="mt-[16px] flex h-[44px] items-center justify-center rounded-[7px] bg-brand text-[15px] font-medium leading-[20px] text-black transition-colors hover:bg-brand-hover"
                >
                  Перейти в корзину
                </Link>
                <ul className="-mx-[24px] mt-[20px] max-h-[min(412px,calc(100vh-330px))] overflow-y-auto overscroll-contain border-t border-line px-[24px]">
                  {cart.items.map((it) => (
                    <MiniCartRow key={it.id} item={it} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

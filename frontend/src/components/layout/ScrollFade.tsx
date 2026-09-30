"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Подсказка «дальше есть ещё» у горизонтально прокручиваемых полос (табы товара, табы прайса ДГУ,
 * таблица регламента ТО на мобильных): края плавно гаснут маской, пока в ту сторону есть что листать.
 * Хук ставит на элемент data-fade="r" | "l" | "lr" | "" — сами маски задаются классами ниже.
 */
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const l = el.scrollLeft > 1;
      const r = max > 1 && el.scrollLeft < max - 1;
      const v = `${l ? "l" : ""}${r ? "r" : ""}`;
      if (el.dataset.fade !== v) el.dataset.fade = v;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  return ref;
}

/** Маски краёв: справа 40px, слева 24px. */
export const FADE_X =
  "data-[fade=r]:[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] data-[fade=l]:[mask-image:linear-gradient(to_left,#000_calc(100%-24px),transparent)] data-[fade=lr]:[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-40px),transparent)]";

/** То же, но только ниже lg (на десктопе полоса не прокручивается и маска не нужна). */
export const FADE_X_BELOW_LG =
  "max-lg:data-[fade=r]:[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] max-lg:data-[fade=l]:[mask-image:linear-gradient(to_left,#000_calc(100%-24px),transparent)] max-lg:data-[fade=lr]:[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-40px),transparent)]";

/** Обёртка-прокрутка с масками краёв — для серверных компонентов (таблица регламента ТО). */
export function ScrollFade({ className, belowLg, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { belowLg?: boolean }) {
  const ref = useScrollFade<HTMLDivElement>();
  return (
    <div ref={ref} className={cn(belowLg ? FADE_X_BELOW_LG : FADE_X, className)} {...rest}>
      {children}
    </div>
  );
}

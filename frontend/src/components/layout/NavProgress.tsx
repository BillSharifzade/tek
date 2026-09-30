"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Показывать полосу, только если переход дольше этого — быстрые переходы не мигают. */
const SHOW_AFTER = 150;
const GIVE_UP = 10_000;

/** Внутренняя ссылка, клик по которой приведёт к клиентскому переходу на другой адрес. */
function navigatingLink(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("download") || (a.target && a.target !== "_self")) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  return url.pathname !== location.pathname || url.search !== location.search;
}

/**
 * Тонкая жёлтая полоса прогресса сверху при переходах между страницами без loading.js
 * (например, из каталога в карточку товара): стартует по клику на внутреннюю ссылку, завершается сменой адреса.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search.toString()}`;
  // переход, начатый с адреса `from`; shown — полоса уже видна (переход дольше SHOW_AFTER)
  const [nav, setNav] = useState<{ from: string; shown: boolean } | null>(null);
  const keyRef = useRef(key);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    const clear = () => timers.current.splice(0).forEach((t) => window.clearTimeout(t));
    const onClick = (e: MouseEvent) => {
      if (!navigatingLink(e)) return;
      clear();
      setNav({ from: keyRef.current, shown: false });
      timers.current.push(
        window.setTimeout(() => setNav((n) => n && { ...n, shown: true }), SHOW_AFTER),
        window.setTimeout(() => setNav(null), GIVE_UP),
      );
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  const finished = nav !== null && nav.from !== key;
  // адрес сменился — переход завершён: дорисовать до конца, погасить и забыть
  useEffect(() => {
    if (!finished) return;
    timers.current.splice(0).forEach((t) => window.clearTimeout(t));
    const t = window.setTimeout(() => setNav(null), 450);
    return () => window.clearTimeout(t);
  }, [finished]);

  if (!nav?.shown) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className={finished ? "h-full w-full bg-brand opacity-0 transition-opacity duration-300" : "animate-nav-progress h-full bg-brand"}
        style={finished ? { transitionDelay: "120ms" } : undefined}
      />
    </div>
  );
}

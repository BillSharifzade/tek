"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDebounced } from "@/lib/hooks";

/** Фильтры списка в адресной строке (?status=…&q=…&page=…): ссылки на отфильтрованный список и «назад» из карточки. */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const sp = useSearchParams();
  const get = useCallback((k: string, d = "") => sp?.get(k) ?? d, [sp]);
  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(sp?.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      // любой новый фильтр — снова с первой страницы
      if (!("page" in patch)) next.delete("page");
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );
  const hrefFor = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(sp?.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || (k === "page" && v === 1)) next.delete(k);
        else next.set(k, String(v));
      }
      const s = next.toString();
      return s ? `${pathname}?${s}` : pathname;
    },
    [sp, pathname],
  );
  return { get, set, hrefFor, key: sp?.toString() ?? "" };
}

/** Поле поиска, синхронизированное с ?q= с задержкой 300 мс. */
export function useSearchText(q: ReturnType<typeof useQueryState>, param = "q") {
  const current = q.get(param);
  const [text, setText] = useState(current);
  const debounced = useDebounced(text, 300);
  const { set } = q;
  useEffect(() => {
    if (debounced.trim() !== current) set({ [param]: debounced.trim() || null });
    // только по введённому тексту: смена адреса из других фильтров не должна перезапускать поиск
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return [text, setText] as const;
}

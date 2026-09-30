"use client";

import { useEffect, useState } from "react";
import { client } from "@/lib/client";
import { useAuth } from "@/store/auth";

/**
 * id собственных отзывов/вопросов пользователя (из личного кабинета) — чтобы показать «Удалить» только у своих:
 * публичные списки на карточке товара кешируются и не содержат признака «мой».
 */
export function useMine(kind: "reviews" | "questions"): [Set<string>, (id: string) => void] {
  const user = useAuth((s) => s.user);
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    let alive = true;
    client
      .get<{ id: string }[]>(`/account/${kind}`)
      .then((rows) => {
        if (alive) setIds(new Set(rows.map((r) => r.id)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, kind]);
  const forget = (id: string) =>
    setIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  return [user ? ids : new Set<string>(), forget];
}

"use client";

import { useEffect, useState } from "react";
import { client } from "@/lib/client";
import { useAuth } from "@/store/auth";

export interface Mine {
  /** id собственных отзывов / вопросов */
  ids: Set<string>;
  /** товары (slug), о которых пользователь уже оставил отзыв / вопрос */
  products: Set<string>;
  /** только что опубликованное — «Удалить» появляется сразу, без перезагрузки страницы */
  add: (id: string, product: string) => void;
  forget: (id: string) => void;
}

/**
 * Собственные отзывы/вопросы пользователя (из личного кабинета) — чтобы показать «Удалить» только у своих:
 * публичные списки на карточке товара кешируются и не содержат признака «мой».
 */
export function useMine(kind: "reviews" | "questions"): Mine {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<{ id: string; product: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    client
      .get<{ id: string; product: { slug: string } }[]>(`/account/${kind}`)
      .then((r) => {
        if (alive) setRows(r.map((x) => ({ id: x.id, product: x.product.slug })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, kind]);
  const own = user ? rows : [];
  return {
    ids: new Set(own.map((r) => r.id)),
    products: new Set(own.map((r) => r.product)),
    add: (id, product) => setRows((prev) => [{ id, product }, ...prev.filter((r) => r.id !== id)]),
    forget: (id) => setRows((prev) => prev.filter((r) => r.id !== id)),
  };
}

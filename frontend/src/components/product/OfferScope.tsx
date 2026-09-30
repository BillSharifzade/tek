"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface OfferNav {
  /** исполнение, на которое сейчас идёт переход (кнопки подсвечивают его сразу, не дожидаясь сервера) */
  pending: string | null;
  open: (slug: string) => void;
}

const Ctx = createContext<OfferNav | null>(null);

/**
 * Область товара, которая меняется при выборе исполнения (заголовок, фото, характеристики, цена, наличие).
 * Переход — клиентский, без перезагрузки и без прокрутки; пока сервер отдаёт новое исполнение, старое остаётся
 * на экране и через 150 мс чуть приглушается (`.offer-dim`), чтобы быстрые переключения не мигали.
 */
export function OfferScope({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  const open = useCallback(
    (slug: string) => {
      setTarget(slug);
      startTransition(() => router.push(`/product/${slug}`, { scroll: false }));
    },
    [router],
  );
  const value = useMemo(() => ({ pending: isPending ? target : null, open }), [isPending, target, open]);

  return (
    <Ctx.Provider value={value}>
      <div className={className} data-offer-pending={isPending ? "" : undefined} aria-busy={isPending || undefined}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useOfferNav(): OfferNav | null {
  return useContext(Ctx);
}

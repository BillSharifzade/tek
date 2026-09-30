"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { useFavorites } from "@/store/favorites";
import { ensureFreshAccess } from "@/lib/client";

/**
 * Hydrates client stores once per app load (auth → cart → favorites) и следит за access-токеном:
 * сервер рендерит персональные цены по cookie, поэтому токен обновляется заранее (он живёт 15 минут),
 * а если страница пришла уже с истёкшим токеном — после обновления она перерисовывается с ценами клиента.
 */
export function AppInit() {
  const router = useRouter();
  useEffect(() => {
    useAuth.getState().hydrate();
    void ensureFreshAccess(0).then((refreshed) => {
      if (refreshed) router.refresh();
      void useCart.getState().load();
      void useFavorites.getState().hydrate();
      void useAuth.getState().refreshUser();
    });
    const timer = window.setInterval(() => void ensureFreshAccess(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}

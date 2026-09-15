"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { useFavorites } from "@/store/favorites";

/** Hydrates client stores once per app load (auth → cart → favorites). */
export function AppInit() {
  useEffect(() => {
    useAuth.getState().hydrate();
    void useCart.getState().load();
    void useFavorites.getState().hydrate();
    void useAuth.getState().refreshUser();
  }, []);
  return null;
}

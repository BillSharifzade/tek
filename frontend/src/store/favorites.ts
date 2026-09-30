"use client";

import { create } from "zustand";
import { client } from "@/lib/client";
import { readAuth } from "@/lib/auth-storage";
import type { ProductCard } from "@/lib/types";
import { toast } from "./toast";

const KEY = "tek_favorites_v2";

type LocalMap = Record<string, ProductCard>;

function readLocal(): LocalMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" ? (obj as LocalMap) : {};
  } catch {
    return {};
  }
}

function writeLocal(map: LocalMap) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

interface FavState {
  ids: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: (product: ProductCard) => Promise<void>;
  remove: (id: string) => Promise<void>;
  list: () => Promise<ProductCard[]>;
}

export const useFavorites = create<FavState>((set, get) => ({
  ids: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    const local = readLocal();
    set({ ids: Object.keys(local), hydrated: true });
    if (readAuth()) {
      try {
        const items = await client.get<ProductCard[]>("/account/favorites");
        const serverIds = new Set(items.map((p) => p.id));
        const missing = Object.keys(local).filter((id) => !serverIds.has(id));
        // гостевое избранное переносим в аккаунт; локальное стираем только если всё перенеслось
        const moved = await Promise.all(missing.map((id) => client.post("/account/favorites", { product_id: id }).then(() => true, () => false)));
        const failed = missing.filter((_, i) => !moved[i]);
        writeLocal(Object.fromEntries(failed.map((id) => [id, local[id]])));
        set({ ids: [...serverIds, ...missing.filter((_, i) => moved[i])] });
      } catch {
        /* keep local */
      }
    }
  },
  toggle: async (product) => {
    const id = product.id;
    const exists = get().ids.includes(id);
    const prev = get().ids;
    set({ ids: exists ? prev.filter((x) => x !== id) : [...prev, id] });
    if (readAuth()) {
      try {
        if (exists) await client.delete(`/account/favorites/${id}`);
        else await client.post("/account/favorites", { product_id: id });
      } catch {
        set({ ids: prev });
        toast.error("Не удалось обновить избранное");
        return;
      }
    } else {
      const local = readLocal();
      if (exists) delete local[id];
      else local[id] = product;
      writeLocal(local);
    }
    if (!exists) toast.success("Добавлено в избранное", { actionLabel: "Избранное", actionHref: readAuth() ? "/account/favorites" : "/favorites" });
  },
  remove: async (id) => {
    const prev = get().ids;
    set({ ids: prev.filter((x) => x !== id) });
    if (readAuth()) {
      try {
        await client.delete(`/account/favorites/${id}`);
      } catch {
        set({ ids: prev });
      }
    } else {
      const local = readLocal();
      delete local[id];
      writeLocal(local);
    }
  },
  list: async () => {
    if (readAuth()) return client.get<ProductCard[]>("/account/favorites");
    return Object.values(readLocal());
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("tek:auth", (e) => {
    const type = (e as CustomEvent<{ type: string }>).detail?.type;
    if (type === "login") {
      useFavorites.setState({ hydrated: false });
      void useFavorites.getState().hydrate();
    }
    if (type === "logout") useFavorites.setState({ ids: Object.keys(readLocal()) });
  });
}

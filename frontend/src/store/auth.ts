"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import { readAuth, readCartToken, writeAuth, writeCartToken } from "@/lib/auth-storage";
import type { AuthResponse, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (login: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  refreshUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const stored = readAuth();
    set({ user: stored?.user ?? null, hydrated: true });
  },
  login: async (login, password) => {
    const r = await api<AuthResponse>("/auth/login", { method: "POST", body: { login, password } });
    writeAuth({ access: r.access_token, refresh: r.refresh_token, user: r.user });
    set({ user: r.user, hydrated: true });
    // merge guest cart into the user cart
    const cartToken = readCartToken();
    if (cartToken) {
      try {
        await api("/cart/merge", { method: "POST", body: {}, token: r.access_token, cartToken });
      } catch {
        /* non-fatal */
      }
      writeCartToken(null);
    }
    window.dispatchEvent(new CustomEvent("tek:auth", { detail: { type: "login" } }));
    return r.user;
  },
  logout: async () => {
    const stored = readAuth();
    if (stored) {
      try {
        await api("/auth/logout", { method: "POST", body: { refresh_token: stored.refresh }, token: stored.access });
      } catch {
        /* ignore */
      }
    }
    writeAuth(null);
    set({ user: null });
    window.dispatchEvent(new CustomEvent("tek:auth", { detail: { type: "logout" } }));
  },
  setUser: (user) => {
    const stored = readAuth();
    if (stored) writeAuth({ ...stored, user });
    set({ user });
  },
  refreshUser: async () => {
    const stored = readAuth();
    if (!stored) return;
    try {
      const user = await api<User>("/auth/me", { token: stored.access });
      writeAuth({ ...stored, user });
      set({ user });
    } catch {
      /* handled by client refresh flow */
    }
  },
}));

// keep the store in sync with token refresh / logout triggered from the API client
if (typeof window !== "undefined") {
  window.addEventListener("tek:auth", (e) => {
    const type = (e as CustomEvent<{ type: string }>).detail?.type;
    if (type === "logout") useAuth.setState({ user: null });
    if (type === "refreshed") useAuth.setState({ user: readAuth()?.user ?? null });
  });
}

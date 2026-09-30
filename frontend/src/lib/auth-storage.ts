import { BASE_PATH } from "./asset";
import type { User } from "./types";

export const AUTH_KEY = "tek_auth_v1";
export const CART_TOKEN_KEY = "tek_cart_token_v1";
export const ACCESS_COOKIE = "tek_access";
export const CART_COOKIE = "tek_cart";

export interface StoredAuth {
  access: string;
  refresh: string;
  user: User;
}

const isBrowser = () => typeof window !== "undefined";

export function readAuth(): StoredAuth | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.access || !parsed?.refresh || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuth(auth: StoredAuth | null) {
  if (!isBrowser()) return;
  try {
    if (auth) {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      setCookie(ACCESS_COOKIE, auth.access, 60 * 60 * 24 * 30);
    } else {
      window.localStorage.removeItem(AUTH_KEY);
      setCookie(ACCESS_COOKIE, "", 0);
    }
  } catch {
    /* storage blocked */
  }
}

export function readCartToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(CART_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeCartToken(token: string | null) {
  if (!isBrowser()) return;
  try {
    if (token) {
      window.localStorage.setItem(CART_TOKEN_KEY, token);
      setCookie(CART_COOKIE, token, 60 * 60 * 24 * 90);
    } else {
      window.localStorage.removeItem(CART_TOKEN_KEY);
      setCookie(CART_COOKIE, "", 0);
    }
  } catch {
    /* ignore */
  }
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=${BASE_PATH || "/"}; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

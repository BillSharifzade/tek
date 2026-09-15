"use client";

import { api, ApiError, type Query, type RequestOptions } from "./api";
import { readAuth, readCartToken, writeAuth, writeCartToken } from "./auth-storage";

type Method = NonNullable<RequestOptions["method"]>;

let refreshing: Promise<string | null> | null = null;

/** Refresh the access token once; concurrent callers share the same promise. */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const stored = readAuth();
    if (!stored) return null;
    try {
      const r = await api<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: stored.refresh },
      });
      writeAuth({ access: r.access_token, refresh: r.refresh_token, user: stored.user });
      window.dispatchEvent(new CustomEvent("tek:auth", { detail: { type: "refreshed" } }));
      return r.access_token;
    } catch {
      writeAuth(null);
      window.dispatchEvent(new CustomEvent("tek:auth", { detail: { type: "logout" } }));
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(method: Method, path: string, body?: unknown, query?: Query, retry = true): Promise<T> {
  const auth = readAuth();
  const cartToken = readCartToken();
  try {
    return await api<T>(path, {
      method,
      body,
      query,
      token: auth?.access ?? null,
      cartToken,
      revalidate: false,
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && auth && retry) {
      const token = await refreshAccessToken();
      if (token) return request<T>(method, path, body, query, false);
    }
    throw e;
  }
}

export const client = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, body ?? {}, query),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/** Remember the guest cart token issued by the backend. */
export function rememberCartToken(token: string | null | undefined) {
  if (token && token !== readCartToken()) writeCartToken(token);
}

/** Build a URL for file downloads (xlsx etc.) with auth passed via query when needed. */
export function downloadUrl(path: string, query?: Query): string {
  const auth = readAuth();
  const cartToken = readCartToken();
  const q: Query = { ...(query ?? {}) };
  if (auth?.access) q.access_token = auth.access;
  if (cartToken) q.cart_token = cartToken;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null) sp.set(k, String(v));
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8181/api/v1";
  const s = sp.toString();
  return `${base}${path}${s ? `?${s}` : ""}`;
}

/** Download a file through fetch (so Authorization/X-Cart-Token headers are sent) and save it. */
export async function downloadFile(path: string, filename: string, query?: Query): Promise<void> {
  const auth = readAuth();
  const cartToken = readCartToken();
  const headers: Record<string, string> = {};
  if (auth?.access) headers.Authorization = `Bearer ${auth.access}`;
  if (cartToken) headers["X-Cart-Token"] = cartToken;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8181/api/v1";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  const res = await fetch(`${base}${path}${s ? `?${s}` : ""}`, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(res.status, `http_${res.status}`, "Не удалось скачать файл");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

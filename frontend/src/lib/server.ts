import "server-only";
import { cookies } from "next/headers";
import { api, ApiError, type Query } from "./api";
import { ACCESS_COOKIE, CART_COOKIE } from "./auth-storage";

/** Access token from the `tek_access` cookie (set by the client after login). */
export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value || null;
}

export async function getCartCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value || null;
}

/**
 * Public data: cached for 60s (ISR-style). Use for catalog tree, content, brands...
 */
export function publicGet<T>(path: string, query?: Query, revalidate = 60): Promise<T> {
  return api<T>(path, { query, revalidate });
}

/**
 * Personalized data: if the visitor has an access cookie, fetch with Authorization (no-store),
 * otherwise fall back to the cached public response. Prices depend on the account.
 */
export async function personalizedGet<T>(path: string, query?: Query, revalidate = 60): Promise<T> {
  const token = await getAccessToken();
  if (!token) return api<T>(path, { query, revalidate });
  try {
    return await api<T>(path, { query, token, revalidate: false });
  } catch (e) {
    // Expired access cookie → anonymous view; the client refreshes the token.
    if (e instanceof ApiError && e.status === 401) return api<T>(path, { query, revalidate });
    throw e;
  }
}

/** Authenticated-only data for server components (account). Returns null when not logged in / 401. */
export async function authedGet<T>(path: string, query?: Query): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await api<T>(path, { query, token, revalidate: false });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}

/** Swallow 404 → null so pages can call notFound(). */
export async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Never fail the page because of a secondary block: return fallback on any error. */
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

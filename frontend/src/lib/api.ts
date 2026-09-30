import type { ApiErrorBody } from "./types";

export const API_URL =
  (typeof window === "undefined" ? process.env.API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8181/api/v1";

/** Адрес API для ссылок в HTML (скачивание документов): публичный, а не внутренний адрес контейнера. */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8181/api/v1";

/** Серверный рендер не ждёт зависший API дольше этого (браузерные запросы — без ограничения). */
const SERVER_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  token?: string | null;
  cartToken?: string | null;
  /** seconds; `false` → no-store (default for authenticated / mutating requests) */
  revalidate?: number | false;
  tags?: string[];
  signal?: AbortSignal;
}

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, String(item));
    } else {
      sp.set(k, v === true ? "1" : String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function apiUrl(path: string, query?: Query): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}${buildQuery(query)}`;
}

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Некорректный запрос";
    case 401:
      return "Требуется авторизация";
    case 403:
      return "Доступ запрещён";
    case 404:
      return "Не найдено";
    case 409:
      return "Конфликт данных";
    case 422:
      return "Проверьте введённые данные";
    case 429:
      return "Слишком много запросов";
    default:
      return status >= 500 ? "Ошибка сервера. Попробуйте позже" : "Ошибка запроса";
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  const err = body?.error;
  return new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? messageForStatus(res.status), err?.details);
}

/**
 * Core isomorphic request. No implicit auth: callers pass `token` / `cartToken`.
 * GET without token defaults to ISR-style caching (revalidate 60s); everything else is no-store.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cartToken) headers["X-Cart-Token"] = opts.cartToken;

  const personalized = Boolean(opts.token || opts.cartToken) || method !== "GET";
  const revalidate = opts.revalidate ?? (personalized ? false : 60);

  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal ?? (typeof window === "undefined" ? AbortSignal.timeout(SERVER_TIMEOUT_MS) : undefined),
  };
  if (revalidate === false) {
    init.cache = "no-store";
  } else {
    init.next = { revalidate, tags: opts.tags };
  }

  const res = await fetch(apiUrl(path, opts.query), init);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) return undefined as T;
  return (await res.json()) as T;
}

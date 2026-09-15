"use client";

import { AlertCircle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

export function errorMessage(e: unknown, fallback = "Не удалось загрузить данные"): string {
  if (e instanceof ApiError) return e.message || fallback;
  return fallback;
}

export function ErrorLine({ error, className }: { error: string | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={cn("flex items-center gap-2 rounded-[6px] border border-sale/30 bg-sale/5 px-4 py-3 text-sm text-sale", className)}>
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {error}
    </p>
  );
}

export function PageTitle({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-3", className)}>
      <h2 className="text-2xl font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[8px] border border-dashed border-line bg-surface-2 px-6 py-12 text-center text-sub", className)}>{children}</div>;
}

/** Path relative to the API base for `client`/`downloadFile` (documents come as `/api/v1/...`). */
export function apiPath(url: string): string {
  if (url.startsWith("/api/v1")) return url.slice("/api/v1".length) || "/";
  return url.startsWith("/") ? url : `/${url}`;
}

/** Absolute URL for a file served by the backend (documents come as `/api/v1/...`). */
export function apiFileUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8181/api/v1";
  const origin = base.replace(/\/api\/v1\/?$/, "");
  if (url.startsWith("/api/v1")) return `${origin}${url}`;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

"use client";

import Link from "next/link";
import { AlertCircle, Check, Info, X } from "lucide-react";
import { useToast } from "@/store/toast";
import { cn } from "@/lib/cn";

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[calc(100%-40px)] max-w-[360px] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-[8px] bg-ink px-4 py-3 text-white shadow-pop animate-toast-in",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              t.kind === "success" && "bg-brand text-ink",
              t.kind === "error" && "bg-sale text-white",
              t.kind === "info" && "bg-info text-white",
            )}
          >
            {t.kind === "success" ? <Check className="size-3.5" strokeWidth={3} /> : t.kind === "error" ? <AlertCircle className="size-4" /> : <Info className="size-4" />}
          </span>
          <span className="flex-1 text-base font-medium">{t.text}</span>
          {t.actionHref ? (
            <Link href={t.actionHref} onClick={() => dismiss(t.id)} className="text-sm font-semibold text-brand hover:underline">
              {t.actionLabel}
            </Link>
          ) : null}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Закрыть" className="text-white/60 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

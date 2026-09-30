"use client";

import Link from "next/link";
import { AlertCircle, Check, Info } from "lucide-react";
import { useToast, type Toast } from "@/store/toast";
import { IconToastBasket } from "@/components/icons/figma";
import { cn } from "@/lib/cn";

/** Сердце 22×20 из макета «Всплывающие сообщения». */
function ToastHeart() {
  return (
    <svg width={22} height={20} viewBox="0 1.2 23 20.4" aria-hidden>
      <path
        d="M11.501 3.50205C13.9773 1.31527 17.8038 1.38786 20.1893 3.73846C22.5738 6.09009 22.656 9.8353 20.4381 12.2782L11.4989 21.0834L2.56186 12.2782C0.343934 9.8353 0.427212 6.08387 2.81064 3.73846C5.19828 1.39097 9.01746 1.31217 11.501 3.50205ZM18.6967 5.20357C17.1154 3.64618 14.5643 3.58293 12.9094 5.04492L11.5021 6.28711L10.0937 5.04596C8.43346 3.58189 5.88769 3.64618 4.30225 5.20564C2.73157 6.75059 2.65251 9.22355 4.09986 10.8576L11.5 18.148L18.9001 10.8587C20.3485 9.22355 20.2694 6.7537 18.6967 5.20357Z"
        fill="currentColor"
      />
    </svg>
  );
}

function icon(t: Toast) {
  if (t.kind === "error") return <AlertCircle className="size-[22px]" strokeWidth={1.75} />;
  if (t.kind === "info") return <Info className="size-[22px]" strokeWidth={1.75} />;
  if (/избранн/i.test(t.text)) return <ToastHeart />;
  if (/корзин/i.test(t.text)) return <IconToastBasket />;
  return <Check className="size-[22px]" strokeWidth={2} />;
}

/**
 * Всплывающие сообщения — Figma «Инфа о товаре / Property 1=Default»:
 * 274×57, #FFCC33, r10, иконка слева (20px), текст Regular 15/24 чёрный с x=56.
 */
export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-[130px] z-[120] flex flex-col items-end gap-[20px]" aria-live="polite">
      {toasts.map((t) => {
        const cls = cn(
          "pointer-events-auto flex min-h-[57px] w-[274px] max-w-[calc(100vw-32px)] items-center gap-[14px] rounded-[10px] py-[16px] pl-[20px] pr-[16px] text-[15px] leading-[24px] text-black shadow-pop animate-toast-in",
          t.kind === "error" ? "bg-sale-bg text-sale-text" : "bg-brand",
        );
        const body = (
          <>
            <span className="flex w-[22px] shrink-0 justify-center">{icon(t)}</span>
            <span className="min-w-0 flex-1">{t.text}</span>
          </>
        );
        return t.actionHref ? (
          <Link key={t.id} href={t.actionHref} onClick={() => dismiss(t.id)} role="status" className={cls}>
            {body}
          </Link>
        ) : (
          <button key={t.id} type="button" onClick={() => dismiss(t.id)} role="status" className={cn(cls, "text-left")}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

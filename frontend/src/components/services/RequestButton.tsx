"use client";

import { cn } from "@/lib/cn";

export const REQUEST_EVENT = "tek:service-request";
export const REQUEST_ANCHOR = "request";

/** Жёлтая кнопка «Оставить заявку»: прокручивает к форме и подставляет в примечание выбранную позицию. */
export function RequestButton({ note, className, children = "Оставить заявку" }: { note?: string; className?: string; children?: React.ReactNode }) {
  return (
    <a
      href={`#${REQUEST_ANCHOR}`}
      onClick={(e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: note ?? "" }));
        const form = document.getElementById(REQUEST_ANCHOR);
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${REQUEST_ANCHOR}`);
        window.setTimeout(() => form?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }), 450);
      }}
      className={cn(
        "flex h-[54px] items-center justify-center rounded-[7px] bg-brand text-[16px] font-medium leading-[24px] text-black transition-colors hover:bg-brand-hover",
        className,
      )}
    >
      {children}
    </a>
  );
}

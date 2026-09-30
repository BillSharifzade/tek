"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useEscape, useHydrated, useLockBody } from "@/lib/hooks";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** side drawer from the right instead of a centered dialog */
  drawer?: boolean;
  className?: string;
  /** classes for the scrollable body (padding etc.) */
  bodyClassName?: string;
}

/**
 * Модалка из «Прочих дополнительных элементов» (10522:1897): жёлтая шапка #FFCC33 с заголовком 17/600
 * и крестиком, белое тело, r10, мягкая тень. drawer — панель справа на всю высоту («Вам может понадобиться»).
 */
export function Modal({ open, onClose, title, children, footer, size = "md", drawer, className, bodyClassName }: ModalProps) {
  const hydrated = useHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useLockBody(open);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!hydrated || !open) return null;

  const width = size === "sm" ? "max-w-[480px]" : size === "lg" ? "max-w-[880px]" : size === "xl" ? "max-w-[1040px]" : "max-w-[560px]";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex flex-col overflow-hidden bg-white shadow-[0_4px_24px_rgba(0,0,0,0.16)] outline-none",
          drawer ? "ml-auto h-full w-full max-w-[560px] rounded-l-[10px]" : cn("m-auto max-h-[calc(100%-32px)] w-[calc(100%-32px)] rounded-[10px]", width),
          className,
        )}
      >
        <div className="flex min-h-[46px] shrink-0 items-center justify-between gap-4 bg-brand py-[12px] pl-[24px] pr-[16px]">
          <h3 className="text-[17px] font-semibold leading-[22px] text-black">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-[4px] flex size-[28px] shrink-0 items-center justify-center rounded-[5px] text-black transition-colors hover:bg-brand-hover"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={cn("flex-1 overflow-y-auto px-[24px] py-[24px]", bodyClassName)}>{children}</div>
        {footer ? <div className="shrink-0 border-t border-line px-[24px] py-[16px]">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

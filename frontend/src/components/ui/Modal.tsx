"use client";

import { X } from "lucide-react";
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
  size?: "sm" | "md" | "lg";
  /** side drawer from the right instead of a centered dialog */
  drawer?: boolean;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, size = "md", drawer, className }: ModalProps) {
  const hydrated = useHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useLockBody(open);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!hydrated || !open) return null;

  const width = size === "sm" ? "max-w-[420px]" : size === "lg" ? "max-w-[880px]" : "max-w-[560px]";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex animate-fade-in" role="presentation">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex flex-col bg-white shadow-pop outline-none",
          drawer
            ? "ml-auto h-full w-full max-w-[520px]"
            : cn("m-auto w-[calc(100%-32px)] max-h-[calc(100%-32px)] rounded-[8px]", width),
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded p-1 text-sub hover:bg-surface hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

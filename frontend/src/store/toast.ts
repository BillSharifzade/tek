"use client";

import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  actionLabel?: string;
  actionHref?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (text: string, kind?: ToastKind, extra?: Pick<Toast, "actionLabel" | "actionHref">) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (text, kind = "success", extra) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text, ...extra }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (text: string, extra?: Pick<Toast, "actionLabel" | "actionHref">) => useToast.getState().push(text, "success", extra),
  error: (text: string) => useToast.getState().push(text, "error"),
  info: (text: string) => useToast.getState().push(text, "info"),
};

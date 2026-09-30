"use client";

import { ApiError } from "./api";
import { client } from "./client";

export type LeadKind = "service" | "feedback" | "question" | "project" | "consultation";

export interface LeadInput {
  kind: LeadKind;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  service?: string;
  page?: string;
}

/** Заявка с формы сайта → POST /leads (бэкенд пишет её и ставит событие lead.created в outbox CRM). */
export async function sendLead(input: LeadInput): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  try {
    await client.post("/leads", { ...input, page: input.page ?? (typeof window !== "undefined" ? window.location.pathname : undefined) });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, code: e.code, message: e.message };
    return { ok: false, message: "Не удалось отправить заявку. Позвоните нам: +992 (44) 620 60 60" };
  }
}

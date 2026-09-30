"use client";

import { sendLead } from "@/lib/leads";

export interface ServiceRequestInput {
  name: string;
  phone: string;
  note: string;
  service: string;
  page: string;
}

export interface ServiceRequestResult {
  ok: boolean;
  errors?: { name?: string; phone?: string };
  message?: string;
}

const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

/** Заявка на услугу → POST /leads (kind=service); в CRM уходит через outbox бэкенда. */
export async function submitServiceRequest(input: ServiceRequestInput): Promise<ServiceRequestResult> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const errors: ServiceRequestResult["errors"] = {};
  if (!name) errors.name = "Укажите имя";
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, "").length < 7) errors.phone = "Укажите корректный телефон";
  if (errors.name || errors.phone) return { ok: false, errors };

  const r = await sendLead({ kind: "service", name, phone, note: input.note.trim(), service: input.service, page: input.page });
  if (r.ok) return { ok: true };
  if (r.code === "phone_invalid") return { ok: false, errors: { phone: r.message } };
  if (r.code === "name_required") return { ok: false, errors: { name: r.message } };
  return { ok: false, message: r.message };
}

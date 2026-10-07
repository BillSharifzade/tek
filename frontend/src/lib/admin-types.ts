/*
 * Типы ответов API панели управления (`/api/v1/admin/*`, роль ≥ manager; см. ../docs/API.md).
 * Поля, которых может не быть в старых версиях API, помечены как необязательные — интерфейс работает и без них.
 */

import type { User } from "./types";

export type Role = User["role"];
export type UserStatus = User["status"];
export type CustomerType = User["customer_type"];

export interface AdminPaged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  per_page?: number;
}

// ---------- пользователи ----------

export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  role: Role;
  status: UserStatus;
  customer_type: CustomerType;
  discount_pct: number;
  cashback_pct: number;
  manager_id: string | null;
  manager_name?: string | null;
  is_lead_manager?: boolean;
  company_name: string | null;
  company_inn: string | null;
  company_verified?: boolean | null;
  created_at: string;
}

export interface AdminUserPatch {
  status?: "approved" | "blocked";
  /** только администратор */
  role?: Role;
  /** только администратор */
  is_lead_manager?: boolean;
  manager_id?: string | null;
  company_verified?: boolean;
}

export interface PricingRule {
  category_slug: string | null;
  brand_slug: string | null;
  product_id: string | null;
  discount_pct: number;
  cashback_pct: number;
  /** подписи в ответе GET …/pricing (в запросе не нужны) */
  category_name?: string | null;
  brand_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
}

export interface UserPricing {
  discount_pct: number;
  cashback_pct: number;
  manager_id: string | null;
  rules: PricingRule[];
}

export interface PricingInput {
  discount_pct?: number;
  cashback_pct?: number;
  manager_id?: string | null;
  rules?: PricingRule[];
}

export interface AdminManager {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  is_lead_manager: boolean;
}

// ---------- заказы ----------

export interface AdminOrder {
  id: string;
  number: string;
  created_at: string;
  status: string;
  status_label?: string;
  total: number;
  paid_amount: number;
  remaining?: number;
  payment_method: string;
  payment_status: string;
  payment_status_label?: string;
  payment_method_label?: string;
  delivery_method: string;
  delivery_method_label?: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  company_name?: string | null;
  crm_status: string | null;
  reservation_status: string | null;
  manager_id?: string | null;
  manager_name?: string | null;
  /** старый формат списка: e-mail менеджера вместо имени */
  manager_email?: string | null;
}

export interface PaymentInput {
  amount?: number;
  note?: string;
}

// ---------- заявки ----------

export type LeadStatus = "new" | "in_progress" | "done";

export interface AdminLead {
  id: number | string;
  kind: string;
  name: string;
  phone: string;
  email: string | null;
  note: string | null;
  service: string | null;
  page: string | null;
  status: LeadStatus;
  manager_note: string | null;
  user_id: string | null;
  created_at: string;
}

export interface LeadPatch {
  status?: LeadStatus;
  manager_note?: string | null;
}

// ---------- отзывы и вопросы ----------

export interface ProductRef {
  id: string;
  slug: string;
  name: string;
}

export interface AdminReview {
  id: string;
  product: ProductRef;
  user_id: string | null;
  author: string;
  rating: number;
  pros: string | null;
  cons: string | null;
  text: string;
  created_at: string;
  reply_text: string | null;
  replied_at: string | null;
  /** published | hidden … */
  status?: string;
}

export interface AdminQuestion {
  id: string;
  product: ProductRef;
  user_id: string | null;
  author: string;
  text: string;
  created_at: string;
  answer_text: string | null;
  answered_at: string | null;
}

// ---------- купоны ----------

export type CouponKind = "percent" | "fixed";

export interface Coupon {
  code: string;
  kind: CouponKind;
  value: number;
  min_total: number | null;
  active: boolean;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
}

export interface CouponInput {
  code?: string;
  kind: CouponKind;
  value: number;
  min_total?: number | null;
  active?: boolean;
  expires_at?: string | null;
  usage_limit?: number | null;
}

// ---------- товары ----------

export interface AdminProduct {
  id: string;
  code: string;
  slug: string;
  name: string;
  category: { slug: string; name: string } | null;
  brand: { slug: string; name: string } | null;
  unit: string;
  list_price: number;
  sale_price: number | null;
  pack_qty?: number | null;
  stock_total: number;
  /** остатки по всем складам (в том числе у снятых с продажи) */
  stock?: ProductStoreStock[];
  is_active: boolean;
  is_hit?: boolean;
  is_new?: boolean;
  badges: string[];
  image?: string | null;
}

export interface ProductPatch {
  list_price?: number;
  sale_price?: number | null;
  is_active?: boolean;
  is_hit?: boolean;
  is_new?: boolean;
}

export interface StoreQty {
  store_id: number;
  qty: number;
}

export interface Store {
  id: number;
  city: string;
  name: string;
  address?: string;
}

/** Остаток товара на складе (из карточки товара `GET /catalog/products/{slug}` → `stock`). */
export interface ProductStoreStock {
  store_id: number;
  city: string;
  name: string;
  qty: number;
}

// ---------- импорт каталога ----------

export interface ImportResult {
  dry_run: boolean;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  categories_created: number;
  brands_created: number;
  stock_rows: number;
  errors: { row: number; message: string }[];
  /** колонки файла, которые импорт не знает (пропущены) */
  ignored_columns?: string[];
}

// ---------- интеграции ----------

export interface OutboxEvent {
  id: number;
  target: string;
  event: string;
  status: "pending" | "sent" | "failed" | string;
  attempts: number;
  mock: boolean;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  payload: unknown;
}

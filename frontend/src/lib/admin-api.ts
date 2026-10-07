"use client";

import { client, downloadFile, ensureFreshAccess, uploadForm } from "./client";
import type { Order } from "./types";
import type {
  AdminLead,
  AdminManager,
  AdminOrder,
  AdminPaged,
  AdminProduct,
  AdminQuestion,
  AdminReview,
  AdminUser,
  AdminUserPatch,
  Coupon,
  CouponInput,
  ImportResult,
  LeadPatch,
  LeadStatus,
  OutboxEvent,
  PaymentInput,
  PricingInput,
  ProductPatch,
  ProductStoreStock,
  Store,
  StoreQty,
  UserPricing,
  UserStatus,
} from "./admin-types";

/** Заказ в ответах API: базовый контракт + поля, которые API отдаёт сверх него (контакты, менеджер, подписи). */
export type AdminOrderDetail = Order & {
  contact?: { first_name: string; last_name: string; phone: string; email: string };
  manager?: { name: string; phone: string; email: string } | null;
  delivery: Order["delivery"] & { date_label?: string | null };
  payment: Order["payment"] & { sublabel?: string | null };
  subtotal_list?: number;
  coupon_code?: string | null;
};

const enc = encodeURIComponent;

/** Тонкий типизированный клиент `/admin/*` поверх `client` (JWT + обновление токена). */
export const adminApi = {
  // пользователи
  users: (q: { status?: UserStatus | ""; role?: string; q?: string } = {}) => client.get<AdminUser[]>("/admin/users", q),
  user: (id: string) => client.get<AdminUser>(`/admin/users/${enc(id)}`),
  updateUser: (id: string, patch: AdminUserPatch) => client.put<AdminUser>(`/admin/users/${enc(id)}`, patch),
  approveUser: (id: string) => client.post<{ ok: boolean }>(`/admin/users/${enc(id)}/approve`, {}),
  pricing: (id: string) => client.get<UserPricing>(`/admin/users/${enc(id)}/pricing`),
  savePricing: (id: string, body: PricingInput) => client.put<unknown>(`/admin/users/${enc(id)}/pricing`, body),
  managers: () => client.get<AdminManager[]>("/admin/managers"),

  // заказы
  orders: (q: { status?: string; q?: string; mine?: boolean } = {}) => client.get<AdminOrder[]>("/admin/orders", q),
  order: (number: string) => client.get<AdminOrderDetail>(`/orders/${enc(number)}`),
  setOrderStatus: (number: string, status: string) => client.put<AdminOrderDetail>(`/admin/orders/${enc(number)}/status`, { status }),
  registerPayment: (number: string, body: PaymentInput) => client.post<AdminOrderDetail>(`/admin/orders/${enc(number)}/payments`, body),
  setOrderManager: (number: string, managerId: string) => client.put<AdminOrderDetail>(`/admin/orders/${enc(number)}/manager`, { manager_id: managerId }),

  // заявки
  leads: (q: { status?: LeadStatus | ""; kind?: string; q?: string; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminLead>>("/admin/leads", q),
  updateLead: (id: AdminLead["id"], patch: LeadPatch) => client.put<AdminLead>(`/admin/leads/${enc(String(id))}`, patch),

  // отзывы и вопросы
  reviews: (q: { unanswered?: boolean; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminReview>>("/admin/reviews", q),
  replyReview: (id: string, text: string) => client.post<unknown>(`/admin/reviews/${enc(id)}/reply`, { text }),
  deleteReview: (id: string) => client.delete<unknown>(`/admin/reviews/${enc(id)}`),
  questions: (q: { unanswered?: boolean; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminQuestion>>("/admin/questions", q),
  answerQuestion: (id: string, text: string) => client.post<unknown>(`/admin/questions/${enc(id)}/answer`, { text }),
  deleteQuestion: (id: string) => client.delete<unknown>(`/admin/questions/${enc(id)}`),

  // купоны
  coupons: () => client.get<Coupon[]>("/admin/coupons"),
  createCoupon: (body: CouponInput & { code: string }) => client.post<Coupon>("/admin/coupons", body),
  updateCoupon: (code: string, body: CouponInput) => client.put<Coupon>(`/admin/coupons/${enc(code)}`, body),
  deleteCoupon: (code: string) => client.delete<unknown>(`/admin/coupons/${enc(code)}`),

  // товары
  products: (q: { q?: string; category?: string; active?: string; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminProduct>>("/admin/products", q),
  updateProduct: (id: string, patch: ProductPatch) => client.put<AdminProduct>(`/admin/products/${enc(id)}`, patch),
  /** возвращает товар с пересчитанными остатками */
  saveStock: (id: string, stores: StoreQty[]) => client.put<AdminProduct>(`/admin/products/${enc(id)}/stock`, { stores }),
  /** остатки по складам — из публичной карточки товара (для неактивных товаров может вернуть 404) */
  productStock: (slug: string) => client.get<{ stock: ProductStoreStock[] }>(`/catalog/products/${enc(slug)}`).then((p) => p.stock ?? []),
  stores: () => client.get<Store[]>("/content/stores"),

  // импорт каталога (только администратор)
  importCatalog: (file: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return uploadForm<ImportResult>("/admin/import/catalog", form, dryRun ? { dry_run: 1 } : undefined);
  },
  downloadImportTemplate: async () => {
    await ensureFreshAccess();
    return downloadFile("/admin/import/template.xlsx", "tek-catalog-template.xlsx");
  },

  // интеграции
  outbox: () => client.get<OutboxEvent[]>("/admin/outbox"),
};

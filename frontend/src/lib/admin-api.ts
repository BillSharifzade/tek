"use client";

import { client, downloadFile, ensureFreshAccess, uploadForm } from "./client";
import type { Order } from "./types";
import type {
  AdminLead,
  AdminManager,
  AdminOrder,
  AdminPaged,
  AdminBrand,
  AdminDocument,
  AdminNews,
  AdminNewsDetail,
  AdminProject,
  AdminProjectDetail,
  AdminStore,
  AdminVacancy,
  NewsInput,
  ProjectInput,
  StoreInput,
  VacancyInput,
  AdminProduct,
  AdminProductDetail,
  AdminQuestion,
  BrandPatch,
  DocumentInput,
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
  UploadedFile,
  UserPricing,
  UserStatus,
  VariantInput,
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
  orders: (q: { status?: string; q?: string; mine?: boolean; edit_pending?: boolean } = {}) => client.get<AdminOrder[]>("/admin/orders", q),
  order: (number: string) => client.get<AdminOrderDetail>(`/orders/${enc(number)}`),
  setOrderStatus: (number: string, status: string) => client.put<AdminOrderDetail>(`/admin/orders/${enc(number)}/status`, { status }),
  registerPayment: (number: string, body: PaymentInput) => client.post<AdminOrderDetail>(`/admin/orders/${enc(number)}/payments`, body),
  setOrderManager: (number: string, managerId: string) => client.put<AdminOrderDetail>(`/admin/orders/${enc(number)}/manager`, { manager_id: managerId }),
  approveEdit: (number: string) => client.post<AdminOrderDetail>(`/admin/orders/${enc(number)}/edit-request/approve`, {}),
  rejectEdit: (number: string, note: string | null) => client.post<AdminOrderDetail>(`/admin/orders/${enc(number)}/edit-request/reject`, { note }),

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
  product: (id: string) => client.get<AdminProductDetail>(`/admin/products/${enc(id)}`),
  setProductDocuments: (id: string, documentIds: number[]) => client.put<AdminProductDetail>(`/admin/products/${enc(id)}/documents`, { document_ids: documentIds }),
  setProductAccessories: (id: string, items: { code: string; group: string }[]) => client.put<AdminProductDetail>(`/admin/products/${enc(id)}/accessories`, { items }),
  setProductVariant: (id: string, body: VariantInput) => client.put<AdminProductDetail>(`/admin/products/${enc(id)}/variant`, body),

  // библиотека документов и бренды
  documents: (q: { q?: string; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminDocument>>("/admin/documents", q),
  createDocument: (input: DocumentInput) => {
    const form = new FormData();
    for (const k of ["title", "kind", "url", "product_id"] as const) if (input[k]) form.append(k, input[k]);
    if (input.file) form.append("file", input.file);
    return uploadForm<AdminDocument>("/admin/documents", form);
  },
  updateDocument: (id: number, patch: { title?: string; kind?: string; url?: string }) => client.put<AdminDocument>(`/admin/documents/${id}`, patch),
  deleteDocument: (id: number) => client.delete<unknown>(`/admin/documents/${id}`),
  brands: () => client.get<AdminBrand[]>("/admin/brands"),
  updateBrand: (id: number, patch: BrandPatch) => client.put<AdminBrand>(`/admin/brands/${id}`, patch),
  /** файл в хранилище (картинка новости / проекта): `kind: "image"` — только картинки */
  uploadFile: (file: File, kind?: "image") => {
    const form = new FormData();
    if (kind) form.append("kind", kind);
    form.append("file", file);
    return uploadForm<UploadedFile>("/admin/files", form);
  },

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

  // контент сайта
  news: (q: { q?: string; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminNews>>("/admin/news", q),
  newsItem: (id: number) => client.get<AdminNewsDetail>(`/admin/news/${id}`),
  createNews: (body: NewsInput) => client.post<AdminNewsDetail>("/admin/news", body),
  updateNews: (id: number, body: NewsInput) => client.put<AdminNewsDetail>(`/admin/news/${id}`, body),
  deleteNews: (id: number) => client.delete<unknown>(`/admin/news/${id}`),
  projects: (q: { q?: string; page?: number; per_page?: number } = {}) => client.get<AdminPaged<AdminProject>>("/admin/projects", q),
  project: (id: number) => client.get<AdminProjectDetail>(`/admin/projects/${id}`),
  createProject: (body: ProjectInput) => client.post<AdminProjectDetail>("/admin/projects", body),
  updateProject: (id: number, body: ProjectInput) => client.put<AdminProjectDetail>(`/admin/projects/${id}`, body),
  deleteProject: (id: number) => client.delete<unknown>(`/admin/projects/${id}`),
  vacancies: () => client.get<AdminVacancy[]>("/admin/vacancies"),
  createVacancy: (body: VacancyInput) => client.post<AdminVacancy>("/admin/vacancies", body),
  updateVacancy: (id: number, body: Partial<VacancyInput>) => client.put<AdminVacancy>(`/admin/vacancies/${id}`, body),
  deleteVacancy: (id: number) => client.delete<unknown>(`/admin/vacancies/${id}`),
  adminStores: () => client.get<AdminStore[]>("/admin/stores"),
  createStore: (body: StoreInput) => client.post<AdminStore>("/admin/stores", body),
  updateStore: (id: number, body: StoreInput) => client.put<AdminStore>(`/admin/stores/${id}`, body),
  deleteStore: (id: number) => client.delete<unknown>(`/admin/stores/${id}`),
};

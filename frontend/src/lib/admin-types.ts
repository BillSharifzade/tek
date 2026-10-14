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
  /** персональная скидка аккаунта, % (0 — цены как у гостя) */
  discount_pct: number;
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
  /** подписи в ответе GET …/pricing (в запросе не нужны) */
  category_name?: string | null;
  brand_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
}

export interface UserPricing {
  discount_pct: number;
  manager_id: string | null;
  rules: PricingRule[];
}

export interface PricingInput {
  discount_pct?: number;
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
  /** клиент запросил изменение состава — ждёт решения менеджера */
  edit_pending?: boolean;
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
  /** кешбэк товара, % от цены покупателя (0 — без кешбэка) */
  cashback_pct?: number;
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
  cashback_pct?: number;
  is_active?: boolean;
  is_hit?: boolean;
  is_new?: boolean;
  /** страна производства товара; null — как у бренда */
  country_origin?: string | null;
}

/** Вид документа товара (группы на странице товара: Сертификаты / Описание / Чертежи / Каталоги). */
export type DocumentKind = "certificate" | "declaration" | "passport" | "drawing" | "catalog" | "other";

/** Документ из общей библиотеки: загруженный файл или внешняя ссылка; один документ — у многих товаров. */
export interface AdminDocument {
  id: number;
  title: string;
  kind: DocumentKind | string;
  file_name: string;
  size_kb: number;
  url: string | null;
  has_file: boolean;
  created_at?: string;
  /** у скольких товаров */
  products?: number;
}

export interface DocumentInput {
  title?: string;
  kind?: string;
  url?: string;
  file?: File | null;
  /** сразу привязать к товару */
  product_id?: string;
}

export interface AdminAccessory {
  group: string;
  product_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

/** Торговое предложение товара: группа исполнений, её оси, значения товара и другие исполнения группы. */
export interface AdminVariant {
  group: string;
  axes: string[];
  values: Record<string, string>;
  siblings: { id: string; code: string; name: string; values: Record<string, string>; is_active: boolean }[];
}

export interface AdminBrand {
  id: number;
  slug: string;
  name: string;
  country_brand: string | null;
  country_origin: string | null;
  description?: string | null;
  logo_url?: string | null;
  is_featured?: boolean;
  products?: number;
}

export interface BrandPatch {
  name?: string;
  country_brand?: string | null;
  country_origin?: string | null;
  description?: string | null;
}

/** Карточка товара в панели: строка списка + документы, комплектующие, предложение, страны. */
export interface AdminProductDetail extends AdminProduct {
  country_origin: string | null;
  brand_info: Pick<AdminBrand, "id" | "slug" | "name" | "country_brand" | "country_origin"> | null;
  documents: AdminDocument[];
  accessories: AdminAccessory[];
  variant: AdminVariant | null;
}

export interface VariantInput {
  group: string | null;
  axes?: string[];
  values: { axis: string; value: string }[];
}

/** Загруженный файл: `url` — для полей картинок (`/api/v1/files/…`). */
export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  content_type: string;
  size_bytes: number;
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

// ---------- контент сайта ----------

export interface AdminNews {
  id: number;
  slug: string;
  title: string;
  published_at: string;
  excerpt: string;
  image_url: string | null;
  tags: string[];
}

/** Новость для правки: текст — в разметке панели (абзацы, «- » списки, «## » заголовки, **жирный**, [ссылка](https://…)). */
export interface AdminNewsDetail extends AdminNews {
  body_text: string;
}

export interface NewsInput {
  title: string;
  slug?: string;
  published_at?: string;
  excerpt?: string;
  body_text?: string;
  image_url?: string | null;
  tags?: string[];
}

export interface AdminProject {
  id: number;
  slug: string;
  title: string;
  year: string;
  project_date: string;
  object: string;
  service: string;
  image_url: string | null;
  excerpt: string;
  photos: string[];
  video_url: string | null;
  sort: number;
}

export interface AdminProjectDetail extends AdminProject {
  body_text: string;
  /** слаги брендов */
  brands: string[];
  products: { code: string; name: string }[];
}

export interface ProjectInput {
  title: string;
  slug?: string;
  year?: string;
  project_date?: string;
  object?: string;
  service?: string;
  image_url?: string | null;
  excerpt?: string;
  body_text?: string;
  photos?: string[];
  video_url?: string | null;
  sort?: number;
  brands?: string[];
  /** коды товаров */
  products?: string[];
}

export interface VacancyBlock {
  title: string;
  items: string[];
}

export interface AdminVacancy {
  id: number;
  slug: string;
  dept: string;
  title: string;
  city: string;
  experience: string;
  schedule: string;
  salary: string;
  blocks: VacancyBlock[];
  sort: number;
  is_active: boolean;
}

export type VacancyInput = Omit<AdminVacancy, "id" | "slug" | "sort"> & { slug?: string; sort?: number };

export interface AdminStore {
  id: number;
  code: string;
  city: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  delivery_hint: string;
  lat: number | null;
  lon: number | null;
  sort: number;
  stock_total?: number;
  /** товаров с остатком */
  products?: number;
}

export type StoreInput = Omit<AdminStore, "id" | "stock_total" | "products" | "sort"> & { sort?: number };

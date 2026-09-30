// Types mirror docs/API.md (backend contract v1)

export type Badge = "sale" | "hit" | "new";

export interface Price {
  list: number;
  price: number;
  discount_pct: number;
  cashback: number;
  sale: boolean;
  savings: number;
}

export interface BrandRef {
  slug: string;
  name: string;
  logo?: string | null;
  country_brand?: string | null;
  country_origin?: string | null;
}

export interface ProductCard {
  id: string;
  slug: string;
  code: string;
  name: string;
  brand: BrandRef;
  unit: string; // "шт" | "м"
  image: string | null;
  price: Price;
  stock_total: number;
  in_stock: boolean;
  badges: Badge[];
  rating: number;
  reviews_count: number;
  price_unit_label: string; // "за шт" | "за метр"
  /** кратность упаковки: количество меняется этим шагом */
  pack_qty?: number | null;
}

export interface StoreStock {
  store_id: number;
  city: string;
  name: string;
  qty: number;
  delivery_hint: string;
}

/** Ось торговых предложений: «Число полюсов», «Сечение, мм²»… Значения уже отсортированы бэкендом. */
export interface VariantAxis {
  name: string;
  values: string[];
}

/** Исполнение товара в группе — отдельный товар со своим URL, кодом, ценой и фото. */
export interface VariantItem {
  slug: string;
  code: string;
  name: string;
  values: Record<string, string>;
  in_stock: boolean;
  price: number;
  unit: string;
  image: string | null;
}

export interface Variants {
  axes: VariantAxis[];
  items: VariantItem[];
}

export interface Attribute {
  name: string;
  value: string;
}

export type DocumentKind = "certificate" | "declaration" | "drawing" | "passport" | "catalog" | "other";

export interface ProductDocument {
  id: string;
  title: string;
  kind: DocumentKind;
  url: string;
  size_kb: number;
}

export interface Accessory {
  group: string;
  product: ProductCard;
}

export interface Crumb {
  slug: string;
  name: string;
}

export interface Product extends ProductCard {
  description: string;
  short_description: string;
  category: Crumb;
  breadcrumbs: Crumb[];
  attributes: Attribute[];
  pack: { qty: number; label: string } | null;
  stock: StoreStock[];
  variants: Variants | null;
  documents: ProductDocument[];
  accessories: Accessory[];
  configurator: { name: string; url: string } | null;
  images: string[];
  questions_count: number;
  features: { title: string; text: string }[];
}

export interface CartItemError {
  code: "insufficient_stock";
  available: number;
}

export interface CartItem {
  id: string;
  product: ProductCard;
  qty: number;
  selected: boolean;
  price: Price;
  line_total: number;
  line_cashback: number;
  stock_total: number;
  error: CartItemError | null;
}

export interface Cart {
  id: string;
  cart_token: string | null;
  items: CartItem[];
  items_count: number;
  selected_count: number;
  subtotal_list: number;
  discount_total: number;
  coupon: { code: string; discount: number } | null;
  subtotal: number;
  cashback_total: number;
  total: number;
}

export type OrderStatus = "new" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderItem {
  product: ProductCard;
  qty: number;
  price: Price;
  line_total: number;
}

export interface OrderEvent {
  kind: string;
  label: string;
  at: string;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  status_label: string;
  created_at: string;
  delivery: {
    method: string;
    method_label: string;
    address: string | null;
    date: string | null;
    store: { id: number; city: string; name: string; address: string } | null;
    price: number;
  };
  payment: {
    method: string;
    method_label: string;
    status: string;
    status_label: string;
  };
  subtotal: number;
  discount_total: number;
  coupon_discount: number;
  delivery_price: number;
  total: number;
  cashback_total: number;
  paid_amount: number;
  remaining: number;
  due_date: string | null;
  comment: string | null;
  items: OrderItem[];
  events: OrderEvent[];
  can_cancel: boolean;
  can_edit: boolean;
}

export interface OrderListItem {
  number: string;
  id: string;
  date: string;
  status: OrderStatus;
  status_label: string;
  total: number;
  paid_amount: number;
  remaining: number;
  due_date: string | null;
}

export interface Company {
  id: string;
  name: string;
  inn: string;
  address: string;
  phone: string | null;
  email: string | null;
}

export interface Manager {
  name: string;
  phone: string;
  email: string;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: "customer" | "manager" | "admin";
  status: "pending" | "approved" | "blocked";
  customer_type: "retail" | "electrician" | "purchaser";
  discount_pct: number;
  cashback_pct: number;
  bonus_balance: number;
  company: Company | null;
  manager: Manager | null;
  notify_marketing: boolean;
  notify_replies: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  product_count: number;
  children: CategoryNode[];
}

export interface CategoryPage {
  category: { slug: string; name: string; description: string | null };
  breadcrumbs: Crumb[];
  children: { slug: string; name: string; product_count: number; image: string | null }[];
  brands: { slug: string; name: string; count: number }[];
  filters: { name: string; values: { value: string; count: number }[] }[];
  price_range: { min: number; max: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ReviewReply {
  author: string;
  date: string;
  text: string;
}

export interface Review {
  id: string;
  author: string;
  date: string;
  rating: number;
  pros: string | null;
  cons: string | null;
  text: string;
  reply: ReviewReply | null;
}

export interface ReviewsResponse {
  summary: { avg: number; count: number; distribution: Record<string, number> };
  items: Review[];
  page: number;
  pages: number;
}

export interface Question {
  id: string;
  author: string;
  date: string;
  text: string;
  answer: ReviewReply | null;
}

export interface QuestionsResponse {
  items: Question[];
  total: number;
}

export interface Suggest {
  products: { slug: string; name: string; code: string; image: string | null; price: number }[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
}

export interface Brand {
  slug: string;
  name: string;
  logo: string | null;
  country_brand: string | null;
  country_origin: string | null;
  product_count: number;
  is_featured: boolean;
  description?: string | null;
}

export interface BrandPage {
  brand: Brand;
  categories: { slug: string; name: string; product_count: number }[];
}

export interface Banner {
  id: string;
  title: string;
  text: string;
  cta_text: string;
  cta_url: string;
  image: string | null;
}

export interface HomeService {
  slug: string;
  title: string;
  short: string;
  image: string | null;
}

export interface HomeProject {
  slug: string;
  title: string;
  date: string;
  year: string;
  object: string;
  service: string;
  image: string | null;
}

export interface HomeNews {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  image?: string | null;
  /** без «#», например ["проекты", "ДГУ"] */
  tags?: string[];
}

export interface Usp {
  title: string;
  text: string;
  icon: string;
}

export interface Home {
  banners: Banner[];
  popular_categories: { slug: string; name: string; image: string | null; product_count: number }[];
  popular_products: ProductCard[];
  new_products: ProductCard[];
  brands: { slug: string; name: string; logo: string | null }[];
  services: HomeService[];
  projects: HomeProject[];
  news: HomeNews[];
  usp: Usp[];
}

export interface Project {
  slug: string;
  title: string;
  year: string;
  date: string;
  object: string;
  service: string;
  image: string | null;
  excerpt?: string;
  body?: string;
  brands?: { slug: string; name: string; logo?: string | null }[];
  photos?: string[];
  video_url?: string | null;
  products?: ProductCard[];
}

export interface NewsItem {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  image: string | null;
  body?: string;
  tags?: string[];
}

export interface Service {
  slug: string;
  title: string;
  short: string;
  body: string;
  image: string | null;
}

export interface Page {
  slug: string;
  title: string;
  body_html: string;
}

export interface Configurator {
  slug: string;
  name: string;
  description: string;
  url: string;
  image: string | null;
}

export interface Store {
  id: number;
  city: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
}

export interface CheckoutOptions {
  delivery_methods: { code: string; label: string; price: number; free_from?: number | null; description: string }[];
  delivery_dates: { date: string; label: string; day_label: string; available: boolean }[];
  payment_methods: { code: string; label: string; sublabel: string; available: boolean }[];
  stores: { id: number; city: string; name: string; address: string }[];
  note: string;
}

export interface CheckoutPayload {
  contact: { first_name: string; last_name: string; phone: string; email: string };
  delivery: { method: string; address?: string; date?: string; store_id?: number };
  payment: { method: string };
  comment?: string;
}

export interface CheckoutResult {
  order: Order;
  payment: { kind: "redirect" | "invoice" | "none"; url?: string };
}

export interface Dashboard {
  company_name: string | null;
  balance: { receivable: number; overdue: number };
  orders_count: number;
  documents_count: number;
  favorites_count: number;
  cart_count: number;
  bonus_balance: number;
  manager: Manager | null;
  notifications_unread: number;
}

export interface ReconciliationEntry {
  date: string;
  doc_type: string;
  doc_number: string;
  debit: number;
  credit: number;
  balance: number;
  order_number: string | null;
}

export interface Reconciliation {
  period: { from: string; to: string };
  opening_balance: number;
  entries: ReconciliationEntry[];
  turnover: { debit: number; credit: number };
  closing_balance: number;
}

export interface BonusEntry {
  date: string;
  order_number: string | null;
  kind: "accrual" | "spend" | "adjust";
  amount: number;
  balance: number;
  note: string | null;
}

export interface BonusStatement {
  balance: number;
  opening: number;
  entries: BonusEntry[];
  closing: number;
}

export interface MyReview {
  product: { slug: string; name: string };
  rating: number;
  text: string;
  date: string;
  reply: ReviewReply | null;
}

export interface MyQuestion {
  product: { slug: string; name: string };
  text: string;
  date: string;
  answer: ReviewReply | null;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AccountDocument {
  id: string;
  kind: "invoice" | "act" | "contract" | string;
  title: string;
  number: string;
  date: string;
  url: string;
}

export interface Estimate {
  id: string;
  name: string;
  created_at: string;
  items_count: number;
  total: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

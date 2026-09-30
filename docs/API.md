# ТЭК Marketplace — API contract (v1)

Base URL: `http://127.0.0.1:8181/api/v1`  (env `NEXT_PUBLIC_API_URL` on the frontend)
Frontend dev URL: `http://127.0.0.1:3010`

All responses are JSON. Money is a JSON number with 2 decimals, currency is TJS, rendered on the frontend as `1 690,80 с.`.
Quantities are JSON numbers (may be fractional for metres). Dates are ISO-8601 (`2025-08-10` or full timestamps in UTC).
Errors: `{"error": {"code": "snake_case_code", "message": "human text (ru)", "details": {...}}}` with a proper HTTP status.

Auth: `Authorization: Bearer <access_jwt>` (15 min). Refresh with `POST /auth/refresh`.
Guest cart: header `X-Cart-Token: <uuid>` (issued by the server in the `cart_token` field of any cart response; frontend persists it in localStorage). When a logged-in user sends `X-Cart-Token`, `POST /cart/merge` merges the guest cart into the user cart.

Pricing rule (applies everywhere a price is shown):
* anonymous → `list_price`, discount 0, cashback 0
* authenticated → `price = list_price * (1 - discount_pct/100)`, `cashback = price * cashback_pct/100`.
  discount_pct/cashback_pct = the most specific matching row of `user_price_rules` (product > brand > category (nearest ancestor) > user default from `users.discount_pct / cashback_pct`), default 0 after registration.
* `sale_price` (Распродажа) replaces `list_price` when set, and the personal discount is applied on top; `list_price` is still returned so the UI can show it struck through + "выгода N с.".

## Rules enforced by the API

* **Errors** — always `{ "error": { code, message, details } }`, including framework rejections (bad JSON → 400/422, unknown route → 404).
* **Rate limits** (per client IP, 429 + `Retry-After`): login 10/min, register 5/10 min, refresh 60/min, password change 5/10 min,
  leads 5/10 min, checkout 10/10 min, cart share 20/10 min, reviews/questions 10/10 min each.
* **Quantities** — positive; whole numbers for non-metre units; multiples of `pack_qty` when set (`invalid_qty` / `invalid_pack`).
* **Stock** is reserved at checkout (row-locked per store, pickup store first) and returned on cancel / order edit.
* **Delivery** — courier `price` (30 с.) is free from `free_from` (1000 с.) of the goods total; pickup is free.
* **Payments** — `alif` / `dc` are `available: false` ("скоро") in production until acquiring is connected; the callback route
  is disabled there. `invoice` requires a company verified by a manager (`POST /admin/users/{id}/approve` verifies it).
* **Orders** — manager status changes follow new → confirmed → processing → shipped → delivered (cancel before delivery);
  a cancel returns stock, reverses accrued cashback and issues a credit note; cashback is accrued on delivery;
  paid orders can't be edited/cancelled by the client.
* **Guest order lookup** (`/orders/{n}?email=`) works only for guest orders and a non-empty matching e-mail.

## Shared JSON shapes

```
Price        { list: number, price: number, discount_pct: number, cashback: number, sale: bool, savings: number }
ProductCard  { id, slug, code, name, brand: {slug,name}, unit: "шт"|"м", image: string|null,
               price: Price, stock_total: number, in_stock: bool, badges: ["sale"|"hit"|"new"],
               rating: number, reviews_count: number, price_unit_label: "за шт"|"за метр",
               pack_qty: number|null }                              // кратность упаковки: qty в корзине/заказе кратно ей
StoreStock   { store_id, city, name, qty, delivery_hint }        // delivery_hint: "сегодня" | "завтра" | "2-3 дня"
Variants     { axes: [{ name, values: string[] }],                // trade offers (Petrovich-style), axes in display order,
               items: VariantItem[] }                               // values sorted naturally (0.75 < 1 < 1.5, E14 < E27)
VariantItem  { slug, code, name, values: { [axis]: value }, in_stock, price: number, unit, image: string|null }
Attribute    { name, value }
Document     { id, title, kind: "certificate"|"declaration"|"drawing"|"passport"|"catalog"|"other", url, size_kb }
Accessory    { group: string, product: ProductCard }
Product      { ...ProductCard, description, short_description, category: {slug,name}, breadcrumbs: [{slug,name}],
               brand: {slug, name, country_brand, country_origin, logo},
               attributes: Attribute[], pack: { qty: number, label: string } | null,
               stock: StoreStock[], variants: Variants | null,
               documents: Document[], accessories: Accessory[], configurator: {name, url} | null,
               images: string[], questions_count, features: [{title, text}] }
CartItem     { id, product: ProductCard, qty, selected: bool, price: Price, line_total: number, line_cashback: number,
               stock_total: number, error: null | { code: "insufficient_stock", available: number } }
Cart         { id, cart_token: string|null, items: CartItem[], items_count, selected_count,
               subtotal_list, discount_total, coupon: {code, discount} | null, subtotal, cashback_total, total }
Order        { id, number, status, status_label, created_at, delivery: {method, method_label, address, date, store, price},
               payment: {method, method_label, status, status_label}, subtotal, discount_total, coupon_discount,
               delivery_price, total, cashback_total, paid_amount, remaining, due_date, comment,
               items: [{product: ProductCard, qty, price: Price, line_total}], events: [{kind, label, at}],
               can_cancel: bool, can_edit: bool }
User         { id, email, phone, first_name, last_name, role: "customer"|"manager"|"admin",
               status: "pending"|"approved"|"blocked", customer_type: "retail"|"electrician"|"purchaser",
               discount_pct, cashback_pct, bonus_balance, company: Company|null,
               manager: {name, phone, email}|null, notify_marketing: bool, notify_replies: bool }
Company      { id, name, inn, address, phone, email }
```

Order statuses: `new`→`confirmed`→`processing`→`shipped`→`delivered`, or `cancelled`. Labels (ru): Новый, Подтверждён, В обработке, Отгружен, Доставлен, Отменён.
Payment methods: `alif` (Алиф Банк / онлайн), `dc` (Душанбе Сити Банк / онлайн), `cash` (Наличными / при получении), `invoice` (По счёту — only for users with a company).
Delivery methods: `courier` (Доставка, 30.00 с., Душанбе/Худжанд, 48 ч по Таджикистану), `pickup` (Самовывоз, 0.00).

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{status:"ok", db:"ok", version}` |
| GET | `/home` | `{ banners:[{id,title,text,cta_text,cta_url,image}], popular_categories:[{slug,name,image,product_count}], popular_products: ProductCard[], new_products: ProductCard[], brands:[{slug,name,logo}], services:[{slug,title,short,image}], projects:[{slug,title,date,year}], news:[{slug,title,date}], usp:[{title,text,icon}] }` |
| GET | `/catalog/tree` | `[{id,slug,name,image,product_count,children:[...]}]` (cached in memory) |
| GET | `/catalog/categories/{slug}` | `{ category:{slug,name,description}, breadcrumbs, children:[{slug,name,product_count,image}], brands:[{slug,name,count}], filters:[{name, values:[{value,count}]}], price_range:{min,max} }` |
| GET | `/catalog/products` | query: `category, brand, q, sort=popular|new|price_asc|price_desc|rating|reviews|name, page=1, per_page=24, in_stock=1, sale=1, hit=1, new=1, price_min, price_max, attr.<Name>=<value>` → `{ items: ProductCard[], total, page, per_page, pages }` |
| GET | `/catalog/products/{slug}` | `Product` |
| GET | `/catalog/products/{slug}/reviews` | `{ summary:{avg, count, distribution:{5:n,...}}, items:[{id, author, date, rating, pros, cons, text, reply:{author, date, text}|null}], page, pages }` |
| POST | `/catalog/products/{slug}/reviews` | auth. `{rating, pros, cons, text}` → 201 review |
| GET | `/catalog/products/{slug}/questions` | `{ items:[{id, author, date, text, answer:{author,date,text}|null}], total }` |
| POST | `/catalog/products/{slug}/questions` | auth. `{text}` → 201 |
| DELETE | `/catalog/products/{slug}/reviews/{id}` | auth, только автор → 204 (пересчитывает рейтинг товара) |
| DELETE | `/catalog/products/{slug}/questions/{id}` | auth, только автор → 204 |
| GET | `/catalog/suggest?q=` | `{ products:[{slug,name,code,image,price}], categories:[{slug,name}], brands:[{slug,name}] }` (max 5 each) |
| GET | `/brands` | `[{slug,name,logo,country_brand,country_origin,product_count,is_featured}]` |
| GET | `/brands/{slug}` | `{ brand:{...,description}, categories:[{slug,name,product_count}] }` (products via `/catalog/products?brand=`) |
| GET | `/content/projects?page&per_page` | `{items:[{slug,title,year,date,object,service,image,excerpt, brands:[{slug,name,logo}], categories:[{slug,name}]}], total, pages}` — `categories` = разделы каталога применённых продуктов (фильтр «Продукция») |
| GET | `/content/projects/{slug}` | `{slug,title,year,date,object,service,image,excerpt,body, brands:[{slug,name,logo}], photos:string[], video_url:string|null, products: ProductCard[] (прайсовые цены)}` |
| GET | `/content/news?page` | `{items:[{slug,title,date,excerpt,image,tags:string[]}], total}` ; `/content/news/{slug}` → `{..., body, tags}` |
| POST | `/leads` | заявка с формы сайта, auth опционально. `{kind: service|feedback|question|project|consultation, name, phone, email?, note?, service?, page?}` → 201 `{id, created_at}`; 422 `name_required` / `phone_invalid`. Пишется в `leads` и ставится событие `lead.created` в outbox CRM (исполнитель — закреплённый менеджер клиента, иначе лид-менеджер) |
| GET | `/content/services` | `[{slug,title,short,body,image}]` ; `/content/services/{slug}` |
| GET | `/content/pages/{slug}` | `{slug,title,body_html}` for `about`, `contacts`, `support`, `help`, `delivery`, `payment` |
| GET | `/content/configurators` | `[{slug,name,description,url,image}]` |
| GET | `/content/stores` | `[{id,city,name,address,phone,hours}]` |
| GET | `/documents/{id}/download` | streams the file (Content-Disposition attachment) |

## Auth

| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/register` | `{email, phone, password, first_name, last_name, customer_type, company?: {name, inn, address}}` → 202 `{message:"Заявка отправлена на одобрение"}` (status `pending`; login refused with 403 `account_pending` until approved) |
| POST | `/auth/login` | `{login (email or phone), password}` → `{access_token, refresh_token, user: User}` |
| POST | `/auth/refresh` | `{refresh_token}` → `{access_token, refresh_token}` (rotation) |
| POST | `/auth/logout` | `{refresh_token}` → 204 |
| GET | `/auth/me` | `User` |

Password policy (validated server-side, message ru): ≥8 chars, latin letters only + digits, at least one letter and one digit, must not contain the user name/email local part.

## Cart (guest via `X-Cart-Token`, or auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/cart` | `Cart` (always returns `cart_token` for guests) |
| POST | `/cart/items` | `{product_id, qty}` → `Cart`. If qty > stock_total → 422 `insufficient_stock` `{available}` |
| PATCH | `/cart/items/{id}` | `{qty?, selected?}` → `Cart` (same stock check) |
| DELETE | `/cart/items/{id}` | → `Cart` |
| POST | `/cart/items/delete-selected` | → `Cart` |
| POST | `/cart/select-all` | `{selected: bool}` → `Cart` |
| POST | `/cart/coupon` | `{code}` → `Cart` or 422 `coupon_invalid` |
| DELETE | `/cart/coupon` | → `Cart` |
| POST | `/cart/merge` | auth + `X-Cart-Token` → `Cart` |
| POST | `/cart/clear` | → `Cart` |
| GET | `/cart/export.xlsx` | Excel estimate (смета) by template: header with company/date, table №/Код/Наименование/Ед./Кол-во/Цена/Скидка/Сумма, totals |
| POST | `/cart/share` | → `{token, url}` snapshot of products + qty |
| GET | `/cart/shared/{token}` | `Cart`-like view priced for the **current** viewer (guest or user) |
| POST | `/cart/shared/{token}/apply` | copies items into the viewer's cart → `Cart` |
| POST | `/cart/estimates` | auth `{name}` → saves current cart as an estimate; `GET /account/estimates` lists them; `POST /account/estimates/{id}/restore` |

## Checkout / orders

| Method | Path | Notes |
|---|---|---|
| GET | `/checkout/options` | `{ delivery_methods:[{code,label,price,description}], delivery_dates:[{date, label:"Сегодня"|"Завтра"|"Пятница", day_label:"9 сентября", available:bool}], payment_methods:[{code,label,sublabel,available}], stores:[{id,city,name,address}] , note:"Подъем/спуск на этажи и разгрузка товара не входят в услугу доставки" }` |
| POST | `/checkout` | `{ contact:{first_name,last_name,phone,email}, delivery:{method, address?, date?, store_id?}, payment:{method}, comment? }` → 201 `{ order: Order, payment: {kind:"redirect"|"invoice"|"none", url?} }`. Uses **selected** cart items only, validates stock, applies coupon, writes `orders`, reserves stock (`integration_outbox` → 1C), pushes to CRM (`assigned manager` if user has one, else `lead manager`), clears the ordered items from the cart, accrues cashback as a pending bonus transaction. |
| POST | `/payments/{provider}/callback` | provider = alif|dc. `{order_number, status:"paid"|"failed", txn_id}` → marks the order paid (stub for the online-payment modules) |
| GET | `/orders/{number}` | auth (or guest with `?email=`) → `Order` |

## Account (auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/account/dashboard` | `{ company_name, balance:{receivable, overdue}, orders_count, documents_count, favorites_count, cart_count, bonus_balance, manager, notifications_unread }` |
| GET/PUT | `/account/profile` | `User` / `{first_name,last_name,phone,email}` |
| PUT | `/account/password` | `{current_password, new_password}` |
| PUT | `/account/notifications` | `{notify_marketing, notify_replies}` |
| GET/PUT | `/account/company` | `Company` / `{name,inn,address,phone,email}` |
| GET | `/account/orders?from&to&page` | default last 30 days → `{items:[{number,id,date,status,status_label,total,paid_amount,remaining,due_date}], total}` |
| GET | `/account/orders/{number}` | `Order` |
| POST | `/account/orders/{number}/cancel` | allowed while status ∉ {shipped, delivered, cancelled} → `Order`; emits CRM update |
| PUT | `/account/orders/{number}` | `{items:[{product_id, qty}], comment?}` re-prices while editable → `Order`; emits CRM update |
| GET | `/account/reconciliation?from&to` | Акт сверки: `{ period:{from,to}, opening_balance, entries:[{date, doc_type, doc_number, debit, credit, balance, order_number}], turnover:{debit,credit}, closing_balance }` ; `.xlsx` variant at `/account/reconciliation.xlsx` |
| GET | `/account/bonus?from&to` | `{ balance, opening, entries:[{date, order_number, kind:"accrual"|"spend"|"adjust", amount, balance, note}], closing }` |
| GET | `/account/reviews` | `[{product:{slug,name}, rating, text, date, reply}]` ; `/account/questions` similar |
| GET | `/account/notifications` | `[{id,kind,title,body,link,is_read,created_at}]` ; `POST /account/notifications/read` `{ids?: []}` marks all/selected |
| GET | `/account/documents` | `[{id,kind:"invoice"|"act"|"contract", title, number, date, url}]` |
| GET/POST/DELETE | `/account/favorites`, `/account/favorites/{product_id}` | `ProductCard[]` |
| GET | `/account/estimates` | saved estimates |

## Manager / admin (role ≥ manager)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users?status=pending` | list |
| POST | `/admin/users/{id}/approve` | sets `approved`, notifies |
| PUT | `/admin/users/{id}/pricing` | `{discount_pct, cashback_pct, manager_id?, rules?:[{category_slug?, brand_slug?, product_id?, discount_pct, cashback_pct}]}` |
| GET | `/admin/orders?status=` | list ; `PUT /admin/orders/{number}/status` `{status}` |
| GET | `/admin/outbox` | integration outbox with statuses |

## Integrations (backend internal)

* `integration_outbox(target: crm|onec, event, payload, status, attempts)`. A tokio background worker POSTs to `CRM_WEBHOOK_URL` / `ONEC_WEBHOOK_URL` if configured; otherwise marks rows `sent` with `mock=true`. Events: `order.created`, `order.updated`, `order.cancelled`, `stock.reserve`, `user.registered`.
* Order routing: `assigned_manager_id = user.manager_id ?? lead manager (users.role='manager' AND is_lead)`.

## Seed accounts (dev)

* `admin@tec.tj / Admin1234` (admin)
* `manager@tec.tj / Manager1234` (lead manager, "Абдурахим Фозилов", +992 6969696969)
* `client@tec.tj / Client1234` (approved B2B purchaser, company ООО «Точикэлектрокомплект», ИНН 123123123, discount 10%, cashback 3%, manager = manager@tec.tj, with orders/ledger history)
* `electric@tec.tj / Electric1234` (approved electrician, discount 5%, cashback 2%)
* `pending@tec.tj / Pending1234` (pending approval → 403 on login)
* coupons: `TEK10` (10%), `WELCOME50` (50 с. off from 500 с.)

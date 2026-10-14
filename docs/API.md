# ТЭК Marketplace — API contract (v1)

Base URL: `http://127.0.0.1:8181/api/v1`  (env `NEXT_PUBLIC_API_URL` on the frontend)
Frontend dev URL: `http://127.0.0.1:3010`

All responses are JSON. Money is a JSON number with 2 decimals, currency is TJS, rendered on the frontend as `1 690,80 с.`.
Quantities are JSON numbers (may be fractional for metres). Dates are ISO-8601 (`2025-08-10` or full timestamps in UTC).
Errors: `{"error": {"code": "snake_case_code", "message": "human text (ru)", "details": {...}}}` with a proper HTTP status.

Auth: `Authorization: Bearer <access_jwt>` (15 min). Refresh with `POST /auth/refresh`.
Guest cart: header `X-Cart-Token: <uuid>` (issued by the server in the `cart_token` field of any cart response; frontend persists it in localStorage). When a logged-in user sends `X-Cart-Token`, `POST /cart/merge` merges the guest cart into the user cart.

Pricing rule (applies everywhere a price is shown; revision R5):
* discount: anonymous and accounts without a discount → 0 %; otherwise the manually set personal discount — the most specific
  matching row of `user_price_rules` (product > brand > category (nearest ancestor) > `users.discount_pct`). It is not
  credited to the bonus account: the account simply sees its own prices.
* `Price.list = list_price * (1 - discount/100)` — the account's regular price; `Price.price` — what it pays:
  `sale_price * (1 - discount/100)` for a promo item (Распродажа), otherwise `= list`. The UI strikes `list` through
  (+ "выгода N с." = `savings`) only when `price < list`, i.e. only for promo items; a personal discount is never struck through.
* cashback is a separate loyalty programme set per product (`products.cashback_pct`, 0–50 %, 0 = none):
  `Price.cashback = price * cashback_pct/100` per unit (shown as the «Кешбэк N с.» badge only when > 0). It is credited to
  the bonus account when the order is delivered; bonuses can be spent only on purchases (`bonus` in `POST /checkout`).

## Rules enforced by the API

* **Errors** — always `{ "error": { code, message, details } }`, including framework rejections (bad JSON → 400/422, unknown route → 404).
* **Rate limits** (per client IP, 429 + `Retry-After`): login 10/min, register 5/10 min, refresh 60/min, password change 5/10 min,
  leads 5/10 min, checkout 10/10 min, cart share 20/10 min, coupon 20/10 min, reviews/questions 10/10 min each, `/payments/*` 30/min.
  Outside production requests from 127.0.0.1 / ::1 are not limited (smoke/e2e).
* **Quantities** — positive; whole numbers for non-metre units; multiples of `pack_qty` when set (`invalid_qty` / `invalid_pack`).
* **Stock** is reserved at checkout (row-locked per store, pickup store first) and returned on cancel / order edit.
* **Checkout** locks the cart: a repeated submit of the same cart, or a cart changed in another tab (items, quantities, selection,
  coupon) after it was priced, gets 409 `cart_changed` instead of a duplicate / stale order.
* **Delivery** — courier `price` (30 с.) is free from `free_from` (1000 с.) of the goods total; pickup is free.
* **Payments** — `alif` / `dc` are `available: false` ("скоро") in production until acquiring is connected; the callback route
  is disabled there. `invoice` requires a company verified by a manager (`POST /admin/users/{id}/approve` verifies it);
  the invoice is due in 3 working days (Sat/Sun skipped) — `due_date`.
* **Orders** — manager status changes follow new → confirmed → processing → shipped → delivered (cancel before delivery);
  a cancel returns stock and the coupon use, reverses accrued cashback and issues a credit note; cashback is accrued on delivery;
  paid orders can't be edited/cancelled by the client (partially paid ones can't be cancelled, and an edit can't bring the total below
  `paid_amount` — 409 `below_paid`). Cancel / edit / status / payment of one order are serialized (row lock).
* **Payments in the reconciliation act** — every company order is a debit (`invoice`); payments are credits (`payment`):
  online payment callback, `cash` on delivery (status → `delivered`), or a manager entry (`POST /admin/orders/{n}/payments`).
  An order edit adds a `credit_note` correction for the difference instead of rewriting the original document.
* **Guest order lookup** (`/orders/{n}?email=`) works only for guest orders and a non-empty matching e-mail.

## Shared JSON shapes

```
Price        { list: number, price: number, discount_pct: number, cashback: number, cashback_pct: number, sale: bool, savings: number }
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
               can_cancel: bool, can_edit: bool, edit_request: EditRequest | null }
EditRequest  { created_at, comment|null, total, delivery_price,                  // client's change request awaiting the manager;
               items: [{product: ProductCard, qty, old_qty}] }                    // qty 0 = removed, old_qty 0 = added
User         { id, email, phone, first_name, last_name, role: "customer"|"manager"|"admin",
               status: "pending"|"approved"|"blocked", customer_type: "retail"|"legal"|"electrician"|"purchaser", email: "" when not given,
               discount_pct, bonus_balance, company: Company|null,
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
| POST | `/catalog/products/{slug}/reviews` | auth. `{rating, pros, cons, text}` → 201 review; one review per account and product — 409 `review_exists` |
| GET | `/catalog/products/{slug}/questions` | `{ items:[{id, author, date, text, answer:{author,date,text}|null}], total }` |
| POST | `/catalog/products/{slug}/questions` | auth. `{text}` → 201 |
| DELETE | `/catalog/products/{slug}/reviews/{id}` | auth, только автор → 204 (пересчитывает рейтинг товара) |
| DELETE | `/catalog/products/{slug}/questions/{id}` | auth, только автор → 204 |
| GET | `/catalog/suggest?q=` | `{ products:[{slug,name,code,image,price}], categories:[{slug,name}], brands:[{slug,name}] }` (max 5 each) |
| GET | `/brands` | `[{slug,name,logo,country_brand,country_origin,product_count,is_featured}]` |
| GET | `/brands/{slug}` | `{ brand:{...,description}, categories:[{slug,name,product_count}] }` (products via `/catalog/products?brand=`) |
| GET | `/content/projects?page&per_page` | `{items:[{slug,title,year,date,object,service,image,excerpt, brands:[{slug,name,logo}], categories:[{slug,name}]}], total, pages}` — `categories` = разделы каталога применённых продуктов (фильтр «Продукция») |
| GET | `/content/projects/{slug}` | `{slug,title,year,date,object,service,image,excerpt,body, brands:[{slug,name,logo}], photos:string[], video_url:string|null, products: ProductCard[] (прайсовые цены)}` |
| GET | `/content/news?page&per_page` | `{items:[{slug,title,date,excerpt,image,tags:string[]}], total, page, pages, per_page}` ; `/content/news/{slug}` → `{..., body, tags}` |
| POST | `/leads` | заявка с формы сайта, auth опционально. `{kind: service|feedback|question|project|consultation, name, phone, email?, note?, service?, page?}` → 201 `{id, created_at}`; 422 `name_required` / `phone_invalid` / `email_invalid`. Пишется в `leads` и ставится событие `lead.created` в outbox CRM (исполнитель — закреплённый менеджер клиента, иначе лид-менеджер) |
| GET | `/content/services` | `[{slug,title,short,body,image}]` ; `/content/services/{slug}` |
| GET | `/content/pages/{slug}` | `{slug,title,body_html}` for `about`, `contacts`, `support`, `help`, `delivery`, `payment` |
| GET | `/content/configurators` | `[{slug,name,description,url,image}]` |
| GET | `/content/stores` | `[{id,city,name,address,phone,hours,delivery_hint,lat,lon}]` |
| GET | `/content/vacancies` | `[{id (slug, anchor), dept, title, city, experience, schedule, salary, blocks:[{title, items:string[]}]}]` — active vacancies (admin panel «Вакансии») |
| GET | `/content/site` | `{online_payment: bool}` — whether Alif / DC online payment is enabled; while it is not, the site texts (footer, «Оплата», FAQ) don't promise it |
| GET | `/documents/{id}/download` | the uploaded file (Content-Disposition attachment, Cyrillic name via `filename*`), or 307 to the document's external `url`, or (demo documents without either) a generated PDF |
| GET | `/files/{id}/{name}` | a file uploaded in the admin panel (news / project images): images and PDF inline, other types as attachment; `Cache-Control: immutable` |

## Auth

| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/register` | `{email?, phone, password, first_name, last_name, customer_type: "retail"|"legal", company?: {name, inn, address}}` — e-mail optional (then phone is required); phone only `+992` + 9 digits, any spelling accepted and stored as `+992XXXXXXXXX` (else 422 `invalid_phone`) → 202 `{message:"Заявка отправлена на одобрение"}` (status `pending`; login refused with 403 `account_pending` until approved) |
| POST | `/auth/login` | `{login (email or phone in any spelling: +992 92 111 22 25 / 921112225), password}` → `{access_token, refresh_token, user: User}` |
| POST | `/auth/refresh` | `{refresh_token}` → `{access_token, refresh_token}` (rotation) |
| POST | `/auth/logout` | `{refresh_token}` → 204 |
| GET | `/auth/me` | `User` |
| POST | `/auth/password/forgot` | `{login}` (e-mail or phone) → 202 `{message}` — always the same answer (no account enumeration). An approved account with an e-mail gets the e-mail `email.password_reset` with a one-time link `{FRONTEND_URL}/reset-password?token=…` valid for 1 hour; at most one e-mail per minute per account, a new link cancels the previous one. 422 `invalid_login` (empty) |
| POST | `/auth/password/check` | `{token}` → 204 if the link is valid, else 422 `invalid_reset_token` |
| POST | `/auth/password/reset` | `{token, password}` → 204; the link is single-use, all sessions of the user are ended. 422 `invalid_reset_token` (unknown / expired / used / account not approved) or `weak_password` (link stays valid) |

Register → 202 `{message, user_id}`; 409 `already_registered`, 422 `invalid_email` / `invalid_phone` / `invalid_name` / `company_required` (legal entity without company) / `weak_password`.

Password policy (validated server-side, message ru): ≥8 chars, latin letters + digits (punctuation `!@#$%^&*()_-+=.,:;?` allowed), at least one letter and one digit, must not contain the user name/email local part.

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
| GET | `/checkout/options` | `{ delivery_methods:[{code,label,price,free_from?,description}], delivery_dates:[{date, label:"Сегодня"|"Завтра"|"Пятница", day_label:"9 сентября", available:bool}], delivery_max_date:"2027-10-12" (в заказе — любая дата от сегодня до неё, кроме воскресенья), payment_methods:[{code,label,sublabel,available}], stores:[{id,city,name,address,phone,hours}] , note:"Подъем/спуск на этажи и разгрузка товара не входят в услугу доставки" }` |
| POST | `/checkout` | `{ contact:{first_name,last_name,phone,email}, delivery:{method, address?, date?, store_id?}, payment:{method}, comment?, bonus? }` → 201 `{ order: Order, payment: {kind:"redirect"|"invoice"|"none", url?} }`. Uses **selected** cart items only, validates stock, applies coupon, writes `orders`, reserves stock (`integration_outbox` → 1C), pushes to CRM (`assigned manager` if user has one, else `lead manager`; `totals.bonus`), clears the ordered items from the cart. `bonus` — bonuses to spend on the goods (signed-in buyer only: 422 `bonus_requires_login`; ≤ goods total after coupon: 422 `bonus_exceeds_total`; ≤ balance, checked under a lock: 422 `insufficient_bonus`): written off as a `spend` bonus transaction, `Order.bonus_spent`, `total` = goods − bonus + delivery (fully covered → `payment.status = paid`, `kind:"none"`). Cancel returns them (`refund`); an edit that lowers the goods total below the spent bonuses returns the excess. Cashback is credited on delivery. |
| POST | `/payments/{provider}/callback` | provider = alif|dc. `{order_number, status:"paid"|"failed", txn_id}` → marks the order paid. Stub for the online-payment modules: only with `PAYMENTS_MOCK` (404 otherwise); 422 `provider_mismatch` |
| GET | `/orders/{number}/invoice.xlsx` | счёт на оплату (auth owner / manager, or guest with `?email=`) |
| GET | `/orders/{number}` | auth (or guest with `?email=`) → `Order` |

## Account (auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/account/dashboard` | `{ company_name, balance:{receivable, overdue}, orders_count, documents_count, favorites_count, cart_count, bonus_balance, manager, notifications_unread }` |
| GET/PUT | `/account/profile` | `User` / `{first_name,last_name,phone,email, current_password?}` — `current_password` required when e-mail or phone (both are logins) changes (422 `password_required`); 409 `email_taken` / `phone_taken`; 422 `invalid_phone` |
| PUT | `/account/password` | `{current_password, new_password}` |
| PUT | `/account/notifications` | `{notify_marketing, notify_replies}` |
| GET/PUT | `/account/company` | `Company` / `{name,inn,address,phone,email}` |
| GET | `/account/orders?from&to&page` | all orders by default (R5); with `from`/`to` — that period → `{items:[{number,id,date,status,status_label,total,paid_amount,remaining,due_date}], total, period: {from,to} \| null}` |
| GET | `/account/orders/{number}` | `Order` |
| POST | `/account/orders/{number}/cancel` | allowed while status ∉ {shipped, delivered, cancelled} → `Order`; emits CRM update |
| PUT | `/account/orders/{number}` | `{items:[{product_id, qty}], comment?}` while editable (not shipped, not paid) → `Order` with `edit_request`. **Change request** (ТЗ: the shipping order changes only after the manager's approval): the order, stock reservation, reconciliation and CRM stay as they are until a manager approves it. The new composition is validated at once exactly as on approval (stock, pack multiples, «below paid») — 422 / 409 right away. A new request replaces a pending one. Emits CRM `order.edit_requested`, e-mails the manager (`email.order_edit_requested`). On approval: items already in the order keep their order prices (new ones — current personal price), the coupon stays applied, delivery price is recalculated, CRM `order.updated` + 1C `stock.reserve` |
| DELETE | `/account/orders/{number}/edit-request` | withdraw the pending request → `Order`; 409 `no_edit_request` |
| GET | `/account/reconciliation?from&to\|all=1` | Акт сверки (default — last 365 days; `all=1` — from the first entry): `{ period:{from,to}, opening_balance, entries:[{date, doc_type, doc_number, debit, credit, balance, order_number}], turnover:{debit,credit}, closing_balance }` ; `.xlsx` variant at `/account/reconciliation.xlsx` |
| GET | `/account/bonus` | the whole history, newest first (R5): `{ balance, accrued, spent, entries:[{date, order_number, kind:"accrual"\|"spend"\|"refund"\|"adjust", kind_label, amount, balance (after the entry), note}] }` ; `.xlsx` variant at `/account/bonus.xlsx` |
| GET | `/account/reviews` | `[{product:{slug,name}, rating, text, date, reply}]` ; `/account/questions` similar |
| GET | `/account/notifications` | `[{id,kind,title,body,link,is_read,created_at}]` ; `POST /account/notifications/read` `{ids?: []}` marks all/selected |
| GET | `/account/documents` | `[{id,kind:"invoice"|"act"|"contract", title, number, date, url}]` |
| GET/POST/DELETE | `/account/favorites`, `/account/favorites/{product_id}` | `ProductCard[]` |
| GET | `/account/estimates` | saved estimates ; `POST /account/estimates/{id}/restore`, `DELETE /account/estimates/{id}` |

## Manager / admin (role ≥ manager)

All paths require role `manager` or `admin` (`Manager` extractor): a customer gets 403 `forbidden`. Rows marked **ADMIN** are
admin-only: a manager gets 403 `admin_only`. Lists of users / orders return at most 500 rows, newest first; paged lists return
`{items, total, page, per_page, pages}` (`page` from 1, `per_page` 1–200, default 50). `q` searches case-insensitively; a phone
typed in any spelling (`+992 90 000 0001`, `900000001`) is matched by digits.

```
AdminUser    { id, email|null, phone|null, first_name, last_name, role, status, customer_type, discount_pct,
               manager_id|null, manager_name|null, is_lead_manager, company_name|null, company_inn|null, company_verified|null, created_at }
AdminOrder   { id, number, created_at, status, status_label, total, paid_amount, remaining, payment_method, payment_method_label,
               payment_status, payment_status_label, delivery_method, delivery_method_label, first_name, last_name, phone, email,
               company_name|null, crm_status, reservation_status, manager_id|null, manager_name|null, manager_email|null,
               edit_pending: bool }                                                 // a client's change request awaits a decision
Lead         { id (number), kind, name, phone, email|null, note, service|null, page|null, status: "new"|"in_progress"|"done",
               manager_note|null, user_id|null, created_at }
AdminReview  { id, product:{id,slug,name}, user_id|null, author, rating, pros, cons, text, created_at, reply_text|null, replied_at|null, status }
AdminQuestion{ id, product:{id,slug,name}, user_id|null, author, text, created_at, answer_text|null, answered_at|null }
Coupon       { code, kind: "percent"|"fixed", value, min_total, active, expires_at|null, usage_limit|null, used_count }
AdminProduct { id, code, slug, name, category:{slug,name}, brand:{slug,name}|null, unit, list_price, sale_price|null, pack_qty|null,
               stock_total, stock:[{store_id, city, name, qty}] (every store, 0 when none), is_active, is_hit, is_new,
               badges:["sale"|"hit"|"new"], image|null, created_at,
               // GET/PUT /admin/products/{id}… also return:
               country_origin|null, brand_info:{id,slug,name,country_brand,country_origin}|null,
               documents: AdminDocument[], accessories:[{group, product_id, code, name, is_active}],
               variant: {group, axes:string[], values:{[axis]:value}, siblings:[{id,code,name,values,is_active}]}|null }
AdminDocument{ id, title, kind, file_name, size_kb, url|null, has_file: bool, created_at, products: number }
ImportSummary{ dry_run, rows, created, updated, skipped, categories_created, brands_created, stock_rows,
               errors:[{row, message}] (row = line number in the file, header = 1; max 1000 listed), ignored_columns:[string] }
```

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users?status=pending\|approved\|blocked&role=customer\|manager\|admin&q=` | `AdminUser[]`; `q` — name / e-mail / phone / company name / ИНН |
| GET | `/admin/users/{id}` | `AdminUser` (same row as in the list); 404 `not_found` |
| POST | `/admin/users/{id}/approve` | pending → approved (+ verifies the user's company, notification + e-mail «Аккаунт активирован»); a manager who approves a client without a manager becomes their manager → `{ok:true}` |
| PUT | `/admin/users/{id}` | `{status?: "approved"\|"blocked", role?: "customer"\|"manager"\|"admin" (ADMIN), is_lead_manager?: bool (ADMIN), manager_id?: uuid\|null (null = unassign), company_verified?: bool}` → `AdminUser`. 403 `self_change` (own role/status), 403 `admin_only` (role / lead flag, or any change of a manager/admin account by a manager), 422 `invalid_status` / `invalid_role` / `invalid_manager` (not an active manager/admin) / `no_company`. Blocking revokes all refresh tokens (the access token stops working at once: status is checked per request). pending → approved here works like `/approve` (notification + e-mail). Demoting to `customer` clears `is_lead_manager`. |
| GET | `/admin/users/{id}/pricing` | `{discount_pct, manager_id, rules:[{category_slug, brand_slug, product_id, discount_pct, category_name, brand_name, product_code, product_name}]}` |
| PUT | `/admin/users/{id}/pricing` | `{discount_pct, manager_id?, rules?:[{category_slug?, brand_slug?, product_id?, discount_pct}]}` (discount 0–90 %) (a manager — only for own clients: 403 `not_your_client`; nobody for himself: 403 `self_pricing`) |
| GET | `/admin/managers` | `[{id, name, email, phone, role, is_lead_manager}]` — active (not blocked) managers and admins, lead manager first; for assignment dropdowns |
| GET | `/admin/orders?status=&q=&mine=1&edit_pending=1` | `AdminOrder[]`; `q` — number / customer name / phone / e-mail / company; `mine=1` — orders assigned to me; `edit_pending=1` — with a pending change request |
| PUT | `/admin/orders/{number}/status` | `{status}` → `Order` (e-mail «Заказ N: статус» to the customer); 409 `edit_pending` when shipping / delivering an order with a pending change request (cancelling is allowed and closes the request) |
| POST | `/admin/orders/{number}/edit-request/approve` | applies the client's request to the order → `Order` (event «Изменение состава подтверждено менеджером», notification + e-mail `email.order_edit_decision`); 409 `no_edit_request`, `not_editable` (shipped / paid — reject instead), 422 / 409 if stock or prices no longer allow it |
| POST | `/admin/orders/{number}/edit-request/reject` | `{note?}` (shown to the client) → `Order`; the order stays as it was; CRM `order.edit_rejected`, notification + e-mail |
| PUT | `/admin/orders/{number}/manager` | `{manager_id: uuid\|null}` → `Order`; reassigns `assigned_manager_id` (`null` — unassign), emits CRM `order.updated {manager: {...}\|null}`, e-mails the new manager; 422 `invalid_manager` (unknown / blocked manager, or the field is missing) |
| POST | `/admin/orders/{number}/payments` | `{amount?, note?}` — payment received (bank transfer for an invoice, partial allowed); no `amount` = the whole remainder → `Order`; 409 `already_paid` / `order_cancelled`, 422 `invalid_amount` |
| GET | `/orders/{number}` | full `Order` (managers may open any order) |
| GET | `/admin/outbox` | last 200 integration / e-mail events `{id, target: crm\|onec\|email, event, status, attempts, mock, last_error, created_at, sent_at, payload}` (for e-mails the HTML part is omitted: `payload {to, subject, text, number?}`; for `email.password_reset` the text is omitted too — it holds a login link — and the text is erased from the database once the e-mail is sent or failed) |
| GET | `/admin/leads?status=new\|in_progress\|done&kind=&q=&page=1&per_page=50` | `{items: Lead[], total, page, per_page, pages}` |
| PUT | `/admin/leads/{id}` | `{status?, manager_note?: string\|null}` → `Lead`; 422 `invalid_status`, 404 |
| GET | `/admin/reviews?unanswered=1&page=&per_page=` | `{items: AdminReview[], total, page, per_page, pages}` |
| DELETE | `/admin/reviews/{id}` | → 204; recomputes the product's `rating` / `reviews_count` |
| POST | `/admin/reviews/{id}/reply` | `{text}` — reply to a review (notification + e-mail to the author on the first reply, if `notify_replies`) → `{ok, reply:{author,date,text,role}}`; `DELETE` — remove the reply (the review stays) |
| GET | `/admin/questions?unanswered=1&page=&per_page=` | `{items: AdminQuestion[], total, page, per_page, pages}` |
| DELETE | `/admin/questions/{id}` | → 204; recomputes `questions_count` |
| POST | `/admin/questions/{id}/answer` | `{text}` — answer a question (notification + e-mail to the author on the first answer, if `notify_replies`) → `{ok, answer:{…}}`; `DELETE` — remove the answer |
| GET | `/admin/coupons` | `Coupon[]` (active first) |
| POST | `/admin/coupons` | `{code, kind, value, min_total?=0, active?=true, expires_at?: RFC 3339 \| "YYYY-MM-DD" (end of that day, Dushanbe time) \| null, usage_limit?: int\|null}` → 201 `Coupon`; 409 `coupon_exists` (case-insensitive); 422 `invalid_coupon` (code 3–32 chars `[A-Za-z0-9_-]`, stored upper-case; percent 0 < v ≤ 100, fixed v > 0, min_total ≥ 0, usage_limit ≥ 1) |
| PUT | `/admin/coupons/{code}` | same fields, all optional (`null` clears `expires_at` / `usage_limit`; the code itself can't be changed — 422) → `Coupon` |
| DELETE | `/admin/coupons/{code}` | → 204 (404 when missing) |
| GET | `/admin/products?q=&category=<slug, with subcategories>&brand=<slug>&active=1\|0&page=&per_page=50` | `{items: AdminProduct[], total, page, per_page, pages}` — includes products taken off sale; exact code match first |
| GET | `/admin/products/{id}` | `AdminProduct` with documents, accessories, variant, countries |
| PUT | `/admin/products/{id}` | `{list_price?, sale_price?: number\|null (null = no sale), cashback_pct?, is_active?, is_hit?, is_new?, country_origin?: string\|null}` → `AdminProduct`; 422 `invalid_price` (list > 0; 0 < sale < list), `invalid_cashback` (0–50 %), `invalid_country` (> 60 chars). `country_origin` — the product's own country of production (shown instead of the brand's on the product page). Clears public caches; `is_active` recounts category counters |
| PUT | `/admin/products/{id}/documents` | `{document_ids: int[]}` → `AdminProduct` — replaces the product's documents (from the shared library); 422 `unknown_document` |
| PUT | `/admin/products/{id}/accessories` | `{items:[{code, group}]}` → `AdminProduct` — replaces accessories (tab «Комплектующие»), in list order; 422 `unknown_product` (codes listed) / `invalid_accessory` |
| PUT | `/admin/products/{id}/variant` | `{group: string\|null, axes?: string[], values:[{axis, value}]}` → `AdminProduct`. Trade offer: group found by name or created; `axes` set the group's axes (default — the group's current axes); a value for every axis is required; 422 `invalid_variant` (≤ 5 axes, duplicate values in the group, unknown axis). `group: null` — leave the group. Empty groups are deleted |
| GET | `/admin/documents?q=&page=&per_page=` | `{items: AdminDocument[], …}` — shared document library |
| POST | `/admin/documents` | `multipart/form-data`: `file` (PDF, JPG, PNG, WebP, GIF, DOC(X), XLS(X), DWG, DXF, ZIP, RAR, 7Z — no SVG; up to 20 MB) **or** `url` (https), `title?` (default — file name), `kind?` (default — guessed from the title), `product_id?` (link to a product) → 201 `AdminDocument`; 409 `duplicate_document` (same url), 422 `unsupported_file` / `file_required` |
| PUT | `/admin/documents/{id}` | `{title?, kind?, url?}` → `AdminDocument` |
| DELETE | `/admin/documents/{id}` | → 204; removed from every product, the uploaded file is deleted |
| GET | `/admin/brands` | `[{id, slug, name, country_brand, country_origin, description, logo_url, is_featured, products}]` |
| PUT | `/admin/brands/{id}` | `{name?, country_brand?, country_origin?, description?}` (`null` clears) → brand row |
| POST | `/admin/files` | `multipart`: `file`, `kind?: "image"` (then only images) → 201 `{id, url: "/api/v1/files/{id}/{name}", name, content_type, size_bytes}` — for news / project images (the frontend maps `/api/v1/files/…` to the API address) |
| GET/POST | `/admin/news?q=&page=` | list `{items:[{id, slug, title, published_at, excerpt, image_url, tags}], …}` / create `{title, slug?, published_at?: "YYYY-MM-DD" (default today), excerpt?, body_text?, image_url?, tags?: string[]}` → 201 with `body_text` |
| GET/PUT/DELETE | `/admin/news/{id}` | `body_text` — text in the panel markup (blank line = paragraph, `- ` list, `1. ` numbered, `## `/`### ` heading, `**bold**`, `[text](https://…)`); the site gets HTML generated from it with everything else escaped (no scripts). Existing HTML is converted back for editing. 409 `slug_taken` (explicit slug in use) |
| GET/POST | `/admin/projects?q=&page=` | list / create `{title, slug?, project_date?, year? (default — year of the date), object?, service?, image_url?, excerpt?, body_text?, photos?: string[], video_url? (https), sort?, brands?: string[] (slugs), products?: string[] (codes)}`; 422 `invalid_content` with unknown brands / codes listed |
| GET/PUT/DELETE | `/admin/projects/{id}` | same fields; `GET` returns `brands` (slugs), `products:[{code,name}]`, `body_text` |
| GET/POST | `/admin/vacancies` | all vacancies (incl. hidden) / create `{title, slug?, dept, city, experience, schedule, salary, blocks:[{title, items}], sort?, is_active?}` |
| PUT/DELETE | `/admin/vacancies/{id}` | `is_active: false` hides it from the site |
| GET/POST | `/admin/stores` | `[{id, code, city, name, address, phone, hours, delivery_hint, lat, lon, sort, stock_total, products}]` / create `{code ([a-z0-9-], used in import headers «Остаток <code>»), city, name, address, phone?, hours?, delivery_hint?, lat?, lon?, sort?}`; 409 `code_taken` |
| PUT/DELETE | `/admin/stores/{id}` | delete only a store without stock and orders — 409 `store_in_use` |
| PUT | `/admin/products/{id}/stock` | `{stores:[{store_id, qty}]}` → `AdminProduct`; sets the absolute sellable quantity per store (order reservations are already subtracted); 422 `invalid_store` / `invalid_qty` |
| POST | `/admin/import/catalog?dry_run=1` | **ADMIN**. `multipart/form-data`, field `file` (.xlsx / .xls / .ods or CSV UTF-8 / Windows-1251, `;` `,` or tab separated), up to **20 MB** (413 `payload_too_large`), timeout 10 min → 200 `ImportSummary`. One transaction; `dry_run` rolls it back. Row errors are skipped and listed, not fatal; header errors → 422 `invalid_header` `{details:{problems, headers}}`; unreadable file → 422 `invalid_file`; no `file` field → 422 `file_required`. Format: [`docs/IMPORT.md`](IMPORT.md). Also from the server console: `tek-api import <file> [--dry-run]` |
| GET | `/admin/import/template.xlsx` | **ADMIN**. Template: sheet «Каталог» (headers incl. one `Остаток <store code>` column per current store, one example row taken from the catalog) + sheet «Инструкция» |

**Products taken off sale** (`is_active = false`, migration 0009): hidden from listings, search/suggest, home, brand counters,
category facets and counters and trade-offer variants; `GET /catalog/products/{slug}` → 404; `POST /cart/items` → 404;
checkout with such a product still in the cart → 422 `product_unavailable`; an order edit can keep it but not add it again.

## E-mail notifications

Sent via SMTP (`lettre`, rustls) by the outbox worker — `integration_outbox` rows with `target = "email"`, payload `{to, subject, html, text, number?}`,
queued in the same transaction as the event that triggers them, so an e-mail problem never fails the request. Delivery: retries with
the same backoff as webhooks (12 attempts); a permanent SMTP rejection / invalid address → `failed` at once; while the SMTP server is
unreachable the rest of the batch waits a minute (CRM / 1C events are not delayed). No `SMTP_URL`: outside production rows are marked
`sent` with `mock = true`; in production they stay queued until SMTP is configured.

| Event | To | When |
|---|---|---|
| `email.registration_received` | customer (if an e-mail was given) | `POST /auth/register` |
| `email.registration_new` | manager recipient¹ | `POST /auth/register` (pending approval) |
| `email.account_approved` | customer | `POST /admin/users/{id}/approve`, `PUT /admin/users/{id}` pending → approved |
| `email.order_created` | `order.email` (items, totals, delivery, payment, link: `/account/orders/{n}`, guests `/checkout/success/{n}`) | checkout |
| `email.order_new` | manager recipient¹ (personal manager of the customer) | checkout |
| `email.order_status` | `order.email` | `PUT /admin/orders/{n}/status` (incl. cancel by manager) |
| `email.order_assigned` | the new manager (not when assigning to yourself) | `PUT /admin/orders/{n}/manager` |
| `email.review_reply` / `email.question_answer` | author, first reply only, if `notify_replies` | `POST /admin/reviews/{id}/reply`, `/admin/questions/{id}/answer` |
| `email.lead_new` | manager recipient¹ | `POST /leads` |
| `email.password_reset` | the account's e-mail | `POST /auth/password/forgot` |
| `email.order_edit_requested` | manager recipient¹ (the order's manager) | `PUT /account/orders/{n}` |
| `email.order_edit_decision` | `order.email` | approve / reject of a change request |

¹ Manager recipient: the customer's personal manager (`users.manager_id`) → `MANAGER_NOTIFY_EMAIL` → the lead manager. No e-mail → not queued.
Links to the admin UI in manager e-mails: `{FRONTEND_URL}/admin/orders?q={number}`, `/admin/users?status=pending`, `/admin/leads`.

Config (backend env): `SMTP_URL` (`smtps://user:pass@smtp.example.com:465` — implicit TLS, or `smtp://user:pass@smtp.example.com:587?tls=required` — STARTTLS;
URL-encode special characters in the password), `MAIL_FROM` (default `ТЭК <noreply@tec.tj>`), `MANAGER_NOTIFY_EMAIL` (optional). In production an
invalid `SMTP_URL` / `MAIL_FROM` stops the start-up with an explanation.

## Integrations (backend internal)

* `integration_outbox(target: crm|onec|email, event, payload, status, attempts)`. A tokio background worker POSTs to `CRM_WEBHOOK_URL` / `ONEC_WEBHOOK_URL` if configured (e-mails — via SMTP, see above); otherwise (outside production) marks rows `sent` with `mock=true`, in production keeps them queued. Events: `order.created`, `order.updated` (status, payment, items, `manager` on reassignment), `order.cancelled`, `order.edit_requested` / `order.edit_rejected` / `order.edit_withdrawn` (client's change request; the approved change comes as `order.updated` with items), `stock.reserve`, `stock.release`, `user.registered`, `lead.created`. Events of one order are delivered in order (a later one waits while an earlier one is pending a retry). The catalog import sends nothing to CRM / 1C.
* Order routing: `assigned_manager_id = user.manager_id ?? lead manager (users.role='manager' AND is_lead)`; a manager can reassign it (`PUT /admin/orders/{n}/manager`).

## Seed accounts (dev)

* `admin@tec.tj / Admin1234` (admin)
* `manager@tec.tj / Manager1234` (lead manager, "Абдурахим Фозилов", +992935000010)
* `client@tec.tj / Client1234` (approved B2B purchaser, company ООО «Точикэлектрокомплект», ИНН 123123123, discount 10% (15% on кабеленесущие системы), manager = manager@tec.tj, with orders/ledger/bonus history)
* `electric@tec.tj / Electric1234` (approved electrician, discount 5% (8% on ДКС))
* demo cashback: ДКС products 3 %, codes 101005 / 101010 — 5 %
* `pending@tec.tj / Pending1234` (pending approval → 403 on login)
* coupons: `TEK10` (10%), `WELCOME50` (50 с. off from 500 с.)

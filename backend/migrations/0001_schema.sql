CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  inn         text,
  address     text,
  phone       text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE,
  phone            text UNIQUE,
  password_hash    text NOT NULL,
  first_name       text NOT NULL DEFAULT '',
  last_name        text NOT NULL DEFAULT '',
  role             text NOT NULL DEFAULT 'customer',      -- customer|manager|admin
  status           text NOT NULL DEFAULT 'pending',       -- pending|approved|blocked
  customer_type    text NOT NULL DEFAULT 'retail',        -- retail|electrician|purchaser
  company_id       uuid REFERENCES companies(id),
  manager_id       uuid REFERENCES users(id),
  is_lead_manager  boolean NOT NULL DEFAULT false,
  discount_pct     numeric(5,2) NOT NULL DEFAULT 0,
  cashback_pct     numeric(5,2) NOT NULL DEFAULT 0,
  notify_marketing boolean NOT NULL DEFAULT true,
  notify_replies   boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_manager_idx ON users(manager_id);

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);

CREATE TABLE stores (
  id            serial PRIMARY KEY,
  code          text NOT NULL UNIQUE,
  city          text NOT NULL,
  name          text NOT NULL,
  address       text NOT NULL,
  phone         text,
  hours         text,
  delivery_hint text NOT NULL DEFAULT 'сегодня',
  sort          int NOT NULL DEFAULT 0
);

CREATE TABLE brands (
  id             serial PRIMARY KEY,
  slug           text NOT NULL UNIQUE,
  name           text NOT NULL,
  country_brand  text,
  country_origin text,
  description    text,
  logo_url       text,
  is_featured    boolean NOT NULL DEFAULT false,
  sort           int NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id            serial PRIMARY KEY,
  parent_id     int REFERENCES categories(id),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  path          text NOT NULL UNIQUE,
  image_url     text,
  description   text,
  sort          int NOT NULL DEFAULT 0,
  product_count int NOT NULL DEFAULT 0
);
CREATE INDEX categories_parent_idx ON categories(parent_id);
CREATE INDEX categories_path_idx ON categories(path text_pattern_ops);

CREATE TABLE configurators (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  url         text NOT NULL,
  image_url   text
);

CREATE TABLE product_groups (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  param_name text NOT NULL
);

CREATE TABLE products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  brand_id          int REFERENCES brands(id),
  category_id       int NOT NULL REFERENCES categories(id),
  group_id          int REFERENCES product_groups(id),
  param_value       text,
  unit              text NOT NULL DEFAULT 'шт',
  list_price        numeric(14,2) NOT NULL,
  sale_price        numeric(14,2),
  is_hit            boolean NOT NULL DEFAULT false,
  is_new            boolean NOT NULL DEFAULT false,
  pack_qty          numeric(12,3),
  pack_label        text,
  configurator_id   int REFERENCES configurators(id),
  attributes        jsonb NOT NULL DEFAULT '[]'::jsonb,
  images            text[] NOT NULL DEFAULT '{}',
  description       text NOT NULL DEFAULT '',
  short_description text NOT NULL DEFAULT '',
  features          jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating            numeric(3,2) NOT NULL DEFAULT 0,
  reviews_count     int NOT NULL DEFAULT 0,
  questions_count   int NOT NULL DEFAULT 0,
  popularity        int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_brand_idx ON products(brand_id);
CREATE INDEX products_group_idx ON products(group_id);
CREATE INDEX products_popularity_idx ON products(popularity DESC);
CREATE INDEX products_created_idx ON products(created_at DESC);
CREATE INDEX products_price_idx ON products((COALESCE(sale_price, list_price)));
CREATE INDEX products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX products_code_trgm ON products USING gin (code gin_trgm_ops);
CREATE INDEX products_attributes_gin ON products USING gin (attributes jsonb_path_ops);

CREATE TABLE stock (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id   int NOT NULL REFERENCES stores(id),
  qty        numeric(12,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, store_id)
);

CREATE TABLE documents (
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  kind         text NOT NULL,          -- certificate|declaration|drawing|passport|catalog|other
  file_name    text NOT NULL,
  size_kb      int NOT NULL DEFAULT 120,
  content_type text NOT NULL DEFAULT 'application/pdf'
);

CREATE TABLE product_documents (
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  document_id int NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, document_id)
);

CREATE TABLE accessories (
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  accessory_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_name   text NOT NULL,
  sort         int NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, accessory_id)
);

CREATE TABLE user_price_rules (
  id           serial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  int REFERENCES categories(id),
  brand_id     int REFERENCES brands(id),
  product_id   uuid REFERENCES products(id),
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  cashback_pct numeric(5,2) NOT NULL DEFAULT 0
);
CREATE INDEX user_price_rules_user_idx ON user_price_rules(user_id);

CREATE TABLE reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id),
  author_name  text NOT NULL,
  rating       int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  pros         text NOT NULL DEFAULT '',
  cons         text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  reply_text   text,
  reply_author text,
  replied_at   timestamptz,
  status       text NOT NULL DEFAULT 'published',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_idx ON reviews(product_id, created_at DESC);
CREATE INDEX reviews_user_idx ON reviews(user_id);

CREATE TABLE questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id),
  author_name   text NOT NULL,
  body          text NOT NULL,
  answer_text   text,
  answer_author text,
  answered_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_product_idx ON questions(product_id, created_at DESC);
CREATE INDEX questions_user_idx ON questions(user_id);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  link       text,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE carts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token       uuid UNIQUE,
  coupon_code text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        numeric(12,3) NOT NULL,
  selected   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX cart_items_cart_idx ON cart_items(cart_id);

CREATE TABLE cart_shares (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id),
  items      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saved_estimates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  items      jsonb NOT NULL,
  total      numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coupons (
  code        text PRIMARY KEY,
  kind        text NOT NULL,                 -- percent|fixed
  value       numeric(14,2) NOT NULL,
  min_total   numeric(14,2) NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  usage_limit int,
  used_count  int NOT NULL DEFAULT 0
);

CREATE SEQUENCE order_number_seq START 1001;

CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number              text NOT NULL UNIQUE,
  user_id             uuid REFERENCES users(id),
  company_id          uuid REFERENCES companies(id),
  first_name          text NOT NULL DEFAULT '',
  last_name           text NOT NULL DEFAULT '',
  phone               text NOT NULL DEFAULT '',
  email               text NOT NULL DEFAULT '',
  status              text NOT NULL DEFAULT 'new',
  delivery_method     text NOT NULL,
  delivery_address    text,
  delivery_date       date,
  store_id            int REFERENCES stores(id),
  delivery_price      numeric(14,2) NOT NULL DEFAULT 0,
  payment_method      text NOT NULL,
  payment_status      text NOT NULL DEFAULT 'pending',   -- pending|paid|invoice_issued|failed
  comment             text,
  subtotal_list       numeric(14,2) NOT NULL DEFAULT 0,
  discount_total      numeric(14,2) NOT NULL DEFAULT 0,
  coupon_code         text,
  coupon_discount     numeric(14,2) NOT NULL DEFAULT 0,
  subtotal            numeric(14,2) NOT NULL DEFAULT 0,
  total               numeric(14,2) NOT NULL DEFAULT 0,
  cashback_total      numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount         numeric(14,2) NOT NULL DEFAULT 0,
  due_date            date,
  assigned_manager_id uuid REFERENCES users(id),
  crm_status          text NOT NULL DEFAULT 'pending',
  reservation_status  text NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON orders(user_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders(status);

CREATE TABLE order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    uuid REFERENCES products(id),
  code          text NOT NULL,
  name          text NOT NULL,
  unit          text NOT NULL,
  qty           numeric(12,3) NOT NULL,
  list_price    numeric(14,2) NOT NULL,
  price         numeric(14,2) NOT NULL,
  discount_pct  numeric(5,2) NOT NULL DEFAULT 0,
  cashback_pct  numeric(5,2) NOT NULL DEFAULT 0,
  line_total    numeric(14,2) NOT NULL,
  line_cashback numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

CREATE TABLE order_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  label      text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events(order_id, created_at);

CREATE TABLE integration_outbox (
  id         bigserial PRIMARY KEY,
  target     text NOT NULL,          -- crm|onec
  event      text NOT NULL,
  payload    jsonb NOT NULL,
  status     text NOT NULL DEFAULT 'pending',   -- pending|sent|failed
  attempts   int NOT NULL DEFAULT 0,
  last_error text,
  mock       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz
);
CREATE INDEX integration_outbox_status_idx ON integration_outbox(status, id);

CREATE TABLE ledger_entries (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id),
  entry_date date NOT NULL,
  doc_type   text NOT NULL,           -- invoice|payment|credit_note
  doc_number text NOT NULL,
  debit      numeric(14,2) NOT NULL DEFAULT 0,
  credit     numeric(14,2) NOT NULL DEFAULT 0,
  order_id   uuid REFERENCES orders(id),
  due_date   date,
  note       text
);
CREATE INDEX ledger_entries_user_idx ON ledger_entries(user_id, entry_date, id);

CREATE TABLE bonus_transactions (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   uuid REFERENCES orders(id),
  entry_date date NOT NULL,
  kind       text NOT NULL,           -- accrual|spend|adjust
  amount     numeric(14,2) NOT NULL,
  note       text
);
CREATE INDEX bonus_transactions_user_idx ON bonus_transactions(user_id, entry_date, id);

CREATE TABLE favorites (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE banners (
  id        serial PRIMARY KEY,
  title     text NOT NULL,
  text      text NOT NULL DEFAULT '',
  cta_text  text,
  cta_url   text,
  image_url text,
  sort      int NOT NULL DEFAULT 0,
  active    boolean NOT NULL DEFAULT true
);

CREATE TABLE usp (
  id    serial PRIMARY KEY,
  title text NOT NULL,
  text  text NOT NULL DEFAULT '',
  icon  text NOT NULL DEFAULT 'truck',
  sort  int NOT NULL DEFAULT 0
);

CREATE TABLE projects (
  id           serial PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  year         text NOT NULL,
  project_date date NOT NULL,
  object       text NOT NULL DEFAULT '',
  service      text NOT NULL DEFAULT '',
  image_url    text,
  excerpt      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  sort         int NOT NULL DEFAULT 0
);

CREATE TABLE news (
  id           serial PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  published_at date NOT NULL,
  excerpt      text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  image_url    text
);

CREATE TABLE services (
  id        serial PRIMARY KEY,
  slug      text NOT NULL UNIQUE,
  title     text NOT NULL,
  short     text NOT NULL DEFAULT '',
  body      text NOT NULL DEFAULT '',
  image_url text,
  sort      int NOT NULL DEFAULT 0
);

CREATE TABLE pages (
  slug      text PRIMARY KEY,
  title     text NOT NULL,
  body_html text NOT NULL
);

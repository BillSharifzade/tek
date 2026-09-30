-- Данные, которых требуют макет Figma и ТЗ: теги новостей, фото/видео/бренды/продукты проектов, заявки с форм.

ALTER TABLE news ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE projects ADD COLUMN photos text[] NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN video_url text;

CREATE TABLE project_brands (
  project_id int NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  brand_id   int NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, brand_id)
);
CREATE INDEX project_brands_brand_idx ON project_brands(brand_id);

CREATE TABLE project_products (
  project_id int  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort       int  NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, product_id)
);

-- заявки с форм сайта (услуги, обратная связь, «не нашли ответ»); уходят в CRM через integration_outbox
CREATE TABLE leads (
  id         bigserial PRIMARY KEY,
  kind       text NOT NULL DEFAULT 'feedback',
  name       text NOT NULL,
  phone      text NOT NULL,
  email      text,
  note       text NOT NULL DEFAULT '',
  service    text,
  page       text,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_created_idx ON leads(created_at DESC);

CREATE INDEX products_rating_idx ON products(rating DESC, reviews_count DESC);

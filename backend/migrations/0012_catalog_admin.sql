-- Панель и импорт каталога: документы товаров файлами или ссылками, страна производства товара,
-- загрузка файлов (документы, картинки новостей и проектов) — в базе, без отдельного тома на сервере.

CREATE TABLE files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,           -- исходное имя файла (для Content-Disposition)
  content_type text NOT NULL,
  size_bytes   int NOT NULL,
  data         bytea NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- документ — загруженный файл (file_id) или внешняя ссылка (url, например на сайт производителя);
-- у документов из сида нет ни того ни другого — для них отдаётся сгенерированный PDF
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS documents_url_uidx ON documents(url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_documents_document_idx ON product_documents(document_id);

-- страна производства конкретного товара; пусто — как у бренда (brands.country_origin)
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_origin text;

CREATE INDEX IF NOT EXISTS accessories_accessory_idx ON accessories(accessory_id);

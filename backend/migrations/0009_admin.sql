-- Панель управления: обработка заявок с форм, снятие товаров с продажи, поиск в списках менеджера.

-- заявки: статус обработки менеджером и его заметка
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';   -- new|in_progress|done
ALTER TABLE leads ADD COLUMN IF NOT EXISTS manager_note text;
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status, created_at DESC);

-- товар, снятый с продажи (is_active = false), не показывается в каталоге, поиске, на главной и в торговых предложениях,
-- его карточка отдаёт 404, в корзину и в заказ его не добавить; в панели и при импорте он доступен
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- списки панели: новые сверху, «мои заказы» менеджера, модерация отзывов и вопросов
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_manager_idx ON orders(assigned_manager_id, created_at DESC);
CREATE INDEX IF NOT EXISTS users_created_idx ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_created_idx ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS questions_created_idx ON questions(created_at DESC);

-- integration_outbox.target: crm | onec | email (письма: payload {to, subject, html, text})

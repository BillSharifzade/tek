-- Подготовка к production: резерв остатков под заказ и проверка компании перед оплатой по счёту.

-- откуда списан товар под заказ (для возврата на склад при отмене / изменении заказа)
CREATE TABLE order_stock (
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id   int  NOT NULL REFERENCES stores(id),
  qty        numeric(12,3) NOT NULL CHECK (qty > 0),
  PRIMARY KEY (order_id, product_id, store_id)
);

-- оплата по счёту (отсрочка 14 дней) — только для компаний, проверенных менеджером
ALTER TABLE companies ADD COLUMN verified boolean NOT NULL DEFAULT false;
UPDATE companies SET verified = true;

-- уборка: гостевые корзины и истёкшие refresh-токены
CREATE INDEX IF NOT EXISTS carts_updated_idx ON carts(updated_at);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens(expires_at);

-- доставка событий в CRM / 1С: повторы с растущей паузой (до суток), без блокировки строк на время HTTP
ALTER TABLE integration_outbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX integration_outbox_due_idx ON integration_outbox(next_attempt_at) WHERE status = 'pending';

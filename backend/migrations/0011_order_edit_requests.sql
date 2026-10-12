-- Изменение заказа клиентом — через подтверждение менеджером (ТЗ: «Обновление заказа должно поступать в заказ на отгрузку.
-- Заказ на отгрузку должен меняться после одобрения менеджером»). Клиент отправляет запрос — новый состав и комментарий;
-- заказ, резерв на складе, акт сверки и CRM не меняются, пока менеджер не одобрит запрос.
CREATE TABLE order_edit_requests (
  id             bigserial PRIMARY KEY,
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  items          jsonb NOT NULL,                 -- [{"product_id": "…", "qty": 10}]
  comment        text,
  -- итог и доставка заказа после изменения — расчёт на момент запроса (при одобрении пересчитываются)
  total          numeric(14,2) NOT NULL,
  delivery_price numeric(14,2) NOT NULL,
  status         text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|withdrawn|superseded|cancelled
  manager_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  manager_note   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz
);
-- у заказа не больше одного запроса на рассмотрении: новый запрос клиента заменяет прежний (superseded)
CREATE UNIQUE INDEX order_edit_requests_pending_uidx ON order_edit_requests(order_id) WHERE status = 'pending';
CREATE INDEX order_edit_requests_order_idx ON order_edit_requests(order_id, created_at DESC);

-- События одного заказа уходят в CRM / 1С по порядку: воркер ищет более раннее неотправленное событие того же заказа.
CREATE INDEX IF NOT EXISTS integration_outbox_order_idx ON integration_outbox (target, (payload->>'number'), id) WHERE status = 'pending';

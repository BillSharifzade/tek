-- Доработки R5: персональная скидка аккаунта — просто его цена (без зачёркивания и без начисления на бонусный счёт);
-- кешбэк — отдельная программа лояльности на определённые товары, бонусы тратятся только на покупки.

-- кешбэк задаётся товару (процент от цены покупателя), а не аккаунту / правилу персональной цены
ALTER TABLE products ADD COLUMN cashback_pct numeric(5,2) NOT NULL DEFAULT 0
  CONSTRAINT products_cashback_pct_check CHECK (cashback_pct >= 0 AND cashback_pct <= 50);
ALTER TABLE users DROP COLUMN cashback_pct;
ALTER TABLE user_price_rules DROP COLUMN cashback_pct;

-- бонусы, списанные в оплату заказа (уменьшают сумму к оплате; при отмене возвращаются на счёт)
ALTER TABLE orders ADD COLUMN bonus_spent numeric(14,2) NOT NULL DEFAULT 0;

-- один отзыв на товар от аккаунта: из уже оставленных повторов остаётся последний
DELETE FROM reviews r USING reviews n
 WHERE r.user_id IS NOT NULL AND n.user_id = r.user_id AND n.product_id = r.product_id
   AND (n.created_at, n.id) > (r.created_at, r.id);
CREATE UNIQUE INDEX reviews_product_user_uniq ON reviews(product_id, user_id) WHERE user_id IS NOT NULL;
UPDATE products p SET
  reviews_count = (SELECT count(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'published'),
  rating = (SELECT COALESCE(round(avg(r.rating)::numeric, 2), 0) FROM reviews r WHERE r.product_id = p.id AND r.status = 'published')
 WHERE p.reviews_count <> (SELECT count(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'published');

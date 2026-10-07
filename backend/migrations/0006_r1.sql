-- Доработки R1 (tec.tj): регистрация без e-mail (вход по телефону), адреса и координаты магазинов,
-- фото категорий, новый номер телефона в текстах.

-- e-mail при регистрации не обязателен; UNIQUE по-прежнему (NULL не конфликтуют)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- телефоны пользователей — в единый формат +992XXXXXXXXX (так их ищет вход и проверка дублей при регистрации);
-- номера, которые после приведения совпали бы у двух аккаунтов, не трогаем
WITH c AS (
  SELECT id,
         CASE WHEN length(d) = 9 THEN '+992' || d
              WHEN length(d) = 12 AND d LIKE '992%' THEN '+' || d END AS canon
  FROM (SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') AS d FROM users WHERE phone IS NOT NULL) s
), ok AS (
  SELECT id, canon FROM c
  WHERE canon IS NOT NULL AND canon IN (SELECT canon FROM c WHERE canon IS NOT NULL GROUP BY canon HAVING count(*) = 1)
)
UPDATE users u SET phone = ok.canon FROM ok
 WHERE u.id = ok.id AND u.phone <> ok.canon
   AND NOT EXISTS (SELECT 1 FROM users x WHERE x.phone = ok.canon AND x.id <> u.id);

-- магазины: координаты для «Показать на карте» и новые адреса / телефоны / режим работы
ALTER TABLE stores ADD COLUMN IF NOT EXISTS lat double precision, ADD COLUMN IF NOT EXISTS lon double precision;
UPDATE stores SET address = 'г. Душанбе, ул. Низоми Ганджави', phone = NULL, hours = '8:30–17:00', lat = 38.549998, lon = 68.735072
 WHERE code = 'dushanbe';
UPDATE stores SET address = 'г. Худжанд, рынок Вахдат, вход 1', phone = '+992 92 111 22 25', hours = 'Пн–Сб 8:00–17:00', lat = 40.247170, lon = 69.695286
 WHERE code = 'khujand';
UPDATE stores SET address = 'г. Душанбе, рынок Кушониён, магазин №327', phone = '+992 55 000 66 13', hours = 'Пн – Сб: 9:00–17:00, Вс — выходной',
       lat = 38.633192, lon = 68.766223
 WHERE code = 'kushoniyon';

-- фото категорий верхнего уровня (frontend/public/categories/*.png) вместо иллюстраций
UPDATE categories SET image_url = '/categories/' || slug || '.png'
 WHERE parent_id IS NULL AND slug IN ('kabelenesushchie-sistemy', 'svetotekhnika', 'generatory', 'molniezashchita-i-zazemlenie',
                                      'nizkovoltnoe-oborudovanie', 'shchitovoe-oborudovanie', 'elektroustanovochnye-izdeliya');

-- номер телефона в текстах услуг, новостей и страниц
UPDATE services SET body = replace(body, '+992 (44) 620 60 60', '+992 446 20 60 60') WHERE body LIKE '%620 60 60%';
UPDATE news SET body = replace(body, '+992 (44) 620 60 60', '+992 446 20 60 60') WHERE body LIKE '%620 60 60%';
UPDATE pages SET body_html = '<p><strong>Телефон:</strong> <a href="tel:+992446206060">+992 446 20 60 60</a></p><p><strong>E-mail:</strong> <a href="mailto:info@tec.tj">info@tec.tj</a>, <a href="mailto:sales@tec.tj">sales@tec.tj</a></p><p><strong>Главный офис:</strong> г. Душанбе, ул. Бохтар 37/1, офис 704</p><p><strong>Склад:</strong> г. Душанбе, ул. Низоми Ганджави</p><p><strong>Магазин:</strong> г. Душанбе, рынок Кушониён, магазин №327</p><p><strong>Филиал:</strong> г. Худжанд, рынок Вахдат, вход 1</p><p>Режим работы офиса: Пн – Пт: 9:00–17:00, Сб – Вс — выходной</p>'
 WHERE slug = 'contacts';
UPDATE pages SET body_html = replace(body_html, '+992 (44) 620 60 60', '+992 446 20 60 60') WHERE body_html LIKE '%620 60 60%';

-- Макет лендинга, редакция 06.10 (Figma): новые преимущества, плитки категорий с новыми разделами.

-- разделы из плиток лендинга (на пустой базе их создаёт сид — здесь только для уже заполненного каталога)
INSERT INTO categories (slug, name, path, image_url, description, sort)
SELECT v.slug, v.name, v.slug, '/categories/' || v.slug || '.png',
       v.name || ': оригинальная продукция ведущих мировых производителей со склада в Душанбе.', v.sort
FROM (VALUES ('instrumenty', 'Инструменты', 10),
             ('solnechnaya-energetika', 'Солнечная энергетика', 11),
             ('elektromontazhnaya-produktsiya', 'Электромонтажная продукция', 12)) AS v(slug, name, sort)
WHERE EXISTS (SELECT 1 FROM categories)
ON CONFLICT (slug) DO NOTHING;

-- преимущества: тексты и иконки макета; ** — акцентный фрагмент
UPDATE usp SET title = 'Большой ассортимент **оригинальных товаров** от мировых брендов', icon = 'assortment',
               text = 'Прямые контракты с производителями, сертификаты на всё' WHERE sort = 1;
UPDATE usp SET title = '**Доставка товаров** по Душанбе в течение 24 часов с момента заказа', icon = 'truck',
               text = 'Собственная служба доставки, по Таджикистану — за 48 часов' WHERE sort = 2;
UPDATE usp SET title = '**Квалифицированная техподдержка** по каждому товару', icon = 'support',
               text = 'Инженеры помогут с подбором и расчётом' WHERE sort = 3;
UPDATE usp SET title = '**Удобный личный кабинет** для работы с заказами, оплатами и сметами', icon = 'account',
               text = 'Персональные цены, акт сверки и бонусная карта' WHERE sort = 4;

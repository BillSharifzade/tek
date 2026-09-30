-- Торговые предложения «как у Петровича»: группа — это один товар в нескольких исполнениях,
-- каждое исполнение — отдельный товар (свой код, URL, цена, фото, остатки). Раньше у группы была одна ось
-- (param_name / param_value), теперь осей сколько угодно: «Число полюсов × Номинальный ток», «Цоколь × Температура × Мощность».

ALTER TABLE product_groups ADD COLUMN axes text[] NOT NULL DEFAULT '{}';   -- порядок осей = порядок на странице
ALTER TABLE products ADD COLUMN variant jsonb NOT NULL DEFAULT '{}'::jsonb; -- { "<ось>": "<значение>" }

UPDATE product_groups SET axes = ARRAY[param_name];
UPDATE products p SET variant = jsonb_build_object(g.param_name, p.param_value)
  FROM product_groups g
 WHERE g.id = p.group_id AND p.param_value IS NOT NULL;

ALTER TABLE products DROP COLUMN param_value;
ALTER TABLE product_groups DROP COLUMN param_name;

CREATE UNIQUE INDEX product_groups_name_uidx ON product_groups(name);

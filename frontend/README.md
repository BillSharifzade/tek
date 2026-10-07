# tek-web — сайт ТЭК (Next.js)

Интернет-магазин и корпоративный сайт: **Next.js 16** (App Router, RSC), **React 19**, **Tailwind 4**, **Bun**, zustand. Данные — из API `tek-api` (`../backend`, контракт `../docs/API.md`). Вёрстка — по макету Figma (1512 / колонка 1260, Roboto); токены цветов и кнопок — `src/app/globals.css`.

## Запуск

```bash
cp .env.example .env.local   # адрес API и сайта
bun install
bun run dev -p 3010          # http://127.0.0.1:3010 (API должен работать на :8181)
```

Проверка: `bun run lint`, `bun run build`. Сквозная проверка страниц — `../scripts/e2e.sh`.

## Переменные окружения

| Переменная | Где | Назначение |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | сборка | адрес API для браузера (в Docker — `${BASE_PATH}/api/v1`) |
| `API_URL` | запуск | адрес API для серверного рендера (внутри docker-сети); пусто — `NEXT_PUBLIC_API_URL` |
| `SITE_URL` / `NEXT_PUBLIC_SITE_URL` | запуск | публичный адрес сайта: canonical, sitemap, robots |
| `NEXT_PUBLIC_BASE_PATH` | сборка | подпуть сайта на домене (например `/tek`) |
| `NEXT_PUBLIC_YANDEX_MAPS_KEY` | сборка | ключ Static API Яндекс.Карт (карта на «Контактах»); пусто — открытая версия 1.x |

`NEXT_PUBLIC_*` встраиваются при сборке (в Docker — build args, см. `../deploy/frontend.Dockerfile`).

## Структура

```
src/app/            страницы: (home), catalog, product, search, brands, cart, checkout, payment, account/*, admin/* (панель управления
                    для менеджеров и администраторов: пользователи, заказы, заявки, отзывы, купоны, товары, импорт, интеграции), login, register,
                    about, vacancies, news, projects, contacts, services, configurators, support («Для проектировщиков»),
                    help/* («Покупателям»: как купить?, доставка, оплата, гарантия, вопросы — вкладки-страницы), favorites,
                    art (SVG-иллюстрации исполнений демо-товаров), sitemap, robots
src/components/     ui (кнопки, поля, степпер…), layout (шапка, подвал, меню каталога, поиск), home, catalog, product,
                    cart, checkout, account, admin, auth, content (блоки контентных страниц, карта, вакансии), services, projects
src/lib/            api/client (fetch к API, токены), server (RSC-запросы с кешем), site (контакты, меню), format, phone (+992),
                    qty, types, admin-api/admin-types (клиент и типы /admin/*)
src/store/          zustand: auth, cart, favorites, city, toast
public/             figma/ (фото и иконки из макета), categories/ (фото категорий), corporate/, brands/, products/, banners/
```

## Docker

`../deploy/frontend.Dockerfile` — сборка `output: "standalone"`, запуск `bun server.js` на порту 3010 (см. `../docker-compose.prod.yml`).

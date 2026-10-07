# Сверка с макетом Figma (tec.tj)

Инструменты, которыми сайт переносился из Figma 1:1 (ширина макета 1512, контент 1260 с x=126).

| Скрипт | Что делает |
|---|---|
| `fetch.py [ids]` | Скачивает JSON файла и PNG-рендеры фреймов в `.figma/` (токен — `~/.config/figma_token`) |
| `dump.py <node-id>` | Компактное дерево узла: координаты относительно фрейма, шрифты `Family W Size/LH`, заливки, обводки, радиусы, тени, иконки |
| `shot.ts out.png URL [--width 1512] [--auth email:pass]` | Полностраничный скриншот сайта через Chrome DevTools Protocol (запуск: `bun scripts/figma/shot.ts …`) |
| `compare.py figma.png site.png prefix` | Side-by-side + overlay по кускам и средний diff |
| `zoom.py figma.png site.png x0 y0 x1 y1 out.png` | Увеличенная стопка макет/сайт/наложение (красно-голубая кайма = расхождение) |
| `svg2tsx.py icon.svg Name` | SVG-экспорт иконки → React-компонент (чёрный → currentColor) |
| `node2svg.py <node-id> [out.svg]` | SVG иконки из геометрии векторов (nodes API, `geometry=paths`) — когда images API недоступен (на тарифе Starter лимит ~раз в несколько суток) |

Python-скрипты требуют Pillow (`uv venv && uv pip install pillow`).

# syntax=docker/dockerfile:1.7
FROM oven/bun:1 AS deps
WORKDIR /app
# bun.lock не хранится в git: если его нет в контексте сборки, зависимости ставятся по package.json
COPY frontend/package.json frontend/bun.lock* ./
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else bun install; fi

FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .
# встраиваются при сборке: подпуть сайта (пусто — корень домена) и адрес API для браузера (относительный — тот же домен)
ARG NEXT_PUBLIC_BASE_PATH=
ARG NEXT_PUBLIC_API_URL=/api/v1
# ключ Static API Яндекс.Карт (необязателен: без него — открытая версия 1.x)
ARG NEXT_PUBLIC_YANDEX_MAPS_KEY=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_YANDEX_MAPS_KEY=$NEXT_PUBLIC_YANDEX_MAPS_KEY NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=
# API_URL (адрес API изнутри docker-сети) и SITE_URL (публичный адрес) задаются при запуске
ENV NODE_ENV=production PORT=3010 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
COPY --from=build --chown=bun:bun /app/.next/standalone ./
COPY --from=build --chown=bun:bun /app/.next/static ./.next/static
COPY --from=build --chown=bun:bun /app/public ./public
USER bun
EXPOSE 3010
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3010'+(process.env.NEXT_PUBLIC_BASE_PATH||'')+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "server.js"]

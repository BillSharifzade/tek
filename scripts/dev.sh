#!/usr/bin/env bash
# Запускает Postgres, бэкенд (8181) и фронтенд (3010) для разработки.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$PATH"

docker compose -f "$ROOT/docker-compose.yml" up -d postgres
until docker compose -f "$ROOT/docker-compose.yml" exec -T postgres pg_isready -U tek -d tek >/dev/null 2>&1; do sleep 1; done

[ -f "$ROOT/backend/.env" ] || cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
[ -f "$ROOT/frontend/.env.local" ] || cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env.local"

(cd "$ROOT/backend" && cargo run --release) &
BACK=$!
(cd "$ROOT/frontend" && [ -d node_modules ] || bun install; bun run dev -p 3010) &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null' EXIT INT TERM
wait

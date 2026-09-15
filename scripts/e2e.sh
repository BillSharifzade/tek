#!/usr/bin/env bash
# Сквозная проверка: API health + статусы страниц фронтенда + скриншоты (headless Chrome).
set -uo pipefail
API=${API:-http://127.0.0.1:8181/api/v1}
WEB=${WEB:-http://127.0.0.1:3010}
OUT=${OUT:-/tmp/tek-e2e}
mkdir -p "$OUT"
fail=0
check() { # url expected
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$1")
  if [ "$code" = "$2" ]; then echo "  ok   $code $1"; else echo "  FAIL $code (want $2) $1"; fail=$((fail+1)); fi
}
echo "== API =="
check "$API/health" 200
check "$API/home" 200
check "$API/catalog/tree" 200
check "$API/catalog/products?per_page=5" 200
check "$API/brands" 200
check "$API/checkout/options" 200
check "$API/content/projects" 200
check "$API/content/services" 200
PROD=$(curl -s "$API/catalog/products?per_page=1" | grep -oE '"slug":"[^"]+"' | head -1 | cut -d'"' -f4)
CAT=$(curl -s "$API/catalog/tree" | grep -oE '"slug":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "  product=$PROD category=$CAT"
check "$API/catalog/products/$PROD" 200
check "$API/catalog/categories/$CAT" 200
echo "== WEB =="
for p in / /catalog "/catalog/$CAT" "/product/$PROD" /brands /cart /checkout /login /register /about /services /projects /news /contacts /support /help /configurators "/search?q=%D0%BA%D0%B0%D0%B1%D0%B5%D0%BB%D1%8C" /account; do
  check "$WEB$p" 200
done
if [ "${SHOTS:-1}" = "1" ]; then
  echo "== SCREENSHOTS → $OUT =="
  for p in / "/catalog/$CAT" "/product/$PROD" /cart /checkout /login /register /projects /brands; do
    name=$(echo "$p" | tr '/?=' '___'); [ -z "$name" ] && name=home
    timeout 90 google-chrome-stable --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1440,2400 --virtual-time-budget=8000 \
      --screenshot="$OUT/${name}.png" "$WEB$p" >/dev/null 2>&1 && echo "  shot $OUT/${name}.png" || echo "  shot FAILED $p"
  done
fi
echo "== RESULT: $fail failures =="
exit $fail

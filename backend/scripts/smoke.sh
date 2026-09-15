#!/usr/bin/env bash
# End-to-end smoke test for tek-api. Usage: scripts/smoke.sh [base_url]
set -uo pipefail
BASE="${1:-http://127.0.0.1:8181/api/v1}"
PASS=0; FAIL=0
J='-H Content-Type:application/json'
TMP=$(mktemp)
check() { # name expected_code actual_code
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); printf '  ok   %-58s %s\n' "$1" "$3"; else FAIL=$((FAIL+1)); printf '  FAIL %-58s got %s want %s\n' "$1" "$3" "$2"; head -c 300 "$TMP"; echo; fi
}
req() { # method path [data] [extra curl args...]
  local m=$1 p=$2 d=${3:-}; shift; shift; [ $# -gt 0 ] && shift
  if [ -n "$d" ]; then curl -s -o "$TMP" -w '%{http_code}' -X "$m" "$BASE$p" $J -d "$d" "$@"; else curl -s -o "$TMP" -w '%{http_code}' -X "$m" "$BASE$p" "$@"; fi
}
jqv() { python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(eval('d'+sys.argv[2]))" "$TMP" "$1" 2>/dev/null; }

echo "== public =="
check "GET /health"                       200 "$(req GET /health)"
check "GET /home"                         200 "$(req GET /home)"
check "GET /catalog/tree"                 200 "$(req GET /catalog/tree)"
check "GET /catalog/categories/{slug}"    200 "$(req GET /catalog/categories/kabelnye-lotki-i-aksessuary)"
check "GET /catalog/products?category="   200 "$(req GET '/catalog/products?category=kabelnye-lotki-dks&sort=price_asc&in_stock=1')"
check "GET /catalog/products?q="          200 "$(req GET '/catalog/products?q=%D0%BB%D0%BE%D1%82%D0%BE%D0%BA')"
check "GET /catalog/products?attr."       200 "$(req GET '/catalog/products?category=kabelenesushchie-sistemy&attr.%D0%A8%D0%B8%D1%80%D0%B8%D0%BD%D0%B0%2C%20%D0%BC%D0%BC=200')"
req GET '/catalog/products?category=kabelnye-lotki-dks&sort=popular' >/dev/null
SLUG=$(jqv "['items'][0]['slug']"); PID=$(jqv "['items'][0]['id']")
check "GET /catalog/products/{slug}"      200 "$(req GET "/catalog/products/$SLUG")"
check "GET /catalog/products/{slug} 404"  404 "$(req GET /catalog/products/nope)"
check "GET /catalog/products/{slug}/reviews" 200 "$(req GET "/catalog/products/$SLUG/reviews")"
check "GET /catalog/products/{slug}/questions" 200 "$(req GET "/catalog/products/$SLUG/questions")"
check "GET /catalog/suggest"              200 "$(req GET '/catalog/suggest?q=%D0%BB%D0%BE%D1%82')"
check "GET /brands"                       200 "$(req GET /brands)"
check "GET /brands/dks"                   200 "$(req GET /brands/dks)"
check "GET /content/projects"             200 "$(req GET /content/projects)"
check "GET /content/news"                 200 "$(req GET /content/news)"
check "GET /content/services"             200 "$(req GET /content/services)"
check "GET /content/pages/about"          200 "$(req GET /content/pages/about)"
check "GET /content/configurators"        200 "$(req GET /content/configurators)"
check "GET /content/stores"               200 "$(req GET /content/stores)"
check "GET /documents/1/download"         200 "$(req GET /documents/1/download)"
check "GET /checkout/options"             200 "$(req GET /checkout/options)"

echo "== auth =="
RND=$RANDOM
check "POST /auth/register (pending)"     202 "$(req POST /auth/register "{\"email\":\"smoke$RND@test.tj\",\"phone\":\"+99290$RND$RND\",\"password\":\"Smoke1234\",\"first_name\":\"Тест\",\"last_name\":\"Смоук\",\"customer_type\":\"electrician\"}")"
NEW_ID=$(jqv "['user_id']")
check "POST /auth/register weak password" 422 "$(req POST /auth/register '{"email":"x@y.tj","password":"short","first_name":"A"}')"
check "POST /auth/login pending -> 403"   403 "$(req POST /auth/login "{\"login\":\"smoke$RND@test.tj\",\"password\":\"Smoke1234\"}")"
check "POST /auth/login wrong -> 401"     401 "$(req POST /auth/login '{"login":"client@tec.tj","password":"bad"}')"
check "POST /auth/login client"           200 "$(req POST /auth/login '{"login":"client@tec.tj","password":"Client1234"}')"
TOKEN=$(jqv "['access_token']"); REFRESH=$(jqv "['refresh_token']")
AUTH="-H Authorization:Bearer_$TOKEN"; AUTH="-H"; AUTHV="Authorization: Bearer $TOKEN"
check "GET /auth/me"                      200 "$(req GET /auth/me '' -H "$AUTHV")"
check "POST /auth/refresh"                200 "$(req POST /auth/refresh "{\"refresh_token\":\"$REFRESH\"}")"
check "POST /auth/login admin"            200 "$(req POST /auth/login '{"login":"admin@tec.tj","password":"Admin1234"}')"
ADMIN="Authorization: Bearer $(jqv "['access_token']")"
check "POST /admin/users/{id}/approve"    200 "$(req POST "/admin/users/$NEW_ID/approve" '' -H "$ADMIN")"
check "POST /auth/login approved user"    200 "$(req POST /auth/login "{\"login\":\"smoke$RND@test.tj\",\"password\":\"Smoke1234\"}")"
check "GET /admin/users?status=pending"   200 "$(req GET '/admin/users?status=pending' '' -H "$ADMIN")"
check "PUT /admin/users/{id}/pricing"     200 "$(req PUT "/admin/users/$NEW_ID/pricing" '{"discount_pct":7,"cashback_pct":2,"rules":[{"category_slug":"kabelenesushchie-sistemy","discount_pct":12,"cashback_pct":4}]}' -H "$ADMIN")"
check "GET /admin/users forbidden for client" 403 "$(req GET /admin/users '' -H "$AUTHV")"

echo "== guest cart =="
check "GET /cart (guest)"                 200 "$(req GET /cart)"
CT=$(jqv "['cart_token']")
check "POST /cart/items (guest)"          200 "$(req POST /cart/items "{\"product_id\":\"$PID\",\"qty\":2}" -H "X-Cart-Token: $CT")"
ITEM=$(jqv "['items'][0]['id']")
check "POST /cart/items too many -> 422"  422 "$(req POST /cart/items "{\"product_id\":\"$PID\",\"qty\":999999}" -H "X-Cart-Token: $CT")"
check "PATCH /cart/items/{id}"            200 "$(req PATCH "/cart/items/$ITEM" '{"qty":3}' -H "X-Cart-Token: $CT")"
check "POST /cart/coupon TEK10"           200 "$(req POST /cart/coupon '{"code":"tek10"}' -H "X-Cart-Token: $CT")"
check "POST /cart/coupon invalid -> 422"  422 "$(req POST /cart/coupon '{"code":"NOPE"}' -H "X-Cart-Token: $CT")"
check "GET /cart/export.xlsx"             200 "$(req GET /cart/export.xlsx '' -H "X-Cart-Token: $CT")"
check "POST /cart/share"                  201 "$(req POST /cart/share '' -H "X-Cart-Token: $CT")"
SHARE=$(jqv "['token']")
check "GET /cart/shared/{token}"          200 "$(req GET "/cart/shared/$SHARE")"
check "POST /cart/merge (client)"         200 "$(req POST /cart/merge '' -H "$AUTHV" -H "X-Cart-Token: $CT")"
check "POST /cart/shared/{token}/apply"   200 "$(req POST "/cart/shared/$SHARE/apply" '' -H "$AUTHV")"
check "DELETE /cart/coupon"               200 "$(req DELETE /cart/coupon '' -H "$AUTHV")"
check "POST /cart/select-all"             200 "$(req POST /cart/select-all '{"selected":true}' -H "$AUTHV")"
check "POST /cart/estimates"              201 "$(req POST /cart/estimates '{"name":"Смета smoke"}' -H "$AUTHV")"
check "GET /account/estimates"            200 "$(req GET /account/estimates '' -H "$AUTHV")"
check "GET /account/favorites"            200 "$(req GET /account/favorites '' -H "$AUTHV")"
check "POST /account/favorites"           200 "$(req POST /account/favorites "{\"product_id\":\"$PID\"}" -H "$AUTHV")"

echo "== checkout =="
DATE=$(req GET /checkout/options >/dev/null; jqv "['delivery_dates'][1]['date']")
check "POST /checkout (invoice, courier)" 201 "$(req POST /checkout "{\"contact\":{\"first_name\":\"Фаррух\",\"last_name\":\"Назаров\",\"phone\":\"+992900000001\",\"email\":\"client@tec.tj\"},\"delivery\":{\"method\":\"courier\",\"address\":\"Душанбе, Сомони 68\",\"date\":\"$DATE\"},\"payment\":{\"method\":\"invoice\"},\"comment\":\"smoke\"}" -H "$AUTHV")"
ORDER=$(jqv "['order']['number']")
check "GET /orders/{number}"              200 "$(req GET "/orders/$ORDER" '' -H "$AUTHV")"
check "GET /orders/{number}/invoice.xlsx" 200 "$(req GET "/orders/$ORDER/invoice.xlsx" '' -H "$AUTHV")"
check "POST /checkout empty cart -> 422"  422 "$(req POST /checkout '{"contact":{"first_name":"A","phone":"1"},"delivery":{"method":"pickup","store_id":1},"payment":{"method":"cash"}}' -H "$AUTHV")"
req POST /cart/items "{\"product_id\":\"$PID\",\"qty\":1}" -H "X-Cart-Token: $CT" >/dev/null
check "POST /checkout guest alif"         201 "$(req POST /checkout '{"contact":{"first_name":"Гость","phone":"+992900000009","email":"guest@test.tj"},"delivery":{"method":"pickup","store_id":1},"payment":{"method":"alif"}}' -H "X-Cart-Token: $CT")"
GORDER=$(jqv "['order']['number']")
check "POST /payments/alif/callback"      200 "$(req POST /payments/alif/callback "{\"order_number\":\"$GORDER\",\"status\":\"paid\",\"txn_id\":\"tx1\"}")"
check "GET /orders/{number}?email= guest" 200 "$(req GET "/orders/$GORDER?email=guest@test.tj")"

echo "== account =="
check "GET /account/dashboard"            200 "$(req GET /account/dashboard '' -H "$AUTHV")"
check "GET /account/profile"              200 "$(req GET /account/profile '' -H "$AUTHV")"
check "PUT /account/profile"              200 "$(req PUT /account/profile '{"last_name":"Назаров"}' -H "$AUTHV")"
check "PUT /account/notifications"        200 "$(req PUT /account/notifications '{"notify_marketing":false}' -H "$AUTHV")"
check "GET /account/company"              200 "$(req GET /account/company '' -H "$AUTHV")"
check "GET /account/orders"               200 "$(req GET /account/orders '' -H "$AUTHV")"
check "GET /account/orders?from&to"       200 "$(req GET '/account/orders?from=2025-01-01&to=2030-01-01' '' -H "$AUTHV")"
check "GET /account/orders/{number}"      200 "$(req GET "/account/orders/$ORDER" '' -H "$AUTHV")"
check "PUT /account/orders/{number}"      200 "$(req PUT "/account/orders/$ORDER" "{\"items\":[{\"product_id\":\"$PID\",\"qty\":1}],\"comment\":\"edited\"}" -H "$AUTHV")"
check "POST /account/orders/{n}/cancel"   200 "$(req POST "/account/orders/$ORDER/cancel" '' -H "$AUTHV")"
check "POST cancel again -> 409"          409 "$(req POST "/account/orders/$ORDER/cancel" '' -H "$AUTHV")"
check "GET /account/reconciliation"       200 "$(req GET /account/reconciliation '' -H "$AUTHV")"
check "GET /account/reconciliation.xlsx"  200 "$(req GET /account/reconciliation.xlsx '' -H "$AUTHV")"
check "GET /account/bonus"                200 "$(req GET /account/bonus '' -H "$AUTHV")"
check "GET /account/bonus.xlsx"           200 "$(req GET /account/bonus.xlsx '' -H "$AUTHV")"
check "GET /account/reviews"              200 "$(req GET /account/reviews '' -H "$AUTHV")"
check "GET /account/questions"            200 "$(req GET /account/questions '' -H "$AUTHV")"
check "GET /account/notifications"        200 "$(req GET /account/notifications '' -H "$AUTHV")"
check "POST /account/notifications/read"  200 "$(req POST /account/notifications/read '{}' -H "$AUTHV")"
check "GET /account/documents"            200 "$(req GET /account/documents '' -H "$AUTHV")"
check "POST review"                       201 "$(req POST "/catalog/products/$SLUG/reviews" '{"rating":5,"pros":"ок","cons":"нет","text":"smoke review"}' -H "$AUTHV")"
RID=$(jqv "['id']")
check "POST question"                     201 "$(req POST "/catalog/products/$SLUG/questions" '{"text":"smoke question?"}' -H "$AUTHV")"
QID=$(jqv "['id']")
check "POST /admin/reviews/{id}/reply"    200 "$(req POST "/admin/reviews/$RID/reply" '{"text":"Спасибо!"}' -H "$ADMIN")"
check "POST /admin/questions/{id}/answer" 200 "$(req POST "/admin/questions/$QID/answer" '{"text":"Да."}' -H "$ADMIN")"
check "GET /admin/orders"                 200 "$(req GET /admin/orders '' -H "$ADMIN")"
check "PUT /admin/orders/{n}/status"      200 "$(req PUT "/admin/orders/$GORDER/status" '{"status":"confirmed"}' -H "$ADMIN")"
check "GET /admin/outbox"                 200 "$(req GET /admin/outbox '' -H "$ADMIN")"
check "PUT /account/password wrong"       422 "$(req PUT /account/password '{"current_password":"bad","new_password":"Newpass123"}' -H "$AUTHV")"
check "POST /auth/logout"                 204 "$(req POST /auth/logout "{\"refresh_token\":\"$REFRESH\"}")"
check "GET /auth/me without token -> 401" 401 "$(req GET /auth/me)"

rm -f "$TMP"
echo; echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]

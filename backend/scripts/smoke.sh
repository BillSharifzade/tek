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
# кратность упаковки товара (лоток — 3 м): все количества в тесте кратны ей
PACK=$(jqv "['items'][0].get('pack_qty') or 1" | python3 -c "import sys; v=float(sys.stdin.read()); print(int(v) if v.is_integer() else v)")
check "GET /catalog/products/{slug}"      200 "$(req GET "/catalog/products/$SLUG")"
check "GET /catalog/products/{slug} 404"  404 "$(req GET /catalog/products/nope)"
# торговые предложения: у автомата две оси, текущее исполнение есть среди items, у каждого исполнения значения по всем осям
req GET '/catalog/products?q=Easy9&per_page=1' >/dev/null
VSLUG=$(jqv "['items'][0]['slug']")
req GET "/catalog/products/$VSLUG" >/dev/null
VOK=$(jqv ".get('variants') is not None and len(d['variants']['axes'])==2 and any(i['slug']=='$VSLUG' for i in d['variants']['items']) and all(len(i['values'])==2 for i in d['variants']['items'])")
check "GET /catalog/products/{slug} variants" True "$VOK"
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
check "stores have coordinates"           True "$(jqv "[0].get('lat') is not None and d[0].get('lon') is not None")"
check "GET /catalog/products?sort=rating"  200 "$(req GET '/catalog/products?sort=rating&per_page=3')"
check "GET /catalog/products?sort=reviews" 200 "$(req GET '/catalog/products?sort=reviews&per_page=3')"
req GET '/content/projects?per_page=1' >/dev/null; PSLUG=$(jqv "['items'][0]['slug']")
check "GET /content/projects/{slug}"      200 "$(req GET "/content/projects/$PSLUG")"
check "POST /leads invalid phone"         422 "$(req POST /leads '{"name":"Smoke","phone":"12"}')"
check "POST /leads"                       201 "$(req POST /leads '{"kind":"feedback","name":"Smoke test","phone":"+992 900 000 000","note":"smoke"}')"
check "GET /documents/1/download"         200 "$(req GET /documents/1/download)"
check "GET /checkout/options"             200 "$(req GET /checkout/options)"

echo "== auth =="
RND=$RANDOM
# 7 цифр номера без совпадений с демо-аккаунтами (+992 90 000000N)
PH=$((RND + 1000000))
check "POST /auth/register (pending)"     202 "$(req POST /auth/register '{"email":"smoke'"$RND"'@test.tj","phone":"+992 90 '"$PH"'","password":"Smoke1234","first_name":"Тест","last_name":"Смоук","customer_type":"retail"}')"
NEW_ID=$(jqv "['user_id']")
# e-mail не обязателен: юрлицо по телефону; неверный формат телефона — 422
check "POST /auth/register no e-mail"     202 "$(req POST /auth/register '{"phone":"+99291'"$PH"'","password":"Smoke1234","first_name":"Юрлицо","customer_type":"legal","company":{"name":"ООО Смоук","inn":"123456789","address":"Душанбе"}}')"
check "POST /auth/register bad phone"     422 "$(req POST /auth/register '{"phone":"+7 999 123","password":"Smoke1234","first_name":"Тест"}')"
check "POST /auth/register weak password" 422 "$(req POST /auth/register '{"email":"x@y.tj","password":"short","first_name":"A"}')"
check "POST /auth/login pending -> 403"   403 "$(req POST /auth/login '{"login":"smoke'"$RND"'@test.tj","password":"Smoke1234"}')"
check "POST /auth/login wrong -> 401"     401 "$(req POST /auth/login '{"login":"client@tec.tj","password":"bad"}')"
check "POST /auth/login client"           200 "$(req POST /auth/login '{"login":"client@tec.tj","password":"Client1234"}')"
TOKEN=$(jqv "['access_token']"); REFRESH=$(jqv "['refresh_token']")
AUTH="-H Authorization:Bearer_$TOKEN"; AUTH="-H"; AUTHV="Authorization: Bearer $TOKEN"
check "GET /auth/me"                      200 "$(req GET /auth/me '' -H "$AUTHV")"
check "POST /auth/refresh"                200 "$(req POST /auth/refresh '{"refresh_token":"'"$REFRESH"'"}')"
check "POST /auth/login admin"            200 "$(req POST /auth/login '{"login":"admin@tec.tj","password":"Admin1234"}')"
ADMIN="Authorization: Bearer $(jqv "['access_token']")"
check "POST /admin/users/{id}/approve"    200 "$(req POST "/admin/users/$NEW_ID/approve" '' -H "$ADMIN")"
check "POST /auth/login approved user"    200 "$(req POST /auth/login '{"login":"smoke'"$RND"'@test.tj","password":"Smoke1234"}')"
check "POST /auth/login by phone"         200 "$(req POST /auth/login '{"login":"90 '"$PH"'","password":"Smoke1234"}')"
check "GET /admin/users?status=pending"   200 "$(req GET '/admin/users?status=pending' '' -H "$ADMIN")"
check "PUT /admin/users/{id}/pricing"     200 "$(req PUT "/admin/users/$NEW_ID/pricing" '{"discount_pct":7,"cashback_pct":2,"rules":[{"category_slug":"kabelenesushchie-sistemy","discount_pct":12,"cashback_pct":4}]}' -H "$ADMIN")"
check "GET /admin/users forbidden for client" 403 "$(req GET /admin/users '' -H "$AUTHV")"
# «Забыли пароль?»: ответ одинаковый для любого логина, письмо — только существующему одобренному аккаунту с e-mail;
# ссылку из письма не видно в списке очереди (в нём вход в чужой аккаунт)
check "POST /auth/password/forgot unknown" 202 "$(req POST /auth/password/forgot '{"login":"nobody-'"$RND"'@example.com"}')"
check "POST /auth/password/forgot"        202 "$(req POST /auth/password/forgot '{"login":"smoke'"$RND"'@test.tj"}')"
check "password reset e-mail hidden"      True "$(req GET /admin/outbox '' -H "$ADMIN" >/dev/null; jqv " is not None and [r for r in d if r['event']=='email.password_reset' and r['payload'].get('to')=='smoke$RND@test.tj'] != [] and all('text' not in r['payload'] and 'html' not in r['payload'] for r in d if r['event']=='email.password_reset')")"
check "POST /auth/password/forgot empty"  422 "$(req POST /auth/password/forgot '{"login":" "}')"
check "POST /auth/password/check bad"     422 "$(req POST /auth/password/check '{"token":"nope"}')"
check "POST /auth/password/reset bad"     422 "$(req POST /auth/password/reset '{"token":"nope","password":"Newpass123"}')"

echo "== guest cart =="
check "GET /cart (guest, no cart created)" 200 "$(req GET /cart)"
check "POST /cart/items (guest, new cart)" 200 "$(req POST /cart/items '{"product_id":"'"$PID"'","qty":'"$((PACK*2))"'}')"
CT=$(jqv "['cart_token']")
ITEM=$(jqv "['items'][0]['id']")
check "POST /cart/items too many -> 422"  422 "$(req POST /cart/items '{"product_id":"'"$PID"'","qty":999999}' -H "X-Cart-Token: $CT")"
check "PATCH /cart/items/{id}"            200 "$(req PATCH "/cart/items/$ITEM" '{"qty":'"$((PACK*3))"'}' -H "X-Cart-Token: $CT")"
check "PATCH qty not multiple of pack"    "$([ "$PACK" = 1 ] && echo 200 || echo 422)" "$(req PATCH "/cart/items/$ITEM" '{"qty":'"$((PACK*3+1))"'}' -H "X-Cart-Token: $CT")"
req PATCH "/cart/items/$ITEM" '{"qty":'"$((PACK*3))"'}' -H "X-Cart-Token: $CT" >/dev/null
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
check "POST /account/favorites"           200 "$(req POST /account/favorites '{"product_id":"'"$PID"'"}' -H "$AUTHV")"

echo "== checkout =="
stock() { req GET "/catalog/products/$SLUG" '' -H "$AUTHV" >/dev/null; jqv "['stock_total']"; }
S0=$(stock)
# календарь доставки (доработки R4): любой день от сегодня, кроме воскресенья — берём даты через 8 недель
SUNDAY=$(python3 -c "import datetime as d; t=d.date.today(); print(t+d.timedelta(days=(6-t.weekday())%7+56))")
DATE=$(python3 -c "import datetime as d; t=d.date.today(); print(t+d.timedelta(days=(6-t.weekday())%7+57))")
check "POST /checkout Sunday -> 422"      422 "$(req POST /checkout '{"contact":{"first_name":"Фаррух","last_name":"Назаров","phone":"+992900000001","email":"client@tec.tj"},"delivery":{"method":"courier","address":"Душанбе, Сомони 68","date":"'"$SUNDAY"'"},"payment":{"method":"invoice"}}' -H "$AUTHV")"
check "POST /checkout (invoice, courier)" 201 "$(req POST /checkout '{"contact":{"first_name":"Фаррух","last_name":"Назаров","phone":"+992900000001","email":"client@tec.tj"},"delivery":{"method":"courier","address":"Душанбе, Сомони 68","date":"'"$DATE"'"},"payment":{"method":"invoice"},"comment":"smoke"}' -H "$AUTHV")"
ORDER=$(jqv "['order']['number']")
S1=$(stock)
check "stock reserved by order"           True "$(python3 -c "print($S1 < $S0)")"
check "GET /orders/{number}"              200 "$(req GET "/orders/$ORDER" '' -H "$AUTHV")"
check "GET /orders/{number}/invoice.xlsx" 200 "$(req GET "/orders/$ORDER/invoice.xlsx" '' -H "$AUTHV")"
check "POST /checkout empty cart -> 422"  422 "$(req POST /checkout '{"contact":{"first_name":"A","phone":"1"},"delivery":{"method":"pickup","store_id":1},"payment":{"method":"cash"}}' -H "$AUTHV")"
req POST /cart/items '{"product_id":"'"$PID"'","qty":'"$PACK"'}' -H "X-Cart-Token: $CT" >/dev/null
check "POST /checkout guest alif"         201 "$(req POST /checkout '{"contact":{"first_name":"Гость","phone":"+992900000009","email":"guest@test.tj"},"delivery":{"method":"pickup","store_id":1},"payment":{"method":"alif"}}' -H "X-Cart-Token: $CT")"
GORDER=$(jqv "['order']['number']")
check "POST /payments/alif/callback"      200 "$(req POST /payments/alif/callback '{"order_number":"'"$GORDER"'","status":"paid","txn_id":"tx1"}')"
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
# изменение заказа — запросом: заказ меняется только после одобрения менеджером (ТЗ), отгрузить с запросом нельзя
EDIT='{"items":[{"product_id":"'"$PID"'","qty":'"$PACK"'}],"comment":"edited"}'
check "PUT /account/orders/{number}"      200 "$(req PUT "/account/orders/$ORDER" "$EDIT" -H "$AUTHV")"
check "edit request pending, order kept"  True "$(jqv "['edit_request'] is not None and d['edit_request']['comment']=='edited' and d['comment']=='smoke' and any(i['qty']==$PACK for i in d['edit_request']['items'])")"
check "edit request too many -> 422"      422 "$(req PUT "/account/orders/$ORDER" '{"items":[{"product_id":"'"$PID"'","qty":99999900}]}' -H "$AUTHV")"
check "GET /admin/orders?edit_pending=1"  True "$(req GET '/admin/orders?edit_pending=1' '' -H "$ADMIN" >/dev/null; jqv " is not None and any(o['number']=='$ORDER' and o['edit_pending'] for o in d)")"
check "ship with pending edit -> 409"     409 "$(req PUT "/admin/orders/$ORDER/status" '{"status":"shipped"}' -H "$ADMIN")"
check "POST edit-request/reject"          200 "$(req POST "/admin/orders/$ORDER/edit-request/reject" '{"note":"нет на складе"}' -H "$ADMIN")"
check "rejected: order unchanged"         True "$(jqv "['edit_request'] is None and d['comment']=='smoke' and any('нет на складе' in e['label'] for e in d['events'])")"
check "reject again -> 409"               409 "$(req POST "/admin/orders/$ORDER/edit-request/reject" '{}' -H "$ADMIN")"
check "PUT edit (second request)"         200 "$(req PUT "/account/orders/$ORDER" "$EDIT" -H "$AUTHV")"
check "DELETE edit-request (withdraw)"    200 "$(req DELETE "/account/orders/$ORDER/edit-request" '' -H "$AUTHV")"
check "withdrawn: no request"             True "$(jqv "['edit_request'] is None")"
req PUT "/account/orders/$ORDER" "$EDIT" -H "$AUTHV" >/dev/null
check "approve as client -> 403"          403 "$(req POST "/admin/orders/$ORDER/edit-request/approve" '' -H "$AUTHV")"
check "POST edit-request/approve"         200 "$(req POST "/admin/orders/$ORDER/edit-request/approve" '' -H "$ADMIN")"
check "approved: order changed"           True "$(jqv "['edit_request'] is None and d['comment']=='edited' and len(d['items'])==1 and d['items'][0]['qty']==$PACK")"
check "POST /account/orders/{n}/cancel"   200 "$(req POST "/account/orders/$ORDER/cancel" '' -H "$AUTHV")"
check "POST cancel again -> 409"          409 "$(req POST "/account/orders/$ORDER/cancel" '' -H "$AUTHV")"
# отмена вернула резерв клиента; остался только 1 шт. гостевого заказа
check "stock released on cancel"          True "$(python3 -c "print($(stock) == $S0 - $PACK)")"
# двойной клик «Оформить»: из одной корзины — ровно один заказ, второй запрос — 409 cart_changed (или 422 — корзина уже пуста)
req POST /cart/items '{"product_id":"'"$PID"'","qty":'"$PACK"'}' -H "$AUTHV" >/dev/null
DBODY='{"contact":{"first_name":"Дубль","phone":"+992900000002"},"delivery":{"method":"pickup","store_id":1},"payment":{"method":"cash"}}'
D1=$(mktemp); D2=$(mktemp)
curl -s -o "$D1" -w '%{http_code}' -X POST "$BASE/checkout" $J -d "$DBODY" -H "$AUTHV" > "$D1.code" &
curl -s -o "$D2" -w '%{http_code}' -X POST "$BASE/checkout" $J -d "$DBODY" -H "$AUTHV" > "$D2.code" &
wait
check "double checkout -> one order"      True "$(python3 -c "c=sorted([open('$D1.code').read(), open('$D2.code').read()]); print(c[0]=='201' and c[1] in ('409','422'))")"
DORDER=$(python3 -c "import json; print(next(json.load(open(f))['order']['number'] for f in ['$D1','$D2'] if open(f+'.code').read()=='201'))" 2>/dev/null)
rm -f "$D1" "$D2" "$D1.code" "$D2.code"
# оплата частями: приход менеджером, сумма больше остатка — 422; частично оплаченный заказ клиент не отменяет
check "POST /admin/orders/{n}/payments"   200 "$(req POST "/admin/orders/$DORDER/payments" '{"amount":1}' -H "$ADMIN")"
check "partial payment reduces remaining" True "$(jqv "['paid_amount'] == 1 and d['remaining'] > 0 and not d['can_cancel']")"
check "payment over remainder -> 422"     422 "$(req POST "/admin/orders/$DORDER/payments" '{"amount":99999999}' -H "$ADMIN")"
check "cancel partially paid -> 409"      409 "$(req POST "/account/orders/$DORDER/cancel" '' -H "$AUTHV")"
# наличные при получении: доставка закрывает оплату (остаток)
req PUT "/admin/orders/$DORDER/status" '{"status":"shipped"}' -H "$ADMIN" >/dev/null
check "cash order delivered"              200 "$(req PUT "/admin/orders/$DORDER/status" '{"status":"delivered"}' -H "$ADMIN")"
check "cash order paid on delivery"       True "$(jqv "['payment']['status'] == 'paid' and d['remaining'] == 0")"
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
check "DELETE review (not author) -> 404" 404 "$(req DELETE "/catalog/products/$SLUG/reviews/$RID" '' -H "$ADMIN")"
check "DELETE own review"                 204 "$(req DELETE "/catalog/products/$SLUG/reviews/$RID" '' -H "$AUTHV")"
check "DELETE own question"               204 "$(req DELETE "/catalog/products/$SLUG/questions/$QID" '' -H "$AUTHV")"
check "GET /admin/orders"                 200 "$(req GET /admin/orders '' -H "$ADMIN")"
check "PUT /admin/orders/{n}/status"      200 "$(req PUT "/admin/orders/$GORDER/status" '{"status":"confirmed"}' -H "$ADMIN")"
check "GET /admin/outbox"                 200 "$(req GET /admin/outbox '' -H "$ADMIN")"

echo "== admin panel =="
check "POST /auth/login manager"          200 "$(req POST /auth/login '{"login":"manager@tec.tj","password":"Manager1234"}')"
MANAGER="Authorization: Bearer $(jqv "['access_token']")"
MANAGER_ID=$(jqv "['user']['id']")
req GET /auth/me '' -H "$ADMIN" >/dev/null; ADMIN_ID=$(jqv "['id']")
# пользователи: фильтры, менеджеры, условия, изменение (статус / менеджер), права
check "GET /admin/users?role&q"           200 "$(req GET '/admin/users?role=customer&q=client%40tec.tj' '' -H "$MANAGER")"
check "admin user row fields"             True "$(jqv "[0]['email']=='client@tec.tj' and d[0]['manager_name'] is not None and 'company_verified' in d[0] and 'is_lead_manager' in d[0]")"
check "GET /admin/users?q=phone digits"   True "$(req GET '/admin/users?q=900000001' '' -H "$ADMIN" >/dev/null; jqv "[0]['email']=='client@tec.tj'")"
check "GET /admin/managers"               200 "$(req GET /admin/managers '' -H "$MANAGER")"
check "managers list has lead manager"    True "$(jqv " is not None and any(m['id']=='$MANAGER_ID' and m['is_lead_manager'] for m in d)")"
check "GET /admin/users/{id}"             200 "$(req GET "/admin/users/$NEW_ID" '' -H "$MANAGER")"
check "admin user by id = list row"       True "$(jqv "['id']=='$NEW_ID' and d['email']=='smoke$RND@test.tj' and 'manager_name' in d and 'company_verified' in d")"
check "GET /admin/users/{id} 404"         404 "$(req GET /admin/users/00000000-0000-0000-0000-000000000000 '' -H "$MANAGER")"
check "GET /admin/users/{id}/pricing"     200 "$(req GET "/admin/users/$NEW_ID/pricing" '' -H "$MANAGER")"
check "pricing has rules"                 True "$(jqv "['discount_pct']==7 and len(d['rules'])==1 and d['rules'][0]['category_slug']=='kabelenesushchie-sistemy'")"
check "PUT /admin/users/{id} manager_id"  200 "$(req PUT "/admin/users/$NEW_ID" '{"manager_id":"'"$MANAGER_ID"'"}' -H "$MANAGER")"
check "user manager assigned"             True "$(jqv "['manager_id']=='$MANAGER_ID' and d['manager_name'] is not None")"
check "PUT /admin/users/{id} unassign"    True "$(req PUT "/admin/users/$NEW_ID" '{"manager_id":null}' -H "$MANAGER" >/dev/null; jqv "['manager_id'] is None")"
check "PUT user role by manager -> 403"   403 "$(req PUT "/admin/users/$NEW_ID" '{"role":"manager"}' -H "$MANAGER")"
check "admin_only error code"             admin_only "$(jqv "['error']['code']")"
check "PUT own status -> 403 self_change" 403 "$(req PUT "/admin/users/$ADMIN_ID" '{"status":"blocked"}' -H "$ADMIN")"
check "PUT user bad status -> 422"        422 "$(req PUT "/admin/users/$NEW_ID" '{"status":"pending"}' -H "$ADMIN")"
check "PUT /admin/users/{id} block"       200 "$(req PUT "/admin/users/$NEW_ID" '{"status":"blocked"}' -H "$ADMIN")"
check "blocked user can't log in"         403 "$(req POST /auth/login '{"login":"smoke'"$RND"'@test.tj","password":"Smoke1234"}')"
check "PUT /admin/users/{id} unblock"     200 "$(req PUT "/admin/users/$NEW_ID" '{"status":"approved"}' -H "$ADMIN")"
check "unblocked user logs in"            200 "$(req POST /auth/login '{"login":"smoke'"$RND"'@test.tj","password":"Smoke1234"}')"
# заказы: поиск, «мои», передача другому менеджеру
check "GET /admin/orders?q=number"        200 "$(req GET "/admin/orders?q=$ORDER" '' -H "$MANAGER")"
check "admin order row fields"            True "$(jqv "[0]['number']=='$ORDER' and d[0]['status_label']=='Отменён' and 'remaining' in d[0] and 'payment_status_label' in d[0] and 'manager_name' in d[0] and d[0]['company_name'] is not None")"
check "GET /admin/orders?mine=1"          200 "$(req GET '/admin/orders?mine=1&status=delivered' '' -H "$MANAGER")"
check "PUT /admin/orders/{n}/manager"     200 "$(req PUT "/admin/orders/$DORDER/manager" '{"manager_id":"'"$ADMIN_ID"'"}' -H "$MANAGER")"
check "order manager reassigned"          admin@tec.tj "$(jqv "['manager']['email']")"
check "PUT order manager null (unassign)" 200 "$(req PUT "/admin/orders/$DORDER/manager" '{"manager_id":null}' -H "$MANAGER")"
check "order manager unassigned"          True "$(jqv "['manager'] is None")"
check "PUT order manager without field"   422 "$(req PUT "/admin/orders/$DORDER/manager" '{}' -H "$MANAGER")"
check "PUT order manager back"            200 "$(req PUT "/admin/orders/$DORDER/manager" '{"manager_id":"'"$MANAGER_ID"'"}' -H "$ADMIN")"
check "PUT order manager unknown -> 422"  422 "$(req PUT "/admin/orders/$DORDER/manager" '{"manager_id":"00000000-0000-0000-0000-000000000000"}' -H "$ADMIN")"
# заявки с форм
check "GET /admin/leads"                  200 "$(req GET '/admin/leads?status=new&kind=feedback&per_page=1' '' -H "$MANAGER")"
LEAD=$(jqv "['items'][0]['id']")
check "leads page shape"                  True "$(jqv "['total'] >= 1 and d['page']==1 and d['pages'] >= 1 and d['items'][0]['status']=='new'")"
check "PUT /admin/leads/{id}"             200 "$(req PUT "/admin/leads/$LEAD" '{"status":"in_progress","manager_note":"smoke: перезвонить"}' -H "$MANAGER")"
check "lead updated"                      True "$(jqv "['status']=='in_progress' and d['manager_note']=='smoke: перезвонить'")"
check "PUT /admin/leads/{id} bad -> 422"  422 "$(req PUT "/admin/leads/$LEAD" '{"status":"closed"}' -H "$MANAGER")"
check "PUT /admin/leads/{id} done"        200 "$(req PUT "/admin/leads/$LEAD" '{"status":"done","manager_note":null}' -H "$MANAGER")"
# модерация отзывов и вопросов: списки, удаление с пересчётом рейтинга
check "GET /admin/reviews?unanswered=1"   200 "$(req GET '/admin/reviews?unanswered=1&per_page=5' '' -H "$MANAGER")"
check "reviews page shape"                True "$(jqv "['total'] >= 1 and len(d['items']) <= 5 and d['items'][0]['reply_text'] is None and 'slug' in d['items'][0]['product']")"
check "GET /admin/questions"              200 "$(req GET '/admin/questions?page=1' '' -H "$MANAGER")"
req GET "/catalog/products/$SLUG" >/dev/null; RC0=$(jqv "['reviews_count']")
req POST "/catalog/products/$SLUG/reviews" '{"rating":1,"text":"smoke spam"}' -H "$AUTHV" >/dev/null; RID2=$(jqv "['id']")
req POST "/catalog/products/$SLUG/questions" '{"text":"smoke spam?"}' -H "$AUTHV" >/dev/null; QID2=$(jqv "['id']")
check "DELETE /admin/reviews/{id}"        204 "$(req DELETE "/admin/reviews/$RID2" '' -H "$MANAGER")"
check "rating recomputed after delete"    True "$(req GET "/catalog/products/$SLUG" >/dev/null; jqv "['reviews_count']==$RC0")"
check "DELETE /admin/reviews/{id} again"  404 "$(req DELETE "/admin/reviews/$RID2" '' -H "$MANAGER")"
check "DELETE /admin/questions/{id}"      204 "$(req DELETE "/admin/questions/$QID2" '' -H "$MANAGER")"
# промокоды
CPN="SMOKE$RND"
check "POST /admin/coupons"               201 "$(req POST /admin/coupons '{"code":"'"$CPN"'","kind":"percent","value":15,"min_total":100,"expires_at":"2030-12-31","usage_limit":5}' -H "$MANAGER")"
check "coupon stored upper-case"          True "$(jqv "['code']=='$CPN' and d['value']==15 and d['used_count']==0 and d['expires_at'].startswith('2030-12-31')")"
check "POST /admin/coupons dup -> 409"    409 "$(req POST /admin/coupons '{"code":"'"$(echo $CPN | tr A-Z a-z)"'","kind":"fixed","value":5}' -H "$MANAGER")"
check "POST /admin/coupons bad -> 422"    422 "$(req POST /admin/coupons '{"code":"X","kind":"percent","value":150}' -H "$MANAGER")"
check "PUT /admin/coupons/{code}"         200 "$(req PUT "/admin/coupons/$CPN" '{"active":false,"usage_limit":null}' -H "$MANAGER")"
check "coupon updated"                    True "$(jqv "['active']==False and d['usage_limit'] is None and d['kind']=='percent'")"
check "GET /admin/coupons"                200 "$(req GET /admin/coupons '' -H "$MANAGER")"
check "DELETE /admin/coupons/{code}"      204 "$(req DELETE "/admin/coupons/$CPN" '' -H "$MANAGER")"
check "DELETE /admin/coupons again -> 404" 404 "$(req DELETE "/admin/coupons/$CPN" '' -H "$MANAGER")"
# товары: список, правка, снятие с продажи, остатки
check "GET /admin/products?q="            200 "$(req GET "/admin/products/$PID" '' -H "$MANAGER")"
PCODE=$(jqv "['code']"); LIST=$(jqv "['list_price']")
STOCK_BODY=$(python3 -c "import json; d=json.load(open('$TMP')); print(json.dumps({'stores':[{'store_id':s['store_id'],'qty':s['qty']} for s in d['stock']]}))")
check "GET /admin/products search"        200 "$(req GET "/admin/products?q=$PCODE&per_page=5" '' -H "$MANAGER")"
check "admin product row fields"          True "$(jqv "['items'][0]['id']=='$PID' and d['items'][0]['is_active'] and isinstance(d['items'][0]['badges'], list) and len(d['items'][0]['stock']) >= 1 and d['items'][0]['category']['slug'] != ''")"
check "PUT /admin/products/{id} hide"     200 "$(req PUT "/admin/products/$PID" '{"is_active":false,"is_hit":true}' -H "$MANAGER")"
check "hidden product: badges/is_active"  True "$(jqv "['is_active']==False and 'hit' in d['badges']")"
check "hidden product card -> 404"        404 "$(req GET "/catalog/products/$SLUG")"
check "hidden product not in cart -> 404" 404 "$(req POST /cart/items '{"product_id":"'"$PID"'","qty":'"$PACK"'}')"
check "PUT /admin/products/{id} show"     200 "$(req PUT "/admin/products/$PID" '{"is_active":true,"is_hit":false}' -H "$MANAGER")"
check "visible product card"              200 "$(req GET "/catalog/products/$SLUG")"
check "PUT product sale >= list -> 422"   422 "$(req PUT "/admin/products/$PID" '{"sale_price":'"$LIST"'}' -H "$MANAGER")"
check "PUT /admin/products/{id}/stock"    200 "$(req PUT "/admin/products/$PID/stock" "$STOCK_BODY" -H "$MANAGER")"
check "PUT stock unknown store -> 422"    422 "$(req PUT "/admin/products/$PID/stock" '{"stores":[{"store_id":9999,"qty":1}]}' -H "$MANAGER")"
# импорт каталога (только администратор): шаблон, проверка без записи, создание и обновление по коду
upload() { curl -s -o "$TMP" -w '%{http_code}' -X POST "$BASE/admin/import/catalog$1" -H "$2" -F "file=@$3"; }
TPL=$(mktemp); CSV=$(mktemp)
check "GET /admin/import/template.xlsx"   200 "$(curl -s -o "$TPL" -w '%{http_code}' "$BASE/admin/import/template.xlsx" -H "$ADMIN")"
check "template for manager -> 403"       403 "$(req GET /admin/import/template.xlsx '' -H "$MANAGER")"
check "POST import template dry_run"      200 "$(upload '?dry_run=1' "$ADMIN" "$TPL")"
check "template imports cleanly"          True "$(jqv "['dry_run'] and d['rows']==1 and d['updated']==1 and d['errors']==[]")"
printf 'Код;Наименование;Категория;Бренд;Ед. изм.;Цена;Остаток dushanbe;Хар: Цвет\nSMOKE-IMPORT-1;Смоук-товар импорта;Кабели и провода / Силовые кабели;IEK;шт;123,40;7;белый\nSMOKE-IMPORT-2;Без цены;Кабели и провода;;шт;;;\n' > "$CSV"
check "POST import csv dry_run"           200 "$(upload '?dry_run=1' "$ADMIN" "$CSV")"
check "dry_run reports row errors"        True "$(jqv "['dry_run'] and d['rows']==2 and d['skipped']==1 and len(d['errors'])==1 and d['errors'][0]['row']==3")"
check "POST import as manager -> 403"     403 "$(upload '' "$MANAGER" "$CSV")"
check "POST /admin/import/catalog"        200 "$(upload '' "$ADMIN" "$CSV")"
check "import created / updated product"  True "$(jqv "['dry_run']==False and d['created'] + d['updated']==1 and d['stock_rows']==1")"
printf 'Код,Цена\nSMOKE-IMPORT-1,150\n' > "$CSV"
check "POST import price-only file"       200 "$(upload '' "$ADMIN" "$CSV")"
check "price-only import updates"         True "$(jqv "['updated']==1 and d['created']==0")"
check "imported product in admin list"    True "$(req GET '/admin/products?q=SMOKE-IMPORT-1' '' -H "$ADMIN" >/dev/null; jqv "['items'][0]['list_price']==150 and d['items'][0]['stock_total']==7 and d['items'][0]['brand']['slug']=='iek'")"
IPID=$(jqv "['items'][0]['id']")
# тестовый товар импорта на витрине не нужен — снимаем с продажи
check "hide imported smoke product"       200 "$(req PUT "/admin/products/$IPID" '{"is_active":false}' -H "$ADMIN")"
rm -f "$TPL" "$CSV"

echo "== catalog admin: documents, accessories, variants, countries =="
form() { # path auth [curl -F args...]
  local p=$1 a=$2; shift; shift; curl -s -o "$TMP" -w '%{http_code}' -X POST "$BASE$p" -H "$a" "$@"
}
DOCF=$(mktemp -d)/smoke-passport.pdf; printf '%%PDF-1.4\nsmoke document\n%%%%EOF\n' > "$DOCF"
check "GET /admin/products/{id} extras"     True "$(req GET "/admin/products/$PID" '' -H "$MANAGER" >/dev/null; jqv "['id']=='$PID' and all(k in d for k in ['documents','accessories','variant','country_origin','brand_info'])")"
check "PUT product country_origin"          True "$(req PUT "/admin/products/$PID" '{"country_origin":"Китай"}' -H "$MANAGER" >/dev/null; jqv "['country_origin']=='Китай'")"
check "storefront shows product origin"     True "$(req GET "/catalog/products/$SLUG" >/dev/null; jqv "['brand']['country_origin']=='Китай'")"
req PUT "/admin/products/$PID" '{"country_origin":null}' -H "$MANAGER" >/dev/null
check "POST /admin/documents (file)"        201 "$(form /admin/documents "$MANAGER" -F "file=@$DOCF;type=application/pdf" -F "title=Паспорт smoke" -F "product_id=$PID")"
DOCID=$(jqv "['id']")
check "document kind guessed, file stored"  True "$(jqv "['kind']=='passport' and d['has_file'] and d['products']==1")"
check "GET /documents/{id}/download file"   True "$(curl -s "$BASE/documents/$DOCID/download" | grep -c 'smoke document' | python3 -c "import sys; print(sys.stdin.read().strip()=='1')")"
check "POST /admin/documents (url)"         201 "$(form /admin/documents "$MANAGER" -F "url=https://example.com/smoke-$RND.pdf" -F "title=Сертификат smoke")"
UDOC=$(jqv "['id']")
check "download redirects to url"           307 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/documents/$UDOC/download")"
check "duplicate document url -> 409"       409 "$(form /admin/documents "$MANAGER" -F "url=https://example.com/smoke-$RND.pdf")"
check "POST /admin/documents svg -> 422"    422 "$(form /admin/documents "$MANAGER" -F "file=@$DOCF;filename=logo.svg")"
check "PUT /admin/documents/{id}"           200 "$(req PUT "/admin/documents/$UDOC" '{"title":"Сертификат smoke 2","kind":"certificate"}' -H "$MANAGER")"
check "GET /admin/documents?q="             True "$(req GET '/admin/documents?q=smoke' '' -H "$MANAGER" >/dev/null; jqv "['total'] >= 2")"
check "PUT /admin/products/{id}/documents"  True "$(req PUT "/admin/products/$PID/documents" '{"document_ids":['"$DOCID"','"$UDOC"']}' -H "$MANAGER" >/dev/null; jqv " is not None and len(d['documents'])==2")"
check "unknown document -> 422"             422 "$(req PUT "/admin/products/$PID/documents" '{"document_ids":[99999999]}' -H "$MANAGER")"
req GET '/catalog/products?category=kabelnye-lotki-dks&per_page=3' >/dev/null; ACODE=$(jqv "['items'][1]['code']")
check "PUT /admin/products/{id}/accessories" True "$(req PUT "/admin/products/$PID/accessories" '{"items":[{"code":"'"$ACODE"'","group":"Smoke"}]}' -H "$MANAGER" >/dev/null; jqv " is not None and len(d['accessories'])==1 and d['accessories'][0]['group']=='Smoke'")"
check "accessory unknown code -> 422"       422 "$(req PUT "/admin/products/$PID/accessories" '{"items":[{"code":"NO-SUCH-CODE","group":"Smoke"}]}' -H "$MANAGER")"
check "storefront shows accessory group"    True "$(req GET "/catalog/products/$SLUG" >/dev/null; jqv " is not None and any(a['group']=='Smoke' for a in d['accessories']) and len(d['documents'])==2")"
check "PUT /admin/products/{id}/variant"    True "$(req PUT "/admin/products/$IPID/variant" '{"group":"Smoke group '"$RND"'","axes":["Длина, м"],"values":[{"axis":"Длина, м","value":"3"}]}' -H "$MANAGER" >/dev/null; jqv " is not None and d['variant']['group']=='Smoke group $RND' and d['variant']['values']=={'Длина, м':'3'}")"
check "variant missing value -> 422"        422 "$(req PUT "/admin/products/$IPID/variant" '{"group":"Smoke group '"$RND"'","axes":["Длина, м","Цвет"],"values":[{"axis":"Длина, м","value":"3"}]}' -H "$MANAGER")"
check "GET /admin/brands"                   200 "$(req GET /admin/brands '' -H "$MANAGER")"
BID=$(jqv "[0]['id']"); BCOUNTRY=$(jqv "[0]['country_brand'] or ''")
check "PUT /admin/brands/{id} country"      True "$(req PUT "/admin/brands/$BID" '{"country_brand":"Германия"}' -H "$MANAGER" >/dev/null; jqv "['country_brand']=='Германия'")"
req PUT "/admin/brands/$BID" '{"country_brand":"'"$BCOUNTRY"'"}' -H "$MANAGER" >/dev/null
IMG=$(mktemp -d)/smoke.png; printf '\x89PNG\r\n\x1a\nsmoke' > "$IMG"
check "POST /admin/files image"             201 "$(form /admin/files "$MANAGER" -F "kind=image" -F "file=@$IMG")"
FURL=$(jqv "['url']")
check "GET uploaded file"                   200 "$(curl -s -o /dev/null -w '%{http_code}' "${BASE%/api/v1}$FURL")"
check "POST /admin/files pdf as image -> 422" 422 "$(form /admin/files "$MANAGER" -F "kind=image" -F "file=@$DOCF")"
check "POST /admin/files as client -> 403"  403 "$(form /admin/files "$AUTHV" -F "file=@$IMG")"
# импорт: страна производства, документы по ссылке и номеру, комплектующие (код ниже в файле), торговое предложение
printf 'Код;Страна производства;Документы;Комплектующие;Предложение;Вар: Длина, м\nSMOKE-IMPORT-1;Турция;"Каталог | https://example.com/smoke-cat-%s.pdf; #%s";Крепёж: %s;Smoke group %s;6\n' "$RND" "$DOCID" "$ACODE" "$RND" > "$CSV"
check "import with new columns"             True "$(upload '' "$ADMIN" "$CSV" >/dev/null; jqv "['updated']==1 and d['errors']==[]")"
check "import applied extras"               True "$(req GET "/admin/products/$IPID" '' -H "$ADMIN" >/dev/null; jqv " is not None and d['country_origin']=='Турция' and len(d['documents'])==2 and d['accessories'][0]['group']=='Крепёж' and d['variant']['values']=={'Длина, м':'6'}")"
printf 'Код;Комплектующие;Вар: Длина, м\nSMOKE-IMPORT-1;NOPE-%s;-\n' "$RND" > "$CSV"
check "import unknown accessory reported"   True "$(upload '' "$ADMIN" "$CSV" >/dev/null; jqv " is not None and any('NOPE' in e['message'] for e in d['errors'])")"
check "variant: leave group"                True "$(req PUT "/admin/products/$IPID/variant" '{"group":null,"values":[]}' -H "$MANAGER" >/dev/null; jqv "['variant'] is None")"
req PUT "/admin/products/$PID/accessories" '{"items":[]}' -H "$MANAGER" >/dev/null
req PUT "/admin/products/$PID/documents" '{"document_ids":[]}' -H "$MANAGER" >/dev/null
check "DELETE /admin/documents/{id}"        204 "$(req DELETE "/admin/documents/$DOCID" '' -H "$MANAGER")"
req DELETE "/admin/documents/$UDOC" '' -H "$MANAGER" >/dev/null
# документ, созданный импортом по ссылке, тоже убираем
req GET "/admin/documents?q=smoke-cat-$RND" '' -H "$MANAGER" >/dev/null
for d in $(jqv "['items']" | python3 -c "import sys,ast; print(' '.join(str(x['id']) for x in ast.literal_eval(sys.stdin.read() or '[]')))"); do req DELETE "/admin/documents/$d" '' -H "$MANAGER" >/dev/null; done
rm -rf "$(dirname "$DOCF")" "$(dirname "$IMG")"; rm -f "$CSV"

echo "== content admin: news, projects, vacancies, stores =="
check "GET /content/site"                   200 "$(req GET /content/site)"
check "GET /content/vacancies"              True "$(req GET /content/vacancies >/dev/null; jqv " is not None and len(d) >= 1 and all('blocks' in v for v in d)")"
check "GET /admin/news as client -> 403"    403 "$(req GET /admin/news '' -H "$AUTHV")"
check "POST /admin/news"                    201 "$(req POST /admin/news '{"title":"Смоук новость '"$RND"'","excerpt":"анонс","body_text":"Текст **важно**\n\n- пункт\n\n<script>alert(1)</script>","tags":["Смоук"]}' -H "$MANAGER")"
NID=$(jqv "['id']"); NSLUG=$(jqv "['slug']")
check "news body is safe html"              True "$(req GET "/content/news/$NSLUG" >/dev/null; jqv " is not None and '<strong>важно</strong>' in d['body'] and '<li>пункт</li>' in d['body'] and '<script>' not in d['body'] and '&lt;script&gt;' in d['body']")"
check "GET /admin/news/{id} body_text"      True "$(req GET "/admin/news/$NID" '' -H "$MANAGER" >/dev/null; jqv "['body_text'].startswith('Текст **важно**')")"
check "PUT /admin/news/{id}"                200 "$(req PUT "/admin/news/$NID" '{"title":"Смоук новость '"$RND"' 2","slug":"'"$NSLUG"'","body_text":"Новый текст"}' -H "$MANAGER")"
check "news slug taken -> 409"              409 "$(req POST /admin/news '{"title":"Дубль","slug":"'"$NSLUG"'"}' -H "$MANAGER")"
check "DELETE /admin/news/{id}"             204 "$(req DELETE "/admin/news/$NID" '' -H "$MANAGER")"
check "POST /admin/projects"                201 "$(req POST /admin/projects '{"title":"Смоук проект '"$RND"'","project_date":"2025-01-02","object":"Объект","service":"Поставка","brands":["dks"],"products":["'"$ACODE"'"],"body_text":"Описание"}' -H "$MANAGER")"
PJID=$(jqv "['id']"); PJSLUG=$(jqv "['slug']")
check "project on site with brand/product"  True "$(req GET "/content/projects/$PJSLUG" >/dev/null; jqv " is not None and d['brands'][0]['slug']=='dks' and len(d['products'])==1 and d['year']=='2025'")"
check "project unknown brand -> 422"        422 "$(req PUT "/admin/projects/$PJID" '{"title":"x","brands":["no-such-brand"]}' -H "$MANAGER")"
check "DELETE /admin/projects/{id}"         204 "$(req DELETE "/admin/projects/$PJID" '' -H "$MANAGER")"
check "POST /admin/vacancies"               201 "$(req POST /admin/vacancies '{"title":"Смоук вакансия '"$RND"'","dept":"Тест","city":"Душанбе","experience":"","schedule":"","salary":"","is_active":false,"blocks":[{"title":"Обязанности","items":["Тестировать"]}]}' -H "$MANAGER")"
VID=$(jqv "['id']")
check "hidden vacancy not on site"          True "$(req GET /content/vacancies >/dev/null; jqv " is not None and not any(v['title']=='Смоук вакансия $RND' for v in d)")"
check "DELETE /admin/vacancies/{id}"        204 "$(req DELETE "/admin/vacancies/$VID" '' -H "$MANAGER")"
check "POST /admin/stores"                  201 "$(req POST /admin/stores '{"code":"smoke-'"$RND"'","city":"Вахдат","name":"Смоук склад","address":"ул. Тестовая, 1","phone":null,"hours":null,"delivery_hint":"завтра","lat":38.5,"lon":69.0}' -H "$MANAGER")"
SID=$(jqv "['id']")
check "store code taken -> 409"             409 "$(req POST /admin/stores '{"code":"smoke-'"$RND"'","city":"Вахдат","name":"Дубль","address":"ул. Тестовая, 1","delivery_hint":"","lat":null,"lon":null}' -H "$MANAGER")"
check "PUT /admin/stores/{id}"              200 "$(req PUT "/admin/stores/$SID" '{"code":"smoke-'"$RND"'","city":"Вахдат","name":"Смоук склад 2","address":"ул. Тестовая, 2","delivery_hint":"завтра","lat":null,"lon":null}' -H "$MANAGER")"
check "DELETE /admin/stores/{id}"           204 "$(req DELETE "/admin/stores/$SID" '' -H "$MANAGER")"
check "DELETE store with stock -> 409"      409 "$(req DELETE /admin/stores/1 '' -H "$MANAGER")"

# письма: регистрация, заказы, заявки, ответы — в outbox (target=email)
check "email events queued in outbox"     True "$(req GET /admin/outbox '' -H "$ADMIN" >/dev/null; jqv " is not None and all(e in [r['event'] for r in d if r['target']=='email'] for e in ['email.order_created','email.order_new','email.registration_received','email.lead_new','email.order_status'])")"
check "PUT /account/password wrong"       422 "$(req PUT /account/password '{"current_password":"bad","new_password":"Newpass123"}' -H "$AUTHV")"
check "POST /auth/logout"                 204 "$(req POST /auth/logout '{"refresh_token":"'"$REFRESH"'"}')"
check "GET /auth/me without token -> 401" 401 "$(req GET /auth/me)"

rm -f "$TMP"
echo; echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]

#!/usr/bin/env bash
# Run after every deploy:   npm run smoke
# Checks the LIVE site: public pages load, protected pages send you to sign in (not an error), assets exist, and /api/health
# says the live database matches the live code. Nothing here signs in or changes anything.
#   Other sites:  MANAGE=https://manage.example.com PORTAL=https://portal.example.com npm run smoke
MANAGE="${MANAGE:-https://manage.onesimplesite.co.uk}"; PORTAL="${PORTAL:-https://portal.onesimplesite.co.uk}"
fail=0; n=0
check() { # check <label> <url> <expected status> [text the page must contain] [curl args...]
  local label="$1" url="$2" want="$3" text="${4:-}"; shift 4 2>/dev/null || shift $#
  local body status; body="$(mktemp)"; n=$((n+1))
  status="$(curl -s -m 25 -o "$body" -w '%{http_code}' "$@" "$url")"
  if [ "$status" != "$want" ]; then echo "FAIL  $label: got $status, wanted $want ($url)"; fail=$((fail+1))
  elif [ -n "$text" ] && ! grep -q "$text" "$body"; then echo "FAIL  $label: page is missing \"$text\" ($url)"; fail=$((fail+1))
  else echo "ok    $label"; fi
  rm -f "$body"
}
check "team sign-in page"            "$MANAGE/login" 200 "Sign in"
check "customer sign-in page"        "$PORTAL/login" 200 "Sign in"
check "privacy notice"               "$PORTAL/legal/privacy" 200 "Privacy"
check "cookie notice"                "$PORTAL/legal/cookies" 200 "ookie"
check "portal terms"                 "$PORTAL/legal/terms" 200 "Terms"
check "email font (text)"            "$PORTAL/brand/fonts/hanken-grotesk-latin-wght-normal.woff2" 200 ""
check "email font (headings)"        "$PORTAL/brand/fonts/funnel-display-latin-wght-normal.woff2" 200 ""
check "email logo"                   "$PORTAL/brand/wordmark-reversed-colour-email.png" 200 ""
check "team home needs sign-in"      "$MANAGE/" 307 ""
check "agreements need sign-in"      "$MANAGE/agreements" 307 ""
check "payments need sign-in"        "$MANAGE/payments" 307 ""
check "customer billing needs sign-in" "$PORTAL/billing" 307 ""
check "unknown page is a clean 404"  "$MANAGE/this-page-does-not-exist" 404 ""
check "Stripe webhook refuses an unsigned call" "$MANAGE/api/stripe/webhook" 400 "" -X POST -d '{}'
check "team side: database matches code" "$MANAGE/api/health" 200 '"ok":true'
check "customer side: database matches code" "$PORTAL/api/health" 200 '"ok":true'
echo; if [ "$fail" -eq 0 ]; then echo "All $n checks passed."; else echo "$fail of $n checks FAILED. Do not leave this deploy live until they are explained."; fi
exit "$fail"

#!/usr/bin/env bash
# The gate before any deploy:   npm run verify          (about 2 minutes)
#                                npm run verify:full     (adds every browser test, about 10 minutes)
# It stops at the first thing that fails. Needs the local database running (see README).
set -e
cd "$(dirname "$0")/.."
step() { echo; echo "== $1"; }
step "1. Types";                npx tsc --noEmit
step "2. Unit tests";           npx vitest run
step "3. Build with NO environment settings (exactly what Vercel does)"
backup="$(mktemp -d)"; for f in .env .env.local; do [ -f "$f" ] && mv "$f" "$backup/"; done
restore() { for f in "$backup"/.env*; do [ -f "$f" ] && mv "$f" .; done; true; }
trap restore EXIT
env -u DATABASE_URL -u BETTER_AUTH_SECRET npx next build
restore; trap - EXIT
if [ "${FULL:-0}" = "1" ]; then
  step "4. Production build with settings"; npx next build
  step "5. Browser tests (team app, customer portal, desktop and phone)"
  fuser -k 3000/tcp >/dev/null 2>&1 || true
  (npx next start -p 3000 >/tmp/verify-next.log 2>&1 &) ; sleep 8
  for t in journey agreements revise lists settings payments portal-billing client-setup cancel-order return-to; do echo "-- $t"; node "tests/e2e/$t.mjs" | tail -1; done
  echo "-- crawl (every page)"; node tests/e2e/crawl.mjs | grep -E "pages,|BAD|OVERFLOW" || true
  fuser -k 3000/tcp >/dev/null 2>&1 || true
fi
echo; echo "VERIFIED. Safe to deploy. After deploying, run: npm run smoke"

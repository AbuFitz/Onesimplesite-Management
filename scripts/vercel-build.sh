#!/usr/bin/env bash
# The build command on Vercel (and the same locally and in GitHub checks).
#
# Live builds just build. DEV builds (a preview with DEV_AUTO_MIGRATE=1) first bring the dev database up to date and fill it
# with test data, so a dev deploy is always testable straight away. It will REFUSE to do that to the live database.
set -euo pipefail
LIVE_REF="mxjgysmphfsofqiucxxz"

if [ "${DEV_AUTO_MIGRATE:-}" = "1" ]; then
  if [ "${VERCEL_ENV:-preview}" = "production" ]; then echo "REFUSING: DEV_AUTO_MIGRATE is on for a production build."; exit 1; fi
  if [ -z "${MIGRATE_DATABASE_URL:-}" ]; then echo "REFUSING: DEV_AUTO_MIGRATE is on but MIGRATE_DATABASE_URL is empty."; exit 1; fi
  for v in MIGRATE_DATABASE_URL DATABASE_URL; do
    case "${!v:-}" in *"$LIVE_REF"*) echo "REFUSING: $v points at the LIVE database. Dev builds never touch live."; exit 1;; esac
  done
  echo "== Dev build: updating the dev database"
  npx prisma migrate deploy
  node scripts/dev-prepare.mjs
fi

npx prisma generate
npx next build

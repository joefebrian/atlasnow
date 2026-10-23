#!/bin/sh
# Checks the commerce migration files. Does not migrate production.
# Does not apply loyalty or broadcast schema drift.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"

files="
prisma/migrations/20261023120000_commerce_products/migration.sql
prisma/migrations/20261023180000_commerce_image_sku/migration.sql
prisma/migrations/20261023210000_commerce_catalog_connection/migration.sql
prisma/migrations/20261023233000_commerce_sync_hardening/migration.sql
prisma/migrations/20261024100000_commerce_batch_poll/migration.sql
prisma/migrations/20261024180000_commerce_orders/migration.sql
"

for file in $files; do
  test -f "$file"
  if grep -E -q 'Loyalty|Broadcast' "$file"; then
    echo "commerce migration mentions an unrelated table: $file" >&2
    exit 1
  fi
done

echo "commerce migration files are present and do not mention Loyalty or Broadcast"
echo "loyalty/broadcast drift is not applied by this script"

if [ -n "${COMMERCE_MIGRATE_URL:-}" ]; then
  case "$COMMERCE_MIGRATE_URL" in
    *localhost*|*127.0.0.1*) ;;
    *)
      echo "COMMERCE_MIGRATE_URL must point at localhost" >&2
      exit 1
      ;;
  esac
  echo "applying prisma migrate deploy to the local URL only"
  DATABASE_URL="$COMMERCE_MIGRATE_URL" npx prisma migrate deploy
fi

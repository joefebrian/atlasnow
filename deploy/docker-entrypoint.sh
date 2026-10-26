#!/bin/sh
set -eu
# Boot never migrates. An operator runs prisma migrate deploy only after a
# separate approval and a passing scripts/migration-preflight.mjs result.
echo ">> next start (0.0.0.0:${PORT:-3000})"
exec node server.js

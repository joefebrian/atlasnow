#!/bin/sh
set -eu
echo ">> prisma migrate deploy"
# Use the package entry, not node_modules/.bin/prisma (Docker COPY
# flattens that symlink and the CLI then misses prisma_schema_build_bg.wasm).
node /app/node_modules/prisma/build/index.js migrate deploy
echo ">> next start (0.0.0.0:${PORT:-3000})"
exec node server.js

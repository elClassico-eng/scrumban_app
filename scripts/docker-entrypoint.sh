#!/bin/sh
# Production entrypoint: run drizzle migrations against the admin role,
# then exec the actual server. Migrations are idempotent — drizzle-kit
# tracks applied migrations in its own meta table.
set -e

echo "[entrypoint] Running drizzle migrations..."
npx drizzle-kit migrate

echo "[entrypoint] Starting Nitro server..."
exec "$@"

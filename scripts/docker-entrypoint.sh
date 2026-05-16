#!/bin/sh
# Production entrypoint: run drizzle migrations via the embedded migrator
# from drizzle-orm/postgres-js (no drizzle-kit CLI), then exec the server.
# Migrations are tracked in the __drizzle_migrations meta table.
set -e

echo "[entrypoint] Running migrations..."
node /app/scripts/migrate.mjs

echo "[entrypoint] Starting Nitro server..."
exec "$@"

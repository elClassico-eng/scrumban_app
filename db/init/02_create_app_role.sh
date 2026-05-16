#!/bin/sh
# Creates the runtime role `scrumban_app` referenced by 0004+ migrations
# (GRANT ... TO scrumban_app). Same password as the admin role for now —
# proper split (separate password from .env) is a Phase 10 hardening step.
# Runs only on first DB init when /var/lib/postgresql/data is empty, so we
# don't need a guard against duplicate-role.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$POSTGRES_PASSWORD" <<-'EOSQL'
CREATE ROLE scrumban_app LOGIN PASSWORD :'app_password' NOBYPASSRLS;
GRANT CONNECT ON DATABASE scrumban_prod TO scrumban_app;
GRANT USAGE ON SCHEMA public TO scrumban_app;
EOSQL
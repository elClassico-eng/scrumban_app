#!/bin/bash
# Nightly encrypted Postgres + .env backup on the prod host, run from cron as
# the deploy user. Config: ~/.scrumban-backup.env (see backup-db.env.example).
# Off-site copies are pulled by scripts/pull-backups.sh on another server.
set -euo pipefail
umask 077

source "${BACKUP_ENV_FILE:-$HOME/.scrumban-backup.env}"

REPO_DIR="${REPO_DIR:-$HOME/scrumban_app}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS=$(date -u +%Y%m%d-%H%M%S)

notify() {
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n' "$SMTP_USER" "$HC_PING_EMAIL" "$1" "$2" \
    | curl -fsS -m 30 --retry 3 --url "$SMTP_URL" --mail-from "$SMTP_USER" \
        --mail-rcpt "$HC_PING_EMAIL" --user "$SMTP_USER:$SMTP_PASS" --upload-file - >/dev/null
}

fail() {
  echo "[backup] FAILED: $1" >&2
  rm -f "$BACKUP_DIR"/*.tmp
  notify "takt backup FAIL" "backup-db on $(hostname): $1" || true
  exit 1
}
trap 'fail "line $LINENO"' ERR

mkdir -p "$BACKUP_DIR"
DB_OUT="$BACKUP_DIR/db-$TS.sql.gz.age"
ENV_OUT="$BACKUP_DIR/env-$TS.age"

docker compose -f "$REPO_DIR/docker-compose.prod.yml" exec -T db \
  pg_dump -U scrumban -d scrumban_prod \
  | gzip | age -r "$AGE_RECIPIENT" > "$DB_OUT.tmp"

SIZE=$(stat -c%s "$DB_OUT.tmp")
[ "$SIZE" -gt 1024 ] || fail "dump is only $SIZE bytes"

age -r "$AGE_RECIPIENT" < "$REPO_DIR/.env" > "$ENV_OUT.tmp"

mv "$DB_OUT.tmp" "$DB_OUT"
mv "$ENV_OUT.tmp" "$ENV_OUT"

find "$BACKUP_DIR" -maxdepth 1 \( -name 'db-*.sql.gz.age' -o -name 'env-*.age' \) \
  -mtime +"$RETENTION_DAYS" -delete

echo "[backup] ok: $(basename "$DB_OUT") ($SIZE bytes)"

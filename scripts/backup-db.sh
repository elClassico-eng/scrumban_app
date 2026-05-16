#!/bin/bash
# Daily Postgres backup → YC Object Storage. Reads credentials from
# ~/.scrumban-backup.env (BACKUP_BUCKET, AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION). Run via cron from the
# host (not inside a container). Retention: 14 days.
set -euo pipefail

ENV_FILE="${BACKUP_ENV_FILE:-$HOME/.scrumban-backup.env}"
if [[ ! -r "$ENV_FILE" ]]; then
  echo "[backup] missing env file: $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

REPO_DIR="${REPO_DIR:-$HOME/scrumban_app}"
COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"
ENDPOINT="https://storage.yandexcloud.net"

TS=$(date -u +%Y%m%d-%H%M%S)
FILE="scrumban-${TS}.sql.gz"
TMP="/tmp/${FILE}"

echo "[backup] dumping db..."
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U scrumban -d scrumban_prod | gzip > "$TMP"

SIZE=$(stat -c%s "$TMP")
echo "[backup] dump size: ${SIZE} bytes"

echo "[backup] uploading to s3://${BACKUP_BUCKET}/${FILE}"
aws s3 cp "$TMP" "s3://${BACKUP_BUCKET}/${FILE}" --endpoint-url "$ENDPOINT"
rm -f "$TMP"

echo "[backup] rotating old backups (>14 days)..."
CUTOFF=$(date -u -d "14 days ago" +%Y%m%d)
aws s3 ls "s3://${BACKUP_BUCKET}/" --endpoint-url "$ENDPOINT" | awk '{print $4}' | while read -r key; do
  [[ -z "$key" ]] && continue
  file_date=$(echo "$key" | sed -E 's/^scrumban-([0-9]{8})-.*$/\1/')
  if [[ "$file_date" =~ ^[0-9]{8}$ && "$file_date" < "$CUTOFF" ]]; then
    echo "[backup] removing $key"
    aws s3 rm "s3://${BACKUP_BUCKET}/${key}" --endpoint-url "$ENDPOINT"
  fi
done

echo "[backup] done"

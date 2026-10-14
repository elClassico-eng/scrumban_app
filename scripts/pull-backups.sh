#!/bin/bash
set -euo pipefail
umask 077

source "${PULL_ENV_FILE:-$HOME/.scrumban-pull.env}"

DEST="${DEST:-$HOME/takt-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"

notify() {
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n' "$SMTP_USER" "$HC_PING_EMAIL" "$1" "$2" \
    | curl -fsS -m 30 --retry 3 --url "$SMTP_URL" --mail-from "$SMTP_USER" \
        --mail-rcpt "$HC_PING_EMAIL" --user "$SMTP_USER:$SMTP_PASS" --upload-file - >/dev/null
}

fail() {
  echo "[pull] FAILED: $1" >&2
  notify "takt backup FAIL" "pull-backups on $(hostname): $1" || true
  exit 1
}
trap 'fail "line $LINENO"' ERR

mkdir -p -m 700 "$DEST"
rsync -a --no-owner --no-group --chmod=F600 --exclude '*.tmp' --exclude '*.log' \
  -e "ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30" \
  "$SOURCE:" "$DEST/"

FRESH=$(find "$DEST" -maxdepth 1 -name 'db-*.sql.gz.age' -mmin -$((MAX_AGE_HOURS * 60)) | sort | tail -1)
[ -n "$FRESH" ] || fail "no db backup newer than ${MAX_AGE_HOURS}h"

find "$DEST" -maxdepth 1 \( -name 'db-*.sql.gz.age' -o -name 'env-*.age' \) \
  -mtime +"$RETENTION_DAYS" -delete

COUNT=$(find "$DEST" -maxdepth 1 -name 'db-*.sql.gz.age' | wc -l)
echo "[pull] ok: $(basename "$FRESH"), $COUNT db backups kept"
notify "takt backup OK" "pull-backups on $(hostname): $(basename "$FRESH"), $COUNT db backups kept"

#!/bin/bash
[ "${PAM_TYPE:-}" = open_session ] || exit 0

source /etc/ssh-login-notify.env
source "$SMTP_ENV"

for skip in ${SKIP_LOGINS:-}; do
  [ "$PAM_USER@$PAM_RHOST" = "$skip" ] && exit 0
done

SUBJECT="SSH login: $PAM_USER@$(hostname) from $PAM_RHOST"
BODY="user: $PAM_USER
host: $(hostname)
from: $PAM_RHOST
time: $(date '+%F %T %Z')"

(
  printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n' "$SMTP_USER" "$ALERT_TO" "$SUBJECT" "$BODY" \
    | curl -fsS -m 30 --url "$SMTP_URL" --mail-from "$SMTP_USER" --mail-rcpt "$ALERT_TO" \
        --user "$SMTP_USER:$SMTP_PASS" --upload-file -
) </dev/null >/dev/null 2>&1 &

exit 0

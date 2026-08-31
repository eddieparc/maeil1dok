#!/usr/bin/env bash
set -uo pipefail

DJANGO_HEALTH_URL="${DJANGO_HEALTH_URL:-https://api.maeil1dok.app/health/}"
DJANGO_READY_URL="${DJANGO_READY_URL:-https://api.maeil1dok.app/ready/}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-https://maeil1dok.app/api/health}"
LOKI_READY_URL="${LOKI_READY_URL:-http://loki:3100/ready}"
ALLOY_READY_URL="${ALLOY_READY_URL:-http://alloy:12345/-/ready}"
BACKUP_RECEIPT_PATH="${BACKUP_RECEIPT_PATH:-/mnt/data/maeil1dok/backups/last-success.json}"
BACKUP_MAX_AGE_SECONDS="${BACKUP_MAX_AGE_SECONDS:-108000}"
ALERT_API_URL="${ALERT_API_URL:-https://api.resend.com/emails}"
ALERT_STATE_PATH="${ALERT_STATE_PATH:-/state/status}"
LOKI_DATA_PATH="${LOKI_DATA_PATH:-}"
DISK_MIN_FREE_PERCENT="${DISK_MIN_FREE_PERCENT:-15}"
CANARY=false
[ "${1:-}" = "--canary" ] && CANARY=true

failures=()

add_failure() {
  failures+=("$1")
}

probe_json() {
  local name="$1"
  local url="$2"
  local body status
  body="$(mktemp)"
  if ! status="$(curl --silent --show-error --max-time 10 --output "$body" --write-out '%{http_code}' "$url")"; then
    add_failure "${name}:unreachable"
  elif [ "$status" != "200" ]; then
    add_failure "${name}:http_${status}"
  elif ! jq -e '.status == "ok"' "$body" >/dev/null 2>&1; then
    add_failure "${name}:status_not_ok"
  fi
  rm -f "$body"
}

probe_ready() {
  local name="$1"
  local url="$2"
  local status
  if ! status="$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' "$url")"; then
    add_failure "${name}:unreachable"
  elif [ "$status" != "200" ]; then
    add_failure "${name}:http_${status}"
  fi
}

probe_backup() {
  local completed_at backup_path size_bytes now age
  if ! jq -e '
      (.completed_at_epoch | type == "number") and
      (.path | type == "string" and length > 0) and
      (.size_bytes | type == "number" and . > 0)
    ' "$BACKUP_RECEIPT_PATH" >/dev/null 2>&1; then
    add_failure "backup:receipt_missing_or_invalid"
    return
  fi

  completed_at="$(jq -r '.completed_at_epoch' "$BACKUP_RECEIPT_PATH")"
  backup_path="$(jq -r '.path' "$BACKUP_RECEIPT_PATH")"
  size_bytes="$(jq -r '.size_bytes' "$BACKUP_RECEIPT_PATH")"
  now="$(date +%s)"
  age=$((now - completed_at))
  if [ "$age" -gt "$BACKUP_MAX_AGE_SECONDS" ]; then
    add_failure "backup:stale"
  elif [ ! -f "$backup_path" ]; then
    add_failure "backup:file_missing"
  elif [ "$(wc -c < "$backup_path")" -ne "$size_bytes" ]; then
    add_failure "backup:size_mismatch"
  fi
}

probe_log_disk() {
  local free_percent
  [ -z "$LOKI_DATA_PATH" ] && return
  if [ ! -d "$LOKI_DATA_PATH" ]; then
    add_failure "log_disk:path_missing"
    return
  fi
  free_percent="$(df -Pk "$LOKI_DATA_PATH" | awk 'NR == 2 {gsub(/%/, "", $5); print 100 - $5}')"
  if ! [[ "$free_percent" =~ ^[0-9]+$ ]]; then
    add_failure "log_disk:probe_failed"
  elif [ "$free_percent" -lt "$DISK_MIN_FREE_PERCENT" ]; then
    add_failure "log_disk:low_space"
  fi
}

send_alert() {
  local subject="$1"
  local body="$2"
  local payload response status receipt_id
  if [ -z "${RESEND_API_KEY:-}" ] || [ -z "${OPS_ALERT_EMAIL:-}" ] || [ -z "${OPS_ALERT_FROM:-}" ]; then
    printf '{"level":"ERROR","event":"ops.alert.delivery","reason":"configuration_missing"}\n' >&2
    return 2
  fi

  payload="$(jq -n \
    --arg from "$OPS_ALERT_FROM" \
    --arg to "$OPS_ALERT_EMAIL" \
    --arg subject "$subject" \
    --arg html "$body" \
    '{from:$from,to:[$to],subject:$subject,html:$html}')"
  response="$(mktemp)"
  if ! status="$(curl --silent --show-error --max-time 15 \
    --request POST "$ALERT_API_URL" \
    --header "Authorization: Bearer ${RESEND_API_KEY}" \
    --header "Content-Type: application/json" \
    --data "$payload" \
    --output "$response" \
    --write-out '%{http_code}')"; then
    rm -f "$response"
    printf '{"level":"ERROR","event":"ops.alert.delivery","reason":"request_failed"}\n' >&2
    return 2
  fi
  if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
    rm -f "$response"
    printf '{"level":"ERROR","event":"ops.alert.delivery","reason":"http_error","status":%s}\n' "$status" >&2
    return 2
  fi

  receipt_id="$(jq -r '.id // "unknown"' "$response")"
  rm -f "$response"
  jq -cn --arg receipt_id "$receipt_id" --arg subject "$subject" \
    '{level:"INFO",event:"ops.alert.delivered",receipt_id:$receipt_id,subject:$subject}'
}

probe_json "django_health" "$DJANGO_HEALTH_URL"
probe_json "django_ready" "$DJANGO_READY_URL"
probe_json "frontend_health" "$FRONTEND_HEALTH_URL"
probe_ready "loki" "$LOKI_READY_URL"
probe_ready "alloy" "$ALLOY_READY_URL"
probe_backup
probe_log_disk

mkdir -p "$(dirname "$ALERT_STATE_PATH")"
previous_state="$(cat "$ALERT_STATE_PATH" 2>/dev/null || true)"
if [ "${#failures[@]}" -eq 0 ]; then
  current_state="ok"
else
  current_state="$(printf '%s\n' "${failures[@]}" | sort | tr '\n' ',')"
fi

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if $CANARY; then
  if [ "$current_state" = "ok" ]; then
    send_alert "[CANARY] maeil1dok observability OK" \
      "<p>All production probes passed at ${timestamp}.</p>" || exit $?
  else
    send_alert "[CANARY] maeil1dok observability DEGRADED" \
      "<p>Probe failures at ${timestamp}: ${current_state}</p>" || exit $?
  fi
elif [ "$current_state" != "ok" ] && [ "$current_state" != "$previous_state" ]; then
  send_alert "[ALERT] maeil1dok production degraded" \
    "<p>Probe failures at ${timestamp}: ${current_state}</p>" || exit $?
elif [ "$current_state" = "ok" ] && [ -n "$previous_state" ] && [ "$previous_state" != "ok" ]; then
  send_alert "[RECOVERY] maeil1dok production healthy" \
    "<p>All production probes recovered at ${timestamp}.</p>" || exit $?
fi

printf '%s\n' "$current_state" > "$ALERT_STATE_PATH"
if [ "$current_state" = "ok" ]; then
  printf '{"level":"INFO","event":"ops.probe.completed","status":"ok"}\n'
  exit 0
fi
printf '{"level":"ERROR","event":"ops.probe.completed","status":"degraded","failures":"%s"}\n' "$current_state" >&2
exit 1

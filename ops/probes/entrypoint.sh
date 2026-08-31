#!/usr/bin/env sh
set -u

interval="${OPS_PROBE_INTERVAL_SECONDS:-60}"
startup_grace="${OPS_PROBE_STARTUP_GRACE_SECONDS:-120}"
sleep "$startup_grace" &
wait "$!"

while true; do
  if ! /app/run.sh; then
    printf '{"level":"ERROR","event":"ops.probe.run","status":"failed"}\n' >&2
  fi
  sleep "$interval" &
  wait "$!"
done

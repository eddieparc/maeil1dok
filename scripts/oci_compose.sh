#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DEPLOY_COMMIT_FILE="${DEPLOY_COMMIT_FILE:-.deploy-commit}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.oci.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.oci}"

if [ ! -f "$DEPLOY_COMMIT_FILE" ]; then
  echo "ERROR: $DEPLOY_COMMIT_FILE is missing" >&2
  exit 1
fi
COMMIT_SHA="$(tr -d '\r\n' < "$DEPLOY_COMMIT_FILE")"
if ! [[ "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: $DEPLOY_COMMIT_FILE does not contain a full commit SHA" >&2
  exit 1
fi
export COMMIT_SHA

exec docker compose -f "$COMPOSE_FILE" --env-file "$COMPOSE_ENV_FILE" "$@"

#!/bin/sh
set -e

echo "Waiting for database..."
DB_WAIT_HOST="${DB_HOST:-db}"
DB_WAIT_PORT="${DB_PORT:-3306}"
while ! nc -z "$DB_WAIT_HOST" "$DB_WAIT_PORT"; do
  sleep 1
done
echo "Database is ready!"
APP_PORT="${PORT:-8000}"

if [ "${RUN_MIGRATIONS:-true}" = "true" ] || [ "${RUN_MIGRATIONS:-true}" = "1" ]; then
  echo "Running migrations..."
  python manage.py migrate --noinput
else
  echo "Skipping migrations."
fi

if [ "${RUN_COLLECTSTATIC:-true}" = "true" ] || [ "${RUN_COLLECTSTATIC:-true}" = "1" ]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput
else
  echo "Skipping collectstatic."
fi

if [ "$#" -gt 0 ]; then
  echo "Starting custom command: $*"
  exec "$@"
fi

# 개발에서는 자동 리로드되는 runserver, 운영에서는 gunicorn 사용
if [ "$DEBUG" = "True" ] || [ "$DEBUG" = "true" ] || [ "$DEBUG" = "1" ]; then
  echo "Starting Django development server (DEBUG)..."
  python manage.py runserver "0.0.0.0:${APP_PORT}"
else
  echo "Starting gunicorn..."
  exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${APP_PORT}" \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile -
fi

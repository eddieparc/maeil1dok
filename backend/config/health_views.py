import logging
from collections.abc import Mapping
from datetime import datetime, time

from django.core.cache import cache
from django.db import connections
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from config.observability import (
    HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS,
    HASENA_SUMMARY_HEARTBEAT_CACHE_KEY,
    HASENA_SUMMARY_UNKNOWN_GRACE_SECONDS,
    HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY,
    REMINDER_DEADMAN_TIMEOUT_SECONDS,
    REMINDER_HEARTBEAT_CACHE_KEY,
    REMINDER_UNKNOWN_GRACE_SECONDS,
    REMINDER_UNKNOWN_SINCE_CACHE_KEY,
)

from todos.models import NotificationPushSubscription
from todos.services.push_notifications import is_web_push_configured

logger = logging.getLogger(__name__)


def _database_ok():
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except Exception as exc:
        return False, exc
    return True, None


def _database_check_payload(db_ok, db_exc, probe):
    if db_ok:
        return {'status': 'ok'}

    # Single emission point: Django/Sentry LoggingIntegration captures this ERROR log.
    logger.error('Health probe database check failed (probe=%s)', probe, exc_info=db_exc)
    return {'status': 'error'}


def _local_datetime(value):
    if not isinstance(value, datetime):
        return None
    if timezone.is_aware(value):
        return timezone.localtime(value).replace(tzinfo=None)
    return value


def _hasena_schedule_window_start(local_now):
    return datetime.combine(local_now.date(), time.min)


def _hasena_summary_is_scheduled(local_now):
    return local_now.weekday() in range(0, 6) and 0 <= local_now.hour < 6


def _current_window_recorded_at(heartbeat, window_start, local_now):
    if not isinstance(heartbeat, Mapping):
        return None

    recorded_at = _local_datetime(heartbeat.get('recorded_at'))
    if recorded_at is None or recorded_at < window_start or recorded_at > local_now:
        return None
    return recorded_at


def _hasena_unknown_since(now, window_start):
    marker = cache.get(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY)
    local_marker = _local_datetime(marker)
    if local_marker is None or local_marker < window_start:
        cache.set(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY, now, timeout=None)
        return now

    return local_marker


def _hasena_recorded_status(heartbeat, age_seconds):
    if age_seconds > HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS:
        return 'stale'
    if not isinstance(heartbeat, Mapping):
        return None
    status = heartbeat.get('status')
    if status == 'success':
        return 'ok'
    if status == 'skipped':
        reason = heartbeat.get('reason')
        return 'ok' if reason in {'already_generated', 'summary_exists'} else None
    if status in {'failed', 'error', 'pending'}:
        return status
    return None


def _hasena_unknown_payload(local_now, window_start):
    unknown_since = _hasena_unknown_since(local_now, window_start)
    unknown_age_seconds = max(0, int((local_now - unknown_since).total_seconds()))
    status = 'unknown' if unknown_age_seconds <= HASENA_SUMMARY_UNKNOWN_GRACE_SECONDS else 'missing'
    return {
        'status': status,
        'last_run_at': None,
        'unknown_since': unknown_since.isoformat(),
        'unknown_age_seconds': unknown_age_seconds,
        'grace_seconds': HASENA_SUMMARY_UNKNOWN_GRACE_SECONDS,
    }


def _hasena_summary_heartbeat_status(now):
    local_now = _local_datetime(now) or timezone.localtime().replace(tzinfo=None)
    window_start = _hasena_schedule_window_start(local_now)
    if not _hasena_summary_is_scheduled(local_now):
        cache.delete(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY)
        return {'status': 'not_scheduled'}

    heartbeat = cache.get(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)
    recorded_at = _current_window_recorded_at(heartbeat, window_start, local_now)
    if recorded_at is not None:
        age_seconds = max(0, int((local_now - recorded_at).total_seconds()))
        status = _hasena_recorded_status(heartbeat, age_seconds)
        if status is not None:
            if status == 'ok':
                cache.delete(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY)
            return {
                'status': status,
                'last_run_at': recorded_at.isoformat(),
                'age_seconds': age_seconds,
                'timeout_seconds': HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS,
            }

    return _hasena_unknown_payload(local_now, window_start)


def _reminder_unknown_status(now):
    unknown_since = cache.get_or_set(REMINDER_UNKNOWN_SINCE_CACHE_KEY, now, timeout=None)
    unknown_age_seconds = max(0, int((now - unknown_since).total_seconds()))
    status = 'unknown' if unknown_age_seconds <= REMINDER_UNKNOWN_GRACE_SECONDS else 'missing'
    return {
        'status': status,
        'last_run_at': None,
        'unknown_since': unknown_since.isoformat(),
        'unknown_age_seconds': unknown_age_seconds,
        'grace_seconds': REMINDER_UNKNOWN_GRACE_SECONDS,
    }


def _reminder_recorded_at(heartbeat):
    if isinstance(heartbeat, Mapping):
        recorded_at = heartbeat.get('recorded_at')
        return recorded_at if isinstance(recorded_at, datetime) else None
    if isinstance(heartbeat, datetime):
        return heartbeat
    return None


def _reminder_recorded_status(heartbeat, age_seconds):
    if age_seconds > REMINDER_DEADMAN_TIMEOUT_SECONDS:
        return 'stale'
    if isinstance(heartbeat, Mapping):
        status = heartbeat.get('status')
        if status == 'success':
            return 'ok'
        if status == 'error':
            return 'error'
        return None
    return 'ok'


def _reminder_heartbeat_status(now):
    heartbeat = cache.get(REMINDER_HEARTBEAT_CACHE_KEY)
    recorded_at = _reminder_recorded_at(heartbeat)
    if recorded_at is None:
        return _reminder_unknown_status(now)

    age_seconds = max(0, int((now - recorded_at).total_seconds()))
    status = _reminder_recorded_status(heartbeat, age_seconds)
    if status is None:
        return _reminder_unknown_status(now)

    if status == 'ok':
        cache.delete(REMINDER_UNKNOWN_SINCE_CACHE_KEY)
    return {
        'status': status,
        'last_run_at': recorded_at.isoformat(),
        'age_seconds': age_seconds,
        'timeout_seconds': REMINDER_DEADMAN_TIMEOUT_SECONDS,
    }


@require_GET
def health(request):
    db_ok, db_exc = _database_ok()
    status_code = 200 if db_ok else 503
    payload = {
        'status': 'ok' if db_ok else 'degraded',
        'checks': {
            'database': _database_check_payload(db_ok, db_exc, 'health'),
        },
    }
    return JsonResponse(payload, status=status_code)


def _safe_heartbeat_status(status_fn, now, check):
    try:
        return status_fn(now)
    except Exception as exc:
        # Single emission point: Django/Sentry LoggingIntegration captures this ERROR log.
        logger.error(
            'Readiness heartbeat cache check failed (check=%s)', check, exc_info=exc
        )
        return {'status': 'error'}


def _web_push_delivery_status(db_ok):
    if is_web_push_configured():
        return {'status': 'ok', 'configured': True}
    if not db_ok:
        return {'status': 'unknown', 'configured': False}
    active_subscriptions = NotificationPushSubscription.objects.filter(enabled=True).exists()
    if not active_subscriptions:
        return {'status': 'inactive', 'configured': False, 'active_subscriptions': False}
    return {'status': 'error', 'configured': False, 'active_subscriptions': True}


def _safe_web_push_delivery_status(db_ok):
    try:
        return _web_push_delivery_status(db_ok)
    except Exception as exc:
        # Single emission point: Django/Sentry LoggingIntegration captures this ERROR log.
        logger.error('Readiness Web Push delivery check failed', exc_info=exc)
        return {'status': 'error', 'configured': False, 'reason': 'subscription_probe_unavailable'}


@require_GET
def readiness(request):
    now = timezone.now()
    db_ok, db_exc = _database_ok()
    reminder_status = _safe_heartbeat_status(
        _reminder_heartbeat_status, now, 'send_due_notification_reminders'
    )
    hasena_status = _safe_heartbeat_status(
        _hasena_summary_heartbeat_status, now, 'generate_hasena_summary'
    )
    web_push_status = _safe_web_push_delivery_status(db_ok)
    ready = (
        db_ok
        and reminder_status['status'] in {'ok', 'unknown'}
        and hasena_status['status'] in {'ok', 'unknown', 'not_scheduled'}
        and web_push_status['status'] in {'ok', 'inactive'}
    )
    payload = {
        'status': 'ok' if ready else 'degraded',
        'checks': {
            'database': _database_check_payload(db_ok, db_exc, 'readiness'),
            'send_due_notification_reminders': reminder_status,
            'generate_hasena_summary': hasena_status,
            'web_push_delivery': web_push_status,
        },
    }
    return JsonResponse(payload, status=200 if ready else 503)

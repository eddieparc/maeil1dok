"""Recording and aggregation for auth-migration metrics.

Split by who calls it:

- `record_auth_event` runs on the request path. It writes one outbox row and
  never raises -- a metrics failure must not turn a login into a 5xx.
- `aggregate_pending` runs in the worker. It folds outbox rows into counters
  idempotently, so a retried task or an early-acked redelivery cannot inflate a
  counter that a release gate reads.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone

from .models import (
    AgeBucket,
    AuthEventOutbox,
    AuthMetricCounter,
    AuthMethod,
    EventKind,
    Outcome,
    RouteBucket,
)

logger = logging.getLogger(__name__)

# Retention: the plan requires at least 21 days of history, so cleanup deletes
# rows strictly older than this. 22 keeps a full day of slack over that floor.
RETENTION_DAYS = 22

_ROUTE_PREFIXES = (
    ('/api/v1/auth/user/', RouteBucket.AUTH_USER),
    ('/api/v1/accounts/user/', RouteBucket.AUTH_USER),
    ('/api/v1/auth/verify/', RouteBucket.AUTH_USER),
    ('/api/v1/accounts/verify/', RouteBucket.AUTH_USER),
    ('/api/v1/auth/token/refresh/', RouteBucket.AUTH_REFRESH),
    ('/api/v1/accounts/token/refresh/', RouteBucket.AUTH_REFRESH),
    ('/api/v1/auth/refresh/', RouteBucket.AUTH_REFRESH),
    ('/api/v1/accounts/refresh/', RouteBucket.AUTH_REFRESH),
    ('/api/v1/auth/logout', RouteBucket.AUTH_LOGOUT),
    ('/api/v1/accounts/logout', RouteBucket.AUTH_LOGOUT),
    ('/api/v1/auth/token/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/accounts/token/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/auth/login/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/accounts/login/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/auth/social-login', RouteBucket.AUTH_LOGIN),
    ('/api/v1/accounts/social-login', RouteBucket.AUTH_LOGIN),
    ('/api/v1/auth/email-login/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/accounts/email-login/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/auth/session/', RouteBucket.AUTH_LOGIN),
    ('/api/v1/accounts/session/', RouteBucket.AUTH_LOGIN),
)

# 30 days, the north-star predicate boundary.
_AGE_BOUNDARY_SECONDS = 2592000


def to_utc_naive(moment: datetime) -> datetime:
    """Normalise any datetime to naive UTC.

    This project runs `USE_TZ = False` with `TIME_ZONE = 'Asia/Seoul'`, so ORM
    datetimes are naive *local* time, while the plan fixes the counter's `hour`
    dimension to UTC. Bucketing a naive KST value as if it were UTC would shift
    every rolling window by nine hours -- the rollback rule would compare the
    wrong six hours against the baseline.

    Naive input is therefore interpreted in `settings.TIME_ZONE` (Django's own
    convention when `USE_TZ` is off) and converted; aware input is converted
    directly. The return value is naive UTC so it can be stored on either
    backend, since SQLite refuses aware datetimes while `USE_TZ` is False.
    """
    if timezone.is_naive(moment):
        moment = moment.replace(tzinfo=ZoneInfo(settings.TIME_ZONE))
    return moment.astimezone(dt_timezone.utc).replace(tzinfo=None)


def utc_now_naive() -> datetime:
    return to_utc_naive(timezone.now())


def route_bucket_for(path: str) -> str:
    """Map a request path onto the normalised route enum.

    Longest-prefix wins so that `/token/refresh/` is not swallowed by `/token/`.
    """
    if not path:
        return RouteBucket.OTHER
    best = RouteBucket.OTHER
    best_len = -1
    for prefix, bucket in _ROUTE_PREFIXES:
        if path.startswith(prefix) and len(prefix) > best_len:
            best, best_len = bucket, len(prefix)
    return best


def age_bucket_for(age_seconds) -> str:
    """Bucket a refresh-token age. Anything untrustworthy becomes `unknown`."""
    if age_seconds is None:
        return AgeBucket.UNKNOWN
    try:
        age = float(age_seconds)
    except (TypeError, ValueError):
        return AgeBucket.UNKNOWN
    if age < 0:
        return AgeBucket.UNKNOWN
    return AgeBucket.LT_30D if age < _AGE_BOUNDARY_SECONDS else AgeBucket.GTE_30D


def record_auth_event(
    *,
    event: str,
    method: str,
    outcome: str,
    status: int,
    route: str = '',
    cause: str = '',
    age_seconds=None,
    client: str = '',
    occurred_at=None,
    event_key: str | None = None,
) -> str | None:
    """Persist one event for later aggregation. Never raises.

    Returns the event key, or None if recording failed. Callers on the request
    path ignore the result; the return value exists for tests and for the
    idempotency checks in the worker.
    """
    key = event_key or uuid.uuid4().hex
    try:
        # Wrapped in its own atomic block: a duplicate key raises IntegrityError,
        # and without a savepoint that failure would poison the caller's
        # transaction -- turning a swallowed metrics error into a broken auth
        # request, which is exactly what this function exists to prevent.
        with transaction.atomic():
            AuthEventOutbox.objects.create(
                event_key=key,
                occurred_at=to_utc_naive(occurred_at) if occurred_at else utc_now_naive(),
                event=event,
                method=method,
                outcome=outcome,
                status=status,
                route_bucket=route_bucket_for(route),
                cause=cause or '',
                age_bucket=age_bucket_for(age_seconds),
                client=client or '',
            )
    except Exception:  # noqa: BLE001 - a metrics sink must never alter a response
        # Deliberately broad. A duplicate key means the event is already recorded,
        # which is the desired end state. Anything else is a metrics-side failure,
        # and this function is called from auth rejection paths that have already
        # decided their status code -- letting an exception escape would turn a 401
        # into a 500, which is strictly worse for the user than losing one counter.
        #
        # `DatabaseError` alone is not enough: connection-level guards raise types
        # outside that hierarchy (Django's test harness does exactly this), and in
        # production a pool exhaustion or a mis-set search path would too.
        logger.warning('auth metrics outbox write failed', exc_info=True)
        return None
    return key


def aggregate_pending(limit: int = 1000) -> int:
    """Fold unprocessed outbox rows into counters. Returns rows folded.

    Idempotent twice over: rows are claimed by stamping `processed_at` inside the
    same transaction that bumps the counter, and a row already stamped is never
    selected again.
    """
    folded = 0
    pending = list(
        AuthEventOutbox.objects.filter(processed_at__isnull=True)
        .order_by('occurred_at', 'id')
        .values_list('id', flat=True)[:limit]
    )
    for row_id in pending:
        with transaction.atomic():
            row = (
                AuthEventOutbox.objects.select_for_update()
                .filter(id=row_id, processed_at__isnull=True)
                .first()
            )
            if row is None:
                continue
            moment = row.occurred_at
            counter, created = AuthMetricCounter.objects.get_or_create(
                day=moment.date(),
                hour=moment.hour,
                event=row.event,
                method=row.method,
                outcome=row.outcome,
                status=row.status,
                route_bucket=row.route_bucket,
                cause=row.cause,
                age_bucket=row.age_bucket,
                client=row.client,
                defaults={'count': 1},
            )
            if not created:
                AuthMetricCounter.objects.filter(pk=counter.pk).update(
                    count=F('count') + 1
                )
            row.processed_at = utc_now_naive()
            row.save(update_fields=['processed_at'])
            folded += 1
    return folded


def purge_expired(now=None) -> int:
    """Delete counters older than the retention floor, keeping pinned rows.

    Returns the number of counter rows deleted. Processed outbox rows are pruned
    on the same schedule; unprocessed rows are never dropped, because losing them
    would lose events the gates depend on.
    """
    now = to_utc_naive(now) if now else utc_now_naive()
    cutoff = (now - timedelta(days=RETENTION_DAYS)).date()
    deleted, _ = AuthMetricCounter.objects.filter(
        day__lt=cutoff, pinned=False
    ).delete()
    AuthEventOutbox.objects.filter(
        processed_at__isnull=False, occurred_at__date__lt=cutoff
    ).delete()
    return deleted


def rolling_window_total(*, start, hours=6, **filters) -> int:
    """Sum counters over `hours` consecutive hours starting at `start` (UTC).

    Spans midnight correctly: the window is expressed as an explicit list of
    `(day, hour)` pairs rather than an hour range, because an hour range alone
    cannot cross a day boundary.
    """
    slot_filter = Q()
    start = to_utc_naive(start)
    for offset in range(hours):
        moment = start + timedelta(hours=offset)
        slot_filter |= Q(day=moment.date(), hour=moment.hour)
    aggregate = AuthMetricCounter.objects.filter(slot_filter, **filters).aggregate(
        total=Sum('count')
    )
    return aggregate['total'] or 0


def daily_total(*, day, **filters) -> int:
    """Sum a whole UTC day, i.e. its 24 hour buckets."""
    aggregate = AuthMetricCounter.objects.filter(day=day, **filters).aggregate(
        total=Sum('count')
    )
    return aggregate['total'] or 0


__all__ = [
    'AgeBucket',
    'AuthMethod',
    'EventKind',
    'Outcome',
    'RouteBucket',
    'RETENTION_DAYS',
    'aggregate_pending',
    'age_bucket_for',
    'daily_total',
    'purge_expired',
    'record_auth_event',
    'rolling_window_total',
    'route_bucket_for',
]

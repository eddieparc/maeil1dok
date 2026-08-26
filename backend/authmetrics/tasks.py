"""Celery entry points for auth-metric aggregation and retention.

The request path only writes to the outbox; everything expensive happens here.
Both tasks are safe to run concurrently with themselves -- aggregation claims
rows row-by-row under `select_for_update`, and retention is a bounded delete.
"""

from celery import shared_task

from .recording import aggregate_pending, purge_expired


@shared_task(name='authmetrics.aggregate_auth_events')
def aggregate_auth_events_task(limit: int = 1000) -> int:
    return aggregate_pending(limit=limit)


@shared_task(name='authmetrics.purge_expired_auth_metrics')
def purge_expired_auth_metrics_task() -> int:
    return purge_expired()

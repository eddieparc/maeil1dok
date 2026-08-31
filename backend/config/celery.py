import os
import logging.config

from celery import Celery
from celery.schedules import crontab
from celery.signals import before_task_publish, setup_logging, task_postrun, task_prerun
from django.conf import settings

from config.logging_config import (
    bind_correlation_context,
    current_correlation_context,
    reset_correlation_context,
)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@setup_logging.connect
def configure_celery_logging(**_kwargs):
    logging.config.dictConfig(settings.LOGGING)


@before_task_publish.connect
def publish_correlation_headers(headers=None, **_kwargs):
    if headers is None:
        return
    request_id, trace_id = current_correlation_context()
    if request_id:
        headers.setdefault('request_id', request_id)
    if trace_id:
        headers.setdefault('trace_id', trace_id)


@task_prerun.connect
def bind_task_correlation(task_id=None, task=None, **_kwargs):
    if task is None:
        return
    headers = getattr(task.request, 'headers', None) or {}
    tokens = bind_correlation_context(
        request_id=headers.get('request_id', ''),
        trace_id=headers.get('trace_id', ''),
        task_id=task_id or '',
    )
    task.request._logging_context_tokens = tokens


@task_postrun.connect
def clear_task_correlation(task=None, **_kwargs):
    if task is None:
        return
    tokens = getattr(task.request, '_logging_context_tokens', None)
    if tokens is not None:
        reset_correlation_context(tokens)
        del task.request._logging_context_tokens

app.conf.beat_schedule = {
    'generate-hasena-summary': {
        'task': 'todos.tasks.generate_hasena_summary_task',
        'schedule': crontab(minute='*/5', hour='0-5', day_of_week='1-6'),
    },
    'send-due-notification-reminders': {
        'task': 'todos.tasks.send_due_notification_reminders_task',
        'schedule': crontab(minute='*/5'),
    },
    # Auth-migration metrics: the request path only writes to a durable outbox, so
    # something has to fold it into counters. Frequent and cheap, because a
    # rollback decision reads these counters within hours of a deploy.
    'aggregate-auth-metrics': {
        'task': 'authmetrics.aggregate_auth_events',
        'schedule': crontab(minute='*/2'),
    },
    'purge-auth-metrics': {
        'task': 'authmetrics.purge_expired_auth_metrics',
        'schedule': crontab(minute=17, hour=4),
    },
}

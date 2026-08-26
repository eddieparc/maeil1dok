import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

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

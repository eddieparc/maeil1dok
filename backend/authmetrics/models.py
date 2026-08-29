"""Durable storage for the Part A auth-migration metrics.

Container logs rotate at roughly 30MB per container (`docker-compose.oci.yml`
`json-file`, max-size 10m x max-file 3). A rollback decision that compares a
7-day pre-deploy baseline against post-deploy windows cannot rely on that: a
traffic bump silently discards the baseline it was going to be judged against.

Two tables, deliberately separate:

`AuthEventOutbox`
    Durable landing spot written on the request path. The aggregation worker
    consumes it. Writing here first is what makes the pipeline lossless -- if
    the broker or worker is down, rows accumulate and are folded in on recovery.
    `event_key` is unique, which is what makes aggregation idempotent: a retried
    or redelivered task cannot double-count.

`AuthMetricCounter`
    The aggregate the release gates actually query. Grain is
    `(day, hour, event, method, outcome, status, route_bucket, cause, age_bucket)`.

Why `hour` and not a coarser bucket: the rollback rule evaluates rolling 6-hour
windows. A fixed 6-hour bucket cannot reconstruct an arbitrary 6-hour window --
joining two adjacent buckets spans 12 hours, and the intra-bucket distribution
needed for a boundary-crossing window is not retained anywhere. At hour grain a
rolling 6-hour window is the sum of 6 adjacent hours and a daily value is the
sum of 24, so both the rollback query and the baseline query hold.

Cardinality stays bounded because every other dimension is a finite enum.
"""

from django.db import models


class RouteBucket(models.TextChoices):
    """Normalised route grouping. Free-form paths would explode cardinality."""

    AUTH_USER = 'auth_user'
    AUTH_REFRESH = 'auth_refresh'
    AUTH_LOGIN = 'auth_login'
    AUTH_LOGOUT = 'auth_logout'
    OTHER = 'other'


class AuthMethod(models.TextChoices):
    """How the request authenticated.

    Deliberately not `session`: Part A does not introduce a server-side session,
    and labelling the cookie path that way would claim a capability that does not
    exist yet.
    """

    COOKIE_ACCESS_JWT = 'cookie-access-jwt'
    HEADER_ACCESS_JWT = 'header-access-jwt'
    REFRESH_REDEMPTION = 'refresh-redemption'
    HANDOFF_CODE = 'handoff-code'
    NONE = 'none'


class AgeBucket(models.TextChoices):
    """Refresh-token age, bucketed for the north-star `< 30 days` predicate.

    `UNKNOWN` covers tokens with no trustworthy issue time (malformed, missing
    `iat`), which must not be silently folded into either real bucket.
    """

    LT_30D = 'lt_30d'
    GTE_30D = 'gte_30d'
    UNKNOWN = 'unknown'


class EventKind(models.TextChoices):
    AUTH = 'auth'
    LOGIN = 'login'
    REFRESH_401 = 'refresh_401'


class Outcome(models.TextChoices):
    SUCCESS = 'success'
    FAIL = 'fail'


class AuthEventOutbox(models.Model):
    """One recorded event awaiting aggregation.

    Written synchronously on the request path, drained by a Celery task. The row
    is the durability guarantee; the broker is only a wake-up signal.
    """

    event_key = models.CharField(
        max_length=64,
        unique=True,
        help_text='Idempotency key. A redelivered event with the same key is ignored.',
    )
    occurred_at = models.DateTimeField(db_index=True)
    event = models.CharField(max_length=16, choices=EventKind.choices)
    method = models.CharField(max_length=24, choices=AuthMethod.choices)
    outcome = models.CharField(max_length=8, choices=Outcome.choices)
    status = models.PositiveSmallIntegerField()
    route_bucket = models.CharField(max_length=16, choices=RouteBucket.choices)
    cause = models.CharField(max_length=32, blank=True, default='')
    age_bucket = models.CharField(
        max_length=8, choices=AgeBucket.choices, default=AgeBucket.UNKNOWN
    )
    client = models.CharField(max_length=32, blank=True, default='')
    processed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['processed_at', 'occurred_at']),
        ]
        verbose_name = '인증 이벤트 아웃박스'
        verbose_name_plural = '인증 이벤트 아웃박스'

    def __str__(self):
        return f'{self.event}/{self.method}@{self.occurred_at:%Y-%m-%dT%H}'


# The counter grain. Named here rather than inside the model because Meta cannot
# see class-body attributes of its own model.
COUNTER_GRAIN_FIELDS = (
    'day',
    'hour',
    'event',
    'method',
    'outcome',
    'status',
    'route_bucket',
    'cause',
    'age_bucket',
    # `client` belongs to the grain, not just the outbox. The cohort size the
    # release gates read is asked days later, by which time the outbox rows have
    # been drained and purged -- an outbox-only dimension cannot answer it. It was
    # also actively lossy: two clients folded into a single counter row.
    'client',
)


class AuthMetricCounter(models.Model):
    """Aggregated counts at `(day, hour, ...)` grain.

    `pinned` protects a window from the retention job. F5 compares a pre-deploy
    week against the following two weeks, which outlives the 22-day cleanup, so
    the evidence has to be holdable without a separate snapshot table.
    """

    day = models.DateField(db_index=True)
    hour = models.PositiveSmallIntegerField(help_text='UTC hour bucket, 0..23.')
    event = models.CharField(max_length=16, choices=EventKind.choices)
    method = models.CharField(max_length=24, choices=AuthMethod.choices)
    outcome = models.CharField(max_length=8, choices=Outcome.choices)
    status = models.PositiveSmallIntegerField()
    route_bucket = models.CharField(max_length=16, choices=RouteBucket.choices)
    cause = models.CharField(max_length=32, blank=True, default='')
    age_bucket = models.CharField(max_length=8, choices=AgeBucket.choices)
    client = models.CharField(max_length=32, blank=True, default='')
    count = models.PositiveIntegerField(default=0)
    pinned = models.BooleanField(
        default=False,
        help_text='Excluded from retention cleanup while true.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    GRAIN_FIELDS = COUNTER_GRAIN_FIELDS

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=COUNTER_GRAIN_FIELDS,
                name='authmetrics_counter_grain_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['day', 'hour']),
            models.Index(fields=['event', 'day']),
        ]
        verbose_name = '인증 지표 카운터'
        verbose_name_plural = '인증 지표 카운터'

    def __str__(self):
        return f'{self.day} {self.hour:02d}h {self.event}/{self.method}={self.count}'

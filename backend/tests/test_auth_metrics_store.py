"""The metric store must survive log rotation, worker outages, and redelivery.

These counters are the only evidence the Part A rollback decision has. Three
properties therefore have to hold, and each is asserted here rather than assumed:

- **Grain** — all nine dimensions are recorded, hour buckets split correctly, a
  day is the sum of its 24 hours, and a rolling 6-hour window is the sum of 6
  adjacent hours *including across UTC midnight*. A window query that silently
  stops at midnight would under-report exactly when a night-time deploy is being
  judged.
- **Losslessness and idempotency** — events written while the worker is down are
  folded in on recovery, and reprocessing the same event does not double-count.
  Without the first, a release gate reads a number that quietly lost rows; without
  the second, a retry inflates the numerator and a healthy deploy reads as a
  regression.
- **Retention** — rows past the floor are deleted, pinned rows are not, and
  unprocessed events are never dropped.
"""

from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from authmetrics.models import (
    AgeBucket,
    AuthEventOutbox,
    AuthMetricCounter,
    AuthMethod,
    EventKind,
    Outcome,
    RouteBucket,
)
from authmetrics.recording import (
    to_utc_naive,
    RETENTION_DAYS,
    age_bucket_for,
    aggregate_pending,
    daily_total,
    purge_expired,
    record_auth_event,
    rolling_window_total,
    route_bucket_for,
)


def utc(year, month, day, hour, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=dt_timezone.utc)


class RouteBucketMappingTest(TestCase):
    def test_refresh_is_not_swallowed_by_the_login_prefix(self):
        """`/token/refresh/` must not fall into the `/token/` login bucket.

        Longest-prefix wins. If this regressed, refresh traffic would be counted
        as logins and the 401-rate denominator would be wrong.
        """
        self.assertEqual(
            route_bucket_for('/api/v1/auth/token/refresh/'), RouteBucket.AUTH_REFRESH
        )
        self.assertEqual(route_bucket_for('/api/v1/auth/token/'), RouteBucket.AUTH_LOGIN)

    def test_both_url_prefixes_map_to_the_same_bucket(self):
        """The `/accounts/` compatibility alias must not create a separate cohort."""
        for suffix, expected in (
            ('user/', RouteBucket.AUTH_USER),
            ('refresh/', RouteBucket.AUTH_REFRESH),
            ('logout/', RouteBucket.AUTH_LOGOUT),
        ):
            with self.subTest(suffix=suffix):
                self.assertEqual(
                    route_bucket_for(f'/api/v1/auth/{suffix}'),
                    route_bucket_for(f'/api/v1/accounts/{suffix}'),
                )
                self.assertEqual(route_bucket_for(f'/api/v1/auth/{suffix}'), expected)

    def test_unrelated_paths_fall_into_other(self):
        self.assertEqual(route_bucket_for('/api/v1/todos/reading/'), RouteBucket.OTHER)
        self.assertEqual(route_bucket_for(''), RouteBucket.OTHER)


class AgeBucketMappingTest(TestCase):
    def test_thirty_day_boundary_is_exclusive_below(self):
        self.assertEqual(age_bucket_for(2592000 - 1), AgeBucket.LT_30D)
        self.assertEqual(age_bucket_for(2592000), AgeBucket.GTE_30D)

    def test_untrustworthy_ages_are_unknown_not_guessed(self):
        """A missing or malformed issue time must not be assumed young.

        Counting it as `lt_30d` would put tokens of unknown age into the
        north-star numerator.
        """
        for value in (None, 'malformed', -1, object()):
            with self.subTest(value=value):
                self.assertEqual(age_bucket_for(value), AgeBucket.UNKNOWN)


class GrainRecordingTest(TestCase):
    def test_all_nine_grain_dimensions_are_persisted(self):
        record_auth_event(
            event=EventKind.REFRESH_401,
            method=AuthMethod.REFRESH_REDEMPTION,
            outcome=Outcome.FAIL,
            status=401,
            route='/api/v1/auth/token/refresh/',
            cause='blacklisted',
            age_seconds=100,
            occurred_at=utc(2026, 8, 20, 13),
        )
        self.assertEqual(aggregate_pending(), 1)

        counter = AuthMetricCounter.objects.get()
        self.assertEqual(
            {
                'day': counter.day,
                'hour': counter.hour,
                'event': counter.event,
                'method': counter.method,
                'outcome': counter.outcome,
                'status': counter.status,
                'route_bucket': counter.route_bucket,
                'cause': counter.cause,
                'age_bucket': counter.age_bucket,
            },
            {
                'day': date(2026, 8, 20),
                'hour': 13,
                'event': EventKind.REFRESH_401,
                'method': AuthMethod.REFRESH_REDEMPTION,
                'outcome': Outcome.FAIL,
                'status': 401,
                'route_bucket': RouteBucket.AUTH_REFRESH,
                'cause': 'blacklisted',
                'age_bucket': AgeBucket.LT_30D,
            },
        )
        self.assertEqual(counter.count, 1)

    def test_same_day_different_hours_split_into_separate_buckets(self):
        for hour in (1, 1, 5):
            record_auth_event(
                event=EventKind.AUTH,
                method=AuthMethod.COOKIE_ACCESS_JWT,
                outcome=Outcome.SUCCESS,
                status=200,
                route='/api/v1/auth/user/',
                occurred_at=utc(2026, 8, 20, hour),
            )
        aggregate_pending()

        buckets = dict(
            AuthMetricCounter.objects.values_list('hour', 'count').order_by('hour')
        )
        self.assertEqual(buckets, {1: 2, 5: 1})

    def test_daily_value_is_the_sum_of_its_twenty_four_hours(self):
        for hour in range(24):
            record_auth_event(
                event=EventKind.AUTH,
                method=AuthMethod.COOKIE_ACCESS_JWT,
                outcome=Outcome.SUCCESS,
                status=200,
                route='/api/v1/auth/user/',
                occurred_at=utc(2026, 8, 20, hour),
            )
        aggregate_pending()

        self.assertEqual(AuthMetricCounter.objects.count(), 24)
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 24)


class RollingWindowTest(TestCase):
    """The rollback rule reads rolling 6-hour windows off the hour grain."""

    def _seed(self, moments):
        for moment in moments:
            record_auth_event(
                event=EventKind.AUTH,
                method=AuthMethod.COOKIE_ACCESS_JWT,
                outcome=Outcome.SUCCESS,
                status=200,
                route='/api/v1/auth/user/',
                occurred_at=moment,
            )
        aggregate_pending()

    def test_window_is_the_sum_of_six_adjacent_hours(self):
        self._seed([utc(2026, 8, 20, hour) for hour in range(6, 12)])
        self.assertEqual(rolling_window_total(start=utc(2026, 8, 20, 6)), 6)

    def test_window_excludes_hours_outside_it(self):
        self._seed([utc(2026, 8, 20, hour) for hour in (5, 6, 7, 12)])
        self.assertEqual(rolling_window_total(start=utc(2026, 8, 20, 6)), 2)

    def test_window_crossing_utc_midnight_reads_both_days(self):
        """A 22:00 window is 22h+23h of one day plus 00h-03h of the next.

        Hour alone cannot express this; the query has to carry the day. A
        regression here would silently halve a night-time window.
        """
        self._seed(
            [utc(2026, 8, 20, 22), utc(2026, 8, 20, 23)]
            + [utc(2026, 8, 21, hour) for hour in (0, 1, 2, 3)]
        )
        self.assertEqual(rolling_window_total(start=utc(2026, 8, 20, 22)), 6)
        # The hour after the window must not be included.
        self._seed([utc(2026, 8, 21, 4)])
        self.assertEqual(rolling_window_total(start=utc(2026, 8, 20, 22)), 6)

    def test_window_can_filter_by_grain_dimension(self):
        self._seed([utc(2026, 8, 20, 6)])
        record_auth_event(
            event=EventKind.REFRESH_401,
            method=AuthMethod.REFRESH_REDEMPTION,
            outcome=Outcome.FAIL,
            status=401,
            route='/api/v1/auth/token/refresh/',
            cause='blacklisted',
            occurred_at=utc(2026, 8, 20, 7),
        )
        aggregate_pending()

        self.assertEqual(
            rolling_window_total(start=utc(2026, 8, 20, 6), status=401), 1
        )
        self.assertEqual(
            rolling_window_total(start=utc(2026, 8, 20, 6), status=200), 1
        )

    def test_empty_window_is_zero_not_none(self):
        self.assertEqual(rolling_window_total(start=utc(2026, 8, 20, 6)), 0)
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 0)


class LosslessnessAndIdempotencyTest(TestCase):
    """Events written while the worker is down, and events redelivered to it."""

    def test_events_recorded_while_the_worker_is_down_are_folded_on_recovery(self):
        keys = [
            record_auth_event(
                event=EventKind.LOGIN,
                method=AuthMethod.NONE,
                outcome=Outcome.SUCCESS,
                status=200,
                route='/api/v1/auth/token/',
                occurred_at=utc(2026, 8, 20, 9),
            )
            for _ in range(5)
        ]
        self.assertTrue(all(keys))
        # Nothing aggregated yet: this is the "worker is down" state.
        self.assertEqual(AuthMetricCounter.objects.count(), 0)
        self.assertEqual(
            AuthEventOutbox.objects.filter(processed_at__isnull=True).count(), 5
        )

        self.assertEqual(aggregate_pending(), 5)
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 5)
        self.assertFalse(
            AuthEventOutbox.objects.filter(processed_at__isnull=True).exists()
        )

    def test_reaggregating_does_not_double_count(self):
        record_auth_event(
            event=EventKind.LOGIN,
            method=AuthMethod.NONE,
            outcome=Outcome.SUCCESS,
            status=200,
            route='/api/v1/auth/token/',
            occurred_at=utc(2026, 8, 20, 9),
        )
        self.assertEqual(aggregate_pending(), 1)
        self.assertEqual(aggregate_pending(), 0)
        self.assertEqual(aggregate_pending(), 0)
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 1)

    def test_redelivering_the_same_event_key_does_not_create_a_second_row(self):
        """Two writes with one key must leave one event, not two.

        This is the guard against an at-least-once producer inflating the count.
        """
        shared = 'redelivered-event-key'
        first = record_auth_event(
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route='/api/v1/auth/user/',
            occurred_at=utc(2026, 8, 20, 9),
            event_key=shared,
        )
        second = record_auth_event(
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route='/api/v1/auth/user/',
            occurred_at=utc(2026, 8, 20, 9),
            event_key=shared,
        )
        self.assertEqual(first, shared)
        self.assertIsNone(second, 'duplicate key must be rejected, not stored again')
        self.assertEqual(AuthEventOutbox.objects.count(), 1)

        aggregate_pending()
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 1)

    def test_partial_drain_leaves_the_rest_pending(self):
        for index in range(4):
            record_auth_event(
                event=EventKind.AUTH,
                method=AuthMethod.COOKIE_ACCESS_JWT,
                outcome=Outcome.SUCCESS,
                status=200,
                route='/api/v1/auth/user/',
                occurred_at=utc(2026, 8, 20, 9 + index),
            )
        self.assertEqual(aggregate_pending(limit=2), 2)
        self.assertEqual(
            AuthEventOutbox.objects.filter(processed_at__isnull=True).count(), 2
        )
        self.assertEqual(aggregate_pending(), 2)
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 4)


class RetentionTest(TestCase):
    def _counter(self, day, *, pinned=False, count=1):
        return AuthMetricCounter.objects.create(
            day=day,
            hour=3,
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route_bucket=RouteBucket.AUTH_USER,
            cause='',
            age_bucket=AgeBucket.UNKNOWN,
            count=count,
            pinned=pinned,
        )

    def test_cleanup_deletes_beyond_the_floor_and_keeps_recent(self):
        # Dates are derived in UTC because the counter's `day` dimension is UTC.
        # Deriving them from local naive time would put the boundary case one day
        # off whenever the local date differs from the UTC date.
        now = timezone.now()
        reference = to_utc_naive(now)
        old = (reference - timedelta(days=RETENTION_DAYS + 1)).date()
        recent = (reference - timedelta(days=20)).date()
        self._counter(old)
        self._counter(recent)

        self.assertEqual(purge_expired(now=now), 1)
        self.assertEqual(
            list(AuthMetricCounter.objects.values_list('day', flat=True)), [recent]
        )

    def test_pinned_rows_survive_cleanup_and_are_deleted_once_unpinned(self):
        """F5 needs a window to outlive retention without a snapshot table."""
        now = timezone.now()
        old = (to_utc_naive(now) - timedelta(days=RETENTION_DAYS + 5)).date()
        self._counter(old, pinned=True)

        self.assertEqual(purge_expired(now=now), 0)
        self.assertTrue(AuthMetricCounter.objects.filter(day=old).exists())

        AuthMetricCounter.objects.filter(day=old).update(pinned=False)
        self.assertEqual(purge_expired(now=now), 1)
        self.assertFalse(AuthMetricCounter.objects.filter(day=old).exists())

    def test_unprocessed_events_are_never_dropped_by_cleanup(self):
        """Dropping them would lose events the release gates still need."""
        now = timezone.now()
        stale = now - timedelta(days=RETENTION_DAYS + 3)
        record_auth_event(
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route='/api/v1/auth/user/',
            occurred_at=stale,
        )
        purge_expired(now=now)
        self.assertEqual(
            AuthEventOutbox.objects.filter(processed_at__isnull=True).count(), 1
        )

    def test_processed_events_past_the_floor_are_pruned(self):
        now = timezone.now()
        stale = now - timedelta(days=RETENTION_DAYS + 3)
        record_auth_event(
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route='/api/v1/auth/user/',
            occurred_at=stale,
        )
        aggregate_pending()
        purge_expired(now=now)
        self.assertEqual(AuthEventOutbox.objects.count(), 0)


class ManagementCommandTest(TestCase):
    def test_pin_command_marks_a_range_and_unpins_it(self):
        AuthMetricCounter.objects.create(
            day=date(2026, 8, 20),
            hour=1,
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route_bucket=RouteBucket.AUTH_USER,
            cause='',
            age_bucket=AgeBucket.UNKNOWN,
            count=1,
        )
        call_command('pin_auth_metrics', '--from', '2026-08-19', '--to', '2026-08-21')
        self.assertTrue(AuthMetricCounter.objects.get().pinned)

        call_command(
            'pin_auth_metrics', '--from', '2026-08-19', '--to', '2026-08-21', '--unpin'
        )
        self.assertFalse(AuthMetricCounter.objects.get().pinned)

    def test_aggregate_command_drains_the_outbox(self):
        record_auth_event(
            event=EventKind.AUTH,
            method=AuthMethod.COOKIE_ACCESS_JWT,
            outcome=Outcome.SUCCESS,
            status=200,
            route='/api/v1/auth/user/',
            occurred_at=utc(2026, 8, 20, 9),
        )
        call_command('aggregate_auth_metrics')
        self.assertEqual(daily_total(day=date(2026, 8, 20)), 1)

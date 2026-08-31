from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from config.observability import (
    HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS,
    HASENA_SUMMARY_HEARTBEAT_CACHE_KEY,
    HASENA_SUMMARY_UNKNOWN_GRACE_SECONDS,
    HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY,
    REMINDER_DEADMAN_TIMEOUT_SECONDS,
    REMINDER_HEARTBEAT_CACHE_KEY,
    REMINDER_UNKNOWN_GRACE_SECONDS,
    REMINDER_UNKNOWN_SINCE_CACHE_KEY,
    parse_sample_rate,
)
from todos.tasks import send_due_notification_reminders_task
from accounts.models import User
from todos.models import NotificationPushSubscription


@override_settings(ROOT_URLCONF='config.test_urls')
class HealthEndpointTest(TestCase):
    def setUp(self):
        cache.delete(REMINDER_HEARTBEAT_CACHE_KEY)
        cache.delete(REMINDER_UNKNOWN_SINCE_CACHE_KEY)
        cache.delete(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)
        cache.delete(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY)

    def _readiness_at(self, now):
        with patch('config.health_views.timezone.now', return_value=now):
            return self.client.get('/ready/')

    def _set_fresh_reminder(self, now):
        cache.set(REMINDER_HEARTBEAT_CACHE_KEY, now, timeout=None)

    def _create_push_subscription(self, enabled=True):
        seq = getattr(self, '_push_subscription_seq', 0) + 1
        self._push_subscription_seq = seq
        subscriber = User.objects.create_user(
            username=f'push-user-{seq}',
            nickname=f'푸시독자{seq}',
        )
        return NotificationPushSubscription.objects.create(
            user=subscriber,
            endpoint=f'https://push.example.com/endpoint-{seq}',
            p256dh=f'p256dh-secret-{seq}',
            auth=f'auth-secret-{seq}',
            enabled=enabled,
        )

    def test_health_reports_database_ok(self):
        response = self.client.get('/health/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['database']['status'], 'ok')

    def test_readiness_reports_unknown_reminder_heartbeat_as_ready(self):
        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 200)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'unknown')
        self.assertIsNotNone(reminder['unknown_since'])
        self.assertGreaterEqual(reminder['unknown_age_seconds'], 0)
        self.assertEqual(reminder['grace_seconds'], REMINDER_UNKNOWN_GRACE_SECONDS)

    def test_readiness_first_unknown_observation_stamps_grace_marker(self):
        self.assertIsNone(cache.get(REMINDER_UNKNOWN_SINCE_CACHE_KEY))

        first = self.client.get('/ready/')

        self.assertEqual(first.status_code, 200)
        self.assertIsNotNone(cache.get(REMINDER_UNKNOWN_SINCE_CACHE_KEY))
        first_unknown_since = first.json()['checks']['send_due_notification_reminders']['unknown_since']

        second = self.client.get('/ready/')

        self.assertEqual(second.status_code, 200)
        second_unknown_since = second.json()['checks']['send_due_notification_reminders']['unknown_since']
        self.assertEqual(second_unknown_since, first_unknown_since)

    def test_readiness_fails_when_heartbeat_missing_beyond_grace(self):
        stale_marker = timezone.now() - timedelta(seconds=REMINDER_UNKNOWN_GRACE_SECONDS + 1)
        cache.set(REMINDER_UNKNOWN_SINCE_CACHE_KEY, stale_marker, timeout=None)
        cache.delete(REMINDER_HEARTBEAT_CACHE_KEY)

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 503)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'missing')
        self.assertGreaterEqual(reminder['unknown_age_seconds'], reminder['grace_seconds'])

    def test_heartbeat_recovery_clears_unknown_marker(self):
        expired_marker = timezone.now() - timedelta(seconds=REMINDER_UNKNOWN_GRACE_SECONDS + 1)
        cache.set(REMINDER_UNKNOWN_SINCE_CACHE_KEY, expired_marker, timeout=None)
        cache.set(REMINDER_HEARTBEAT_CACHE_KEY, timezone.now(), timeout=None)

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['checks']['send_due_notification_reminders']['status'],
            'ok',
        )
        self.assertIsNone(cache.get(REMINDER_UNKNOWN_SINCE_CACHE_KEY))

    def test_readiness_fails_when_reminder_heartbeat_is_stale(self):
        stale_at = timezone.now() - timedelta(seconds=REMINDER_DEADMAN_TIMEOUT_SECONDS + 1)
        cache.set(REMINDER_HEARTBEAT_CACHE_KEY, stale_at, timeout=None)

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 503)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'stale')
        self.assertGreaterEqual(reminder['age_seconds'], REMINDER_DEADMAN_TIMEOUT_SECONDS)

    def test_readiness_accepts_structured_success_heartbeat(self):
        cache.set(
            REMINDER_HEARTBEAT_CACHE_KEY,
            {'recorded_at': timezone.now(), 'status': 'success'},
            timeout=None,
        )

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 200)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'ok')
        self.assertIsNotNone(reminder['last_run_at'])

    def test_readiness_fails_when_structured_heartbeat_reports_error(self):
        cache.set(
            REMINDER_HEARTBEAT_CACHE_KEY,
            {'recorded_at': timezone.now(), 'status': 'error'},
            timeout=None,
        )

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 503)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'error')

    def test_readiness_error_heartbeat_does_not_expose_failure_details(self):
        cache.set(
            REMINDER_HEARTBEAT_CACHE_KEY,
            {'recorded_at': timezone.now(), 'status': 'error', 'reason': 'boom secret'},
            timeout=None,
        )

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 503)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertNotIn('reason', reminder)
        self.assertNotIn('boom secret', response.content.decode())
        self.assertEqual(
            set(reminder.keys()),
            {'status', 'last_run_at', 'age_seconds', 'timeout_seconds'},
        )

    def test_readiness_accepts_legacy_bare_datetime_heartbeat(self):
        cache.set(REMINDER_HEARTBEAT_CACHE_KEY, timezone.now(), timeout=None)

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 200)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'ok')

    def test_readiness_fails_when_structured_heartbeat_is_stale(self):
        stale_at = timezone.now() - timedelta(seconds=REMINDER_DEADMAN_TIMEOUT_SECONDS + 1)
        cache.set(
            REMINDER_HEARTBEAT_CACHE_KEY,
            {'recorded_at': stale_at, 'status': 'success'},
            timeout=None,
        )

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 503)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'stale')

    def test_readiness_uses_grace_for_malformed_structured_heartbeat(self):
        cache.set(
            REMINDER_HEARTBEAT_CACHE_KEY,
            {'recorded_at': 'bad', 'status': 'success'},
            timeout=None,
        )

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 200)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'unknown')

    def test_readiness_uses_grace_for_unrecognized_structured_status(self):
        cache.set(
            REMINDER_HEARTBEAT_CACHE_KEY,
            {'recorded_at': timezone.now(), 'status': 'weird'},
            timeout=None,
        )

        response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 200)
        reminder = response.json()['checks']['send_due_notification_reminders']
        self.assertEqual(reminder['status'], 'unknown')

    def test_hasena_readiness_outside_window_is_not_scheduled_and_ready(self):
        now = datetime(2026, 7, 6, 6, 0, 0)
        self._set_fresh_reminder(now)
        cache.set(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY, datetime(2026, 7, 6, 0, 0, 0), timeout=None)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'not_scheduled')
        self.assertIsNone(cache.get(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY))

    def test_hasena_readiness_sunday_early_window_is_not_scheduled(self):
        now = datetime(2026, 7, 12, 0, 30, 0)
        self._set_fresh_reminder(now)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'not_scheduled')

    def test_hasena_readiness_monday_to_saturday_early_window_is_scheduled(self):
        now = datetime(2026, 7, 6, 0, 0, 0)
        self._set_fresh_reminder(now)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'unknown')
        self.assertIsNotNone(cache.get(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY))

    def test_hasena_readiness_first_missing_current_window_heartbeat_is_unknown(self):
        now = datetime(2026, 7, 7, 0, 5, 0)
        self._set_fresh_reminder(now)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'unknown')
        self.assertEqual(hasena['unknown_since'], now.isoformat())
        self.assertEqual(cache.get(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY), now)

    def test_hasena_readiness_missing_current_window_heartbeat_beyond_grace_fails(self):
        now = datetime(2026, 7, 7, 0, 20, 0)
        unknown_since = now - timedelta(seconds=HASENA_SUMMARY_UNKNOWN_GRACE_SECONDS + 1)
        self._set_fresh_reminder(now)
        cache.set(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY, unknown_since, timeout=None)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'missing')
        self.assertGreaterEqual(hasena['unknown_age_seconds'], hasena['grace_seconds'])

    def test_hasena_readiness_resets_stale_unknown_marker_for_new_window(self):
        now = datetime(2026, 7, 7, 0, 0, 0)
        self._set_fresh_reminder(now)
        cache.set(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY, datetime(2026, 7, 6, 0, 30, 0), timeout=None)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'unknown')
        self.assertEqual(hasena['unknown_since'], now.isoformat())
        self.assertEqual(cache.get(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY), now)

    def test_hasena_readiness_previous_window_heartbeat_opens_as_unknown_not_stale(self):
        now = datetime(2026, 7, 7, 0, 0, 0)
        self._set_fresh_reminder(now)
        cache.set(
            HASENA_SUMMARY_HEARTBEAT_CACHE_KEY,
            {'recorded_at': datetime(2026, 7, 6, 5, 59, 0), 'status': 'success'},
            timeout=None,
        )

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'unknown')

    def test_hasena_readiness_malformed_heartbeat_uses_current_window_unknown(self):
        now = datetime(2026, 7, 7, 0, 1, 0)
        self._set_fresh_reminder(now)
        cache.set(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY, {'recorded_at': 'bad'}, timeout=None)

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'unknown')

    def test_hasena_readiness_current_window_stale_heartbeat_fails(self):
        now = datetime(2026, 7, 7, 0, 20, 0)
        self._set_fresh_reminder(now)
        cache.set(
            HASENA_SUMMARY_HEARTBEAT_CACHE_KEY,
            {'recorded_at': now - timedelta(seconds=HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS + 1), 'status': 'success'},
            timeout=None,
        )

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'stale')
        self.assertGreaterEqual(hasena['age_seconds'], HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS)

    def test_hasena_readiness_fresh_current_window_heartbeat_clears_unknown_marker(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        cache.set(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY, datetime(2026, 7, 7, 0, 0, 0), timeout=None)
        cache.set(
            HASENA_SUMMARY_HEARTBEAT_CACHE_KEY,
            {'recorded_at': now - timedelta(minutes=5), 'status': 'success'},
            timeout=None,
        )

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'ok')
        self.assertIsNone(cache.get(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY))

    def _set_fresh_hasena_heartbeat(self, now, **extra):
        heartbeat = {'recorded_at': now - timedelta(minutes=5)}
        heartbeat.update(extra)
        cache.set(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY, heartbeat, timeout=None)

    def test_hasena_readiness_fresh_failed_heartbeat_fails(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='failed', reason='no_video', error='boom')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'failed')
        self.assertNotIn('reason', hasena)
        self.assertNotIn('error', hasena)
        self.assertNotIn('video_id', hasena)

    def test_hasena_readiness_fresh_error_heartbeat_fails(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='error', error='kaboom')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'error')
        self.assertNotIn('error', hasena)

    def test_hasena_readiness_fresh_pending_heartbeat_fails(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='pending')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        hasena = response.json()['checks']['generate_hasena_summary']
        self.assertEqual(hasena['status'], 'pending')

    def test_hasena_readiness_fresh_success_heartbeat_is_ready(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='success')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'ok')

    def test_hasena_readiness_benign_skip_already_generated_is_ready(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='skipped', reason='already_generated')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'ok')

    def test_hasena_readiness_benign_skip_summary_exists_is_ready(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='skipped', reason='summary_exists')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'ok')

    def test_hasena_readiness_unknown_status_heartbeat_uses_unknown_path(self):
        now = datetime(2026, 7, 7, 0, 10, 0)
        self._set_fresh_reminder(now)
        self._set_fresh_hasena_heartbeat(now, status='mystery')

        response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['generate_hasena_summary']['status'], 'unknown')

    _WEB_PUSH_NOW = datetime(2026, 7, 6, 6, 0, 0)
    _COMPLETE_VAPID = {
        'WEB_PUSH_VAPID_PUBLIC_KEY': 'vapid-public-value',
        'WEB_PUSH_VAPID_PRIVATE_KEY': 'vapid-private-value',
        'WEB_PUSH_VAPID_SUBJECT': 'mailto:admin@maeil1dok.app',
    }
    _INCOMPLETE_VAPID = {
        'WEB_PUSH_VAPID_PUBLIC_KEY': 'vapid-public-value',
        'WEB_PUSH_VAPID_PRIVATE_KEY': '',
        'WEB_PUSH_VAPID_SUBJECT': 'mailto:admin@maeil1dok.app',
    }

    def test_web_push_readiness_ok_when_config_complete(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)
        self._create_push_subscription(enabled=True)

        with override_settings(**self._COMPLETE_VAPID):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['checks']['web_push_delivery'],
            {'status': 'ok', 'configured': True},
        )

    def test_web_push_readiness_inactive_without_active_subscriptions(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)

        with override_settings(**self._INCOMPLETE_VAPID):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['checks']['web_push_delivery'],
            {'status': 'inactive', 'configured': False, 'active_subscriptions': False},
        )

    def test_web_push_readiness_degraded_when_incomplete_with_active_subscription(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)
        self._create_push_subscription(enabled=True)

        with override_settings(**self._INCOMPLETE_VAPID):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body['status'], 'degraded')
        self.assertEqual(body['checks']['web_push_delivery']['status'], 'error')

    def test_web_push_degraded_payload_is_sanitized(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)
        subscription = self._create_push_subscription(enabled=True)

        with override_settings(**self._INCOMPLETE_VAPID):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        web_push = response.json()['checks']['web_push_delivery']
        self.assertEqual(
            set(web_push.keys()),
            {'status', 'configured', 'active_subscriptions'},
        )
        # Check the parsed JSON values, not raw bytes. A raw substring search finds
        # short numeric ids inside unrelated numbers -- `str(subscription.id) == '20'`
        # matches the '20' in a "2026-..." timestamp, so the assertion failed for a
        # leak that never happened once the id sequence reached two digits. Which
        # ids a test sees depends on how many rows earlier tests created, so this
        # was order-dependent and passed in isolation.
        leaked = self._collect_scalars(response.json())
        for secret in (
            self._INCOMPLETE_VAPID['WEB_PUSH_VAPID_PUBLIC_KEY'],
            self._COMPLETE_VAPID['WEB_PUSH_VAPID_PRIVATE_KEY'],
            self._INCOMPLETE_VAPID['WEB_PUSH_VAPID_SUBJECT'],
            subscription.endpoint,
            subscription.p256dh,
            subscription.auth,
            subscription.user_id,
            subscription.id,
        ):
            self.assertNotIn(self._tagged(secret), leaked)

    @staticmethod
    def _tagged(value):
        """Pair a value with its type name so bool and int stay distinguishable.

        Python treats `True == 1`, so an id of 1 would otherwise "match" the
        `configured: false` / `active_subscriptions: true` booleans this payload
        legitimately contains.
        """
        return type(value).__name__, value

    @classmethod
    def _collect_scalars(cls, payload):
        """Every scalar value and key in a JSON payload, tagged with its type.

        Secrets leak as whole values or keys, never as a fragment spliced across
        two unrelated fields, so comparing against discrete scalars is both
        stricter about real leaks and immune to coincidental digit overlap.
        """
        found = set()
        stack = [payload]
        while stack:
            item = stack.pop()
            if isinstance(item, dict):
                found.update(cls._tagged(key) for key in item)
                stack.extend(item.values())
            elif isinstance(item, list):
                stack.extend(item)
            else:
                found.add(cls._tagged(item))
        return found

    def test_web_push_disabled_subscriptions_do_not_fail_readiness(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)
        self._create_push_subscription(enabled=False)

        with override_settings(**self._INCOMPLETE_VAPID):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['checks']['web_push_delivery'],
            {'status': 'inactive', 'configured': False, 'active_subscriptions': False},
        )

    def test_web_push_status_unknown_when_database_probe_fails(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)
        mock_conn = Mock()
        mock_conn.cursor.side_effect = Exception('db down')
        subscription_manager = Mock()

        with (
            override_settings(**self._INCOMPLETE_VAPID),
            patch('config.health_views.connections', new={'default': mock_conn}),
            patch(
                'config.health_views.NotificationPushSubscription.objects',
                new=subscription_manager,
            ),
        ):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body['checks']['web_push_delivery'], {'status': 'unknown', 'configured': False})
        self.assertEqual(body['checks']['database']['status'], 'error')
        subscription_manager.filter.assert_not_called()

    def test_web_push_subscription_probe_failure_is_sanitized(self):
        now = self._WEB_PUSH_NOW
        self._set_fresh_reminder(now)
        canary = 'todos_notificationpushsubscription on mysql.internal:3306 read timeout'

        with (
            override_settings(**self._INCOMPLETE_VAPID),
            patch(
                'config.health_views.NotificationPushSubscription.objects.filter',
                side_effect=Exception(canary),
            ),
            self.assertLogs('config.health_views', level='ERROR') as logs,
        ):
            response = self._readiness_at(now)

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body['status'], 'degraded')
        self.assertEqual(body['checks']['database']['status'], 'ok')
        self.assertEqual(
            body['checks']['web_push_delivery'],
            {'status': 'error', 'configured': False, 'reason': 'subscription_probe_unavailable'},
        )
        self.assertNotIn(canary, response.content.decode())
        self.assertEqual(len(logs.records), 1)
        record = logs.records[0]
        self.assertEqual(record.getMessage(), 'Readiness Web Push delivery check failed')
        self.assertIn(canary, self._format_log_record(record))

    @staticmethod
    def _format_log_record(record):
        import logging

        return logging.Formatter().format(record)


@override_settings(ROOT_URLCONF='config.test_urls')
class HealthEndpointDatabaseFailureTest(TestCase):
    def _failing_connections(self):
        mock_conn = Mock()
        mock_conn.cursor.side_effect = Exception(
            '(1045, "Access denied for user \'maeil1dok\'@\'10.2.3.4\'")'
        )
        return {'default': mock_conn}

    def assert_database_failure_is_sanitized(self, response):
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['checks']['database'], {'status': 'error'})
        self.assertNotIn(b'maeil1dok', response.content)
        self.assertNotIn(b'10.2.3.4', response.content)
        self.assertNotIn(b'Access denied', response.content)

    def test_health_hides_database_error_detail_and_logs_it(self):
        with (
            patch('config.health_views.connections', new=self._failing_connections()),
            self.assertLogs('config.health_views', level='ERROR') as captured,
        ):
            response = self.client.get('/health/')

        self.assert_database_failure_is_sanitized(response)
        self.assertEqual(len(captured.records), 1)
        self.assertIn('Health probe database check failed (probe=health)', captured.output[0])
        self.assertIn('maeil1dok', captured.output[0])
        self.assertIn('10.2.3.4', captured.output[0])

    def test_readiness_hides_database_error_detail_and_logs_it(self):
        with (
            patch('config.health_views.connections', new=self._failing_connections()),
            self.assertLogs('config.health_views', level='ERROR') as captured,
        ):
            response = self.client.get('/ready/')

        self.assert_database_failure_is_sanitized(response)
        self.assertEqual(len(captured.records), 1)
        self.assertIn('Health probe database check failed (probe=readiness)', captured.output[0])
        self.assertIn('maeil1dok', captured.output[0])
        self.assertIn('10.2.3.4', captured.output[0])

@override_settings(ROOT_URLCONF='config.test_urls')
class HealthEndpointCacheFailureTest(TestCase):
    def setUp(self):
        cache.delete(REMINDER_HEARTBEAT_CACHE_KEY)
        cache.delete(REMINDER_UNKNOWN_SINCE_CACHE_KEY)
        cache.delete(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)
        cache.delete(HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY)

    def _scheduled_now(self):
        # Monday 03:00 local time keeps the Hasena summary window active so its
        # heartbeat check also reaches the cache backend.
        naive = datetime(2026, 7, 13, 3, 0, 0)
        return timezone.make_aware(naive, timezone.get_current_timezone())

    def test_readiness_degrades_and_sanitizes_cache_backend_failure(self):
        secret_detail = 'redis://:s3cr3t@10.9.8.7:6379/internal-observability'
        failing_get = Mock(side_effect=Exception(secret_detail))
        with (
            patch('config.health_views.cache.get', new=failing_get),
            patch('config.health_views.timezone.now', return_value=self._scheduled_now()),
            self.assertLogs('config.health_views', level='ERROR') as captured,
        ):
            response = self.client.get('/ready/')

        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(body['status'], 'degraded')
        self.assertEqual(
            body['checks']['send_due_notification_reminders'], {'status': 'error'}
        )
        self.assertEqual(
            body['checks']['generate_hasena_summary'], {'status': 'error'}
        )

        self.assertNotIn(b's3cr3t', response.content)
        self.assertNotIn(b'10.9.8.7', response.content)
        self.assertNotIn(b'redis://', response.content)
        self.assertNotIn(b'internal-observability', response.content)

        self.assertEqual(len(captured.records), 2)
        joined = '\n'.join(captured.output)
        self.assertIn(
            'Readiness heartbeat cache check failed (check=send_due_notification_reminders)',
            joined,
        )
        self.assertIn(
            'Readiness heartbeat cache check failed (check=generate_hasena_summary)',
            joined,
        )
        self.assertIn(secret_detail, joined)


class SentryConfigTest(TestCase):
    def test_parse_sample_rate_rejects_invalid_values(self):
        self.assertEqual(parse_sample_rate('0.25'), 0.25)
        self.assertEqual(parse_sample_rate('not-a-number'), 0.0)
        self.assertEqual(parse_sample_rate('2'), 0.0)
        self.assertEqual(parse_sample_rate('-0.1'), 0.0)


class ReminderTaskObservabilityTest(TestCase):
    def test_reminder_task_records_heartbeat_without_success_sentry_noise(self):
        cache.delete(REMINDER_HEARTBEAT_CACHE_KEY)

        with (
            patch('todos.services.notifications.send_due_reminder_notifications', return_value=3),
            patch('todos.tasks.capture_observability_event') as capture_event,
        ):
            result = send_due_notification_reminders_task.run()

        self.assertEqual(result, {'status': 'success', 'created_count': 3})
        self.assertIsNotNone(cache.get(REMINDER_HEARTBEAT_CACHE_KEY))
        capture_event.assert_not_called()
        heartbeat = cache.get(REMINDER_HEARTBEAT_CACHE_KEY)
        self.assertEqual(heartbeat['status'], 'success')
        self.assertIsInstance(heartbeat['recorded_at'], datetime)
        self.assertEqual(set(heartbeat.keys()), {'recorded_at', 'status'})

    def test_reminder_task_records_failure_event_without_raising(self):
        with (
            patch('todos.services.notifications.send_due_reminder_notifications', side_effect=RuntimeError('boom')),
            patch('todos.tasks.capture_observability_event') as capture_event,
        ):
            result = send_due_notification_reminders_task.run()

        self.assertEqual(result, {'status': 'error', 'reason': 'boom'})
        self.assertIsNotNone(cache.get(REMINDER_HEARTBEAT_CACHE_KEY))
        self.assertEqual(capture_event.call_count, 1)
        self.assertEqual(capture_event.call_args.args[0], 'send_due_notification_reminders failed')
        self.assertEqual(capture_event.call_args.kwargs['level'], 'error')
        heartbeat = cache.get(REMINDER_HEARTBEAT_CACHE_KEY)
        self.assertEqual(heartbeat['status'], 'error')
        self.assertIsInstance(heartbeat['recorded_at'], datetime)
        self.assertNotIn('reason', heartbeat)
        self.assertEqual(set(heartbeat.keys()), {'recorded_at', 'status'})

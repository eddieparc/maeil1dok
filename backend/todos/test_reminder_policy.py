"""Contextual reminder policy: settings fields, batch eligibility, delivery gates.

Batch tests patch `todos.services.notifications.timezone.now` (the module's own
import) so the user's local clock is controlled. Delivery-gate tests patch
`todos.services.push_notifications.timezone.now` for the same reason. Streak
eligibility reuses the canonical streak semantics: completed schedule dates in
settings.TIME_ZONE, never the stored profile counter.
"""

import uuid
from hashlib import sha256
from datetime import date, datetime, time, timedelta
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    NativePushSubscription,
    NativePushReceipt,
    Notification,
    NotificationPushSubscription,
    NotificationSettings,
    PlanSubscription,
    UserBibleProgress,
)
from .services import notifications as notification_service
from .services import push_notifications
from .services.expo_push import EXPO_PUSH_URL
from .services.notifications import send_due_reminder_notifications
from .services.push_notifications import deliver_push_notification

User = get_user_model()

SEOUL = ZoneInfo('Asia/Seoul')
INSTALL = '44444444-4444-4444-8444-444444444444'
EXPO_TOKEN = 'ExponentPushToken[dddddddddddddddddddddd]'


def _user(username):
    return User.objects.create_user(
        username=username,
        nickname=username[:20],
        password='pw-test-1234',
        has_usable_password_flag=True,
    )


def _local_dt(day, hour, minute=0):
    return datetime(day.year, day.month, day.day, hour, minute)


def _db_time(local_dt):
    return local_dt


def _plan(owner, name='policy-plan'):
    return BibleReadingPlan.objects.create(
        name=name,
        description='',
        created_by=owner,
        is_active=True,
    )


def _schedule(plan, plan_date, book='창세기', start_chapter=1):
    return DailyBibleSchedule.objects.create(
        plan=plan,
        date=plan_date,
        book=book,
        start_chapter=start_chapter,
        end_chapter=start_chapter,
    )


def _subscription(user, plan, start_date):
    return PlanSubscription.objects.create(
        user=user,
        plan=plan,
        start_date=start_date,
        is_active=True,
    )


def _settings(user, **overrides):
    defaults = {
        'reading_reminders_enabled': True,
        'hasena_reminders_enabled': True,
        'streak_reminders_enabled': False,
        'reading_reminder_time': time(20, 0),
        'hasena_reminder_time': time(7, 0),
        'streak_reminder_time': time(21, 30),
    }
    defaults.update(overrides)
    return NotificationSettings.objects.create(user=user, **defaults)


def _patch_now(module, local_dt):
    return patch.object(
        module.timezone,
        'now',
        return_value=_db_time(local_dt),
    )


def _at_risk_streak_fixture(username, today, **settings_overrides):
    """User with a completed schedule yesterday and an open schedule today."""
    yesterday = today - timedelta(days=1)
    user = _user(username)
    plan = _plan(user, name=f'{username}-plan')
    subscription = _subscription(user, plan, yesterday)
    schedule_yesterday = _schedule(plan, yesterday)
    _schedule(plan, today)
    UserBibleProgress.objects.create(
        subscription=subscription,
        schedule=schedule_yesterday,
        is_completed=True,
        completed_at=_db_time(_local_dt(yesterday, 10, 0)),
    )
    settings_obj = _settings(user, **settings_overrides)
    return user, plan, subscription, settings_obj


@override_settings(ROOT_URLCONF='config.urls')
class NotificationSettingsFieldsTest(TestCase):
    URL = '/api/v1/todos/notifications/settings/'

    def setUp(self):
        self.user = _user('settings-owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_new_fields_have_contract_defaults(self):
        settings_obj = NotificationSettings.objects.create(user=self.user)

        self.assertIs(settings_obj.streak_reminders_enabled, False)
        self.assertEqual(settings_obj.streak_reminder_time, time(22, 0))
        self.assertEqual(settings_obj.reminder_weekdays, [0, 1, 2, 3, 4, 5, 6])
        self.assertIs(settings_obj.quiet_hours_enabled, False)
        self.assertEqual(settings_obj.quiet_hours_start, time(23, 0))
        self.assertEqual(settings_obj.quiet_hours_end, time(7, 0))
        self.assertIsNone(settings_obj.paused_until)
        self.assertEqual(settings_obj.daily_push_limit, 3)

    def test_get_settings_exposes_new_fields(self):
        NotificationSettings.objects.create(user=self.user)

        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 200, response.data)
        for field in (
            'streak_reminders_enabled',
            'streak_reminder_time',
            'reminder_weekdays',
            'quiet_hours_enabled',
            'quiet_hours_start',
            'quiet_hours_end',
            'paused_until',
            'daily_push_limit',
        ):
            self.assertIn(field, response.data['settings'], field)

    def test_patch_updates_new_fields(self):
        NotificationSettings.objects.create(user=self.user)

        response = self.client.patch(
            self.URL,
            {
                'streak_reminders_enabled': True,
                'streak_reminder_time': '22:15',
                'reminder_weekdays': [0, 2, 4],
                'quiet_hours_enabled': True,
                'quiet_hours_start': '23:00',
                'quiet_hours_end': '06:30',
                'daily_push_limit': 5,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        settings_obj = NotificationSettings.objects.get(user=self.user)
        self.assertTrue(settings_obj.streak_reminders_enabled)
        self.assertEqual(settings_obj.streak_reminder_time, time(22, 15))
        self.assertEqual(settings_obj.reminder_weekdays, [0, 2, 4])
        self.assertTrue(settings_obj.quiet_hours_enabled)
        self.assertEqual(settings_obj.quiet_hours_start, time(23, 0))
        self.assertEqual(settings_obj.quiet_hours_end, time(6, 30))
        self.assertEqual(settings_obj.daily_push_limit, 5)

    def test_reminder_weekdays_rejects_out_of_range_and_bad_types(self):
        NotificationSettings.objects.create(user=self.user)
        for bad in ([7], [-1], ['mon'], 'monday', 5, [True], ['1'], [1.0]):
            with self.subTest(value=bad):
                response = self.client.patch(
                    self.URL,
                    {'reminder_weekdays': bad},
                    format='json',
                )
                self.assertEqual(response.status_code, 400, response.data)

    def test_daily_push_limit_enforces_range(self):
        NotificationSettings.objects.create(user=self.user)
        for bad in (0, 11, -1):
            with self.subTest(value=bad):
                response = self.client.patch(
                    self.URL,
                    {'daily_push_limit': bad},
                    format='json',
                )
                self.assertEqual(response.status_code, 400, response.data)

    def test_quiet_hours_rejects_equal_start_and_end(self):
        NotificationSettings.objects.create(user=self.user)

        response = self.client.patch(
            self.URL,
            {
                'quiet_hours_enabled': True,
                'quiet_hours_start': '22:00',
                'quiet_hours_end': '22:00',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)

    def test_paused_until_accepts_iso_and_null(self):
        NotificationSettings.objects.create(user=self.user)

        response = self.client.patch(
            self.URL,
            {'paused_until': '2026-03-01T09:00:00+09:00'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        settings_obj = NotificationSettings.objects.get(user=self.user)
        self.assertIsNotNone(settings_obj.paused_until)

        response = self.client.patch(self.URL, {'paused_until': None}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(NotificationSettings.objects.get(user=self.user).paused_until)


class ReminderBatchPolicyTest(TestCase):
    def _run_batch(self, local_dt):
        with _patch_now(notification_service, local_dt):
            return send_due_reminder_notifications()

    def test_weekday_off_suppresses_reminder(self):
        today = date(2026, 3, 2)  # Monday (weekday 0)
        user = _user('weekday-off')
        plan = _plan(user)
        _schedule(plan, today)
        _subscription(user, plan, today)
        _settings(user, reminder_weekdays=[1, 2, 3, 4, 5, 6])

        created = self._run_batch(_local_dt(today, 20, 0))

        self.assertEqual(created, 0)
        self.assertFalse(Notification.objects.filter(recipient=user).exists())

    def test_weekday_on_allows_reminder(self):
        today = date(2026, 3, 2)
        user = _user('weekday-on')
        plan = _plan(user)
        _schedule(plan, today)
        _subscription(user, plan, today)
        _settings(user, reminder_weekdays=[0])

        created = self._run_batch(_local_dt(today, 20, 0))

        self.assertEqual(created, 1)

    def test_paused_until_suppresses_reminders(self):
        today = date(2026, 3, 2)
        user = _user('paused-user')
        plan = _plan(user)
        _schedule(plan, today)
        _subscription(user, plan, today)
        _settings(user, paused_until=_db_time(_local_dt(today, 23, 59)))

        created = self._run_batch(_local_dt(today, 20, 0))

        self.assertEqual(created, 0)

    def test_expired_pause_allows_reminders(self):
        today = date(2026, 3, 2)
        user = _user('unpaused-user')
        plan = _plan(user)
        _schedule(plan, today)
        _subscription(user, plan, today)
        _settings(user, paused_until=_db_time(_local_dt(today, 12, 0)))

        created = self._run_batch(_local_dt(today, 20, 0))

        self.assertEqual(created, 1)

    def test_streak_opt_in_required(self):
        today = date(2026, 3, 2)
        user, _plan_obj, _sub, _s = _at_risk_streak_fixture(
            'streak-optout', today, streak_reminders_enabled=False,
        )

        self._run_batch(_local_dt(today, 21, 30))

        self.assertFalse(
            Notification.objects.filter(recipient=user, type='streak_reminder').exists()
        )

    def test_streak_reminder_created_for_at_risk_streak(self):
        today = date(2026, 3, 2)
        user, _plan_obj, _sub, _s = _at_risk_streak_fixture(
            'streak-risk', today, streak_reminders_enabled=True,
            reading_reminders_enabled=False,
        )

        created = self._run_batch(_local_dt(today, 21, 30))

        self.assertEqual(created, 1)
        notification = Notification.objects.get(recipient=user)
        self.assertEqual(notification.type, 'streak_reminder')
        self.assertEqual(notification.dedupe_key, f'streak-reminder:{user.id}:{today}')
        self.assertEqual(notification.data.get('local_date'), today.isoformat())

    def test_streak_not_at_risk_when_any_completion_today(self):
        today = date(2026, 3, 2)
        user, plan, subscription, _s = _at_risk_streak_fixture(
            'streak-safe', today, streak_reminders_enabled=True,
            reading_reminders_enabled=False,
        )
        # Partial completion today: streak is alive, regular reminder covers the rest.
        schedule_today = DailyBibleSchedule.objects.get(plan=plan, date=today)
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule_today,
            is_completed=True,
            completed_at=_db_time(_local_dt(today, 9, 0)),
        )

        self._run_batch(_local_dt(today, 21, 30))

        self.assertFalse(
            Notification.objects.filter(recipient=user, type='streak_reminder').exists()
        )

    def test_no_streak_history_means_no_streak_reminder(self):
        today = date(2026, 3, 2)
        user = _user('streak-none')
        plan = _plan(user)
        _schedule(plan, today)
        _subscription(user, plan, today)
        _settings(user, streak_reminders_enabled=True, reading_reminders_enabled=False)

        created = self._run_batch(_local_dt(today, 21, 30))

        self.assertEqual(created, 0)

    def test_streak_reminder_suppressed_when_reading_reminder_due_same_slot(self):
        today = date(2026, 3, 2)
        user, _plan_obj, _sub, _s = _at_risk_streak_fixture(
            'streak-simul', today, streak_reminders_enabled=True,
            reading_reminder_time=time(21, 30),
            streak_reminder_time=time(21, 30),
        )

        self._run_batch(_local_dt(today, 21, 30))

        self._run_batch(_local_dt(today, 21, 31))
        types = set(
            Notification.objects.filter(recipient=user).values_list('type', flat=True)
        )
        self.assertEqual(types, {'reading_reminder'})

    def test_streak_reminder_dedupes_same_day(self):
        today = date(2026, 3, 2)
        user, _plan_obj, _sub, _s = _at_risk_streak_fixture(
            'streak-dedupe', today, streak_reminders_enabled=True,
            reading_reminders_enabled=False,
        )

        first = self._run_batch(_local_dt(today, 21, 30))
        second = self._run_batch(_local_dt(today, 21, 45))

        self.assertEqual(first, 1)
        self.assertEqual(second, 0)
        self.assertEqual(Notification.objects.filter(recipient=user).count(), 1)


class DeliveryGateTest(TestCase):
    """Delivery-time gates in deliver_push_notification."""

    def _notification(self, user, notification_type='reading_reminder', **data):
        return Notification.objects.create(
            recipient=user,
            type=notification_type,
            title='t',
            body='b',
            dedupe_key=f'dedupe:{uuid.uuid4()}',
            data=data,
        )

    def _web_subscription(self, user):
        return NotificationPushSubscription.objects.create(
            user=user,
            endpoint='https://fcm.googleapis.com/fcm/send/test-sub',
            p256dh='p256dh-key',
            auth='auth-key',
            enabled=True,
        )

    def _native_subscription(self, user):
        return NativePushSubscription.objects.create(
            user=user,
            token=EXPO_TOKEN,
            platform='ios',
            installation_id=uuid.UUID(INSTALL),
            enabled=True,
        )

    def _deliver(self, notification, local_dt):
        with _patch_now(push_notifications, local_dt):
            return deliver_push_notification(notification.id)

    def test_quiet_hours_skip_push_delivery(self):
        today = date(2026, 3, 2)
        user = _user('quiet-user')
        _settings(
            user,
            quiet_hours_enabled=True,
            quiet_hours_start=time(22, 0),
            quiet_hours_end=time(7, 0),
        )
        self._web_subscription(user)
        notification = self._notification(user)

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=True
        ), patch.object(push_notifications, '_send_web_push') as mock_send:
            result = self._deliver(notification, _local_dt(today, 23, 0))

        self.assertEqual(result['skipped'], 'quiet_hours')
        mock_send.assert_not_called()

    def test_quiet_hours_wraparound_morning(self):
        today = date(2026, 3, 2)
        user = _user('quiet-morning')
        _settings(
            user,
            quiet_hours_enabled=True,
            quiet_hours_start=time(22, 0),
            quiet_hours_end=time(7, 0),
        )
        self._web_subscription(user)
        notification = self._notification(user)

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=True
        ), patch.object(push_notifications, '_send_web_push') as mock_send:
            result = self._deliver(notification, _local_dt(today, 6, 30))

        self.assertEqual(result['skipped'], 'quiet_hours')
        mock_send.assert_not_called()

    def test_paused_until_skips_push_delivery(self):
        today = date(2026, 3, 2)
        user = _user('paused-delivery')
        _settings(user, paused_until=_db_time(_local_dt(today, 23, 59)))
        self._web_subscription(user)
        notification = self._notification(user)

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=True
        ), patch.object(push_notifications, '_send_web_push') as mock_send:
            result = self._deliver(notification, _local_dt(today, 20, 0))

        self.assertEqual(result['skipped'], 'paused')
        mock_send.assert_not_called()

    def test_daily_push_limit_blocks_overflow(self):
        today = date(2026, 3, 2)
        user = _user('cap-user')
        _settings(user, daily_push_limit=2)
        self._web_subscription(user)
        earlier = [self._notification(user, notification_type='system') for _ in range(2)]
        overflow = self._notification(user)
        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=True
        ), patch.object(push_notifications, '_send_web_push') as mock_send:
            for prior in earlier:
                self.assertEqual(self._deliver(prior, _local_dt(today, 9, 0))['sent'], 1)
            mock_send.reset_mock()
            result = self._deliver(overflow, _local_dt(today, 20, 0))

        self.assertEqual(result['skipped'], 'daily_limit')
        mock_send.assert_not_called()

    def test_stale_reminder_is_not_delivered_next_day(self):
        today = date(2026, 3, 2)
        user = _user('stale-user')
        _settings(user)
        self._web_subscription(user)
        notification = self._notification(
            user,
            local_date=(today - timedelta(days=1)).isoformat(),
        )

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=True
        ), patch.object(push_notifications, '_send_web_push') as mock_send:
            result = self._deliver(notification, _local_dt(today, 20, 0))

        self.assertEqual(result['skipped'], 'stale')
        mock_send.assert_not_called()

    def test_completed_reading_reminder_is_not_delivered(self):
        today = date(2026, 3, 2)
        user = _user('completed-user')
        _settings(user)
        self._web_subscription(user)
        plan = _plan(user)
        schedule = _schedule(plan, today)
        subscription = _subscription(user, plan, today)
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=_db_time(_local_dt(today, 19, 0)),
        )
        notification = self._notification(user, local_date=today.isoformat())

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=True
        ), patch.object(push_notifications, '_send_web_push') as mock_send:
            result = self._deliver(notification, _local_dt(today, 20, 0))

        self.assertEqual(result['skipped'], 'no_longer_relevant')
        mock_send.assert_not_called()

    def test_native_delivery_uses_expo_transport(self):
        today = date(2026, 3, 2)
        user = _user('native-delivery')
        _settings(user)
        subscription = self._native_subscription(user)
        notification = self._notification(user)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.json.return_value = {
            'data': [{'status': 'ok', 'id': 'ticket-123'}]
        }

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=False
        ), patch(
            'todos.services.expo_push.requests.post', return_value=fake_response
        ) as mock_post:
            result = self._deliver(notification, _local_dt(today, 20, 0))

        self.assertEqual(result['sent'], 1, result)
        mock_post.assert_called_once()
        call = mock_post.call_args
        self.assertEqual(call.args[0], EXPO_PUSH_URL)
        message = call.kwargs['json'][0]
        self.assertEqual(message['to'], EXPO_TOKEN)
        self.assertGreater(message['ttl'], 0)
        subscription.refresh_from_db()
        self.assertEqual(subscription.last_ticket_id, 'ticket-123')
        self.assertEqual(subscription.failure_count, 0)

    def test_native_device_not_registered_disables_subscription(self):
        today = date(2026, 3, 2)
        user = _user('native-dead')
        _settings(user)
        subscription = self._native_subscription(user)
        notification = self._notification(user)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.json.return_value = {
            'data': [{
                'status': 'error',
                'message': 'gone',
                'details': {'error': 'DeviceNotRegistered'},
            }]
        }

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=False
        ), patch('todos.services.expo_push.requests.post', return_value=fake_response):
            result = self._deliver(notification, _local_dt(today, 20, 0))

        self.assertEqual(result['sent'], 0)
        subscription.refresh_from_db()
        self.assertFalse(subscription.enabled)

    def test_native_transient_error_counts_failure(self):
        today = date(2026, 3, 2)
        user = _user('native-flaky')
        _settings(user)
        subscription = self._native_subscription(user)
        notification = self._notification(user)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.json.return_value = {
            'data': [{
                'status': 'error',
                'message': 'boom',
                'details': {'error': 'MessageTooBig'},
            }]
        }

        with patch.object(
            push_notifications, 'is_web_push_configured', return_value=False
        ), patch('todos.services.expo_push.requests.post', return_value=fake_response):
            result = self._deliver(notification, _local_dt(today, 20, 0))

        self.assertEqual(result['failed'], 1)
        subscription.refresh_from_db()
        self.assertTrue(subscription.enabled)
        self.assertEqual(subscription.failure_count, 1)


class ExpoReceiptTaskTest(TestCase):
    def _pending_receipt(self, subscription):
        notification = Notification.objects.create(
            recipient=subscription.user, type='system', title='fixture', body='fixture',
        )
        row = NativePushReceipt.objects.create(
            subscription=subscription, notification=notification,
            ticket_id=subscription.last_ticket_id,
            token_fingerprint=sha256(subscription.token.encode()).hexdigest(),
        )
        NativePushReceipt.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(minutes=16),
        )

    def test_device_not_registered_receipt_disables_subscription(self):
        from .tasks import check_expo_push_receipts_task

        user = _user('receipt-dead')
        subscription = NativePushSubscription.objects.create(
            user=user,
            token=EXPO_TOKEN,
            platform='ios',
            installation_id=uuid.UUID(INSTALL),
            enabled=True,
            last_ticket_id='ticket-dead',
        )
        self._pending_receipt(subscription)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.json.return_value = {
            'data': {
                'ticket-dead': {
                    'status': 'error',
                    'details': {'error': 'DeviceNotRegistered'},
                }
            }
        }

        with patch(
            'todos.services.expo_push.requests.post', return_value=fake_response
        ) as mock_post:
            result = check_expo_push_receipts_task()

        self.assertEqual(result['disabled'], 1)
        subscription.refresh_from_db()
        self.assertFalse(subscription.enabled)
        self.assertIsNone(subscription.last_ticket_id)
        call = mock_post.call_args
        self.assertIn('getReceipts', call.args[0])
        self.assertEqual(call.kwargs['json'], {'ids': ['ticket-dead']})

    def test_ok_receipt_clears_pending_ticket(self):
        from .tasks import check_expo_push_receipts_task

        user = _user('receipt-ok')
        subscription = NativePushSubscription.objects.create(
            user=user,
            token=EXPO_TOKEN,
            platform='android',
            installation_id=uuid.UUID(INSTALL),
            enabled=True,
            last_ticket_id='ticket-ok',
        )
        self._pending_receipt(subscription)

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.json.return_value = {'data': {'ticket-ok': {'status': 'ok'}}}

        with patch('todos.services.expo_push.requests.post', return_value=fake_response):
            result = check_expo_push_receipts_task()

        self.assertEqual(result['disabled'], 0)
        subscription.refresh_from_db()
        self.assertTrue(subscription.enabled)
        self.assertIsNone(subscription.last_ticket_id)

    def test_no_pending_tickets_is_noop(self):
        from .tasks import check_expo_push_receipts_task

        with patch('todos.services.expo_push.requests.post') as mock_post:
            result = check_expo_push_receipts_task()

        self.assertEqual(result['checked'], 0)
        mock_post.assert_not_called()

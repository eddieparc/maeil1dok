from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounts.models import Follow
from .notification_serializers import (
    NotificationPushSubscriptionSerializer,
    PushEndpointOwnershipConflict,
)
from .models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    HasenaRecord,
    Notification,
    NotificationPushSubscription,
    NotificationSettings,
    PlanSubscription,
    UserBibleProgress,
)
from .services.notifications import (
    _create_notification,
    _friend_recipients,
    _local_now,
    ensure_reminder_notifications,
    notify_friend_hasena_completed,
    notify_friend_reading_completed,
    send_due_reminder_notifications,
)
from .services.push_notifications import PushDeliveryError, deliver_push_notification

User = get_user_model()


@override_settings(ROOT_URLCONF='config.urls')
class NotificationApiTest(TransactionTestCase):
    INBOX_URL = '/api/v1/todos/notifications/'
    SETTINGS_URL = '/api/v1/todos/notifications/settings/'
    READING_URL = '/api/v1/todos/reading/update/'
    HASENA_URL = '/api/v1/todos/hasena/update/'

    def setUp(self):
        self.reader = User.objects.create_user(
            username='reader',
            nickname='말씀독자',
            password='pw-test-1234',
        )
        self.friend = User.objects.create_user(
            username='friend',
            nickname='동행친구',
            password='pw-test-1234',
        )
        Follow.objects.create(follower=self.reader, following=self.friend)
        Follow.objects.create(follower=self.friend, following=self.reader)
        self.plan = BibleReadingPlan.objects.create(name='1년 통독', created_by=self.reader)
        self.subscription = PlanSubscription.objects.create(
            user=self.friend,
            plan=self.plan,
            start_date=date.today() - timedelta(days=1),
            is_active=True,
        )
        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.plan,
            start_date=date.today() - timedelta(days=1),
            is_active=True,
        )
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date.today(),
            book='창세기',
            start_chapter=1,
            end_chapter=2,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.reader)

    def test_inbox_returns_reading_hasena_and_friend_notifications(self):
        NotificationSettings.objects.update_or_create(
            user=self.reader,
            defaults={
                'notifications_enabled': True,
                'reading_reminders_enabled': True,
                'hasena_reminders_enabled': True,
                'friend_activity_enabled': True,
                'reading_reminder_time': time(0, 0),
                'hasena_reminder_time': time(0, 0),
            },
        )
        HasenaRecord.objects.create(user=self.reader, date=date.today(), is_completed=False)

        friend_client = APIClient()
        friend_client.force_authenticate(user=self.friend)
        reading_response = friend_client.post(self.READING_URL, {
            'plan_id': self.plan.id,
            'schedule_ids': [self.schedule.id],
            'action': 'complete',
        }, format='json')
        self.assertEqual(reading_response.status_code, 200, reading_response.data)

        hasena_response = friend_client.post(self.HASENA_URL, {
            'date': date.today().isoformat(),
            'is_completed': True,
        }, format='json')
        self.assertEqual(hasena_response.status_code, 200, hasena_response.data)

        response = self.client.get(self.INBOX_URL)

        self.assertEqual(response.status_code, 200, response.data)
        notification_types = {
            item['type']
            for item in response.data['notifications']
        }
        self.assertIn('reading_reminder', notification_types)
        self.assertIn('hasena_reminder', notification_types)
        self.assertIn('friend_activity', notification_types)
        self.assertGreaterEqual(response.data['unread_count'], 3)

    def test_inbox_waits_until_configured_reminder_time(self):
        NotificationSettings.objects.update_or_create(
            user=self.reader,
            defaults={
                'notifications_enabled': True,
                'reading_reminders_enabled': True,
                'hasena_reminders_enabled': True,
                'friend_activity_enabled': True,
                'reading_reminder_time': time(20, 0),
                'hasena_reminder_time': time(7, 0),
                'timezone': 'Asia/Seoul',
            },
        )
        HasenaRecord.objects.create(user=self.reader, date=date.today(), is_completed=False)

        before_due = datetime.combine(date.today(), time(19, 59))
        with patch('todos.services.notifications._local_now', return_value=before_due):
            early_response = self.client.get(self.INBOX_URL)

        self.assertEqual(early_response.status_code, 200, early_response.data)
        self.assertNotIn('reading_reminder', {
            item['type']
            for item in early_response.data['notifications']
        })

        after_due = datetime.combine(date.today(), time(20, 0))
        with patch('todos.services.notifications._local_now', return_value=after_due):
            due_response = self.client.get(self.INBOX_URL)

        self.assertEqual(due_response.status_code, 200, due_response.data)
        self.assertIn('reading_reminder', {
            item['type']
            for item in due_response.data['notifications']
        })

    def test_inbox_sanitizes_unsafe_target_urls(self):
        for target_url in ['javascript:alert(1)', 'https://example.com/phish']:
            Notification.objects.create(
                recipient=self.reader,
                type='system',
                title='외부 링크',
                body='검증되지 않은 링크',
                target_url=target_url,
            )
        Notification.objects.create(
            recipient=self.reader,
            type='system',
            title='내부 링크',
            body='허용된 링크',
            target_url='/profile/123',
        )

        response = self.client.get(self.INBOX_URL)

        self.assertEqual(response.status_code, 200, response.data)
        urls_by_title = {
            item['title']: item['target_url']
            for item in response.data['notifications']
        }
        self.assertEqual(urls_by_title['외부 링크'], '/notifications')
        self.assertEqual(urls_by_title['내부 링크'], '/profile/123')


@override_settings(ROOT_URLCONF='config.urls')
class NotificationSettingsValidationTest(TestCase):
    SETTINGS_URL = '/api/v1/todos/notifications/settings/'

    def setUp(self):
        self.user = User.objects.create_user(
            username='settings-reader',
            nickname='설정독자',
            password='pw-test-1234',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_rejects_invalid_time_without_changing_settings(self):
        settings = NotificationSettings.objects.create(
            user=self.user,
            notifications_enabled=True,
            reading_reminders_enabled=True,
            hasena_reminders_enabled=True,
            friend_activity_enabled=True,
            reading_reminder_time=time(20, 0),
            hasena_reminder_time=time(7, 0),
        )

        response = self.client.patch(self.SETTINGS_URL, {
            'reading_reminder_time': '25:99',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        settings.refresh_from_db()
        self.assertEqual(settings.reading_reminder_time, time(20, 0))

    def test_rejects_invalid_timezone_without_changing_settings(self):
        settings = NotificationSettings.objects.create(
            user=self.user,
            notifications_enabled=True,
            timezone='Asia/Seoul',
        )

        response = self.client.patch(self.SETTINGS_URL, {
            'timezone': 'Not/AZone',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        settings.refresh_from_db()
        self.assertEqual(settings.timezone, 'Asia/Seoul')

    def test_rejects_malformed_timezone_values_with_400_not_500(self):
        # ZoneInfo raises ValueError (not ZoneInfoNotFoundError) for these keys;
        # the write path must still fail closed as a 400 without a 500.
        settings = NotificationSettings.objects.create(
            user=self.user,
            notifications_enabled=True,
            timezone='Asia/Seoul',
        )

        for bad_timezone in ['', '..', '/etc/passwd']:
            with self.subTest(timezone=bad_timezone):
                response = self.client.patch(self.SETTINGS_URL, {
                    'timezone': bad_timezone,
                }, format='json')

                self.assertEqual(response.status_code, 400, response.data)
                settings.refresh_from_db()
                self.assertEqual(settings.timezone, 'Asia/Seoul')


@override_settings(ROOT_URLCONF='config.urls')
class NotificationPushApiTest(TestCase):
    CONFIG_URL = '/api/v1/todos/notifications/push/config/'
    SUBSCRIPTIONS_URL = '/api/v1/todos/notifications/push/subscriptions/'
    REMOVE_URL = '/api/v1/todos/notifications/push/subscriptions/remove/'

    def setUp(self):
        self.user = User.objects.create_user(
            username='push-reader',
            nickname='푸시독자',
            password='pw-test-1234',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.payload = {
            'endpoint': 'https://updates.push.services.mozilla.com/wpush/v2/test-endpoint',
            'keys': {
                'p256dh': 'public-key',
                'auth': 'auth-secret',
            },
        }

    @override_settings(
        WEB_PUSH_VAPID_PUBLIC_KEY='public-vapid-key',
        WEB_PUSH_VAPID_PRIVATE_KEY='',
        WEB_PUSH_VAPID_SUBJECT='mailto:test@example.com',
    )
    def test_push_config_requires_full_vapid_configuration(self):
        response = self.client.get(self.CONFIG_URL)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['enabled'])
        self.assertEqual(response.data['vapid_public_key'], 'public-vapid-key')

    @override_settings(
        WEB_PUSH_VAPID_PUBLIC_KEY='public-vapid-key',
        WEB_PUSH_VAPID_PRIVATE_KEY='private-vapid-key',
        WEB_PUSH_VAPID_SUBJECT='mailto:test@example.com',
    )
    def test_push_config_reports_enabled_when_sender_is_ready(self):
        response = self.client.get(self.CONFIG_URL)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['enabled'])
        self.assertEqual(response.data['vapid_public_key'], 'public-vapid-key')

    def test_register_and_remove_push_subscription(self):
        response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            self.payload,
            format='json',
            HTTP_USER_AGENT='Maeil1DokTest/1.0',
        )

        self.assertEqual(response.status_code, 200, response.data)
        subscription = NotificationPushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.endpoint, self.payload['endpoint'])
        self.assertEqual(subscription.p256dh, 'public-key')
        self.assertTrue(subscription.enabled)
        self.assertEqual(subscription.user_agent, 'Maeil1DokTest/1.0')

        remove_response = self.client.post(
            self.REMOVE_URL,
            {'endpoint': self.payload['endpoint']},
            format='json',
        )

        self.assertEqual(remove_response.status_code, 200, remove_response.data)
        subscription.refresh_from_db()
        self.assertFalse(subscription.enabled)

    def test_register_updates_existing_endpoint_for_same_user(self):
        first_response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            self.payload,
            format='json',
        )

        second_response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': self.payload['endpoint'],
                'keys': {
                    'p256dh': 'rotated-public-key',
                    'auth': 'rotated-auth-secret',
                },
            },
            format='json',
        )

        self.assertEqual(first_response.status_code, 200, first_response.data)
        self.assertEqual(second_response.status_code, 200, second_response.data)
        subscription = NotificationPushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.p256dh, 'rotated-public-key')
        self.assertEqual(subscription.auth, 'rotated-auth-secret')
        self.assertEqual(
            NotificationPushSubscription.objects.filter(
                endpoint=self.payload['endpoint'],
            ).count(),
            1,
        )

    def test_register_accepts_max_length_push_keys(self):
        response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': self.payload['endpoint'],
                'keys': {
                    'p256dh': 'p' * 255,
                    'auth': 'a' * 255,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        subscription = NotificationPushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.p256dh, 'p' * 255)
        self.assertEqual(subscription.auth, 'a' * 255)

    def test_register_rejects_oversized_p256dh_key(self):
        response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': self.payload['endpoint'],
                'keys': {
                    'p256dh': 'p' * 256,
                    'auth': 'auth-secret',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(NotificationPushSubscription.objects.exists())

    def test_register_rejects_oversized_auth_key(self):
        response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': self.payload['endpoint'],
                'keys': {
                    'p256dh': 'public-key',
                    'auth': 'a' * 256,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(NotificationPushSubscription.objects.exists())

    def test_oversized_update_preserves_existing_subscription_keys(self):
        first_response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            self.payload,
            format='json',
        )
        self.assertEqual(first_response.status_code, 200, first_response.data)

        oversized_response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': self.payload['endpoint'],
                'keys': {
                    'p256dh': 'p' * 256,
                    'auth': 'auth-secret',
                },
            },
            format='json',
        )

        self.assertEqual(oversized_response.status_code, 400, oversized_response.data)
        subscription = NotificationPushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.p256dh, 'public-key')
        self.assertEqual(subscription.auth, 'auth-secret')

    def test_register_rejects_endpoint_owned_by_another_user(self):
        other_user = User.objects.create_user(
            username='push-reader-other',
            nickname='다른푸시독자',
            password='pw-test-1234',
        )
        first_response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            self.payload,
            format='json',
        )
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)

        second_response = other_client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': self.payload['endpoint'],
                'keys': {
                    'p256dh': 'attacker-public-key',
                    'auth': 'attacker-auth-secret',
                },
            },
            format='json',
        )

        self.assertEqual(first_response.status_code, 200, first_response.data)
        self.assertEqual(second_response.status_code, 409, second_response.data)
        subscription = NotificationPushSubscription.objects.get(
            endpoint=self.payload['endpoint'],
        )
        self.assertEqual(subscription.user, self.user)
        self.assertEqual(subscription.p256dh, 'public-key')
        self.assertEqual(subscription.auth, 'auth-secret')

    def test_duplicate_insert_race_updates_same_user_endpoint(self):
        NotificationPushSubscription.objects.create(
            user=self.user,
            endpoint=self.payload['endpoint'],
            p256dh='stale-public-key',
            auth='stale-auth-secret',
        )
        serializer = NotificationPushSubscriptionSerializer(data=self.payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with patch.object(
            serializer,
            '_create_or_update_locked',
            side_effect=IntegrityError('duplicate endpoint'),
        ):
            subscription = serializer.create_or_update(self.user)

        self.assertEqual(subscription.user, self.user)
        self.assertEqual(subscription.p256dh, 'public-key')
        self.assertEqual(subscription.auth, 'auth-secret')

    def test_duplicate_insert_race_rejects_other_user_endpoint(self):
        other_user = User.objects.create_user(
            username='push-race-other',
            nickname='다른경쟁독자',
            password='pw-test-1234',
        )
        NotificationPushSubscription.objects.create(
            user=other_user,
            endpoint=self.payload['endpoint'],
            p256dh='other-public-key',
            auth='other-auth-secret',
        )
        serializer = NotificationPushSubscriptionSerializer(data=self.payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with patch.object(
            serializer,
            '_create_or_update_locked',
            side_effect=IntegrityError('duplicate endpoint'),
        ):
            with self.assertRaises(PushEndpointOwnershipConflict):
                serializer.create_or_update(self.user)

        subscription = NotificationPushSubscription.objects.get(
            endpoint=self.payload['endpoint'],
        )
        self.assertEqual(subscription.user, other_user)
        self.assertEqual(subscription.p256dh, 'other-public-key')

    def test_register_rejects_insecure_endpoint(self):
        response = self.client.post(
            self.SUBSCRIPTIONS_URL,
            {
                'endpoint': 'http://example.test/push',
                'keys': self.payload['keys'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(NotificationPushSubscription.objects.exists())

    def test_register_rejects_non_push_service_endpoint(self):
        blocked_endpoints = [
            'https://127.0.0.1:8443/push',
            'https://example.com@127.0.0.1/push',
            'https://localhost/push',
            'https://10.0.0.1/push',
            'https://example.com/push',
            'https://fcm.googleapis.com:444/fcm/send/test',
        ]

        for endpoint in blocked_endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    self.SUBSCRIPTIONS_URL,
                    {
                        'endpoint': endpoint,
                        'keys': self.payload['keys'],
                    },
                    format='json',
                )

                self.assertEqual(response.status_code, 400)

        self.assertFalse(NotificationPushSubscription.objects.exists())

    def test_register_accepts_known_browser_push_service_endpoint(self):
        for endpoint in [
            'https://fcm.googleapis.com/fcm/send/test-endpoint',
            'https://web.push.apple.com/test-endpoint',
        ]:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    self.SUBSCRIPTIONS_URL,
                    {
                        'endpoint': endpoint,
                        'keys': self.payload['keys'],
                    },
                    format='json',
                )

                self.assertEqual(response.status_code, 200, response.data)
                NotificationPushSubscription.objects.filter(endpoint=endpoint).delete()


@override_settings(
    WEB_PUSH_VAPID_PUBLIC_KEY='public-vapid-key',
    WEB_PUSH_VAPID_PRIVATE_KEY='private-vapid-key',
    WEB_PUSH_VAPID_SUBJECT='mailto:test@example.com',
)
class NotificationPushDeliveryTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='delivery-reader',
            nickname='전송독자',
            password='pw-test-1234',
        )
        self.subscription = NotificationPushSubscription.objects.create(
            user=self.user,
            endpoint='https://updates.push.services.mozilla.com/wpush/v2/delivery-endpoint',
            p256dh='public-key',
            auth='auth-secret',
            enabled=True,
        )
        NotificationSettings.objects.create(user=self.user)
        self.notification = Notification.objects.create(
            recipient=self.user,
            type='reading_reminder',
            title='오늘의 통독이 기다리고 있어요',
            body='오늘 배정된 말씀을 읽고 흐름을 이어가볼까요?',
            target_url='/plan',
            dedupe_key='reading-reminder:test',
        )

    def test_deliver_push_notification_sends_web_push_payload(self):
        with (
            patch('todos.services.push_notifications._send_web_push') as send_web_push,
            patch('todos.services.push_notifications.capture_observability_event') as capture_event,
        ):
            result = deliver_push_notification(self.notification.id)

        self.assertEqual(result, {'sent': 1, 'failed': 0})
        send_web_push.assert_called_once()
        capture_event.assert_called_once()
        self.assertEqual(capture_event.call_args.kwargs['tags']['push_outcome'], 'accepted')
        subscription_info, payload = send_web_push.call_args.args
        self.assertEqual(subscription_info['endpoint'], self.subscription.endpoint)
        self.assertEqual(payload['title'], self.notification.title)
        self.assertEqual(payload['url'], '/plan')
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.failure_count, 0)
        self.assertIsNotNone(self.subscription.last_success_at)

    def test_deliver_push_notification_disables_expired_subscription(self):
        class Response:
            status_code = 410

        with (
            patch(
                'todos.services.push_notifications._send_web_push',
                side_effect=PushDeliveryError(response=Response()),
            ),
            patch('todos.services.push_notifications.capture_observability_event') as capture_event,
        ):
            result = deliver_push_notification(self.notification.id)

        self.assertEqual(result, {'sent': 0, 'failed': 1})
        self.assertEqual(capture_event.call_args.kwargs['tags']['push_outcome'], 'expired_subscription')
        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.enabled)
        self.assertEqual(self.subscription.failure_count, 1)
        self.assertIsNotNone(self.subscription.last_failure_at)

    def test_send_due_reminder_notifications_creates_due_reminders(self):
        plan = BibleReadingPlan.objects.create(name='푸시 통독', created_by=self.user)
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=plan,
            start_date=date.today(),
            is_active=True,
        )
        DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today(),
            book='창세기',
            start_chapter=3,
            end_chapter=3,
        )
        settings = self.user.notification_settings
        settings.reading_reminder_time = time(0, 0)
        settings.hasena_reminders_enabled = False
        settings.save()

        with patch('todos.services.push_notifications._send_web_push'):
            created_count = send_due_reminder_notifications()

        self.assertEqual(created_count, 1)
        self.assertTrue(Notification.objects.filter(
            recipient=self.user,
            type='reading_reminder',
            dedupe_key=f'reading-reminder:{self.user.id}:{date.today().isoformat()}',
        ).exists())
        self.assertEqual(subscription.progress.count(), 0)

    def test_batch_survives_malformed_persisted_timezone(self):
        # A malformed timezone can reach the DB via admin/legacy/direct writes
        # that bypass serializer validation. One bad row must not crash the
        # whole reminder batch and deny reminders to every other user.
        plan = BibleReadingPlan.objects.create(name='시간대 통독', created_by=self.user)
        PlanSubscription.objects.create(
            user=self.user,
            plan=plan,
            start_date=date.today(),
            is_active=True,
        )
        DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today(),
            book='창세기',
            start_chapter=1,
            end_chapter=1,
        )
        settings = self.user.notification_settings
        # Persist reminder config and an invalid IANA key together; ZoneInfo
        # raises ValueError for '..' rather than ZoneInfoNotFoundError.
        NotificationSettings.objects.filter(pk=settings.pk).update(
            reading_reminder_time=time(0, 0),
            hasena_reminders_enabled=False,
            timezone='..',
        )
        settings.refresh_from_db()

        with patch('todos.services.push_notifications._send_web_push'):
            created_count = send_due_reminder_notifications()

        # Falls back to Asia/Seoul rather than raising, so the reminder is still created.
        self.assertEqual(created_count, 1)
        self.assertTrue(Notification.objects.filter(
            recipient=self.user,
            type='reading_reminder',
            dedupe_key=f'reading-reminder:{self.user.id}:{date.today().isoformat()}',
        ).exists())

    def test_local_now_falls_back_for_invalid_timezone(self):
        settings = self.user.notification_settings
        # Exercise the guard directly in-memory: '' and '..' raise ValueError and
        # None raises TypeError from ZoneInfo; none may propagate out of _local_now.
        for bad_timezone in ['..', '', '/etc/passwd', None]:
            with self.subTest(timezone=bad_timezone):
                settings.timezone = bad_timezone
                self.assertIsNotNone(_local_now(settings).tzinfo)

    def test_create_notification_treats_duplicate_dedupe_rows_as_existing(self):
        existing = Notification.objects.create(
            recipient=self.user,
            type='reading_reminder',
            title='기존 알림',
            body='이미 생성된 알림입니다.',
            target_url='/plan',
            dedupe_key='reading-reminder:duplicate',
        )

        with (
            patch(
                'todos.services.notifications.Notification.objects.get_or_create',
                side_effect=Notification.MultipleObjectsReturned,
            ),
            patch('todos.services.notifications._queue_push_delivery') as queue_push_delivery,
        ):
            notification, created = _create_notification(
                recipient=self.user,
                notification_type='reading_reminder',
                title='오늘의 통독이 기다리고 있어요',
                body='오늘 배정된 말씀을 읽고 흐름을 이어가볼까요?',
                target_url='/plan',
                dedupe_key='reading-reminder:duplicate',
            )

        self.assertEqual(notification, existing)
        self.assertFalse(created)
        queue_push_delivery.assert_not_called()

class NotificationReminderBatchQueryTest(TestCase):
    """Reminder eligibility reads must be batched and bounded per beat tick."""

    # UTC 12:00 → 21:00 KST → local date 2026-07-10 for the default Asia/Seoul tz.
    FIXED_NOW = datetime(2026, 7, 10, 12, 0, tzinfo=dt_timezone.utc)
    SEOUL_LOCAL_DATE = date(2026, 7, 10)

    def _create_user(self, suffix):
        return User.objects.create_user(
            username=f'reminder-{suffix}',
            nickname=f'리마인더-{suffix}',
            password='pw-test-1234',
        )

    def _create_settings(self, user, **overrides):
        defaults = {
            'notifications_enabled': True,
            'reading_reminders_enabled': True,
            'hasena_reminders_enabled': True,
            'reading_reminder_time': time(0, 0),
            'hasena_reminder_time': time(0, 0),
            'timezone': 'Asia/Seoul',
        }
        defaults.update(overrides)
        return NotificationSettings.objects.create(user=user, **defaults)

    def _create_subscription_with_schedule(self, user, local_date, book='창세기', start_chapter=1):
        plan = BibleReadingPlan.objects.create(
            name=f'plan-{user.id}-{book}-{start_chapter}',
            created_by=user,
        )
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=local_date,
            is_active=True,
        )
        schedule = DailyBibleSchedule.objects.create(
            plan=plan,
            date=local_date,
            book=book,
            start_chapter=start_chapter,
            end_chapter=start_chapter,
        )
        return subscription, schedule

    def _build_due_fixture(self, user, local_date):
        self._create_settings(user)
        self._create_subscription_with_schedule(user, local_date, book='창세기', start_chapter=1)
        self._create_subscription_with_schedule(user, local_date, book='출애굽기', start_chapter=1)

    @staticmethod
    def _select_count(ctx):
        return sum(
            1
            for query in ctx.captured_queries
            if query['sql'].lstrip().upper().startswith('SELECT')
        )

    @staticmethod
    def _dedupe_keys(create_mock):
        return {call.kwargs['dedupe_key'] for call in create_mock.call_args_list}

    def test_reminder_eligibility_reads_are_constant_per_user_count(self):
        # Fixtures are built outside the patch so auto_now_add uses the real naive now.
        self._build_due_fixture(self._create_user('single'), self.SEOUL_LOCAL_DATE)

        with (
            patch('todos.services.notifications.timezone.now', return_value=self.FIXED_NOW),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_one,
        ):
            with CaptureQueriesContext(connection) as ctx_one:
                created_one = send_due_reminder_notifications()
            select_one = self._select_count(ctx_one)
            calls_one = create_one.call_count
            create_one.reset_mock()

        for index in range(4):
            self._build_due_fixture(self._create_user(f'multi-{index}'), self.SEOUL_LOCAL_DATE)

        with (
            patch('todos.services.notifications.timezone.now', return_value=self.FIXED_NOW),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_many,
        ):
            with CaptureQueriesContext(connection) as ctx_many:
                created_many = send_due_reminder_notifications()
            select_many = self._select_count(ctx_many)
            calls_many = create_many.call_count

        # Eligibility reads must not scale with user/subscription count.
        self.assertEqual(select_one, select_many)
        self.assertLessEqual(select_many, 6)
        # Created count and per-notification creation scale with eligible reminders.
        self.assertEqual(created_one, 2)
        self.assertEqual(calls_one, 2)
        self.assertEqual(created_many, 10)
        self.assertEqual(calls_many, 10)

    def test_second_tick_dedupes_without_eligibility_reads(self):
        # Uses the real (naive) clock so real _create_notification can persist under USE_TZ=False.
        user = self._create_user('dedupe')
        settings = self._create_settings(user)
        local_date = _local_now(settings).date()
        self._create_subscription_with_schedule(user, local_date, book='창세기', start_chapter=1)
        self._create_subscription_with_schedule(user, local_date, book='출애굽기', start_chapter=1)

        with patch('todos.services.notifications._queue_push_delivery'):
            first_created = send_due_reminder_notifications()
            self.assertEqual(first_created, 2)
            count_after_first = Notification.objects.count()
            with CaptureQueriesContext(connection) as ctx:
                second_created = send_due_reminder_notifications()

        self.assertEqual(second_created, 0)
        self.assertEqual(Notification.objects.count(), count_after_first)
        # Dedupe pre-skip must short-circuit before any eligibility reads.
        self.assertLessEqual(self._select_count(ctx), 3)

    def test_mixed_timezone_users_use_local_date(self):
        # UTC 16:00 → Seoul 2026-07-11 01:00 and Los Angeles 2026-07-10 09:00.
        fixed_now = datetime(2026, 7, 10, 16, 0, tzinfo=dt_timezone.utc)
        seoul_user = self._create_user('seoul')
        self._create_settings(seoul_user, timezone='Asia/Seoul')
        self._create_subscription_with_schedule(seoul_user, date(2026, 7, 11))
        la_user = self._create_user('la')
        self._create_settings(la_user, timezone='America/Los_Angeles')
        self._create_subscription_with_schedule(la_user, date(2026, 7, 10))

        with (
            patch('todos.services.notifications.timezone.now', return_value=fixed_now),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_mock,
        ):
            send_due_reminder_notifications()

        dedupe_keys = self._dedupe_keys(create_mock)
        self.assertIn(f'reading-reminder:{seoul_user.id}:2026-07-11', dedupe_keys)
        self.assertIn(f'hasena-reminder:{seoul_user.id}:2026-07-11', dedupe_keys)
        self.assertIn(f'reading-reminder:{la_user.id}:2026-07-10', dedupe_keys)
        self.assertIn(f'hasena-reminder:{la_user.id}:2026-07-10', dedupe_keys)

    def test_all_schedules_completed_suppresses_reading_reminder(self):
        user = self._create_user('complete')
        self._create_settings(user, hasena_reminders_enabled=False)
        subscription, schedule = self._create_subscription_with_schedule(user, self.SEOUL_LOCAL_DATE)
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
        )

        with (
            patch('todos.services.notifications.timezone.now', return_value=self.FIXED_NOW),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_mock,
        ):
            created = send_due_reminder_notifications()

        self.assertEqual(created, 0)
        create_mock.assert_not_called()

    def test_no_active_subscription_suppresses_reading_reminder(self):
        user = self._create_user('nosub')
        self._create_settings(user, hasena_reminders_enabled=False)

        with (
            patch('todos.services.notifications.timezone.now', return_value=self.FIXED_NOW),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_mock,
        ):
            created = send_due_reminder_notifications()

        self.assertEqual(created, 0)
        create_mock.assert_not_called()

    def test_completed_hasena_suppresses_hasena_reminder(self):
        user = self._create_user('hasena')
        self._create_settings(user, reading_reminders_enabled=False)
        HasenaRecord.objects.create(user=user, date=self.SEOUL_LOCAL_DATE, is_completed=True)

        with (
            patch('todos.services.notifications.timezone.now', return_value=self.FIXED_NOW),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_mock,
        ):
            created = send_due_reminder_notifications()

        self.assertEqual(created, 0)
        create_mock.assert_not_called()

    def test_notifications_disabled_suppresses_all_including_ensure(self):
        user = self._create_user('disabled')
        self._create_settings(user, notifications_enabled=False)
        self._create_subscription_with_schedule(user, self.SEOUL_LOCAL_DATE)

        with (
            patch('todos.services.notifications.timezone.now', return_value=self.FIXED_NOW),
            patch(
                'todos.services.notifications._create_notification',
                return_value=(None, True),
            ) as create_mock,
        ):
            created = send_due_reminder_notifications()
            ensure_reminder_notifications(user)

        self.assertEqual(created, 0)
        create_mock.assert_not_called()


class NotificationFriendRecipientBatchQueryTest(TestCase):
    """Friend-activity recipient selection must be mutual-only, opt-out aware, and non-N+1."""

    def _create_user(self, suffix):
        return User.objects.create_user(
            username=f'friend-{suffix}',
            nickname=f'친구-{suffix}',
            password='pw-test-1234',
        )

    @staticmethod
    def _make_mutual(actor, other):
        Follow.objects.create(follower=actor, following=other)
        Follow.objects.create(follower=other, following=actor)

    @staticmethod
    def _select_count(ctx):
        return sum(
            1
            for query in ctx.captured_queries
            if query['sql'].lstrip().upper().startswith('SELECT')
        )

    def setUp(self):
        self.actor = self._create_user('actor')

        # Mutual friend with explicit enabled settings.
        self.enabled = self._create_user('enabled')
        self._make_mutual(self.actor, self.enabled)
        NotificationSettings.objects.create(
            user=self.enabled,
            notifications_enabled=True,
            friend_activity_enabled=True,
        )

        # Mutual friend with no settings row (default-enabled).
        self.no_settings = self._create_user('no-settings')
        self._make_mutual(self.actor, self.no_settings)

        # Mutual friend with disabled friend activity.
        self.disabled_activity = self._create_user('disabled-activity')
        self._make_mutual(self.actor, self.disabled_activity)
        NotificationSettings.objects.create(
            user=self.disabled_activity,
            notifications_enabled=True,
            friend_activity_enabled=False,
        )

        # Mutual friend with notifications fully disabled.
        self.disabled_notifications = self._create_user('disabled-notifications')
        self._make_mutual(self.actor, self.disabled_notifications)
        NotificationSettings.objects.create(
            user=self.disabled_notifications,
            notifications_enabled=False,
            friend_activity_enabled=True,
        )

        # One-way: actor follows this user but they do not follow back.
        self.followed_only = self._create_user('followed-only')
        Follow.objects.create(follower=self.actor, following=self.followed_only)

        # One-way: this user follows actor but actor does not follow back.
        self.follower_only = self._create_user('follower-only')
        Follow.objects.create(follower=self.follower_only, following=self.actor)

        self.plan = BibleReadingPlan.objects.create(name='1년 통독', created_by=self.actor)
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date.today(),
            book='창세기',
            start_chapter=1,
            end_chapter=3,
        )

    def _eligible_ids(self):
        return {user.id for user in _friend_recipients(self.actor)}

    def test_recipients_are_mutual_eligible_only(self):
        self.assertEqual(
            self._eligible_ids(),
            {self.enabled.id, self.no_settings.id},
        )

    def test_reading_completion_targets_only_eligible_recipients(self):
        with patch(
            'todos.services.notifications._create_notification',
            return_value=(None, True),
        ) as create_mock:
            notify_friend_reading_completed(self.actor, [self.schedule])

        recipients = {call.kwargs['recipient'].id for call in create_mock.call_args_list}
        self.assertEqual(recipients, {self.enabled.id, self.no_settings.id})

    def test_hasena_completion_targets_only_eligible_recipients(self):
        with patch(
            'todos.services.notifications._create_notification',
            return_value=(None, True),
        ) as create_mock:
            notify_friend_hasena_completed(self.actor, date.today())

        recipients = {call.kwargs['recipient'].id for call in create_mock.call_args_list}
        self.assertEqual(recipients, {self.enabled.id, self.no_settings.id})

    def test_missing_settings_row_is_not_created_as_side_effect(self):
        before = NotificationSettings.objects.count()
        with patch(
            'todos.services.notifications._create_notification',
            return_value=(None, True),
        ):
            notify_friend_reading_completed(self.actor, [self.schedule])
        self.assertEqual(NotificationSettings.objects.count(), before)
        self.assertFalse(
            NotificationSettings.objects.filter(user=self.no_settings).exists()
        )

    def test_recipient_selection_query_count_is_bounded(self):
        with CaptureQueriesContext(connection) as ctx_one:
            list(_friend_recipients(self.actor))
        one_selects = self._select_count(ctx_one)

        # Add nine more eligible mutual friends (10 total eligible mutuals).
        for index in range(9):
            extra = self._create_user(f'scale-{index}')
            self._make_mutual(self.actor, extra)
            NotificationSettings.objects.create(
                user=extra,
                notifications_enabled=True,
                friend_activity_enabled=True,
            )

        with CaptureQueriesContext(connection) as ctx_ten:
            eligible = list(_friend_recipients(self.actor))
        ten_selects = self._select_count(ctx_ten)

        # 11 eligible mutuals now: enabled, no_settings, plus 9 scale users.
        self.assertEqual(len(eligible), 11)
        self.assertLessEqual(ten_selects, one_selects + 1)
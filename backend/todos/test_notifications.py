from datetime import date, datetime, time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Follow
from .models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    HasenaRecord,
    Notification,
    NotificationPushSubscription,
    NotificationSettings,
    PlanSubscription,
)
from .services.notifications import _create_notification, send_due_reminder_notifications
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
        with patch('todos.services.push_notifications._send_web_push') as send_web_push:
            result = deliver_push_notification(self.notification.id)

        self.assertEqual(result, {'sent': 1, 'failed': 0})
        send_web_push.assert_called_once()
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

        with patch(
            'todos.services.push_notifications._send_web_push',
            side_effect=PushDeliveryError(response=Response()),
        ):
            result = deliver_push_notification(self.notification.id)

        self.assertEqual(result, {'sent': 0, 'failed': 1})
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

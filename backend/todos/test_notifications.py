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
    NotificationSettings,
    PlanSubscription,
)

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

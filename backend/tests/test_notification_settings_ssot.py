"""Notification preferences have exactly one owner: todos.NotificationSettings.

Two endpoints expose notification preferences:

- `/api/v1/todos/notifications/settings/` (canonical)
- `/api/v1/{auth,accounts}/notification-settings/` (legacy alias)

They used to read different models, and only the canonical one drove delivery,
so switching a reminder off through the legacy route did nothing. These tests
pin the convergence: both routes now resolve to the same row, and the legacy
wire contract is unchanged.

Each test drives real HTTP with a valid body and asserts on stored state, not on
serializer internals -- a facade that returns the right JSON while writing the
wrong row must fail here.
"""

from datetime import time

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from todos.models import NotificationSettings
from todos.services.notifications import get_notification_settings

User = get_user_model()

LEGACY_URLS = (
    '/api/v1/auth/notification-settings/',
    '/api/v1/accounts/notification-settings/',
)
CANONICAL_URL = '/api/v1/todos/notifications/settings/'

LEGACY_FIELDS = frozenset(
    {
        'daily_reading_reminder',
        'weekly_progress_summary',
        'service_notice',
        'reminder_time',
    }
)


class NotificationSettingsSsotTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='owner', password='pw-owner-1234', nickname='owner'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _legacy_get(self, url=LEGACY_URLS[0]):
        return self.client.get(url)

    def test_legacy_route_reports_the_row_that_drives_delivery(self):
        settings = get_notification_settings(self.user)
        settings.reading_reminders_enabled = False
        settings.weekly_summary_enabled = True
        settings.service_notice_enabled = False
        settings.reading_reminder_time = time(6, 30)
        settings.save()

        for url in LEGACY_URLS:
            with self.subTest(url=url):
                response = self._legacy_get(url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.json(),
                    {
                        'daily_reading_reminder': False,
                        'weekly_progress_summary': True,
                        'service_notice': False,
                        'reminder_time': '06:30',
                    },
                )

    def test_legacy_wire_contract_field_names_are_unchanged(self):
        response = self._legacy_get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), LEGACY_FIELDS)

    def test_legacy_patch_writes_the_row_that_drives_delivery(self):
        response = self.client.patch(
            LEGACY_URLS[0], {'daily_reading_reminder': False}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.json()['daily_reading_reminder'], False)

        settings = NotificationSettings.objects.get(user=self.user)
        self.assertIs(settings.reading_reminders_enabled, False)

    def test_legacy_patch_reaches_the_canonical_route(self):
        patch = self.client.patch(
            LEGACY_URLS[0],
            {'daily_reading_reminder': False, 'reminder_time': '05:15'},
            format='json',
        )
        self.assertEqual(patch.status_code, 200)

        canonical = self.client.get(CANONICAL_URL)
        self.assertEqual(canonical.status_code, 200)
        canonical_settings = canonical.json()['settings']
        self.assertIs(canonical_settings['reading_reminders_enabled'], False)
        self.assertEqual(canonical_settings['reading_reminder_time'], '05:15:00')

    def test_canonical_patch_is_visible_through_the_legacy_route(self):
        patch = self.client.patch(
            CANONICAL_URL, {'reading_reminders_enabled': False}, format='json'
        )
        self.assertEqual(patch.status_code, 200)

        legacy = self._legacy_get()
        self.assertEqual(legacy.status_code, 200)
        self.assertIs(legacy.json()['daily_reading_reminder'], False)

    def test_legacy_patch_leaves_untouched_preferences_alone(self):
        settings = get_notification_settings(self.user)
        settings.hasena_reminders_enabled = False
        settings.friend_activity_enabled = False
        settings.reading_reminder_time = time(21, 45)
        settings.save()

        response = self.client.patch(
            LEGACY_URLS[0], {'service_notice': False}, format='json'
        )
        self.assertEqual(response.status_code, 200)

        settings.refresh_from_db()
        self.assertIs(settings.service_notice_enabled, False)
        self.assertIs(settings.hasena_reminders_enabled, False)
        self.assertIs(settings.friend_activity_enabled, False)
        self.assertEqual(settings.reading_reminder_time, time(21, 45))

    def test_legacy_route_rejects_anonymous_callers(self):
        anonymous = APIClient()
        for url in LEGACY_URLS:
            with self.subTest(url=url):
                self.assertEqual(anonymous.get(url).status_code, 401)

    def test_legacy_route_rejects_a_malformed_reminder_time(self):
        settings = get_notification_settings(self.user)
        original = settings.reading_reminder_time

        response = self.client.patch(
            LEGACY_URLS[0], {'reminder_time': 'not-a-time'}, format='json'
        )
        self.assertEqual(response.status_code, 400)

        settings.refresh_from_db()
        self.assertEqual(settings.reading_reminder_time, original)

    def test_only_one_row_backs_both_routes(self):
        self.client.patch(
            LEGACY_URLS[0], {'daily_reading_reminder': False}, format='json'
        )
        self.client.patch(
            CANONICAL_URL, {'hasena_reminders_enabled': False}, format='json'
        )
        self.assertEqual(
            NotificationSettings.objects.filter(user=self.user).count(), 1
        )

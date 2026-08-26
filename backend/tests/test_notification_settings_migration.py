"""The 0033 data migration must not lose or invent notification preferences.

`todos/migrations/0033_notification_settings_absorb_legacy.py` carries stored
preferences from `accounts.UserReadingSettings` onto `todos.NotificationSettings`
so the legacy endpoint can become a facade without changing what a user asked
for. The propagation is deliberately asymmetric, and that asymmetry is what these
tests pin:

- an explicit reading-reminder opt-out MUST survive, otherwise the facade
  silently resumes notifications someone switched off;
- `reminder_time` MUST NOT be carried over, because the legacy default (07:00)
  differs from the effective default (20:00) and a row cannot distinguish "user
  chose 07:00" from "never touched an inert control". Copying it would move real
  delivery time for every user;
- a legacy value left at its default MUST NOT override a canonical opt-out.

These call the migration's own propagation function -- the code that will run
against production data -- rather than reimplementing its logic. The schema half
of the migration (the two AddField operations) is covered by
`makemigrations --check` in CI, so it is not re-asserted here.
"""

from datetime import time
from importlib import import_module

from django.apps import apps as live_apps
from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.models import UserReadingSettings
from todos.models import NotificationSettings

User = get_user_model()

carry_legacy_preferences = import_module(
    'todos.migrations.0033_notification_settings_absorb_legacy'
).carry_legacy_preferences


class LegacyNotificationPropagationTest(TestCase):
    def _user(self, username):
        return User.objects.create_user(
            username=username, password='pw-migration-1234', nickname=username
        )

    def _legacy(self, user, **fields):
        UserReadingSettings.objects.update_or_create(user=user, defaults=fields)

    def _run_migration_step(self):
        carry_legacy_preferences(live_apps, None)

    def test_explicit_reading_reminder_optout_survives(self):
        user = self._user('optout-user')
        self._legacy(user, daily_reading_reminder=False)
        NotificationSettings.objects.create(user=user)

        self._run_migration_step()

        settings = NotificationSettings.objects.get(user=user)
        self.assertIs(settings.reading_reminders_enabled, False)

    def test_legacy_reminder_time_is_not_propagated(self):
        user = self._user('time-user')
        self._legacy(user, reminder_time=time(7, 0))
        NotificationSettings.objects.create(user=user)

        self._run_migration_step()

        settings = NotificationSettings.objects.get(user=user)
        self.assertEqual(settings.reading_reminder_time, time(20, 0))

    def test_absorbed_preferences_are_copied_verbatim(self):
        user = self._user('absorb-user')
        self._legacy(user, weekly_progress_summary=True, service_notice=False)
        NotificationSettings.objects.create(user=user)

        self._run_migration_step()

        settings = NotificationSettings.objects.get(user=user)
        self.assertIs(settings.weekly_summary_enabled, True)
        self.assertIs(settings.service_notice_enabled, False)

    def test_unrelated_canonical_preferences_are_left_alone(self):
        user = self._user('existing-user')
        self._legacy(user, daily_reading_reminder=False)
        NotificationSettings.objects.create(
            user=user,
            hasena_reminders_enabled=False,
            friend_activity_enabled=False,
            reading_reminder_time=time(21, 30),
        )

        self._run_migration_step()

        settings = NotificationSettings.objects.get(user=user)
        self.assertIs(settings.reading_reminders_enabled, False)
        self.assertIs(settings.hasena_reminders_enabled, False)
        self.assertIs(settings.friend_activity_enabled, False)
        self.assertEqual(settings.reading_reminder_time, time(21, 30))

    def test_enabled_legacy_value_does_not_override_a_canonical_optout(self):
        user = self._user('canonical-optout')
        self._legacy(user, daily_reading_reminder=True)
        NotificationSettings.objects.create(user=user, reading_reminders_enabled=False)

        self._run_migration_step()

        settings = NotificationSettings.objects.get(user=user)
        self.assertIs(settings.reading_reminders_enabled, False)

    def test_users_without_a_canonical_row_get_one(self):
        user = self._user('no-canonical-row')
        self._legacy(user, daily_reading_reminder=False, service_notice=False)
        NotificationSettings.objects.filter(user=user).delete()

        self._run_migration_step()

        settings = NotificationSettings.objects.get(user=user)
        self.assertIs(settings.reading_reminders_enabled, False)
        self.assertIs(settings.service_notice_enabled, False)

    def test_propagation_is_idempotent(self):
        user = self._user('idempotent-user')
        self._legacy(user, daily_reading_reminder=False, weekly_progress_summary=True)
        NotificationSettings.objects.create(user=user)

        self._run_migration_step()
        self._run_migration_step()

        self.assertEqual(NotificationSettings.objects.filter(user=user).count(), 1)
        settings = NotificationSettings.objects.get(user=user)
        self.assertIs(settings.reading_reminders_enabled, False)
        self.assertIs(settings.weekly_summary_enabled, True)

    def test_no_legacy_rows_is_a_no_op(self):
        UserReadingSettings.objects.all().delete()
        NotificationSettings.objects.all().delete()

        self._run_migration_step()

        self.assertEqual(NotificationSettings.objects.count(), 0)

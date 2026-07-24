from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import PersonalReadingRecord


User = get_user_model()


@override_settings(ROOT_URLCONF="config.test_urls")
class PersonalReadingStatsStreakTests(TestCase):
    """Regression coverage for the `stats` streak math.

    The previous implementation used `date.today()` (OS timezone, not the
    configured Asia/Seoul) and a dead `expected_date + timedelta(days=1)`
    branch that could never fire for a past most-recent read, so a user who
    read N consecutive days ending *yesterday* saw `current_streak == 0`.
    """

    URL = "/api/v1/todos/bible/personal-records/stats/"
    # Fixed "now" in KST used for every test unless overridden.
    NOW_KST = datetime(2026, 7, 10, 12, 0, 0)
    TODAY = date(2026, 7, 10)

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="streak-reader",
            nickname="연속독자",
            email="streak@example.com",
        )
        self.client.force_authenticate(user=self.user)

    def _add_read(self, read_date, book="gen", chapter=1):
        PersonalReadingRecord.objects.create(
            user=self.user,
            book=book,
            chapter=chapter,
            read_date=read_date,
        )

    def _get_stats(self, now=None):
        now = now or self.NOW_KST
        with patch("todos.views.timezone.now", return_value=now):
            return self.client.get(self.URL)

    def test_streak_counts_consecutive_days_ending_today(self):
        for offset in range(3):  # today, yesterday, day-before
            self._add_read(self.TODAY - timedelta(days=offset), chapter=offset + 1)

        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["stats"]["current_streak"], 3)

    def test_streak_counts_when_not_read_today_but_read_yesterday(self):
        # Regression: read yesterday + day-before, not today -> should be 2.
        self._add_read(self.TODAY - timedelta(days=1), chapter=1)
        self._add_read(self.TODAY - timedelta(days=2), chapter=2)

        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"]["current_streak"], 2)

    def test_last_read_two_days_ago_is_zero(self):
        self._add_read(self.TODAY - timedelta(days=2), chapter=1)
        self._add_read(self.TODAY - timedelta(days=3), chapter=2)

        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"]["current_streak"], 0)

    def test_gap_inside_history_stops_the_count(self):
        # today, yesterday, then 3 days ago (gap at 2 days ago) -> 2.
        self._add_read(self.TODAY, chapter=1)
        self._add_read(self.TODAY - timedelta(days=1), chapter=2)
        self._add_read(self.TODAY - timedelta(days=3), chapter=3)

        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"]["current_streak"], 2)

    def test_future_date_does_not_inflate_streak(self):
        # A future read_date must not count as part of the streak.
        self._add_read(self.TODAY + timedelta(days=1), chapter=1)
        self._add_read(self.TODAY, chapter=2)
        self._add_read(self.TODAY - timedelta(days=1), chapter=3)

        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        # today + yesterday = 2; the future row is ignored, not counted as 3.
        self.assertEqual(response.data["stats"]["current_streak"], 2)

    def test_future_date_does_not_zero_valid_streak(self):
        # Only a future row plus a valid yesterday streak: future ignored.
        self._add_read(self.TODAY + timedelta(days=2), chapter=1)
        self._add_read(self.TODAY - timedelta(days=1), chapter=2)
        self._add_read(self.TODAY - timedelta(days=2), chapter=3)

        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"]["current_streak"], 2)

    def test_no_records_returns_zero_and_success(self):
        response = self._get_stats()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["stats"]["current_streak"], 0)

    def test_early_kst_morning_uses_seoul_date(self):
        # 01:00 KST on 2026-07-10; reads on 07-09 and 07-08 -> streak 2.
        # Under UTC OS clock this instant is still 2026-07-09 16:00, so a
        # date.today() implementation would compute against the wrong day.
        self._add_read(date(2026, 7, 9), chapter=1)
        self._add_read(date(2026, 7, 8), chapter=2)

        response = self._get_stats(now=datetime(2026, 7, 10, 1, 0, 0))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stats"]["current_streak"], 2)

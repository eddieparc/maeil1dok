from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import PersonalReadingRecord


User = get_user_model()


@override_settings(ROOT_URLCONF="config.test_urls")
class BibleHomeStatsRecentLimitTests(TestCase):
    """Regression coverage for `recent_limit` input validation.

    Before this hardening, `recent_limit` was passed straight to
    `int(...)` and used as a slice bound, so non-integer input raised an
    unhandled 500 and a negative value triggered Django's "Negative
    indexing is not supported" error (also a 500). Both now fail closed.
    """

    URL = "/api/v1/todos/bible/home-stats/"

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="home-stats-reader",
            nickname="홈통계독자",
            email="home-stats@example.com",
        )
        self.client.force_authenticate(user=self.user)
        self._create_records(count=12)

    def _create_records(self, count):
        base = date(2026, 1, 1)
        for i in range(count):
            PersonalReadingRecord.objects.create(
                user=self.user,
                book="gen",
                chapter=i + 1,
                read_date=base + timedelta(days=i),
            )

    def test_default_limit_returns_five_recent_records(self):
        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["recent_records"]), 5)
        self.assertEqual(response.data["bookmarks"], 0)

    def test_non_integer_limit_fails_closed_with_400(self):
        response = self.client.get(self.URL, {"recent_limit": "abc"})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_negative_limit_does_not_500_and_clamps_to_one(self):
        response = self.client.get(self.URL, {"recent_limit": "-5"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["recent_records"]), 1)

    def test_zero_limit_clamps_to_one(self):
        response = self.client.get(self.URL, {"recent_limit": "0"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["recent_records"]), 1)

    def test_excessive_limit_is_capped_at_maximum(self):
        self._create_records_up_to(60)

        response = self.client.get(self.URL, {"recent_limit": "10000"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["recent_records"]), 50)

    def _create_records_up_to(self, total):
        existing = PersonalReadingRecord.objects.filter(user=self.user).count()
        base = date(2026, 6, 1)
        for i in range(existing, total):
            PersonalReadingRecord.objects.create(
                user=self.user,
                book="exo",
                chapter=i + 1,
                read_date=base + timedelta(days=i),
            )

    def test_valid_limit_is_honored(self):
        response = self.client.get(self.URL, {"recent_limit": "3"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["recent_records"]), 3)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 401)

"""
Test suite for HasenaRecord POST race condition + input validation hardening.

Mirrors the pattern established in test_subscription_race_condition.py:
- TransactionTestCase so real database commits let unique_together fire under
  concurrent access (not just in-memory rollback).
- APIClient with force_authenticate so JWT setup is not on the hot path.
- threading with a fresh APIClient per thread so credentials do not race.

Locked scenarios (the contract this cycle promises to hold):

S1 — Sequential duplicate POST for the same date preserves the "update
     on second call" semantics: 201 then 200, DB has exactly one row.
S2 — Concurrent 5-thread POST for the same date produces exactly one row
     and no unhandled IntegrityError (no 5xx) — this is the race the fix
     is closing.
S3 — Malformed date string "2026-13-45" is rejected with 400 BEFORE any
     DB write happens.
S4 — Out-of-range date "9999-01-01" is rejected with 400 BEFORE any DB
     write happens.
S5 — Non-boolean `is_completed` (e.g. "yes") is rejected with 400 BEFORE
     any DB write happens (DRF's default coercion is not enough).
S6 — Same user, different date creates two rows (correct uniqueness key).
S7 — Omitted `is_completed` defaults to True (preserves the current API
     contract; downstream stats depend on it).
"""
import threading
from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import UserAchievement

from todos.models import HasenaRecord


User = get_user_model()
HASENA_URL = '/api/v1/todos/hasena/'
HASENA_UPDATE_URL = '/api/v1/todos/hasena/update/'


# Route cache to LocMem and disable throttling so the test suite does not
# depend on a running Redis instance. This mirrors the pattern used across
# other TransactionTestCase suites in this repo (throttling backends are
# not the subject-under-test).
_TEST_CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'hasena-race-test-cache',
    },
}
_TEST_REST_FRAMEWORK = {
    **settings.REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}


@override_settings(CACHES=_TEST_CACHES, REST_FRAMEWORK=_TEST_REST_FRAMEWORK)
class HasenaRecordRaceConditionTestCase(TransactionTestCase):
    """
    Race + input-validation tests for POST /api/v1/todos/hasena/.

    Uses TransactionTestCase because:
      1. unique_together=['user','date'] must be enforced by the real DB,
         not by Django's in-memory savepoint rollback.
      2. Threading a POST endpoint requires real cross-connection commits.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='hasenatester',
            password='hasenapass123',
            nickname='Hasena Tester',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.target_date = date(2026, 7, 6)
        self.target_date_str = self.target_date.isoformat()

    # ------------------------------------------------------------------
    # S1 — sequential duplicate: 201 then 200, exactly one row
    # ------------------------------------------------------------------
    def test_s1_sequential_duplicate_post_updates_existing_row(self):
        response1 = self.client.post(
            HASENA_URL,
            {'date': self.target_date_str, 'is_completed': True},
            format='json',
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        response2 = self.client.post(
            HASENA_URL,
            {'date': self.target_date_str, 'is_completed': False},
            format='json',
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        row_count = HasenaRecord.objects.filter(
            user=self.user, date=self.target_date
        ).count()
        self.assertEqual(row_count, 1)

        record = HasenaRecord.objects.get(user=self.user, date=self.target_date)
        self.assertFalse(record.is_completed)

    # ------------------------------------------------------------------
    # S2 — concurrent 5-thread hammer: 1 row, no 5xx
    # ------------------------------------------------------------------
    def test_s2_concurrent_posts_produce_no_5xx_and_one_row(self):
        results: list[int] = []
        errors: list[str] = []
        lock = threading.Lock()

        def post_hasena():
            try:
                client = APIClient()
                client.force_authenticate(user=self.user)
                response = client.post(
                    HASENA_URL,
                    {'date': self.target_date_str, 'is_completed': True},
                    format='json',
                )
                with lock:
                    results.append(response.status_code)
            except Exception as exc:  # noqa: BROAD_EXCEPT_OK — surfaces raw crashes
                with lock:
                    errors.append(str(exc))

        threads = [threading.Thread(target=post_hasena) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [], f'unexpected raw errors: {errors}')

        server_errors = [code for code in results if code >= 500]
        self.assertEqual(
            server_errors,
            [],
            f'race exposed 5xx responses: {results}',
        )

        row_count = HasenaRecord.objects.filter(
            user=self.user, date=self.target_date
        ).count()
        self.assertEqual(
            row_count,
            1,
            f'expected exactly one row for {self.target_date}, saw {row_count}',
        )

        success_codes = {status.HTTP_200_OK, status.HTTP_201_CREATED}
        acceptable = success_codes | {status.HTTP_400_BAD_REQUEST}
        for code in results:
            self.assertIn(code, acceptable, f'unexpected status code: {code}')

    # ------------------------------------------------------------------
    # S3 — malformed date string → 400 before any DB write
    # ------------------------------------------------------------------
    def test_s3_malformed_date_rejected_before_db_write(self):
        response = self.client.post(
            HASENA_URL,
            {'date': '2026-13-45', 'is_completed': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(HasenaRecord.objects.count(), 0)

    # ------------------------------------------------------------------
    # S4 — out-of-range date → 400 before any DB write
    # ------------------------------------------------------------------
    def test_s4_out_of_range_date_rejected_before_db_write(self):
        response = self.client.post(
            HASENA_URL,
            {'date': '9999-01-01', 'is_completed': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(HasenaRecord.objects.count(), 0)

        response_low = self.client.post(
            HASENA_URL,
            {'date': '1899-12-31', 'is_completed': True},
            format='json',
        )
        self.assertEqual(response_low.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(HasenaRecord.objects.count(), 0)

    # ------------------------------------------------------------------
    # S5 — non-boolean `is_completed` → 400 before any DB write
    # ------------------------------------------------------------------
    def test_s5_non_boolean_is_completed_rejected_before_db_write(self):
        bad_values = ['yes', 'no', 'maybe', 2, [], {}]
        for value in bad_values:
            response = self.client.post(
                HASENA_URL,
                {'date': self.target_date_str, 'is_completed': value},
                format='json',
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f'value {value!r} should be rejected as non-boolean',
            )
        self.assertEqual(HasenaRecord.objects.count(), 0)

    # ------------------------------------------------------------------
    # S6 — same user, two different dates → two rows
    # ------------------------------------------------------------------
    def test_s6_same_user_different_dates_produces_two_rows(self):
        other_date = date(2026, 7, 7)

        response1 = self.client.post(
            HASENA_URL,
            {'date': self.target_date_str, 'is_completed': True},
            format='json',
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        response2 = self.client.post(
            HASENA_URL,
            {'date': other_date.isoformat(), 'is_completed': True},
            format='json',
        )
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)

        self.assertEqual(HasenaRecord.objects.filter(user=self.user).count(), 2)

    # ------------------------------------------------------------------
    # S7 — omitted is_completed defaults to True
    # ------------------------------------------------------------------
    def test_s7_omitted_is_completed_defaults_to_true(self):
        response = self.client.post(
            HASENA_URL,
            {'date': self.target_date_str},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        record = HasenaRecord.objects.get(user=self.user, date=self.target_date)
        self.assertTrue(record.is_completed)

    def _hasena_total_30_count(self):
        return UserAchievement.objects.filter(
            user=self.user,
            achievement_type='hasena_total_30',
        ).count()

    def _seed_hasena_total_30_boundary(self):
        start_date = date(2026, 1, 1)
        target_date = start_date + timedelta(days=29)
        records = [
            HasenaRecord(
                user=self.user,
                date=start_date + timedelta(days=offset),
                is_completed=True,
            )
            for offset in range(29)
        ]
        records.append(
            HasenaRecord(user=self.user, date=target_date, is_completed=False)
        )
        HasenaRecord.objects.bulk_create(records)
        return target_date

    def _assert_existing_completion_grants_total_30_once(self, endpoint):
        target_date = self._seed_hasena_total_30_boundary()

        for _ in range(2):
            response = self.client.post(
                endpoint,
                {'date': target_date.isoformat(), 'is_completed': True},
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(
            HasenaRecord.objects.filter(user=self.user, date=target_date).count(),
            1,
        )
        self.assertEqual(self._hasena_total_30_count(), 1)

    def test_existing_hasena_completion_grants_total_achievement(self):
        self._assert_existing_completion_grants_total_30_once(HASENA_URL)

    def test_update_alias_existing_completion_grants_total_achievement(self):
        self._assert_existing_completion_grants_total_30_once(HASENA_UPDATE_URL)

    def test_existing_hasena_incomplete_update_grants_no_hasena_achievement(self):
        HasenaRecord.objects.create(
            user=self.user, date=self.target_date, is_completed=False
        )

        response = self.client.post(
            HASENA_URL,
            {'date': self.target_date_str, 'is_completed': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(UserAchievement.objects.filter(user=self.user, achievement_type__startswith='hasena_').exists())

    def test_update_alias_achievement_failure_rolls_back_existing_completion(self):
        HasenaRecord.objects.create(
            user=self.user, date=self.target_date, is_completed=False
        )
        self.client.raise_request_exception = False

        with patch('todos.views.AchievementService.check_and_grant_achievements', side_effect=RuntimeError('achievement failure')):
            response = self.client.post(
                HASENA_UPDATE_URL,
                {'date': self.target_date_str, 'is_completed': True},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        record = HasenaRecord.objects.get(user=self.user, date=self.target_date)
        self.assertFalse(record.is_completed)

    def test_update_alias_rejects_non_boolean_before_db_write(self):
        response = self.client.post(
            HASENA_UPDATE_URL,
            {'date': self.target_date_str, 'is_completed': 'yes'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(HasenaRecord.objects.count(), 0)

    def test_update_alias_rejects_malformed_date_before_db_write(self):
        response = self.client.post(
            HASENA_UPDATE_URL,
            {'date': '2026-13-45', 'is_completed': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(HasenaRecord.objects.count(), 0)

    def test_update_alias_sequential_duplicate_updates_existing_row(self):
        response1 = self.client.post(
            HASENA_UPDATE_URL,
            {'date': self.target_date_str, 'is_completed': True},
            format='json',
        )
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        response2 = self.client.post(
            HASENA_UPDATE_URL,
            {'date': self.target_date_str, 'is_completed': False},
            format='json',
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        record = HasenaRecord.objects.get(user=self.user, date=self.target_date)
        self.assertFalse(record.is_completed)
        self.assertEqual(
            HasenaRecord.objects.filter(
                user=self.user, date=self.target_date
            ).count(),
            1,
        )

    def test_update_alias_concurrent_posts_produce_no_5xx_and_one_row(self):
        results: list[int] = []
        errors: list[str] = []
        lock = threading.Lock()

        def post_hasena_update():
            try:
                client = APIClient()
                client.force_authenticate(user=self.user)
                response = client.post(
                    HASENA_UPDATE_URL,
                    {'date': self.target_date_str, 'is_completed': True},
                    format='json',
                )
                with lock:
                    results.append(response.status_code)
            except Exception as exc:  # noqa: BROAD_EXCEPT_OK — surfaces raw crashes
                with lock:
                    errors.append(str(exc))

        threads = [threading.Thread(target=post_hasena_update) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [], f'unexpected raw errors: {errors}')
        self.assertEqual([code for code in results if code >= 500], [])
        self.assertEqual(HasenaRecord.objects.filter(user=self.user, date=self.target_date).count(), 1)

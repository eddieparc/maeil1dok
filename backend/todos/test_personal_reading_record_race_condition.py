"""
Test suite for PersonalReadingRecord POST race-condition hardening.

Mirrors the pattern established in test_hasena_record_race_condition.py
and test_subscription_race_condition.py:
- TransactionTestCase so real database commits let unique_together fire
  under concurrent access (not just in-memory rollback).
- APIClient with force_authenticate so JWT setup is not on the hot path.
- threading with a fresh APIClient per thread so credentials do not race.

Locked scenarios (the contract this cycle promises to hold):

S1 — Sequential duplicate POST for the same (book, chapter) preserves the
     "update on second call" semantics: 201 then 200, DB has exactly one
     row and read_date reflects the second call (last-write-wins on date).
S2 — Concurrent 5-thread POST for the same (book, chapter, read_date)
     produces exactly one row and no unhandled IntegrityError (no 5xx).
     This is the race the fix is closing.
S3 — Concurrent 5-thread POST for the same (book, chapter) with different
     read_date values still produces exactly one row and no 5xx; the
     surviving read_date is one of the concurrently submitted dates.
S4 — Same user, same book, DIFFERENT chapters produce two rows (the
     uniqueness key is (user, book, chapter), not just (user, book)).
S5 — Concurrent POSTs from two DIFFERENT users for the same (book,
     chapter) produce two rows, one per user (tenant isolation preserved
     under the race).
"""
import threading
from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from todos.models import PersonalReadingRecord


User = get_user_model()
PERSONAL_RECORDS_URL = '/api/v1/todos/bible/personal-records/'


# Route cache to LocMem and disable throttling so the test suite does not
# depend on a running Redis instance. This mirrors the pattern used across
# other TransactionTestCase suites in this repo (throttling backends are
# not the subject-under-test).
_TEST_CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'personal-record-race-test-cache',
    },
}
_TEST_REST_FRAMEWORK = {
    **settings.REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}


@override_settings(CACHES=_TEST_CACHES, REST_FRAMEWORK=_TEST_REST_FRAMEWORK)
class PersonalReadingRecordRaceConditionTestCase(TransactionTestCase):
    """
    Race + tenant-isolation tests for POST /api/v1/todos/bible/personal-records/.

    Uses TransactionTestCase because:
      1. unique_together=['user','book','chapter'] must be enforced by the
         real DB, not by Django's in-memory savepoint rollback.
      2. Threading a POST endpoint requires real cross-connection commits.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='prr-race-tester',
            password='prrpass123',
            nickname='PRR Race Tester',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.target_book = 'gen'
        self.target_chapter = 1
        self.target_date = date(2026, 1, 2)
        self.target_date_str = self.target_date.isoformat()

    def _post(self, client, payload):
        return client.post(PERSONAL_RECORDS_URL, payload, format='json')

    def _fresh_authed_client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    # ------------------------------------------------------------------
    # S1 — sequential duplicate: 201 then 200, exactly one row, LWW date
    # ------------------------------------------------------------------
    def test_s1_sequential_duplicate_post_updates_read_date(self):
        response1 = self._post(self.client, {
            'book': self.target_book,
            'chapter': self.target_chapter,
            'read_date': '2026-01-01',
        })
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        response2 = self._post(self.client, {
            'book': self.target_book,
            'chapter': self.target_chapter,
            'read_date': '2026-01-02',
        })
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        row_count = PersonalReadingRecord.objects.filter(
            user=self.user,
            book=self.target_book,
            chapter=self.target_chapter,
        ).count()
        self.assertEqual(row_count, 1)

        record = PersonalReadingRecord.objects.get(
            user=self.user,
            book=self.target_book,
            chapter=self.target_chapter,
        )
        self.assertEqual(record.read_date, date(2026, 1, 2))

    # ------------------------------------------------------------------
    # S2 — concurrent 5-thread hammer, identical payload:
    #      1 row, no 5xx, every response is 200/201
    # ------------------------------------------------------------------
    def test_s2_concurrent_posts_produce_no_5xx_and_one_row(self):
        results: list[int] = []
        errors: list[str] = []
        lock = threading.Lock()

        def post_record():
            try:
                client = self._fresh_authed_client(self.user)
                response = self._post(client, {
                    'book': self.target_book,
                    'chapter': self.target_chapter,
                    'read_date': self.target_date_str,
                })
                with lock:
                    results.append(response.status_code)
            except Exception as exc:  # noqa: BROAD_EXCEPT_OK — surfaces raw crashes
                with lock:
                    errors.append(str(exc))

        threads = [threading.Thread(target=post_record) for _ in range(5)]
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

        row_count = PersonalReadingRecord.objects.filter(
            user=self.user,
            book=self.target_book,
            chapter=self.target_chapter,
        ).count()
        self.assertEqual(
            row_count,
            1,
            f'expected exactly one row, saw {row_count}',
        )

        success_codes = {status.HTTP_200_OK, status.HTTP_201_CREATED}
        for code in results:
            self.assertIn(
                code,
                success_codes,
                f'unexpected status code under race: {code}',
            )

    # ------------------------------------------------------------------
    # S3 — concurrent 5-thread hammer, different read_date each thread:
    #      still 1 row, no 5xx, surviving read_date is one of the submitted
    # ------------------------------------------------------------------
    def test_s3_concurrent_posts_different_dates_preserve_single_row(self):
        submitted_dates = [
            date(2026, 1, 1),
            date(2026, 1, 2),
            date(2026, 1, 3),
            date(2026, 1, 4),
            date(2026, 1, 5),
        ]
        results: list[int] = []
        errors: list[str] = []
        lock = threading.Lock()

        def post_record(target_date):
            try:
                client = self._fresh_authed_client(self.user)
                response = self._post(client, {
                    'book': self.target_book,
                    'chapter': self.target_chapter,
                    'read_date': target_date.isoformat(),
                })
                with lock:
                    results.append(response.status_code)
            except Exception as exc:  # noqa: BROAD_EXCEPT_OK
                with lock:
                    errors.append(str(exc))

        threads = [
            threading.Thread(target=post_record, args=(d,))
            for d in submitted_dates
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [], f'unexpected raw errors: {errors}')
        server_errors = [code for code in results if code >= 500]
        self.assertEqual(server_errors, [], f'race exposed 5xx: {results}')

        row_count = PersonalReadingRecord.objects.filter(
            user=self.user,
            book=self.target_book,
            chapter=self.target_chapter,
        ).count()
        self.assertEqual(row_count, 1)

        record = PersonalReadingRecord.objects.get(
            user=self.user,
            book=self.target_book,
            chapter=self.target_chapter,
        )
        self.assertIn(
            record.read_date,
            submitted_dates,
            f'surviving read_date {record.read_date} not in {submitted_dates}',
        )

    # ------------------------------------------------------------------
    # S4 — same book, different chapters → two rows
    #      (uniqueness key is (user, book, chapter), NOT (user, book))
    # ------------------------------------------------------------------
    def test_s4_same_book_different_chapters_produces_two_rows(self):
        response1 = self._post(self.client, {
            'book': 'gen',
            'chapter': 1,
            'read_date': '2026-01-01',
        })
        response2 = self._post(self.client, {
            'book': 'gen',
            'chapter': 2,
            'read_date': '2026-01-01',
        })

        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            PersonalReadingRecord.objects.filter(user=self.user).count(),
            2,
        )

    # ------------------------------------------------------------------
    # S5 — concurrent posts from two DIFFERENT users for the same
    #      (book, chapter) produce two rows, one per user
    # ------------------------------------------------------------------
    def test_s5_concurrent_posts_from_different_users_produce_per_user_rows(self):
        other_user = User.objects.create_user(
            username='prr-race-tester-two',
            password='prrpass456',
            nickname='PRR Race Tester Two',
        )
        results: list[int] = []
        errors: list[str] = []
        lock = threading.Lock()

        def post_as(user):
            try:
                client = self._fresh_authed_client(user)
                response = self._post(client, {
                    'book': self.target_book,
                    'chapter': self.target_chapter,
                    'read_date': self.target_date_str,
                })
                with lock:
                    results.append(response.status_code)
            except Exception as exc:  # noqa: BROAD_EXCEPT_OK
                with lock:
                    errors.append(str(exc))

        # 3 threads per user to increase interleaving pressure.
        threads = []
        for _ in range(3):
            threads.append(threading.Thread(target=post_as, args=(self.user,)))
            threads.append(threading.Thread(target=post_as, args=(other_user,)))

        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [], f'unexpected raw errors: {errors}')
        server_errors = [code for code in results if code >= 500]
        self.assertEqual(server_errors, [], f'race exposed 5xx: {results}')

        self.assertEqual(
            PersonalReadingRecord.objects.filter(user=self.user).count(),
            1,
            'user A must have exactly one row for (gen, 1)',
        )
        self.assertEqual(
            PersonalReadingRecord.objects.filter(user=other_user).count(),
            1,
            'user B must have exactly one row for (gen, 1) — tenant isolation',
        )

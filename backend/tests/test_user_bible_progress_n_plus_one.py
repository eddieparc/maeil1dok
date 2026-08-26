"""Regression tests for N+1 behavior in the monthly schedule progress endpoint.

`GET /api/v1/todos/schedules/month/` is the consumed read path for both schedule
metadata and the authenticated user's completion state. The endpoint must keep
query counts bounded as the number of schedules grows.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
)

User = get_user_model()

ROW_COUNT = 40
SCHEDULE_MONTH = 1
SCHEDULE_YEAR = 2026
SELECT_CEILING = 5


def _select_count(context):
    return sum(
        1
        for query in context.captured_queries
        if query['sql'].lstrip().upper().startswith('SELECT')
    )


@override_settings(ROOT_URLCONF="config.urls")
class UserBibleProgressNPlusOneTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='reader',
            nickname='progress-reader',
            password='testpass123',
        )
        cls.other_user = User.objects.create_user(
            username='reader-without-subscription',
            nickname='reader-without-subscription',
            password='testpass123',
        )
        cls.plan = BibleReadingPlan.objects.create(
            name='Progress Plan',
            description='Test plan',
            is_active=True,
            created_by=cls.user,
        )
        cls.subscription = PlanSubscription.objects.create(
            user=cls.user,
            plan=cls.plan,
            start_date=date(SCHEDULE_YEAR, SCHEDULE_MONTH, 1),
            is_active=True,
        )

        # Uniqueness is (plan, date, book), so vary the book while keeping all
        # schedules in the same month.
        fixed_date = date(SCHEDULE_YEAR, SCHEDULE_MONTH, 15)
        for i in range(ROW_COUNT):
            schedule = DailyBibleSchedule.objects.create(
                plan=cls.plan,
                date=fixed_date,
                book=f'book{i:03d}',
                start_chapter=i + 1,
                end_chapter=i + 1,
            )
            UserBibleProgress.objects.create(
                subscription=cls.subscription,
                schedule=schedule,
                is_completed=bool(i % 2),
            )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _get_month(self, **extra_query):
        return self.client.get(
            '/api/v1/todos/schedules/month/',
            {
                'plan_id': self.plan.id,
                'month': SCHEDULE_MONTH,
                **extra_query,
            },
        )

    def _assert_schedules_hydrated(self, data, *, with_progress):
        self.assertEqual(len(data), ROW_COUNT)
        for row in data:
            self.assertEqual(row['plan_name'], 'Progress Plan')
            self.assertIsNotNone(row['date'])
            if with_progress:
                self.assertIn('is_completed', row)
            else:
                self.assertNotIn('is_completed', row)

    def _assert_bounded_selects(self, context):
        selects = _select_count(context)
        self.assertLessEqual(
            selects,
            SELECT_CEILING,
            f"Expected <= {SELECT_CEILING} SELECTs but got {selects}. "
            "This suggests an N+1 query issue.\n"
            + "\n".join(q['sql'] for q in context.captured_queries),
        )

    def test_month_schedules_with_progress_has_no_n_plus_one(self):
        with CaptureQueriesContext(connection) as context:
            response = self._get_month()
            self.assertEqual(response.status_code, 200)

        self._assert_schedules_hydrated(response.json(), with_progress=True)
        self._assert_bounded_selects(context)

    def test_month_schedules_with_year_filter_has_no_n_plus_one(self):
        with CaptureQueriesContext(connection) as context:
            response = self._get_month(year=SCHEDULE_YEAR)
            self.assertEqual(response.status_code, 200)

        self._assert_schedules_hydrated(response.json(), with_progress=True)
        self._assert_bounded_selects(context)

    def test_month_schedules_without_subscription_has_no_n_plus_one(self):
        self.client.force_authenticate(user=self.other_user)

        with CaptureQueriesContext(connection) as context:
            response = self._get_month(year=SCHEDULE_YEAR)
            self.assertEqual(response.status_code, 200)

        self._assert_schedules_hydrated(response.json(), with_progress=False)
        self._assert_bounded_selects(context)

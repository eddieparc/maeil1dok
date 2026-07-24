"""
Regression tests for N+1 query behavior in UserBibleProgress read endpoints.

Both `GET /api/v1/todos/reading/history/` and
`GET /api/v1/todos/plan/<pk>/progress/` serialize many `UserBibleProgress`
rows through `UserBibleProgressSerializer`, which reads
`subscription.plan.name` and `schedule.date`. Without preloading
`schedule` and `subscription__plan`, serializing N rows issues per-row
SELECTs. These tests pin the query count to a small constant ceiling.
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
            start_date=date(2026, SCHEDULE_MONTH, 1),
            is_active=True,
        )

        # All schedules live in the same month so the month-filter test
        # matches every row. Uniqueness is (plan, date, book); we keep the
        # date fixed and vary `book` to stay within the month.
        fixed_date = date(2026, SCHEDULE_MONTH, 15)
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

    def _assert_rows_hydrated(self, data):
        self.assertEqual(len(data), ROW_COUNT)
        for row in data:
            self.assertIsNotNone(row.get('plan_name'))
            self.assertEqual(row['plan_name'], 'Progress Plan')
            self.assertIsNotNone(row.get('date'))

    def test_plan_subscription_progress_has_no_n_plus_one(self):
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(
                f'/api/v1/todos/plan/{self.subscription.id}/progress/'
            )
            self.assertEqual(response.status_code, 200)

        data = response.json()
        self._assert_rows_hydrated(data)

        selects = _select_count(context)
        self.assertLessEqual(
            selects,
            SELECT_CEILING,
            f"Expected <= {SELECT_CEILING} SELECTs but got {selects}. "
            "This suggests an N+1 query issue.\n"
            + "\n".join(q['sql'] for q in context.captured_queries),
        )

    def test_reading_history_has_no_n_plus_one(self):
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(
                f'/api/v1/todos/reading/history/?plan_id={self.plan.id}'
            )
            self.assertEqual(response.status_code, 200)

        data = response.json()
        self._assert_rows_hydrated(data)

        selects = _select_count(context)
        self.assertLessEqual(
            selects,
            SELECT_CEILING,
            f"Expected <= {SELECT_CEILING} SELECTs but got {selects}. "
            "This suggests an N+1 query issue.\n"
            + "\n".join(q['sql'] for q in context.captured_queries),
        )

    def test_reading_history_month_filter_has_no_n_plus_one(self):
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(
                f'/api/v1/todos/reading/history/'
                f'?plan_id={self.plan.id}&month={SCHEDULE_MONTH}'
            )
            self.assertEqual(response.status_code, 200)

        data = response.json()
        self._assert_rows_hydrated(data)

        selects = _select_count(context)
        self.assertLessEqual(
            selects,
            SELECT_CEILING,
            f"Expected <= {SELECT_CEILING} SELECTs but got {selects}. "
            "This suggests an N+1 query issue.\n"
            + "\n".join(q['sql'] for q in context.captured_queries),
        )

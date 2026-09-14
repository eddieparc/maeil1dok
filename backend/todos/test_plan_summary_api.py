from datetime import date, datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
)


class PlanSummaryAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.owner = User.objects.create_user(username='summary-owner', nickname='Owner')
        cls.other = User.objects.create_user(username='summary-other', nickname='Other')
        cls.staff = User.objects.create_user(
            username='summary-staff', nickname='Staff', is_staff=True,
        )
        cls.plan = BibleReadingPlan.objects.create(name='Summary', created_by=cls.owner)
        cls.subscription = PlanSubscription.objects.create(
            id=cls.plan.pk + 1000,
            user=cls.owner,
            plan=cls.plan,
            start_date=date(2026, 2, 1),
        )
        cls.other_subscription = PlanSubscription.objects.create(
            user=cls.other, plan=cls.plan, start_date=date(2026, 1, 1),
        )
        cls.empty_plan = BibleReadingPlan.objects.create(name='Empty', created_by=cls.owner)
        cls.empty_subscription = PlanSubscription.objects.create(
            user=cls.owner, plan=cls.empty_plan, start_date=date(2026, 1, 1),
        )
        cls.schedules = [
            DailyBibleSchedule.objects.create(
                plan=cls.plan, date=day, book=book, start_chapter=1, end_chapter=2,
            )
            for day, book in [
                (date(2026, 1, 1), 'gen'),
                (date(2026, 1, 1), 'exo'),
                (date(2026, 1, 4), 'gen'),
                (date(2026, 1, 4), 'exo'),
                (date(2027, 1, 1), 'gen'),
            ]
        ]
        completed_at = datetime(2026, 2, 2)
        # Bulk creation avoids unrelated achievement side effects, not the ORM under test.
        UserBibleProgress.objects.bulk_create([
            UserBibleProgress(
                subscription=cls.subscription,
                schedule=schedule,
                is_completed=index < 3,
                completed_at=completed_at,
            )
            for index, schedule in enumerate(cls.schedules[:4])
        ] + [
            UserBibleProgress(
                subscription=cls.other_subscription,
                schedule=schedule,
                is_completed=True,
                completed_at=completed_at,
            )
            for schedule in cls.schedules
        ])

    def setUp(self):
        self.client = APIClient()
        self.authenticate(self.owner)

    def authenticate(self, user):
        token = AccessToken.for_user(user)
        token['token_version'] = user.token_version
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def summary_url(self, subscription=None):
        subscription = subscription or self.subscription
        return f'/api/v1/todos/plan/{subscription.pk}/summary/'

    def assert_summary(self, expected, subscription=None):
        response = self.client.get(self.summary_url(subscription))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected)

    def test_distinct_dates_require_every_row_and_ignore_other_subscribers(self):
        # Includes multiple books, gaps, dates before subscription start and a future year.
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})

    def test_empty_plan_returns_actual_zero(self):
        self.assert_summary(
            {'completed_days': 0, 'total_days': 0, 'percent': 0.0},
            self.empty_subscription,
        )

    def test_no_acknowledged_completions_returns_zero_for_scheduled_plan(self):
        UserBibleProgress.objects.filter(subscription=self.subscription).delete()
        self.assert_summary({'completed_days': 0, 'total_days': 3, 'percent': 0.0})

    def test_completion_and_cancel_http_writes_change_summary_only_after_success(self):
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})
        for action, completed_days, percent in [('complete', 3, 100.0), ('cancel', 1, 33.33)]:
            with self.subTest(action=action):
                response = self.client.post('/api/v1/todos/reading/update/', {
                    'plan_id': self.plan.pk,
                    'schedule_ids': [schedule.pk for schedule in self.schedules[3:]],
                    'action': action,
                }, format='json')
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()['success'])
                self.assert_summary({
                    'completed_days': completed_days, 'total_days': 3, 'percent': percent,
                })

    def test_hidden_subscription_and_inactive_plan_remain_owner_readable(self):
        PlanSubscription.objects.filter(pk=self.subscription.pk).update(is_active=False)
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})
        BibleReadingPlan.objects.filter(pk=self.plan.pk).update(is_active=False)
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})

    def test_subscription_id_is_not_plan_id(self):
        self.assertNotEqual(self.subscription.pk, self.plan.pk)
        response = self.client.get(f'/api/v1/todos/plan/{self.plan.pk}/summary/')
        self.assertEqual(response.status_code, 404)
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})

    def test_anonymous_denied(self):
        self.client.credentials()
        self.assertEqual(self.client.get(self.summary_url()).status_code, 401)

    def test_another_owner_and_staff_denied_even_when_hidden(self):
        for active in (True, False):
            PlanSubscription.objects.filter(pk=self.subscription.pk).update(is_active=active)
            for user in (self.other, self.staff):
                with self.subTest(active=active, user=user.username):
                    self.authenticate(user)
                    self.assertEqual(self.client.get(self.summary_url()).status_code, 404)
        self.authenticate(self.other)
        self.assert_summary(
            {'completed_days': 3, 'total_days': 3, 'percent': 100.0},
            self.other_subscription,
        )

    def test_missing_subscription_denied(self):
        missing_id = self.empty_subscription.pk + 1000
        self.assertEqual(
            self.client.get(f'/api/v1/todos/plan/{missing_id}/summary/').status_code, 404,
        )

    def test_other_plan_and_cross_subscription_progress_cannot_inflate_summary(self):
        unrelated = DailyBibleSchedule.objects.create(
            plan=self.empty_plan, date=date(2026, 1, 1), book='gen',
            start_chapter=1, end_chapter=1,
        )
        # The DB allows cross-plan progress rows; neither direction can affect the result.
        UserBibleProgress.objects.bulk_create([
            UserBibleProgress(
                subscription=self.empty_subscription, schedule=schedule, is_completed=True,
            ) for schedule in [*self.schedules, unrelated]
        ] + [UserBibleProgress(
            subscription=self.subscription, schedule=unrelated, is_completed=True,
        )])
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})
        self.assert_summary(
            {'completed_days': 1, 'total_days': 1, 'percent': 100.0},
            self.empty_subscription,
        )

    def test_read_only_endpoint(self):
        self.assertEqual(self.client.post(self.summary_url(), {}, format='json').status_code, 405)
        self.assert_summary({'completed_days': 1, 'total_days': 3, 'percent': 33.33})

    def test_service_uses_one_aggregate_query_independent_of_schedule_count(self):
        from todos.services.plan_summary_service import get_plan_summary

        with self.assertNumQueries(1):
            self.assertEqual(get_plan_summary(self.subscription), {
                'completed_days': 1, 'total_days': 3, 'percent': 33.33,
            })
        DailyBibleSchedule.objects.bulk_create([
            DailyBibleSchedule(
                plan=self.plan, date=date(2028, 1, 1) + timedelta(days=offset),
                book='gen', start_chapter=1, end_chapter=1,
            ) for offset in range(100)
        ])
        with self.assertNumQueries(1):
            self.assertEqual(get_plan_summary(self.subscription), {
                'completed_days': 1, 'total_days': 103, 'percent': 0.97,
            })
        self.assert_summary({'completed_days': 1, 'total_days': 103, 'percent': 0.97})

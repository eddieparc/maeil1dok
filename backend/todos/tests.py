from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    BibleReadingPlan, DailyBibleSchedule, PlanSubscription, UserBibleProgress,
)
from .scoreboard_views import calculate_progress_rate, calculate_progress_rates_bulk

User = get_user_model()


class ProgressTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='reader', nickname='리더', password='pw-test-1234',
        )
        self.plan = BibleReadingPlan.objects.create(name='테스트 플랜', created_by=self.user)
        self.subscription = PlanSubscription.objects.create(
            user=self.user, plan=self.plan, start_date=date.today(), is_active=True,
        )
        self.schedules = [
            DailyBibleSchedule.objects.create(
                plan=self.plan,
                date=date.today() - timedelta(days=offset),
                book='창세기',
                start_chapter=offset * 2 + 1,
                end_chapter=offset * 2 + 2,
            )
            for offset in range(3)
        ]
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class UpdateBibleProgressTest(ProgressTestBase):
    URL = '/api/v1/todos/reading/update/'

    def _complete(self, schedule_ids):
        return self.client.post(self.URL, {
            'plan_id': self.plan.id,
            'schedule_ids': schedule_ids,
            'action': 'complete',
        }, format='json')

    def test_complete_sets_completed_at(self):
        res = self._complete([self.schedules[0].id])
        self.assertEqual(res.status_code, 200)

        progress = UserBibleProgress.objects.get(
            subscription=self.subscription, schedule=self.schedules[0],
        )
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)

    def test_double_complete_does_not_duplicate(self):
        self._complete([self.schedules[0].id])
        self._complete([self.schedules[0].id])

        count = UserBibleProgress.objects.filter(
            subscription=self.subscription, schedule=self.schedules[0],
        ).count()
        self.assertEqual(count, 1)

    def test_recomplete_preserves_first_completed_at(self):
        self._complete([self.schedules[0].id])
        first = UserBibleProgress.objects.get(schedule=self.schedules[0]).completed_at

        self._complete([self.schedules[0].id])
        second = UserBibleProgress.objects.get(schedule=self.schedules[0]).completed_at
        self.assertEqual(first, second)

    def test_cancel_resets_completed_at(self):
        self._complete([self.schedules[0].id])
        res = self.client.post(self.URL, {
            'plan_id': self.plan.id,
            'schedule_ids': [self.schedules[0].id],
            'action': 'cancel',
        }, format='json')
        self.assertEqual(res.status_code, 200)

        progress = UserBibleProgress.objects.get(schedule=self.schedules[0])
        self.assertFalse(progress.is_completed)
        self.assertIsNone(progress.completed_at)

    def test_requires_subscription(self):
        other = User.objects.create_user(
            username='other', nickname='다른사람', password='pw-test-1234',
        )
        client = APIClient()
        client.force_authenticate(user=other)
        res = client.post(self.URL, {
            'plan_id': self.plan.id,
            'schedule_ids': [self.schedules[0].id],
            'action': 'complete',
        }, format='json')
        self.assertEqual(res.status_code, 404)

    def test_plan_schedule_mismatch_rejected(self):
        other_plan = BibleReadingPlan.objects.create(name='다른 플랜', created_by=self.user)
        other_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan, date=date.today(), book='출애굽기',
            start_chapter=1, end_chapter=2,
        )
        res = self._complete([other_schedule.id])
        self.assertEqual(res.status_code, 400)


class ProgressRateBulkTest(ProgressTestBase):
    def test_bulk_matches_single_calculation(self):
        # 한 명은 일부 완료, 한 명은 구독 없음
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.schedules[0],
            is_completed=True,
            completed_at=timezone.now(),
        )
        no_sub_user = User.objects.create_user(
            username='nosub', nickname='무구독', password='pw-test-1234',
        )

        users = [self.user, no_sub_user]
        bulk = calculate_progress_rates_bulk(users, self.plan.id)

        self.assertEqual(bulk[self.user.id], calculate_progress_rate(self.user, self.plan.id))
        self.assertEqual(bulk[no_sub_user.id], 0)
        self.assertGreater(bulk[self.user.id], 0)

    def test_bulk_without_plan_filter(self):
        bulk = calculate_progress_rates_bulk([self.user])
        self.assertEqual(bulk[self.user.id], calculate_progress_rate(self.user))

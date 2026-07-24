from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import UserAchievement
from accounts.services.achievement_service import AchievementService
from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription, UserBibleProgress


User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class UnsubscribeProfileStatsTest(TestCase):
    FIXED_DATE = date(2026, 7, 10)

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="unsubscribe-stats-reader",
            nickname="구독취소통계독자",
            password="pw-test-1234",
        )
        self.plan_a = self._create_plan("통계 보존 플랜 A")
        self.plan_b = self._create_plan("통계 삭제 플랜 B")
        self.subscription_a = self._subscribe(self.plan_a)
        self.subscription_b = self._subscribe(self.plan_b)
        self.progress_a = self._complete_day(
            self.subscription_a,
            self.plan_a,
            self.FIXED_DATE - timedelta(days=1),
            "Genesis",
            1,
        )
        self.progress_b = self._complete_day(
            self.subscription_b,
            self.plan_b,
            self.FIXED_DATE,
            "Exodus",
            2,
        )
        self.client.force_authenticate(user=self.user)
        self._recalculate_stats()

    def _create_plan(self, name):
        return BibleReadingPlan.objects.create(name=name, created_by=self.user)

    def _subscribe(self, plan):
        return PlanSubscription.objects.create(
            user=self.user,
            plan=plan,
            start_date=self.FIXED_DATE,
            is_active=True,
        )

    def _complete_day(self, subscription, plan, schedule_date, book, chapter):
        schedule = DailyBibleSchedule.objects.create(
            plan=plan,
            date=schedule_date,
            book=book,
            start_chapter=chapter,
            end_chapter=chapter,
        )
        return UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def _recalculate_stats(self):
        with patch("accounts.services.achievement_service.timezone") as mock_timezone:
            mock_timezone.now.return_value.date.return_value = self.FIXED_DATE
            return AchievementService.update_user_stats(self.user)

    def _refresh_profile(self):
        self.user.profile.refresh_from_db()
        return self.user.profile

    def _assert_profile_stats(self, total, current_streak, longest_streak):
        profile = self._refresh_profile()
        self.assertEqual(profile.total_completed_days, total)
        self.assertEqual(profile.current_streak, current_streak)
        self.assertEqual(profile.longest_streak, longest_streak)

    def _unsubscribe(self, subscription):
        with patch("accounts.services.achievement_service.timezone") as mock_timezone:
            mock_timezone.now.return_value.date.return_value = self.FIXED_DATE
            return self.client.post(f"/api/v1/todos/plan/{subscription.pk}/unsubscribe/")

    def _delete_subscription(self, subscription):
        with patch("accounts.services.achievement_service.timezone") as mock_timezone:
            mock_timezone.now.return_value.date.return_value = self.FIXED_DATE
            return self.client.delete(f"/api/v1/todos/plan/{subscription.pk}/")

    def test_unsubscribe_recalculates_profile_stats_downward(self):
        achievement, _ = UserAchievement.objects.get_or_create(
            user=self.user,
            achievement_type="first_complete",
            defaults={"milestone_value": 1},
        )
        self._assert_profile_stats(2, 2, 2)

        response = self._unsubscribe(self.subscription_b)

        self.assertEqual(response.status_code, 200, response.data)
        self._assert_profile_stats(1, 1, 1)
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_a.pk).exists())
        self.assertFalse(UserBibleProgress.objects.filter(pk=self.progress_b.pk).exists())
        self.assertTrue(UserAchievement.objects.filter(pk=achievement.pk).exists())

    def test_subscription_delete_recalculates_profile_stats_downward(self):
        self._assert_profile_stats(2, 2, 2)

        response = self._delete_subscription(self.subscription_b)

        self.assertEqual(response.status_code, 204)
        self._assert_profile_stats(1, 1, 1)
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_a.pk).exists())
        self.assertFalse(UserBibleProgress.objects.filter(pk=self.progress_b.pk).exists())

    def test_unsubscribing_last_plan_zeroes_stats(self):
        first_response = self._unsubscribe(self.subscription_b)
        self.assertEqual(first_response.status_code, 200, first_response.data)

        second_response = self._unsubscribe(self.subscription_a)

        self.assertEqual(second_response.status_code, 200, second_response.data)
        self._assert_profile_stats(0, 0, 0)

    def test_stats_recalculation_failure_rolls_back_unsubscribe(self):
        self.client.raise_request_exception = False

        with patch(
            "todos.views.AchievementService.update_user_stats",
            side_effect=RuntimeError("forced stats failure"),
        ):
            response = self.client.post(
                f"/api/v1/todos/plan/{self.subscription_b.pk}/unsubscribe/"
            )

        self.assertEqual(response.status_code, 500)
        self.assertTrue(
            PlanSubscription.objects.filter(pk=self.subscription_b.pk).exists()
        )
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_b.pk).exists())

from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from rest_framework.test import APIClient

from accounts.models import UserAchievement
from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription, UserBibleProgress


User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class ReadingFlowProfileStatsTest(TestCase):
    READING_URL = "/api/v1/todos/reading/"
    FIXED_DATE = date(2026, 7, 10)

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="mainflow-stats-reader",
            nickname="메인흐름통계독자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="메인 흐름 통계 플랜",
            created_by=self.user,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=self.FIXED_DATE,
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)
        self._chapter = 1

    def _schedule(self, day_offset=0):
        chapter = self._chapter
        self._chapter += 1
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=self.FIXED_DATE + timedelta(days=day_offset),
            book="Genesis",
            start_chapter=chapter,
            end_chapter=chapter,
        )

    def _post(self, schedules, action):
        with patch("accounts.services.achievement_service.timezone") as mock_timezone:
            mock_timezone.now.return_value.date.return_value = self.FIXED_DATE
            return self.client.post(
                self.READING_URL,
                {
                    "plan_id": self.plan.id,
                    "schedule_ids": [schedule.id for schedule in schedules],
                    "action": action,
                },
                format="json",
            )

    def _refresh_profile(self):
        self.user.profile.refresh_from_db()
        return self.user.profile

    def test_complete_recomputes_profile_stats_and_grants_first_achievement(self):
        schedule = self._schedule()

        response = self._post([schedule], "complete")

        self.assertEqual(response.status_code, 200, response.data)
        profile = self._refresh_profile()
        self.assertEqual(profile.total_completed_days, 1)
        self.assertEqual(profile.current_streak, 1)
        self.assertEqual(profile.longest_streak, 1)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user, achievement_type="first_complete"
            ).exists()
        )

    def test_bulk_complete_recomputes_consecutive_streak_fields(self):
        schedules = [self._schedule(offset) for offset in (-2, -1, 0)]

        response = self._post(schedules, "complete")

        self.assertEqual(response.status_code, 200, response.data)
        profile = self._refresh_profile()
        self.assertEqual(profile.total_completed_days, 3)
        self.assertEqual(profile.current_streak, 3)
        self.assertEqual(profile.longest_streak, 3)

    def test_cancel_recomputes_profile_stats_downward(self):
        schedule = self._schedule()
        complete_response = self._post([schedule], "complete")
        self.assertEqual(complete_response.status_code, 200, complete_response.data)

        cancel_response = self._post([schedule], "cancel")

        self.assertEqual(cancel_response.status_code, 200, cancel_response.data)
        profile = self._refresh_profile()
        self.assertEqual(profile.total_completed_days, 0)
        self.assertEqual(profile.current_streak, 0)
        self.assertEqual(profile.longest_streak, 0)

    def test_cancel_does_not_grant_achievements(self):
        schedule = self._schedule()

        response = self._post([schedule], "cancel")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(UserAchievement.objects.filter(user=self.user).exists())

    def test_repeat_complete_remains_idempotent_for_completed_day_count(self):
        schedule = self._schedule()
        first_response = self._post([schedule], "complete")
        self.assertEqual(first_response.status_code, 200, first_response.data)

        second_response = self._post([schedule], "complete")

        self.assertEqual(second_response.status_code, 200, second_response.data)
        self.assertEqual(
            UserBibleProgress.objects.filter(
                subscription=self.subscription, schedule=schedule
            ).count(),
            1,
        )
        self.assertEqual(self._refresh_profile().total_completed_days, 1)

    def test_stats_recalculation_failure_rolls_back_progress_write(self):
        schedule = self._schedule()
        self.client.raise_request_exception = False

        with patch(
            "todos.views.AchievementService.update_user_stats",
            side_effect=RuntimeError("forced stats failure"),
        ):
            response = self._post([schedule], "complete")

        self.assertEqual(response.status_code, 500)
        self.assertFalse(
            UserBibleProgress.objects.filter(
                subscription=self.subscription, schedule=schedule
            ).exists()
        )

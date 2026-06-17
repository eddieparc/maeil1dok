from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import path
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from accounts.models import UserAchievement
from accounts import profile_views
from accounts.services.achievement_service import AchievementService
from todos import scoreboard_views
from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    HasenaRecord,
    PlanSubscription,
    UserBibleProgress,
)

User = get_user_model()

urlpatterns = [
    path("api/v1/accounts/profile/<int:user_id>/achievements/", profile_views.get_user_achievements),
    path("api/v1/todos/scoreboard/", scoreboard_views.get_scoreboard),
    path("api/v1/todos/scoreboard/my-ranking/", scoreboard_views.get_my_ranking),
]


@override_settings(ROOT_URLCONF=__name__)
class HasenaScoreboardTest(TestCase):
    SCOREBOARD_URL = "/api/v1/todos/scoreboard/"
    MY_RANKING_URL = "/api/v1/todos/scoreboard/my-ranking/"

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.factory = APIRequestFactory()
        self.reader = User.objects.create_user(
            username="reader",
            nickname="가나",
            password="pw-test-1234",
        )
        self.hasena_reader = User.objects.create_user(
            username="hasena-reader",
            nickname="다라",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="테스트 플랜",
            created_by=self.reader,
        )
        self.reader_subscription = PlanSubscription.objects.create(
            user=self.reader,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date.today(),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )

    def test_scoreboard_ranks_hasena_completion_with_bible_completion(self):
        UserBibleProgress.objects.create(
            subscription=self.reader_subscription,
            schedule=self.schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )
        for offset in range(2):
            HasenaRecord.objects.create(
                user=self.hasena_reader,
                date=date.today() - timedelta(days=offset),
                is_completed=True,
            )

        request = self.factory.get(self.SCOREBOARD_URL, {"period": "all", "limit": 10})
        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        leaderboard = response.data["leaderboard"]
        self.assertEqual(leaderboard[0]["user"]["id"], self.hasena_reader.id)
        self.assertEqual(leaderboard[0]["rank"], 1)
        self.assertEqual(leaderboard[0]["activity_score"], 2)
        self.assertEqual(leaderboard[0]["hasena_completed_days"], 2)
        self.assertEqual(leaderboard[0]["bible_completed_days"], 0)
        self.assertEqual(leaderboard[1]["user"]["id"], self.reader.id)
        self.assertEqual(leaderboard[1]["activity_score"], 1)

    def test_scoreboard_candidate_slice_uses_combined_activity(self):
        for index in range(21):
            user = User.objects.create_user(
                username=f"reader-{index}",
                nickname=f"통독러{index:02d}",
                password="pw-test-1234",
            )
            subscription = PlanSubscription.objects.create(
                user=user,
                plan=self.plan,
                start_date=date.today(),
                is_active=True,
            )
            UserBibleProgress.objects.create(
                subscription=subscription,
                schedule=self.schedule,
                is_completed=True,
                completed_at=timezone.now(),
            )

        for offset in range(100):
            HasenaRecord.objects.create(
                user=self.hasena_reader,
                date=date.today() - timedelta(days=offset),
                is_completed=True,
            )

        request = self.factory.get(self.SCOREBOARD_URL, {"period": "all", "limit": 10})
        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        leaderboard = response.data["leaderboard"]
        self.assertEqual(leaderboard[0]["user"]["id"], self.hasena_reader.id)
        self.assertEqual(leaderboard[0]["activity_score"], 100)

    def test_authenticated_private_self_is_not_replayed_from_global_cache(self):
        private_user = User.objects.create_user(
            username="private-hasena",
            nickname="비공개하시조",
            password="pw-test-1234",
        )
        private_user.profile.is_public = False
        private_user.profile.save()
        for offset in range(5):
            HasenaRecord.objects.create(
                user=private_user,
                date=date.today() - timedelta(days=offset),
                is_completed=True,
            )

        authenticated_request = self.factory.get(self.SCOREBOARD_URL, {"period": "all", "limit": 10})
        force_authenticate(authenticated_request, user=private_user)
        authenticated_response = scoreboard_views.get_scoreboard(authenticated_request)
        self.assertEqual(authenticated_response.status_code, 200)
        self.assertTrue(
            any(item["user"]["id"] == private_user.id for item in authenticated_response.data["leaderboard"])
        )

        anonymous_request = self.factory.get(self.SCOREBOARD_URL, {"period": "all", "limit": 10})
        anonymous_response = scoreboard_views.get_scoreboard(anonymous_request)
        self.assertEqual(anonymous_response.status_code, 200)
        self.assertFalse(
            any(item["user"]["id"] == private_user.id for item in anonymous_response.data["leaderboard"])
        )

    def test_my_ranking_includes_hasena_activity_score(self):
        self.client.force_authenticate(user=self.hasena_reader)
        for offset in range(3):
            HasenaRecord.objects.create(
                user=self.hasena_reader,
                date=date.today() - timedelta(days=offset),
                is_completed=True,
            )

        request = self.factory.get(self.MY_RANKING_URL, {"period": "all"})
        force_authenticate(request, user=self.hasena_reader)
        response = scoreboard_views.get_my_ranking(request)

        self.assertEqual(response.status_code, 200)
        ranking = response.data["ranking"]
        self.assertEqual(ranking["rank"], 1)
        self.assertEqual(ranking["activity_score"], 3)
        self.assertEqual(ranking["hasena_completed_days"], 3)
        self.assertEqual(ranking["completed_days"], 0)


@override_settings(ROOT_URLCONF=__name__)
class HasenaAchievementTest(TestCase):
    ACHIEVEMENTS_URL_TEMPLATE = "/api/v1/accounts/profile/{user_id}/achievements/"

    def setUp(self):
        self.client = APIClient()
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username="hasena-achiever",
            nickname="하시조러",
            password="pw-test-1234",
        )

    def test_hasena_total_milestones_grant_achievements(self):
        for offset in range(30):
            HasenaRecord.objects.create(
                user=self.user,
                date=date.today() - timedelta(days=offset),
                is_completed=True,
            )

        AchievementService.check_and_grant_achievements(self.user)

        achievement = UserAchievement.objects.get(
            user=self.user,
            achievement_type="hasena_total_30",
        )
        self.assertEqual(achievement.milestone_value, 30)

    def test_hasena_total_100_and_streak_7_milestones_grant_achievements(self):
        start = date.today() - timedelta(days=120)
        for offset in range(100):
            HasenaRecord.objects.create(
                user=self.user,
                date=start + timedelta(days=offset),
                is_completed=True,
            )

        AchievementService.check_and_grant_achievements(self.user)

        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="hasena_total_100",
                milestone_value=100,
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="hasena_streak_7",
                milestone_value=7,
            ).exists()
        )

    def test_hasena_streak_skips_sunday_rest_day(self):
        monday = date.today() - timedelta(days=date.today().weekday() + 14)
        required_dates = [monday + timedelta(days=offset) for offset in range(6)]
        required_dates.append(monday + timedelta(days=7))
        self.assertEqual((monday + timedelta(days=6)).weekday(), 6)

        for completed_date in required_dates:
            HasenaRecord.objects.create(
                user=self.user,
                date=completed_date,
                is_completed=True,
            )

        AchievementService.check_and_grant_achievements(self.user)

        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="hasena_streak_7",
                milestone_value=7,
            ).exists()
        )

    def test_incomplete_hasena_records_do_not_grant_or_duplicate_achievements(self):
        for offset in range(30):
            HasenaRecord.objects.create(
                user=self.user,
                date=date.today() - timedelta(days=offset),
                is_completed=False,
            )

        AchievementService.check_and_grant_achievements(self.user)
        self.assertFalse(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type__startswith="hasena_",
            ).exists()
        )

        for offset in range(30):
            HasenaRecord.objects.filter(
                user=self.user,
                date=date.today() - timedelta(days=offset),
            ).update(is_completed=True)

        AchievementService.check_and_grant_achievements(self.user)
        AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="hasena_total_30",
            ).count(),
            1,
        )

    def test_achievements_api_returns_hasena_locked_and_unlocked_metadata(self):
        for offset in range(30):
            HasenaRecord.objects.create(
                user=self.user,
                date=date.today() - timedelta(days=offset),
                is_completed=True,
            )
        AchievementService.check_and_grant_achievements(self.user)

        request = self.factory.get(self.ACHIEVEMENTS_URL_TEMPLATE.format(user_id=self.user.id))
        response = profile_views.get_user_achievements(request, self.user.id)

        self.assertEqual(response.status_code, 200)
        achievements = {
            item["achievement_type"]: item
            for item in response.data["data"]["achievements"]
        }
        self.assertTrue(achievements["hasena_total_30"]["unlocked"])
        self.assertEqual(achievements["hasena_total_30"]["milestone_value"], 30)
        self.assertFalse(achievements["hasena_total_100"]["unlocked"])
        self.assertEqual(achievements["hasena_total_100"]["milestone_value"], 100)

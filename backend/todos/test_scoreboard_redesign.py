from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from todos import scoreboard_views
from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    HasenaRecord,
    GroupMembership,
    PlanSubscription,
    ReadingGroup,
    UserBibleProgress,
)
from accounts.models import Follow
from todos.scoreboard_views import calculate_progress_rates_bulk, rank_leaderboard
from todos.services.hasena_activity import calculate_hasena_activity_stats

User = get_user_model()


class ScoreboardParamValidationTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username="param-reader",
            nickname="파라미터독자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="파라미터 플랜",
            created_by=self.user,
        )

    def test_scoreboard_returns_400_when_limit_is_malformed(self):
        request = self.factory.get("/api/v1/todos/scoreboard/", {"limit": "not-a-number"})

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_scoreboard_returns_400_when_plan_id_is_malformed(self):
        request = self.factory.get("/api/v1/todos/scoreboard/", {"plan_id": "not-a-plan"})

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_all_scoreboard_views_reject_invalid_period(self):
        group = ReadingGroup.objects.create(
            name="검증 그룹",
            creator=self.user,
            is_public=True,
        )
        group.plans.add(self.plan)
        GroupMembership.objects.create(group=group, user=self.user, role="admin")
        cases = [
            (scoreboard_views.get_scoreboard, "/api/v1/todos/scoreboard/"),
            (scoreboard_views.get_friends_scoreboard, "/api/v1/todos/scoreboard/friends/"),
            (scoreboard_views.get_my_ranking, "/api/v1/todos/scoreboard/my-ranking/"),
        ]

        for view, path in cases:
            with self.subTest(path=path):
                request = self.factory.get(path, {"period": "year"})
                force_authenticate(request, user=self.user)
                response = view(request)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(response.data["success"])

        request = self.factory.get(
            f"/api/v1/todos/scoreboard/group/{group.id}/",
            {"period": "year"},
        )
        force_authenticate(request, user=self.user)
        response = scoreboard_views.get_group_scoreboard(request, group.id)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_friends_scoreboard_rejects_unsupported_type(self):
        request = self.factory.get("/api/v1/todos/scoreboard/friends/", {"type": "followers"})
        force_authenticate(request, user=self.user)

        response = scoreboard_views.get_friends_scoreboard(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])


class ProgressRateRedesignTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="progress-reader",
            nickname="진도독자",
            password="pw-test-1234",
        )
        self.active_plan = BibleReadingPlan.objects.create(
            name="활성 플랜",
            created_by=self.user,
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="비활성 플랜",
            created_by=self.user,
        )
        self.active_subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.active_plan,
            start_date=date.today(),
            is_active=True,
        )
        self.inactive_subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.inactive_plan,
            start_date=date.today(),
            is_active=False,
        )

    def _schedule(self, plan, day_offset, book):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today() - timedelta(days=day_offset),
            book=book,
            start_chapter=1,
            end_chapter=1,
        )

    def _complete(self, subscription, schedule):
        return UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def test_bulk_progress_rate_without_plan_ignores_inactive_subscriptions(self):
        active_schedules = [
            self._schedule(self.active_plan, 0, "창세기"),
            self._schedule(self.active_plan, 1, "창세기"),
        ]
        inactive_schedules = [
            self._schedule(self.inactive_plan, 0, "출애굽기"),
            self._schedule(self.inactive_plan, 1, "출애굽기"),
        ]
        self._complete(self.active_subscription, active_schedules[0])
        for schedule in inactive_schedules:
            self._complete(self.inactive_subscription, schedule)

        rates = calculate_progress_rates_bulk([self.user])

        self.assertEqual(rates[self.user.id], 50.0)

    def test_global_scoreboard_activity_ignores_inactive_subscription_progress(self):
        active_schedule = self._schedule(self.active_plan, 0, "창세기")
        inactive_schedule = self._schedule(self.inactive_plan, 1, "출애굽기")
        self._complete(self.active_subscription, active_schedule)
        self._complete(self.inactive_subscription, inactive_schedule)
        self.user.profile.is_public = True
        self.user.profile.save(update_fields=["is_public"])
        request = APIRequestFactory().get("/api/v1/todos/scoreboard/", {"period": "all"})

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        entry = response.data["leaderboard"][0]
        self.assertEqual(entry["completed_days"], 1)
        self.assertEqual(entry["bible_completed_days"], 1)
        self.assertEqual(entry["activity_score"], 1)

    def test_friends_scoreboard_hides_private_followed_user(self):
        follower = User.objects.create_user(
            username="follower",
            nickname="팔로워",
            password="pw-test-1234",
        )
        self.user.profile.is_public = False
        self.user.profile.save(update_fields=["is_public"])
        Follow.objects.create(follower=follower, following=self.user)
        self._complete(self.active_subscription, self._schedule(self.active_plan, 0, "창세기"))
        factory = APIRequestFactory()
        request = factory.get("/api/v1/todos/scoreboard/friends/", {"type": "following"})
        force_authenticate(request, user=follower)

        response = scoreboard_views.get_friends_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        returned_ids = {entry["user"]["id"] for entry in response.data["leaderboard"]}
        self.assertNotIn(self.user.id, returned_ids)
        self.assertIn(follower.id, returned_ids)


class UserBibleProgressStatsRedesignTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="stats-reader",
            nickname="통계독자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="통계 플랜",
            created_by=self.user,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )
        self.today_schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date.today(),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        self.yesterday_schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date.today() - timedelta(days=1),
            book="창세기",
            start_chapter=2,
            end_chapter=2,
        )

    def test_reversing_completed_progress_recomputes_profile_stats_downward(self):
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.yesterday_schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )
        reversed_progress = UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.today_schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.total_completed_days, 2)
        self.assertEqual(self.user.profile.longest_streak, 2)

        reversed_progress.is_completed = False
        reversed_progress.completed_at = None
        reversed_progress.save()

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.total_completed_days, 1)
        self.assertEqual(self.user.profile.current_streak, 1)
        self.assertEqual(self.user.profile.longest_streak, 1)


class ScoreboardRankTieRedesignTest(TestCase):
    def test_rank_tie_breaks_by_longest_hasena_streak_then_nickname(self):
        leaderboard = [
            {
                "user": {"nickname": "다라"},
                "activity_score": 5,
                "completed_days": 0,
                "progress_rate": 0,
                "longest_hasena_streak": 2,
            },
            {
                "user": {"nickname": "가나"},
                "activity_score": 5,
                "completed_days": 0,
                "progress_rate": 0,
                "longest_hasena_streak": 2,
            },
            {
                "user": {"nickname": "마바"},
                "activity_score": 5,
                "completed_days": 0,
                "progress_rate": 0,
                "longest_hasena_streak": 1,
            },
        ]

        ranked = rank_leaderboard(leaderboard)

        self.assertEqual([item["user"]["nickname"] for item in ranked], ["가나", "다라", "마바"])
        self.assertEqual([item["rank"] for item in ranked], [1, 2, 3])

    def test_scoreboard_limit_is_applied_after_progress_tie_breaking(self):
        factory = APIRequestFactory()
        users = []
        for index in range(5):
            user = User.objects.create_user(
                username=f"tie-reader-{index}",
                nickname=f"독자{index}",
                password="pw-test-1234",
            )
            user.profile.is_public = True
            user.profile.save(update_fields=["is_public"])
            plan = BibleReadingPlan.objects.create(name=f"동률 플랜 {index}", created_by=user)
            sub = PlanSubscription.objects.create(
                user=user,
                plan=plan,
                start_date=date.today(),
                is_active=True,
            )
            total_schedules = 2 if index == 4 else 4
            schedules = [
                DailyBibleSchedule.objects.create(
                    plan=plan,
                    date=date.today() - timedelta(days=(index * 10) + offset),
                    book="창세기",
                    start_chapter=offset + 1,
                    end_chapter=offset + 1,
                )
                for offset in range(total_schedules)
            ]
            UserBibleProgress.objects.create(
                subscription=sub,
                schedule=schedules[0],
                is_completed=True,
                completed_at=timezone.now(),
            )
            users.append(user)
        request = factory.get("/api/v1/todos/scoreboard/", {"period": "all", "limit": 2})

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        returned_names = [entry["user"]["nickname"] for entry in response.data["leaderboard"]]
        self.assertIn("독자4", returned_names)


class HasenaStreakVariantTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="hasena-variant-reader",
            nickname="하세나변형독자",
            password="pw-test-1234",
        )

    def _record(self, completed_date):
        return HasenaRecord.objects.create(
            user=self.user,
            date=completed_date,
            is_completed=True,
        )

    def test_sunday_completion_does_not_inflate_longest_hasena_streak(self):
        monday = date.today() - timedelta(days=date.today().weekday() + 14)
        saturday = monday + timedelta(days=5)
        sunday = monday + timedelta(days=6)
        next_monday = monday + timedelta(days=7)
        self.assertEqual(sunday.weekday(), 6)

        for completed_date in [saturday, sunday, next_monday]:
            self._record(completed_date)

        stats = calculate_hasena_activity_stats(self.user)

        self.assertEqual(stats["longest_streak"], 2)

    def test_missing_required_weekday_breaks_hasena_streak_across_sunday(self):
        monday = date.today() - timedelta(days=date.today().weekday() + 14)
        friday = monday + timedelta(days=4)
        next_monday = monday + timedelta(days=7)

        for completed_date in [friday, next_monday]:
            self._record(completed_date)

        stats = calculate_hasena_activity_stats(self.user)

        self.assertEqual(stats["longest_streak"], 1)

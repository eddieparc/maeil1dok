from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

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

    def test_scoreboard_returns_400_when_month_is_malformed(self):
        request = self.factory.get("/api/v1/todos/scoreboard/", {
            "period": "month",
            "month": "2026-13",
        })

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_scoreboard_handles_max_year_month_without_500(self):
        request = self.factory.get("/api/v1/todos/scoreboard/", {
            "period": "month",
            "month": "9999-12",
        })

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["month"], "9999-12")
        for entry in response.data["leaderboard"]:
            self.assertEqual(entry["completed_days"], 0)
            self.assertEqual(entry["hasena_completed_days"], 0)

    def test_my_ranking_handles_max_year_month_without_500(self):
        request = self.factory.get("/api/v1/todos/scoreboard/my-ranking/", {
            "period": "month",
            "month": "9999-12",
        })
        force_authenticate(request, user=self.user)

        response = scoreboard_views.get_my_ranking(request)

        self.assertNotEqual(response.status_code, 500)


class ScoreboardInactivePlanVisibilityTest(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username="inactive-plan-reader",
            nickname="비활성플랜독자",
            password="pw-test-1234",
        )
        self.user.profile.is_public = True
        self.user.profile.save(update_fields=["is_public"])
        self.active_plan = BibleReadingPlan.objects.create(
            name="활성 리더보드 플랜",
            created_by=self.user,
            is_active=True,
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="닫힌 리더보드 플랜",
            created_by=self.user,
            is_active=False,
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
            is_active=True,
        )

    def _complete_plan(self, plan, subscription, book):
        schedule = DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today(),
            book=book,
            start_chapter=1,
            end_chapter=1,
        )
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def test_global_scoreboard_hides_inactive_plan_id(self):
        self._complete_plan(self.inactive_plan, self.inactive_subscription, "민수기")
        request = self.factory.get(
            "/api/v1/todos/scoreboard/",
            {"plan_id": self.inactive_plan.id},
        )

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertNotIn("leaderboard", response.data)

    def test_global_scoreboard_active_plan_id_still_works(self):
        self._complete_plan(self.active_plan, self.active_subscription, "신명기")
        request = self.factory.get(
            "/api/v1/todos/scoreboard/",
            {"plan_id": self.active_plan.id},
        )

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_id"], self.active_plan.id)
        self.assertEqual(response.data["leaderboard"][0]["user"]["id"], self.user.id)

    def test_public_group_scoreboard_hides_inactive_group_plan_metadata(self):
        group = ReadingGroup.objects.create(
            name="닫힌 플랜 그룹",
            creator=self.user,
            is_public=True,
        )
        group.plans.add(self.inactive_plan)
        GroupMembership.objects.create(group=group, user=self.user, is_active=True)
        self._complete_plan(self.inactive_plan, self.inactive_subscription, "여호수아")
        request = self.factory.get(
            f"/api/v1/todos/scoreboard/group/{group.id}/",
            {"plan_id": self.inactive_plan.id},
        )

        response = scoreboard_views.get_group_scoreboard(request, group.id)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertNotIn("plan", response.data)

    def test_public_group_scoreboard_without_plan_id_hides_inactive_default_plan(self):
        group = ReadingGroup.objects.create(
            name="닫힌 기본 플랜 그룹",
            creator=self.user,
            is_public=True,
        )
        group.plans.add(self.inactive_plan)
        GroupMembership.objects.create(group=group, user=self.user, is_active=True)
        self._complete_plan(self.inactive_plan, self.inactive_subscription, "사사기")
        request = self.factory.get(f"/api/v1/todos/scoreboard/group/{group.id}/")

        response = scoreboard_views.get_group_scoreboard(request, group.id)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertNotIn("plan", response.data)
        self.assertNotIn("leaderboard", response.data)


@override_settings(ROOT_URLCONF="config.urls")
class GroupScoreboardCacheIsolationTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = self._user("cache-owner", "캐시그룹장")
        self.member = self._user("cache-member", "캐시멤버")
        self.plan = BibleReadingPlan.objects.create(
            name="캐시 격리 플랜",
            created_by=self.owner,
            is_active=True,
        )

    def _user(self, username, nickname):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            password="pw-test-1234",
        )
        user.profile.is_public = True
        user.profile.save(update_fields=["is_public"])
        return user

    def _group(self, is_public):
        group = ReadingGroup.objects.create(
            name="공개 캐시 그룹" if is_public else "비공개 캐시 그룹",
            creator=self.owner,
            is_public=is_public,
        )
        group.plans.add(self.plan)
        for user in [self.owner, self.member]:
            GroupMembership.objects.create(
                group=group,
                user=user,
                role="admin" if user == self.owner else "member",
                is_active=True,
            )
            PlanSubscription.objects.create(
                user=user,
                plan=self.plan,
                start_date=date.today(),
                is_active=True,
            )
        return group

    def _get_group_scoreboard(self, group, user=None):
        self.client.force_authenticate(user=user)
        response = self.client.get(f"/api/v1/todos/scoreboard/group/{group.id}/")
        self.client.force_authenticate(user=None)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["leaderboard"]

    def test_authenticated_public_group_scoreboard_cache_does_not_leak_is_me_to_anonymous_reader(self):
        group = self._group(is_public=True)
        authenticated_leaderboard = self._get_group_scoreboard(group, self.owner)

        anonymous_leaderboard = self._get_group_scoreboard(group)

        self.assertIn(True, {entry["user"]["is_me"] for entry in authenticated_leaderboard})
        self.assertNotIn(True, {entry["user"]["is_me"] for entry in anonymous_leaderboard})

    def test_public_group_scoreboard_ignores_old_viewer_specific_cache_entries(self):
        group = self._group(is_public=True)
        old_cache_key = f"scoreboard:v3:group:{group.id}:{self.plan.id}:all:None"
        cache.set(
            old_cache_key,
            {
                "success": True,
                "leaderboard": [
                    {
                        "user": {
                            "id": self.owner.id,
                            "nickname": self.owner.nickname,
                            "profile_image": self.owner.profile_image,
                            "is_me": True,
                        },
                    },
                ],
            },
            180,
        )

        anonymous_leaderboard = self._get_group_scoreboard(group)

        self.assertNotIn(True, {entry["user"]["is_me"] for entry in anonymous_leaderboard})

    def test_private_group_scoreboard_cache_does_not_leak_is_me_between_members(self):
        group = self._group(is_public=False)
        owner_leaderboard = self._get_group_scoreboard(group, self.owner)

        member_leaderboard = self._get_group_scoreboard(group, self.member)

        owner_entry = next(entry for entry in owner_leaderboard if entry["user"]["id"] == self.owner.id)
        member_entry = next(entry for entry in member_leaderboard if entry["user"]["id"] == self.member.id)
        stale_owner_entry = next(entry for entry in member_leaderboard if entry["user"]["id"] == self.owner.id)
        self.assertTrue(owner_entry["user"]["is_me"])
        self.assertTrue(member_entry["user"]["is_me"])
        self.assertFalse(stale_owner_entry["user"]["is_me"])

    def test_anonymous_public_group_scoreboard_hides_private_profile_members(self):
        group = self._group(is_public=True)
        self.member.profile.is_public = False
        self.member.profile.save(update_fields=["is_public"])

        anonymous_leaderboard = self._get_group_scoreboard(group)

        returned_ids = {entry["user"]["id"] for entry in anonymous_leaderboard}
        self.assertIn(self.owner.id, returned_ids)
        self.assertNotIn(self.member.id, returned_ids)

    def test_private_profile_member_still_sees_self_in_public_group_scoreboard(self):
        group = self._group(is_public=True)
        self.member.profile.is_public = False
        self.member.profile.save(update_fields=["is_public"])

        member_leaderboard = self._get_group_scoreboard(group, self.member)

        returned_ids = {entry["user"]["id"] for entry in member_leaderboard}
        self.assertIn(self.owner.id, returned_ids)
        self.assertIn(self.member.id, returned_ids)


class MonthlyScoreboardContractTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username="monthly-reader",
            nickname="월간독자",
            password="pw-test-1234",
        )
        self.user.profile.is_public = True
        self.user.profile.save(update_fields=["is_public"])
        self.plan = BibleReadingPlan.objects.create(
            name="월간 플랜",
            created_by=self.user,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )

    def _complete_on(self, completed_date):
        schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=completed_date,
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        completed_at = datetime.combine(completed_date, time(hour=12))
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=completed_at,
        )

    def test_month_scoreboard_uses_calendar_month_not_rolling_30_days(self):
        today = timezone.now().date()
        first_day = today.replace(day=1)
        previous_month_day = first_day - timedelta(days=1)
        self._complete_on(previous_month_day)
        self._complete_on(first_day)
        HasenaRecord.objects.create(user=self.user, date=previous_month_day, is_completed=True)
        HasenaRecord.objects.create(user=self.user, date=first_day, is_completed=True)
        request = self.factory.get("/api/v1/todos/scoreboard/", {"period": "month"})

        response = scoreboard_views.get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        entry = response.data["leaderboard"][0]
        self.assertEqual(response.data["period"], "month")
        self.assertEqual(entry["bible_completed_days"], 1)
        self.assertEqual(entry["hasena_completed_days"], 1)


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


class InactiveUserScoreboardVisibilityTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.active_user = self._reader("active-score-reader", "활성점수독자")
        self.inactive_user = self._reader("inactive-score-reader", "삭제점수독자", is_active=False)
        self.scheduled_user = self._reader(
            "scheduled-score-reader",
            "예약삭제점수독자",
            scheduled_for_deletion=True,
        )
        Follow.objects.create(follower=self.active_user, following=self.inactive_user)
        Follow.objects.create(follower=self.active_user, following=self.scheduled_user)

    def _reader(self, username, nickname, is_active=True, scheduled_for_deletion=False):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            password="pw-test-1234",
        )
        user.profile.is_public = True
        user.profile.save(update_fields=["is_public"])
        if not is_active or scheduled_for_deletion:
            user.is_active = False
            user.scheduled_deletion_at = timezone.now()
            if scheduled_for_deletion:
                user.is_active = True
            user.save(update_fields=["is_active", "scheduled_deletion_at"])
        plan = BibleReadingPlan.objects.create(name=f"{nickname} 플랜", created_by=user)
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date.today(),
            is_active=True,
        )
        schedule = DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today(),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )
        return user

    def test_global_scoreboard_hides_inactive_public_users(self):
        response = self.client.get("/api/v1/todos/scoreboard/", {"period": "all"})

        self.assertEqual(response.status_code, 200, response.data)
        user_ids = {entry["user"]["id"] for entry in response.data["leaderboard"]}
        self.assertIn(self.active_user.id, user_ids)
        self.assertNotIn(self.inactive_user.id, user_ids)
        self.assertNotIn(self.scheduled_user.id, user_ids)

    def test_friends_scoreboard_hides_inactive_and_scheduled_public_users(self):
        self.client.force_authenticate(user=self.active_user)

        response = self.client.get("/api/v1/todos/scoreboard/friends/", {"type": "following"})

        self.assertEqual(response.status_code, 200, response.data)
        user_ids = {entry["user"]["id"] for entry in response.data["leaderboard"]}
        self.assertIn(self.active_user.id, user_ids)
        self.assertNotIn(self.inactive_user.id, user_ids)
        self.assertNotIn(self.scheduled_user.id, user_ids)

    def test_mutual_friends_scoreboard_hides_inactive_and_scheduled_public_users(self):
        Follow.objects.create(follower=self.inactive_user, following=self.active_user)
        Follow.objects.create(follower=self.scheduled_user, following=self.active_user)
        self.client.force_authenticate(user=self.active_user)

        response = self.client.get("/api/v1/todos/scoreboard/friends/", {"type": "mutual"})

        self.assertEqual(response.status_code, 200, response.data)
        user_ids = {entry["user"]["id"] for entry in response.data["leaderboard"]}
        self.assertIn(self.active_user.id, user_ids)
        self.assertNotIn(self.inactive_user.id, user_ids)
        self.assertNotIn(self.scheduled_user.id, user_ids)

    def test_my_ranking_excludes_inactive_and_scheduled_public_users_from_total(self):
        self.client.force_authenticate(user=self.active_user)

        response = self.client.get("/api/v1/todos/scoreboard/my-ranking/", {"period": "all"})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["ranking"]["total_users"], 1)

    def test_plan_my_ranking_excludes_scheduled_public_users_from_total(self):
        shared_plan = BibleReadingPlan.objects.create(
            name="공유 순위 플랜",
            created_by=self.active_user,
            is_active=True,
        )
        for user in [self.active_user, self.scheduled_user]:
            PlanSubscription.objects.create(
                user=user,
                plan=shared_plan,
                start_date=date.today(),
                is_active=True,
            )
        self.client.force_authenticate(user=self.active_user)

        response = self.client.get(
            "/api/v1/todos/scoreboard/my-ranking/",
            {"period": "all", "plan_id": shared_plan.id},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["ranking"]["total_users"], 1)


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

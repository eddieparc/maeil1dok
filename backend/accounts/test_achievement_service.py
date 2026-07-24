from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone as django_timezone

from accounts.achievement_config import ALL_BIBLE_BOOKS, BIBLE_BOOKS
from accounts.models import UserAchievement
from accounts.services.achievement_service import AchievementService
from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    HasenaRecord,
    PlanSubscription,
    UserBibleProgress,
)

User = get_user_model()


class AchievementFixtureMixin:
    FIXED_DATE = date(2026, 7, 10)

    def setUp(self):
        self.user, self.plan, self.subscription = self._create_user_plan_subscription(
            username="achievement-reader",
            nickname="업적독자",
        )
        self._chapter_sequence = 1

    def _create_user_plan_subscription(self, username, nickname, is_active=True):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            password="pw-test-1234",
        )
        plan = BibleReadingPlan.objects.create(
            name=f"{nickname} 플랜",
            created_by=user,
        )
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=self.FIXED_DATE,
            is_active=is_active,
        )
        return user, plan, subscription

    def _schedule(self, day_offset, book="창세기", plan=None):
        plan = plan or self.plan
        chapter = self._chapter_sequence
        self._chapter_sequence += 1
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=self.FIXED_DATE + timedelta(days=day_offset),
            book=book,
            start_chapter=chapter,
            end_chapter=chapter,
        )

    def _complete(self, day_offset, book="창세기", subscription=None, plan=None):
        subscription = subscription or self.subscription
        plan = plan or subscription.plan
        schedule = self._schedule(day_offset, book=book, plan=plan)
        return UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=django_timezone.now(),
        )

    def _complete_schedule(self, schedule, subscription=None):
        return UserBibleProgress.objects.create(
            subscription=subscription or self.subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=django_timezone.now(),
        )

    def _update_stats_with_fixed_today(self, user=None):
        with patch("accounts.services.achievement_service.timezone") as mock_timezone:
            mock_timezone.now.return_value.date.return_value = self.FIXED_DATE
            return AchievementService.update_user_stats(user or self.user)


class UpdateUserStatsStreakTest(AchievementFixtureMixin, TestCase):
    def test_consecutive_days_ending_today_update_current_and_longest_streaks(self):
        self._complete(0)
        self._complete(-1)
        self._complete(-2)

        profile = self._update_stats_with_fixed_today()

        self.assertEqual(profile.total_completed_days, 3)
        self.assertEqual(profile.current_streak, 3)
        self.assertEqual(profile.longest_streak, 3)

    def test_current_streak_counts_from_yesterday_when_today_not_completed(self):
        self._complete(-1)
        self._complete(-2)

        profile = self._update_stats_with_fixed_today()

        self.assertEqual(profile.current_streak, 2)
        self.assertEqual(profile.longest_streak, 2)

    def test_current_streak_stops_at_gap_but_longest_uses_historical_run(self):
        self._complete(0)
        self._complete(-1)
        self._complete(-3)
        self._complete(-5)
        self._complete(-6)
        self._complete(-7)
        self._complete(-8)

        profile = self._update_stats_with_fixed_today()

        self.assertEqual(profile.current_streak, 2)
        self.assertEqual(profile.longest_streak, 4)

    def test_no_completions_reset_all_profile_stats_to_zero(self):
        profile = self._update_stats_with_fixed_today()

        self.assertEqual(profile.total_completed_days, 0)
        self.assertEqual(profile.current_streak, 0)
        self.assertEqual(profile.longest_streak, 0)

    def test_duplicate_completion_dates_count_once_and_do_not_break_longest_streak(self):
        self._complete(0, book="창세기")
        self._complete(0, book="출애굽기")
        self._complete(-1, book="창세기")

        profile = self._update_stats_with_fixed_today()

        self.assertEqual(profile.total_completed_days, 2)
        self.assertEqual(profile.current_streak, 2)
        self.assertEqual(profile.longest_streak, 2)

    def _current_streak_with_fixed_today(self, user=None):
        with patch("accounts.services.achievement_service.timezone") as mock_timezone:
            mock_timezone.now.return_value.date.return_value = self.FIXED_DATE
            return AchievementService._calculate_current_streak(user or self.user)

    def test_current_streak_uses_constant_queries_regardless_of_streak_length(self):
        # A long consecutive run must not trigger one query per day.
        for offset in range(0, -40, -1):
            self._complete(offset)

        with self.assertNumQueries(1):
            streak = self._current_streak_with_fixed_today()

        self.assertEqual(streak, 40)

    def test_current_streak_query_count_matches_short_and_long_runs(self):
        # Scale invariance: a single-day streak and a 30-day streak both
        # resolve in the same constant number of queries.
        self._complete(0)
        with self.assertNumQueries(1):
            short = self._current_streak_with_fixed_today()
        self.assertEqual(short, 1)

        for offset in range(-1, -30, -1):
            self._complete(offset)
        with self.assertNumQueries(1):
            long_run = self._current_streak_with_fixed_today()
        self.assertEqual(long_run, 30)


class BibleReadingAchievementGrantTest(AchievementFixtureMixin, TestCase):
    def _set_profile_stats(self, total_completed_days=0, longest_streak=0):
        profile = self.user.profile
        profile.total_completed_days = total_completed_days
        profile.longest_streak = longest_streak
        profile.current_streak = 0
        profile.save(update_fields=["total_completed_days", "longest_streak", "current_streak"])
        self.assertEqual(UserBibleProgress.objects.count(), 0)
        self.assertEqual(HasenaRecord.objects.count(), 0)

    def _achievement_types(self):
        return set(UserAchievement.objects.filter(user=self.user).values_list("achievement_type", flat=True))

    def test_streak_7_boundary_does_not_grant_at_six_days(self):
        self._set_profile_stats(longest_streak=6)

        granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(granted, [])
        self.assertNotIn("streak_7", self._achievement_types())

    def test_streak_7_boundary_grants_at_seven_days(self):
        self._set_profile_stats(longest_streak=7)

        granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(granted, ["streak_7"])
        achievement = UserAchievement.objects.get(user=self.user, achievement_type="streak_7")
        self.assertEqual(achievement.milestone_value, 7)

    def test_hundred_day_streak_grants_all_streak_milestones(self):
        self._set_profile_stats(longest_streak=100)

        granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(granted, ["streak_7", "streak_30", "streak_100"])
        self.assertTrue({"streak_7", "streak_30", "streak_100"}.issubset(self._achievement_types()))

    def test_total_30_boundary_does_not_grant_at_twenty_nine_days(self):
        self._set_profile_stats(total_completed_days=29)

        granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(granted, ["first_complete"])
        self.assertNotIn("total_30", self._achievement_types())
        first_complete = UserAchievement.objects.get(user=self.user, achievement_type="first_complete")
        self.assertEqual(first_complete.milestone_value, 1)

    def test_total_30_boundary_grants_at_thirty_days(self):
        self._set_profile_stats(total_completed_days=30)

        granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(granted, ["first_complete", "total_30"])
        total_30 = UserAchievement.objects.get(user=self.user, achievement_type="total_30")
        self.assertEqual(total_30.milestone_value, 30)

    def test_total_365_grants_all_total_milestones(self):
        self._set_profile_stats(total_completed_days=365)

        granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(granted, ["first_complete", "total_30", "total_100", "total_365"])
        self.assertTrue({"total_30", "total_100", "total_365"}.issubset(self._achievement_types()))

    def test_rechecking_already_granted_achievements_is_idempotent(self):
        self._set_profile_stats(total_completed_days=30, longest_streak=7)
        first_granted = AchievementService.check_and_grant_achievements(self.user)

        second_granted = AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(first_granted, ["first_complete", "streak_7", "total_30"])
        self.assertEqual(second_granted, [])
        for achievement_type in ["first_complete", "streak_7", "total_30"]:
            self.assertEqual(
                UserAchievement.objects.filter(user=self.user, achievement_type=achievement_type).count(),
                1,
            )


class BookCompletionAchievementTest(AchievementFixtureMixin, TestCase):
    def test_book_completion_requires_all_active_plan_schedules_for_book(self):
        first_schedule = self._schedule(0, book="요한삼서")
        second_schedule = self._schedule(1, book="요한삼서")
        self._complete_schedule(first_schedule)

        self.assertEqual(AchievementService._check_book_completion(self.user), [])
        self.assertFalse(UserAchievement.objects.filter(user=self.user, achievement_type="book_complete").exists())

        self._complete_schedule(second_schedule)
        completed_books = AchievementService._check_book_completion(self.user)
        AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(completed_books, ["요한삼서"])
        achievement = UserAchievement.objects.get(user=self.user, achievement_type="book_complete")
        self.assertEqual(achievement.details, {"books": ["요한삼서"]})
        self.assertEqual(achievement.milestone_value, 1)

    def test_inactive_subscription_progress_never_grants_book_completion(self):
        inactive_user, inactive_plan, inactive_subscription = self._create_user_plan_subscription(
            username="inactive-achievement-reader",
            nickname="비활성업적독자",
            is_active=False,
        )
        self.assertFalse(PlanSubscription.objects.filter(user=inactive_user, is_active=True).exists())
        self._complete(0, book="요한삼서", subscription=inactive_subscription, plan=inactive_plan)

        completed_books = AchievementService._check_book_completion(inactive_user)
        AchievementService.check_and_grant_achievements(inactive_user)

        self.assertEqual(completed_books, [])
        self.assertFalse(UserAchievement.objects.filter(user=inactive_user, achievement_type="book_complete").exists())

    def test_new_testament_completion_grants_testament_but_not_bible_completion(self):
        for book in BIBLE_BOOKS["new_testament"]:
            self._complete(0, book=book)

        completed_testaments = AchievementService._check_testament_completion(self.user)
        bible_completed = AchievementService._check_bible_completion(self.user)
        AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(completed_testaments, ["new_testament"])
        self.assertFalse(bible_completed)
        testament = UserAchievement.objects.get(user=self.user, achievement_type="testament_complete")
        self.assertEqual(testament.details, {"testaments": ["new_testament"]})
        self.assertEqual(testament.milestone_value, 1)
        self.assertFalse(UserAchievement.objects.filter(user=self.user, achievement_type="bible_complete").exists())

    def test_all_sixty_six_books_completion_grants_bible_completion(self):
        for book in ALL_BIBLE_BOOKS:
            self._complete(0, book=book)

        self.assertEqual(AchievementService._check_testament_completion(self.user), ["old_testament", "new_testament"])
        self.assertTrue(AchievementService._check_bible_completion(self.user))
        AchievementService.check_and_grant_achievements(self.user)

        achievement = UserAchievement.objects.get(user=self.user, achievement_type="bible_complete")
        self.assertEqual(achievement.milestone_value, 66)


class AchievementQueryBudgetTest(AchievementFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        for book in ALL_BIBLE_BOOKS:
            self._complete(0, book=book)

    def test_book_completion_uses_constant_query_budget(self):
        with CaptureQueriesContext(connection) as ctx:
            completed_books = AchievementService._check_book_completion(self.user)

        self.assertEqual(completed_books, list(ALL_BIBLE_BOOKS))
        self.assertLessEqual(len(ctx), 4)

    def test_full_achievement_check_reuses_book_completion_result(self):
        with patch.object(
            AchievementService,
            "_check_book_completion",
            side_effect=AchievementService._check_book_completion,
        ) as spy:
            AchievementService.check_and_grant_achievements(self.user)

        self.assertEqual(spy.call_count, 1)
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="book_complete",
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="testament_complete",
            ).exists()
        )
        self.assertTrue(
            UserAchievement.objects.filter(
                user=self.user,
                achievement_type="bible_complete",
            ).exists()
        )

    def test_steady_state_full_check_stays_under_hot_path_budget(self):
        AchievementService.check_and_grant_achievements(self.user)

        with CaptureQueriesContext(connection) as ctx:
            AchievementService.check_and_grant_achievements(self.user)

        self.assertLessEqual(len(ctx), 30)

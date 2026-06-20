from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from .models import (
    BibleReadingPlan, DailyBibleSchedule, PlanSubscription, UserBibleProgress,
    UserReadingPosition,
)
from .scoreboard_views import (
    calculate_progress_rate,
    calculate_progress_rates_bulk,
    get_my_ranking,
    get_scoreboard,
    rank_leaderboard,
)
from .serializers import UserReadingPositionSerializer
from .tasks import generate_hasena_summary_task

User = get_user_model()


class HasenaSummaryTaskTest(TestCase):
    def test_skips_outside_window_when_project_uses_naive_local_time(self):
        with patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 17, 7, 0, 0)):
            result = generate_hasena_summary_task()

        self.assertEqual(result, {'status': 'skipped', 'reason': 'outside_window'})


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


class UserReadingPositionSerializerTest(TestCase):
    def _valid_data(self, **overrides):
        data = {
            'book': 'exo',
            'chapter': 3,
            'scroll_position': 0.42,
            'version': 'KNT',
        }
        data.update(overrides)
        return data

    def test_normalizes_supported_book_and_version_codes(self):
        serializer = UserReadingPositionSerializer(data=self._valid_data(
            book='jon',
            version='knt',
        ))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['book'], 'jnh')
        self.assertEqual(serializer.validated_data['version'], 'KNT')

    def test_rejects_scroll_position_outside_zero_to_one(self):
        for scroll_position in (-0.01, 1.01):
            with self.subTest(scroll_position=scroll_position):
                serializer = UserReadingPositionSerializer(data=self._valid_data(
                    scroll_position=scroll_position,
                ))

                self.assertFalse(serializer.is_valid())
                self.assertIn('scroll_position', serializer.errors)

    def test_rejects_unsupported_book_code(self):
        serializer = UserReadingPositionSerializer(data=self._valid_data(book='bad'))

        self.assertFalse(serializer.is_valid())
        self.assertIn('book', serializer.errors)

    def test_rejects_chapter_beyond_book_bounds(self):
        serializer = UserReadingPositionSerializer(data=self._valid_data(
            book='exo',
            chapter=41,
        ))

        self.assertFalse(serializer.is_valid())
        self.assertIn('chapter', serializer.errors)

    def test_rejects_unsupported_version_code(self):
        serializer = UserReadingPositionSerializer(data=self._valid_data(version='KJV'))

        self.assertFalse(serializer.is_valid())
        self.assertIn('version', serializer.errors)


class UserReadingPositionApiTest(TestCase):
    URL = '/api/v1/todos/bible/reading-position/'

    def setUp(self):
        self.user = User.objects.create_user(
            username='position-reader',
            nickname='위치독자',
            password='pw-test-1234',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_first_save_creates_position_after_validation(self):
        response = self.client.post(self.URL, {
            'book': 'jon',
            'chapter': 3,
            'scroll_position': 0.42,
            'version': 'knt',
        }, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        position = UserReadingPosition.objects.get(user=self.user)
        self.assertEqual(position.book, 'jnh')
        self.assertEqual(position.chapter, 3)
        self.assertEqual(position.scroll_position, 0.42)
        self.assertEqual(position.version, 'KNT')

    def test_first_save_rejects_invalid_payload_without_creating_position(self):
        response = self.client.post(self.URL, {
            'book': 'exo',
            'chapter': 41,
            'scroll_position': 0.42,
            'version': 'KNT',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(UserReadingPosition.objects.filter(user=self.user).exists())


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

    def test_bulk_without_plan_filter_uses_all_subscriptions(self):
        first_plan = BibleReadingPlan.objects.create(name='빈 플랜', created_by=self.user)
        PlanSubscription.objects.create(
            user=self.user, plan=first_plan, start_date=date.today(), is_active=True,
        )
        DailyBibleSchedule.objects.create(
            plan=first_plan,
            date=date.today(),
            book='민수기',
            start_chapter=1,
            end_chapter=1,
        )
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.schedules[0],
            is_completed=True,
            completed_at=timezone.now(),
        )

        bulk = calculate_progress_rates_bulk([self.user])

        self.assertEqual(bulk[self.user.id], calculate_progress_rate(self.user))
        self.assertGreater(bulk[self.user.id], 0)


class ScoreboardRankingTest(TestCase):
    SCOREBOARD_URL = '/api/v1/todos/scoreboard/'
    MY_RANKING_URL = '/api/v1/todos/scoreboard/my-ranking/'

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.factory = APIRequestFactory()
        self.reader = User.objects.create_user(
            username='reader', nickname='가나', password='pw-test-1234',
        )
        self.other = User.objects.create_user(
            username='other-reader', nickname='다라', password='pw-test-1234',
        )
        self.selected_plan = BibleReadingPlan.objects.create(name='선택 플랜', created_by=self.reader)
        self.other_plan = BibleReadingPlan.objects.create(name='다른 플랜', created_by=self.reader)
        self.reader_selected_sub = PlanSubscription.objects.create(
            user=self.reader, plan=self.selected_plan, start_date=date.today(), is_active=True,
        )
        self.reader_other_sub = PlanSubscription.objects.create(
            user=self.reader, plan=self.other_plan, start_date=date.today(), is_active=True,
        )
        self.other_selected_sub = PlanSubscription.objects.create(
            user=self.other, plan=self.selected_plan, start_date=date.today(), is_active=True,
        )
        self.selected_schedules = [
            DailyBibleSchedule.objects.create(
                plan=self.selected_plan,
                date=date.today() - timedelta(days=offset),
                book='창세기',
                start_chapter=offset + 1,
                end_chapter=offset + 1,
            )
            for offset in range(2)
        ]
        self.other_plan_schedules = [
            DailyBibleSchedule.objects.create(
                plan=self.other_plan,
                date=date.today() - timedelta(days=offset),
                book='출애굽기',
                start_chapter=offset + 1,
                end_chapter=offset + 1,
            )
            for offset in range(2)
        ]

    def _complete(self, subscription, schedule):
        return UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def test_rank_leaderboard_splits_equal_completed_days_by_progress_rate(self):
        leaderboard = [
            {'user': {'nickname': '가나'}, 'completed_days': 0, 'progress_rate': 0},
            {'user': {'nickname': '다라'}, 'completed_days': 0, 'progress_rate': 50},
        ]

        ranked = rank_leaderboard(leaderboard)

        self.assertEqual(ranked[0]['user']['nickname'], '다라')
        self.assertEqual(ranked[0]['rank'], 1)
        self.assertEqual(ranked[1]['user']['nickname'], '가나')
        self.assertEqual(ranked[1]['rank'], 2)

    def test_scoreboard_uses_selected_plan_completed_days_for_all_period(self):
        for schedule in self.other_plan_schedules:
            self._complete(self.reader_other_sub, schedule)
        self._complete(self.other_selected_sub, self.selected_schedules[0])

        request = self.factory.get(self.SCOREBOARD_URL, {
            'period': 'all',
            'plan_id': self.selected_plan.id,
            'limit': 10,
        })
        response = get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        leaderboard = response.data['leaderboard']
        self.assertEqual(leaderboard[0]['user']['id'], self.other.id)
        self.assertEqual(leaderboard[0]['rank'], 1)
        self.assertEqual(leaderboard[0]['completed_days'], 1)
        self.assertEqual(leaderboard[1]['user']['id'], self.reader.id)
        self.assertEqual(leaderboard[1]['rank'], 2)
        self.assertEqual(leaderboard[1]['completed_days'], 0)
        self.assertEqual(leaderboard[1]['progress_rate'], 0)

    def test_scoreboard_ignores_stale_profile_completed_days(self):
        self.reader.profile.total_completed_days = 99
        self.reader.profile.save(update_fields=['total_completed_days'])
        self._complete(self.other_selected_sub, self.selected_schedules[0])

        request = self.factory.get(self.SCOREBOARD_URL, {
            'period': 'all',
            'limit': 10,
        })
        response = get_scoreboard(request)

        self.assertEqual(response.status_code, 200)
        leaderboard = response.data['leaderboard']
        self.assertEqual(leaderboard[0]['user']['id'], self.other.id)
        self.assertEqual(leaderboard[0]['rank'], 1)
        self.assertEqual(leaderboard[1]['user']['id'], self.reader.id)
        self.assertEqual(leaderboard[1]['rank'], 2)
        self.assertEqual(leaderboard[1]['completed_days'], 0)
        self.assertEqual(leaderboard[1]['progress_rate'], 0)

    def test_my_ranking_uses_selected_plan_completed_days_for_all_period(self):
        for schedule in self.other_plan_schedules:
            self._complete(self.reader_other_sub, schedule)
        self._complete(self.other_selected_sub, self.selected_schedules[0])
        self.client.force_authenticate(user=self.reader)

        request = self.factory.get(self.MY_RANKING_URL, {
            'period': 'all',
            'plan_id': self.selected_plan.id,
        })
        force_authenticate(request, user=self.reader)
        response = get_my_ranking(request)

        self.assertEqual(response.status_code, 200)
        ranking = response.data['ranking']
        self.assertEqual(ranking['rank'], 2)
        self.assertEqual(ranking['completed_days'], 0)

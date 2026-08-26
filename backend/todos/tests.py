from datetime import date, datetime, timedelta
from unittest.mock import Mock, patch

from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from config.observability import HASENA_SUMMARY_HEARTBEAT_CACHE_KEY
from . import views

from .models import (
    BibleReadingPlan, DailyBibleSchedule, PlanSubscription, UserBibleProgress,
    UserReadingPosition, PersonalReadingRecord,
)
from .scoreboard_views import (
    calculate_progress_rate,
    calculate_progress_rates_bulk,
    get_my_ranking,
    get_scoreboard,
    rank_leaderboard,
)
from .serializers import DailyBibleScheduleSerializer, UserReadingPositionSerializer
from .tasks import generate_hasena_summary_task

User = get_user_model()


class DailyBibleScheduleIntegrityTest(TestCase):
    def test_duplicate_plan_date_book_rejected_at_database_level(self):
        user = User.objects.create_user(
            username='schedule-owner', nickname='스케줄소유자', password='pw-test-1234',
        )
        plan = BibleReadingPlan.objects.create(name='중복 방지 플랜', created_by=user)
        schedule_date = date(2026, 7, 8)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                DailyBibleSchedule.objects.bulk_create([
                    DailyBibleSchedule(
                        plan=plan,
                        date=schedule_date,
                        book='창세기',
                        start_chapter=1,
                        end_chapter=1,
                    ),
                    DailyBibleSchedule(
                        plan=plan,
                        date=schedule_date,
                        book='창세기',
                        start_chapter=2,
                        end_chapter=2,
                    ),
                ])

    def _create_plan(self):
        user = User.objects.create_user(
            username='schedule-validation-owner',
            nickname='스케줄검증소유자',
            password='pw-test-1234',
        )
        return BibleReadingPlan.objects.create(name='장 범위 검증 플랜', created_by=user)

    def test_invalid_chapter_ranges_rejected_on_save(self):
        plan = self._create_plan()

        cases = [
            ('zero_start', 0, 1),
            ('zero_end', 1, 0),
            ('negative_start', -1, 1),
            ('negative_end', 1, -1),
            ('reversed', 5, 3),
        ]

        for label, start_chapter, end_chapter in cases:
            with self.subTest(label=label):
                with self.assertRaises(ValidationError):
                    DailyBibleSchedule(
                        plan=plan,
                        date=date(2026, 7, 9),
                        book=f'창세기-{label}',
                        start_chapter=start_chapter,
                        end_chapter=end_chapter,
                    ).save()

    def test_serializer_rejects_invalid_chapter_ranges(self):
        plan = self._create_plan()

        cases = [
            ('zero_start', {'start_chapter': 0, 'end_chapter': 1}, 'start_chapter'),
            ('zero_end', {'start_chapter': 1, 'end_chapter': 0}, 'end_chapter'),
            ('reversed', {'start_chapter': 5, 'end_chapter': 3}, 'end_chapter'),
        ]

        for label, chapters, error_field in cases:
            with self.subTest(label=label):
                serializer = DailyBibleScheduleSerializer(data={
                    'plan': plan.id,
                    'date': '2026-07-10',
                    'book': f'출애굽기-{label}',
                    **chapters,
                })

                self.assertFalse(serializer.is_valid())
                self.assertIn(error_field, serializer.errors)


class HasenaSummaryTaskTest(SimpleTestCase):
    def setUp(self):
        cache.delete(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)

    def assert_heartbeat_write(self, cache_set, **expected):
        heartbeat_calls = [
            call for call in cache_set.call_args_list
            if call.args and call.args[0] == HASENA_SUMMARY_HEARTBEAT_CACHE_KEY
        ]
        self.assertEqual(len(heartbeat_calls), 1)
        heartbeat = heartbeat_calls[0].args[1]
        self.assertEqual(heartbeat_calls[0].kwargs, {'timeout': None})
        self.assertIn('recorded_at', heartbeat)
        for key, value in expected.items():
            self.assertEqual(heartbeat[key], value)
    def test_skips_outside_window_when_project_uses_naive_local_time(self):
        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 17, 7, 0, 0)),
            patch('todos.tasks.cache.get', return_value=False),
            patch('todos.tasks.cache.set') as cache_set,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(result, {'status': 'skipped', 'reason': 'outside_window'})
        self.assert_heartbeat_write(cache_set, status='skipped', reason='outside_window')

    def test_reports_summary_generation_failure_to_monitoring(self):
        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 17, 1, 0, 0)),
            patch('todos.tasks.cache.get', return_value=False),
            patch('todos.tasks.cache.set') as cache_set,
            patch('todos.models.HasenaSummary.objects.filter', return_value=Mock(first=Mock(return_value=None))),
            patch(
                'todos.services.hasena_summary_service.get_recent_hasena_videos',
                return_value=[
                    {
                        'video_id': 'video-123',
                        'title': '2026년 6월 17일 수요일 하세나하시조',
                        'published_at': '2026-06-16T15:00:31+00:00',
                    }
                ],
            ),
            patch(
                'todos.services.hasena_summary_service.get_hasena_summary',
                return_value={'success': False, 'error': 'AI 요약을 생성할 수 없습니다.'},
            ),
            patch('todos.services.hasena_monitoring.capture_hasena_summary_issue') as capture_issue,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(
            result,
            {
                'status': 'failed',
                'reason': 'AI 요약을 생성할 수 없습니다.',
                'video_id': 'video-123',
            },
        )
        capture_issue.assert_called_once()
        self.assert_heartbeat_write(
            cache_set,
            status='failed',
            reason='AI 요약을 생성할 수 없습니다.',
            video_id='video-123',
        )

    def test_does_not_mark_today_generated_when_latest_video_is_previous_day_summary(self):
        existing_summary = Mock(video_date=date(2026, 6, 24))

        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 25, 0, 0, 0)),
            patch('todos.tasks.cache.get', return_value=False),
            patch('todos.tasks.cache.set') as cache_set,
            patch(
                'todos.services.hasena_summary_service.get_recent_hasena_videos',
                return_value=[
                    {
                        'video_id': 'GEP5Hi4Rp_A',
                        'title': '2026년 6월 24일 수요일 하세나하시조',
                        'published_at': '2026-06-23T15:00:31+00:00',
                    },
                ],
            ),
            patch(
                'todos.models.HasenaSummary.objects.filter',
                return_value=Mock(first=Mock(return_value=existing_summary)),
            ),
            patch('todos.services.hasena_summary_service.get_hasena_summary') as generate_summary,
            patch('todos.services.hasena_monitoring.capture_hasena_summary_issue') as capture_issue,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(
            result,
            {
                'status': 'pending',
                'reason': 'no_video_for_date',
                'date': '2026-06-25',
            },
        )
        self.assert_heartbeat_write(
            cache_set,
            status='pending',
            reason='no_video_for_date',
            date='2026-06-25',
        )
        generate_summary.assert_not_called()
        capture_issue.assert_called_once()

    def test_generates_current_service_date_video_after_feed_update(self):
        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 25, 0, 5, 0)),
            patch('todos.tasks.cache.get', return_value=False),
            patch('todos.tasks.cache.set') as cache_set,
            patch(
                'todos.services.hasena_summary_service.get_recent_hasena_videos',
                return_value=[
                    {
                        'video_id': 'VkWhiXwG-Fw',
                        'title': '2026년 6월 25일 목요일 하세나하시조',
                        'published_at': '2026-06-24T15:00:02+00:00',
                    },
                ],
            ),
            patch(
                'todos.models.HasenaSummary.objects.filter',
                return_value=Mock(first=Mock(return_value=None)),
            ),
            patch(
                'todos.services.hasena_summary_service.get_hasena_summary',
                return_value={
                    'success': True,
                    'cacheable': True,
                    'persisted': True,
                    'video_id': 'VkWhiXwG-Fw',
                },
            ) as generate_summary,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(result, {'status': 'success', 'video_id': 'VkWhiXwG-Fw'})
        generate_summary.assert_called_once_with(
            'VkWhiXwG-Fw',
            video_date=date(2026, 6, 25),
            title='2026년 6월 25일 목요일 하세나하시조',
        )
        self.assertEqual(cache_set.call_count, 2)
        cache_set.assert_any_call(
            'hasena_summary_success_2026-06-25',
            {
                'version': 1,
                'service_date': '2026-06-25',
                'video_id': 'VkWhiXwG-Fw',
                'persisted': True,
            },
            timeout=86400,
        )
        self.assert_heartbeat_write(cache_set, status='success', video_id='VkWhiXwG-Fw')

    def test_matching_cache_payload_and_db_row_skips_generation(self):
        existing_summary = Mock(video_date=date(2026, 6, 25))

        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 25, 0, 10, 0)),
            patch(
                'todos.tasks.cache.get',
                return_value={
                    'version': 1,
                    'service_date': '2026-06-25',
                    'video_id': 'VkWhiXwG-Fw',
                    'persisted': True,
                },
            ),
            patch('todos.tasks.cache.set') as cache_set,
            patch(
                'todos.services.hasena_summary_service.get_recent_hasena_videos',
                return_value=[
                    {
                        'video_id': 'VkWhiXwG-Fw',
                        'title': '2026년 6월 25일 목요일 하세나하시조',
                        'published_at': '2026-06-24T15:00:02+00:00',
                    },
                ],
            ),
            patch(
                'todos.models.HasenaSummary.objects.filter',
                return_value=Mock(first=Mock(return_value=existing_summary)),
            ),
            patch('todos.services.hasena_summary_service.get_hasena_summary') as generate_summary,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(
            result,
            {
                'status': 'skipped',
                'reason': 'already_generated',
                'video_id': 'VkWhiXwG-Fw',
            },
        )
        generate_summary.assert_not_called()
        self.assert_heartbeat_write(
            cache_set,
            status='skipped',
            reason='already_generated',
            video_id='VkWhiXwG-Fw',
        )

    def test_cache_payload_requires_persisted_proof_version(self):
        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 25, 0, 10, 0)),
            patch(
                'todos.tasks.cache.get',
                return_value={
                    'service_date': '2026-06-25',
                    'video_id': 'VkWhiXwG-Fw',
                },
            ),
            patch('todos.tasks.cache.set') as cache_set,
            patch(
                'todos.services.hasena_summary_service.get_recent_hasena_videos',
                return_value=[
                    {
                        'video_id': 'VkWhiXwG-Fw',
                        'title': '2026년 6월 25일 목요일 하세나하시조',
                        'published_at': '2026-06-24T15:00:02+00:00',
                    },
                ],
            ),
            patch(
                'todos.models.HasenaSummary.objects.filter',
                return_value=Mock(first=Mock(return_value=None)),
            ),
            patch(
                'todos.services.hasena_summary_service.get_hasena_summary',
                return_value={
                    'success': True,
                    'cacheable': True,
                    'persisted': True,
                    'video_id': 'VkWhiXwG-Fw',
                },
            ) as generate_summary,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(result, {'status': 'success', 'video_id': 'VkWhiXwG-Fw'})
        generate_summary.assert_called_once()
        self.assertEqual(cache_set.call_count, 2)
        cache_set.assert_any_call(
            'hasena_summary_success_2026-06-25',
            {
                'version': 1,
                'service_date': '2026-06-25',
                'video_id': 'VkWhiXwG-Fw',
                'persisted': True,
            },
            timeout=86400,
        )
        self.assert_heartbeat_write(cache_set, status='success', video_id='VkWhiXwG-Fw')

    def test_legacy_truthy_cache_value_does_not_skip_generation(self):
        with (
            patch('todos.tasks.timezone.now', return_value=datetime(2026, 6, 25, 0, 15, 0)),
            patch('todos.tasks.cache.get', return_value=True),
            patch('todos.tasks.cache.set') as cache_set,
            patch(
                'todos.services.hasena_summary_service.get_recent_hasena_videos',
                return_value=[
                    {
                        'video_id': 'VkWhiXwG-Fw',
                        'title': '2026년 6월 25일 목요일 하세나하시조',
                        'published_at': '2026-06-24T15:00:02+00:00',
                    },
                ],
            ),
            patch(
                'todos.models.HasenaSummary.objects.filter',
                return_value=Mock(first=Mock(return_value=None)),
            ),
            patch(
                'todos.services.hasena_summary_service.get_hasena_summary',
                return_value={
                    'success': True,
                    'cacheable': True,
                    'persisted': True,
                    'video_id': 'VkWhiXwG-Fw',
                },
            ) as generate_summary,
        ):
            result = generate_hasena_summary_task()

        self.assertEqual(result, {'status': 'success', 'video_id': 'VkWhiXwG-Fw'})
        generate_summary.assert_called_once()
        self.assertEqual(cache_set.call_count, 2)
        self.assert_heartbeat_write(cache_set, status='success', video_id='VkWhiXwG-Fw')


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


class PersonalReadingRecordApiValidationTest(TestCase):
    URL = '/api/v1/todos/bible/personal-records/'

    def setUp(self):
        self.user = User.objects.create_user(
            username='personal-record-reader',
            nickname='개인기록독자',
            password='pw-test-1234',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_duplicate_record_update_rejects_malformed_read_date_without_writing(self):
        record = PersonalReadingRecord.objects.create(
            user=self.user,
            book='gen',
            chapter=1,
            read_date=date(2026, 1, 1),
        )

        response = self.client.post(self.URL, {
            'book': 'gen',
            'chapter': 1,
            'read_date': 'not-a-date',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        record.refresh_from_db()
        self.assertEqual(record.read_date, date(2026, 1, 1))

    def test_create_rejects_invalid_book_chapter_without_writing(self):
        response = self.client.post(self.URL, {
            'book': 'exo',
            'chapter': 41,
            'read_date': '2026-01-02',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PersonalReadingRecord.objects.filter(user=self.user).exists())

    def test_create_normalizes_alias_before_idempotent_update(self):
        create_response = self.client.post(self.URL, {
            'book': 'jon',
            'chapter': 4,
            'read_date': '2026-01-02',
        }, format='json')
        update_response = self.client.post(self.URL, {
            'book': 'jnh',
            'chapter': 4,
            'read_date': '2026-01-03',
        }, format='json')

        self.assertEqual(create_response.status_code, 201, create_response.data)
        self.assertEqual(update_response.status_code, 200, update_response.data)
        records = PersonalReadingRecord.objects.filter(user=self.user)
        self.assertEqual(records.count(), 1)
        record = records.get()
        self.assertEqual(record.book, 'jnh')
        self.assertEqual(record.read_date, date(2026, 1, 3))


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

    def test_foreign_schedule_matches_unknown_schedule_response_without_write(self):
        other_user = User.objects.create_user(
            username='foreign-plan-owner', nickname='외부플랜소유자', password='pw-test-1234',
        )
        other_plan = BibleReadingPlan.objects.create(name='외부 플랜', created_by=other_user)
        foreign_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan, date=date.today(), book='출애굽기',
            start_chapter=1, end_chapter=2,
        )

        foreign_res = self._complete([foreign_schedule.id])
        unknown_res = self._complete([999999])

        self.assertEqual(foreign_res.status_code, 404)
        self.assertEqual(unknown_res.status_code, 404)
        self.assertEqual(foreign_res.data, unknown_res.data)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_mixed_own_and_foreign_schedule_rejected_without_partial_write(self):
        other_user = User.objects.create_user(
            username='mixed-plan-owner', nickname='혼합플랜소유자', password='pw-test-1234',
        )
        other_plan = BibleReadingPlan.objects.create(name='혼합 외부 플랜', created_by=other_user)
        foreign_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan, date=date.today(), book='출애굽기',
            start_chapter=1, end_chapter=2,
        )

        res = self._complete([self.schedules[0].id, foreign_schedule.id])

        self.assertEqual(res.status_code, 404)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_rejects_inactive_plan_subscription_without_partial_write(self):
        self.plan.is_active = False
        self.plan.save(update_fields=['is_active'])

        res = self._complete([self.schedules[0].id])

        self.assertEqual(res.status_code, 404)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_month_schedules_rejects_inactive_plan(self):
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.schedules[0],
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.plan.is_active = False
        self.plan.save(update_fields=['is_active'])

        res = self.client.get(
            '/api/v1/todos/schedules/month/',
            {'plan_id': self.plan.id, 'month': date.today().month},
        )

        self.assertEqual(res.status_code, 404)

    def test_month_schedules_rejects_out_of_range_month(self):
        for bad_month in ('0', '13', '99'):
            res = self.client.get(
                '/api/v1/todos/schedules/month/',
                {'plan_id': self.plan.id, 'month': bad_month},
            )
            self.assertEqual(res.status_code, 400, bad_month)
            self.assertIn('Month', res.data['error'])

    def test_month_schedules_includes_completion_state(self):
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.schedules[0],
            is_completed=True,
            completed_at=timezone.now(),
        )

        res = self.client.get(
            '/api/v1/todos/schedules/month/',
            {'plan_id': self.plan.id, 'month': date.today().month},
        )

        self.assertEqual(res.status_code, 200)
        schedule = next(item for item in res.data if item['id'] == self.schedules[0].id)
        self.assertTrue(schedule['is_completed'])

    def test_month_schedules_omits_progress_for_inactive_subscription(self):
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.schedules[0],
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.subscription.is_active = False
        self.subscription.save(update_fields=['is_active'])

        res = self.client.get(
            '/api/v1/todos/schedules/month/',
            {'plan_id': self.plan.id, 'month': date.today().month},
        )

        self.assertEqual(res.status_code, 200)
        schedule = next(item for item in res.data if item['id'] == self.schedules[0].id)
        self.assertNotIn('is_completed', schedule)

    def test_plan_schedule_mismatch_rejected(self):
        other_plan = BibleReadingPlan.objects.create(name='다른 플랜', created_by=self.user)
        PlanSubscription.objects.create(
            user=self.user, plan=other_plan, start_date=date.today(), is_active=True,
        )
        other_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan, date=date.today(), book='출애굽기',
            start_chapter=1, end_chapter=2,
        )
        res = self._complete([other_schedule.id])
        self.assertEqual(res.status_code, 400)

    def test_rejects_mixed_valid_and_unknown_schedule_without_partial_write(self):
        res = self._complete([self.schedules[0].id, 999999])

        self.assertEqual(res.status_code, 404)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_rejects_duplicate_schedule_ids_without_partial_write(self):
        res = self._complete([self.schedules[0].id, self.schedules[0].id])

        self.assertEqual(res.status_code, 400)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_rejects_malformed_schedule_ids_without_partial_write(self):
        res = self._complete([self.schedules[0].id, 'not-an-id'])

        self.assertEqual(res.status_code, 400)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())
        self.assertEqual(res.data['error'], 'schedule_ids는 양의 정수 배열이어야 합니다.')

    def test_rejects_oversized_schedule_ids_without_partial_write(self):
        res = self._complete([str(10**100)])

        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['error'], 'schedule_ids는 양의 정수 배열이어야 합니다.')
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_rejects_float_schedule_ids_without_partial_write(self):
        res = self._complete([1.5])

        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['error'], 'schedule_ids는 양의 정수 배열이어야 합니다.')
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_rejects_non_array_schedule_ids_without_partial_write(self):
        res = self.client.post(self.URL, {
            'plan_id': self.plan.id,
            'schedule_ids': str(self.schedules[0].id),
            'action': 'complete',
        }, format='json')

        self.assertEqual(res.status_code, 400)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())

    def test_rejects_too_many_schedule_ids_before_lookup_without_partial_write(self):
        too_many_schedule_ids = list(range(1, views.MAX_PROGRESS_SCHEDULE_IDS_PER_REQUEST + 2))

        with patch('todos.views._readable_schedule_queryset') as readable_queryset:
            res = self._complete(too_many_schedule_ids)

        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.data['error'],
            f'schedule_ids는 한 번에 최대 {views.MAX_PROGRESS_SCHEDULE_IDS_PER_REQUEST}개까지 처리할 수 있습니다.',
        )
        readable_queryset.assert_not_called()
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription).exists())


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

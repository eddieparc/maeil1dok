from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from todos.models import (
    BibleReadingPlan,
    CatchupSchedule,
    CatchupSession,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
)
from todos.services.catchup import get_overdue_schedules_in_range

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class CatchupProgressSyncTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="catchup-sync-reader",
            nickname="따라잡기동기화독자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="따라잡기 동기화 플랜",
            created_by=self.user,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        self.session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="동기화 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
            max_daily_readings=2,
            max_daily_chapters=4,
            weekend_multiplier=Decimal("1.5"),
        )
        self.client.force_authenticate(user=self.user)

    def _toggle_url(self, catchup_schedule):
        return f"/api/v1/todos/catchup-schedules/{catchup_schedule.id}/toggle/"

    def _original_schedule(self, schedule_date=date(2026, 1, 3), book="Genesis"):
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book=book,
            start_chapter=1,
            end_chapter=1,
        )

    def _catchup_schedule(self, original_schedule):
        return CatchupSchedule.objects.create(
            session=self.session,
            original_schedule=original_schedule,
            scheduled_date=date(2026, 1, 20),
        )

    def test_toggle_on_creates_one_completed_original_progress_row(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 200, response.data)
        progress = UserBibleProgress.objects.get(subscription=self.subscription, schedule=original)
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)
        self.assertEqual(UserBibleProgress.objects.filter(subscription=self.subscription, schedule=original).count(), 1)

    def test_toggle_on_updates_existing_incomplete_progress_without_duplication(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=original,
            is_completed=False,
            completed_at=None,
        )

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(UserBibleProgress.objects.filter(subscription=self.subscription, schedule=original).count(), 1)
        progress = UserBibleProgress.objects.get(subscription=self.subscription, schedule=original)
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)

    def test_toggle_on_preserves_existing_original_completion_timestamp(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        original_completed_at = timezone.now() - timedelta(days=3)
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=original,
            is_completed=True,
            completed_at=original_completed_at,
        )

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 200, response.data)
        progress = UserBibleProgress.objects.get(subscription=self.subscription, schedule=original)
        self.assertEqual(progress.completed_at, original_completed_at)

    def test_toggle_off_marks_original_progress_incomplete_without_duplication(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self.client.post(self._toggle_url(catchup_schedule))

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(UserBibleProgress.objects.filter(subscription=self.subscription, schedule=original).count(), 1)
        progress = UserBibleProgress.objects.get(subscription=self.subscription, schedule=original)
        self.assertFalse(progress.is_completed)
        self.assertIsNone(progress.completed_at)

    def test_overdue_schedules_exclude_original_after_catchup_completion(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        before_ids = set(
            get_overdue_schedules_in_range(
                self.subscription,
                date(2026, 1, 1),
                date(2026, 1, 10),
            ).values_list("id", flat=True)
        )

        response = self.client.post(self._toggle_url(catchup_schedule))
        after_ids = set(
            get_overdue_schedules_in_range(
                self.subscription,
                date(2026, 1, 1),
                date(2026, 1, 10),
            ).values_list("id", flat=True)
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(original.id, before_ids)
        self.assertNotIn(original.id, after_ids)

    def test_profile_stats_update_through_original_progress_signal(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 200, response.data)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.total_completed_days, 1)
        self.assertEqual(self.user.profile.longest_streak, 1)

    def test_progress_sync_failure_rolls_back_catchup_toggle_and_progress_row(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self.client.raise_request_exception = False

        with patch("todos.catchup_views.sync_original_progress", side_effect=RuntimeError("forced sync failure")):
            response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 500)
        catchup_schedule.refresh_from_db()
        self.assertFalse(catchup_schedule.is_completed)
        self.assertIsNone(catchup_schedule.completed_at)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription, schedule=original).exists())


@override_settings(ROOT_URLCONF=__name__)
class MainFlowCatchupSyncTest(TestCase):
    """Completing/cancelling a reading from the main flow must keep the active
    catchup session's denormalized CatchupSchedule rows in sync."""

    READING_URL = "/api/v1/todos/reading/"

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="mainflow-sync-reader",
            nickname="메인흐름동기화",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="메인 흐름 동기화 플랜",
            created_by=self.user,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        self.session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="메인 흐름 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
            max_daily_readings=2,
            max_daily_chapters=4,
            weekend_multiplier=Decimal("1.5"),
        )
        self.client.force_authenticate(user=self.user)

    def _original(self, schedule_date=date(2026, 1, 3), book="Genesis"):
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book=book,
            start_chapter=1,
            end_chapter=1,
        )

    def _catchup_row(self, session, original, is_completed=False, completed_at=None):
        return CatchupSchedule.objects.create(
            session=session,
            original_schedule=original,
            scheduled_date=date(2026, 1, 20),
            is_completed=is_completed,
            completed_at=completed_at,
        )

    def _post(self, schedule_ids, action):
        return self.client.post(
            self.READING_URL,
            {"plan_id": self.plan.id, "schedule_ids": schedule_ids, "action": action},
            format="json",
        )

    def test_main_flow_complete_syncs_active_catchup_schedule(self):
        original = self._original()
        row = self._catchup_row(self.session, original)

        response = self._post([original.id], "complete")

        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertTrue(row.is_completed)
        self.assertIsNotNone(row.completed_at)
        self.assertEqual(self.session.progress_percentage, 100)

    def test_main_flow_cancel_flips_completed_catchup_schedule(self):
        original = self._original()
        row = self._catchup_row(
            self.session, original, is_completed=True, completed_at=timezone.now()
        )

        response = self._post([original.id], "cancel")

        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertFalse(row.is_completed)
        self.assertIsNone(row.completed_at)

    def test_repeat_complete_preserves_catchup_completed_at(self):
        original = self._original()
        first_completed_at = timezone.now() - timedelta(days=3)
        row = self._catchup_row(
            self.session, original, is_completed=True, completed_at=first_completed_at
        )

        response = self._post([original.id], "complete")

        self.assertEqual(response.status_code, 200, response.data)
        row.refresh_from_db()
        self.assertTrue(row.is_completed)
        self.assertEqual(row.completed_at, first_completed_at)

    def test_non_active_sessions_are_frozen(self):
        original = self._original()
        completed_session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="완료된 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
            status="completed",
        )
        abandoned_session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="포기한 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
            status="abandoned",
        )
        completed_row = self._catchup_row(completed_session, original)
        abandoned_row = self._catchup_row(abandoned_session, original)

        response = self._post([original.id], "complete")

        self.assertEqual(response.status_code, 200, response.data)
        completed_row.refresh_from_db()
        abandoned_row.refresh_from_db()
        self.assertFalse(completed_row.is_completed)
        self.assertIsNone(completed_row.completed_at)
        self.assertFalse(abandoned_row.is_completed)
        self.assertIsNone(abandoned_row.completed_at)

    def test_other_users_active_session_not_mutated(self):
        original = self._original()
        row_a = self._catchup_row(self.session, original)

        other_user = User.objects.create_user(
            username="mainflow-sync-other",
            nickname="다른사용자",
            password="pw-test-1234",
        )
        other_subscription = PlanSubscription.objects.create(
            user=other_user,
            plan=self.plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        other_session = CatchupSession.objects.create(
            subscription=other_subscription,
            name="다른 사용자 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
        )
        row_b = self._catchup_row(other_session, original)

        response = self._post([original.id], "complete")

        self.assertEqual(response.status_code, 200, response.data)
        row_a.refresh_from_db()
        row_b.refresh_from_db()
        self.assertTrue(row_a.is_completed)
        self.assertFalse(row_b.is_completed)
        self.assertIsNone(row_b.completed_at)

    def test_sync_failure_rolls_back_progress_and_catchup(self):
        original = self._original()
        row = self._catchup_row(self.session, original)
        self.client.raise_request_exception = False

        with patch(
            "todos.views.sync_catchup_schedules",
            side_effect=RuntimeError("forced sync failure"),
        ):
            response = self._post([original.id], "complete")

        self.assertEqual(response.status_code, 500)
        row.refresh_from_db()
        self.assertFalse(row.is_completed)
        self.assertIsNone(row.completed_at)
        self.assertFalse(
            UserBibleProgress.objects.filter(
                subscription=self.subscription, schedule=original
            ).exists()
        )

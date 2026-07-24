from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
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

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class CatchupSessionValidationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="catchup-reader",
            nickname="따라잡기독자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="따라잡기 플랜",
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
            name="원래 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
            max_daily_readings=2,
            max_daily_chapters=4,
            weekend_multiplier=Decimal("1.5"),
        )
        self.client.force_authenticate(user=self.user)

    def _update_url(self):
        return f"/api/v1/todos/catchup-sessions/{self.session.id}/update/"

    def _toggle_url(self, catchup_schedule):
        return f"/api/v1/todos/catchup-schedules/{catchup_schedule.id}/toggle/"

    def _detail_url(self, session=None):
        session = session or self.session
        return f"/api/v1/todos/catchup-sessions/{session.id}/"

    def _schedules_url(self, session=None):
        session = session or self.session
        return f"/api/v1/todos/catchup-sessions/{session.id}/schedules/"

    def _active_sessions_url(self):
        return "/api/v1/todos/catchup-sessions/active/"

    def _catchup_status_url(self):
        return f"/api/v1/todos/subscriptions/{self.subscription.id}/catchup-status/"

    def _set_subscription_active(self, is_active):
        self.subscription.is_active = is_active
        self.subscription.save(update_fields=["is_active"])

    def _set_plan_active(self, is_active):
        self.plan.is_active = is_active
        self.plan.save(update_fields=["is_active"])

    def _original_schedule(self, schedule_date=date(2026, 1, 3), book="Genesis"):
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book=book,
            start_chapter=1,
            end_chapter=1,
        )

    def _catchup_schedule(
        self,
        original_schedule,
        scheduled_date=date(2026, 1, 20),
    ):
        return CatchupSchedule.objects.create(
            session=self.session,
            original_schedule=original_schedule,
            scheduled_date=scheduled_date,
        )

    def _catchup_schedules_for_date_filter(self):
        first = self._catchup_schedule(
            self._original_schedule(date(2026, 1, 3), "Genesis"),
            scheduled_date=date(2026, 1, 20),
        )
        second = self._catchup_schedule(
            self._original_schedule(date(2026, 1, 4), "Exodus"),
            scheduled_date=date(2026, 1, 21),
        )
        return first, second

    def _overflow_message(self, remaining_count):
        return f"목표일까지 {remaining_count}개 스케줄을 완료할 수 없습니다. 목표일을 늦추거나 읽기량을 늘려주세요."

    def _subscription_with_overdue_schedules(self, suffix, count=3):
        today = timezone.now().date()
        plan = BibleReadingPlan.objects.create(
            name=f"따라잡기 플랜 {suffix}",
            created_by=self.user,
        )
        first_date = today - timedelta(days=count)
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=plan,
            start_date=first_date,
            is_active=True,
        )
        schedules = [
            DailyBibleSchedule.objects.create(
                plan=plan,
                date=first_date + timedelta(days=index),
                book="Genesis",
                start_chapter=1,
                end_chapter=1,
            )
            for index in range(count)
        ]
        return subscription, schedules

    def _catchup_create_url(self, subscription):
        return f"/api/v1/todos/subscriptions/{subscription.id}/catchup/"

    def _catchup_preview_url(self, subscription):
        return f"/api/v1/todos/subscriptions/{subscription.id}/catchup/preview/"

    def _subscription_with_overdue_schedule(self, suffix):
        plan = BibleReadingPlan.objects.create(
            name=f"따라잡기 플랜 {suffix}",
            created_by=self.user,
        )
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=plan,
            start_date=date.today() - timedelta(days=20),
            is_active=True,
        )
        DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today() - timedelta(days=10),
            book="Genesis",
            start_chapter=1,
            end_chapter=1,
        )
        return subscription

    def _create_payload(self):
        target_date = date.today() - timedelta(days=10)
        return {
            "name": "새 따라잡기",
            "range_start": target_date.isoformat(),
            "range_end": target_date.isoformat(),
            "max_daily_readings": 1,
            "max_daily_chapters": 1,
        }


    def test_create_rejects_catchup_overflow_without_writes(self):
        today = timezone.now().date()
        subscription, schedules = self._subscription_with_overdue_schedules("overflow-create")
        response = self.client.post(
            self._catchup_create_url(subscription),
            {
                "name": "불가능한 따라잡기",
                "range_start": schedules[0].date.isoformat(),
                "range_end": schedules[-1].date.isoformat(),
                "target_rejoin_date": today.isoformat(),
                "max_daily_readings": 1,
                "max_daily_chapters": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["error"], self._overflow_message(2))
        self.assertFalse(CatchupSession.objects.filter(subscription=subscription).exists())
        self.assertFalse(
            CatchupSchedule.objects.filter(session__subscription=subscription).exists()
        )

    def test_update_recalculate_rejects_overflow_and_preserves_session_and_schedules(self):
        today = timezone.now().date()
        originals = [
            self._original_schedule(date(2026, 1, 3) + timedelta(days=index))
            for index in range(3)
        ]
        catchup_schedules = [self._catchup_schedule(original) for original in originals]
        original_pks = [schedule.pk for schedule in catchup_schedules]

        response = self.client.patch(
            self._update_url(),
            {
                "name": "저장되면 안 되는 이름",
                "target_rejoin_date": today.isoformat(),
                "max_daily_readings": 1,
                "recalculate": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["error"], self._overflow_message(2))
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "원래 따라잡기")
        self.assertIsNone(self.session.target_rejoin_date)
        self.assertEqual(self.session.max_daily_readings, 2)
        self.assertEqual(
            CatchupSchedule.objects.filter(pk__in=original_pks).count(),
            len(original_pks),
        )

    def test_update_recalculate_with_feasible_settings_still_redistributes(self):
        today = timezone.now().date()
        originals = [
            self._original_schedule(date(2026, 1, 3) + timedelta(days=index))
            for index in range(3)
        ]
        completed_schedule = self._catchup_schedule(originals[0])
        completed_schedule.is_completed = True
        completed_schedule.completed_at = timezone.now()
        completed_schedule.save(update_fields=["is_completed", "completed_at"])
        incomplete_schedules = [
            self._catchup_schedule(original)
            for original in originals[1:]
        ]
        old_incomplete_pks = [schedule.pk for schedule in incomplete_schedules]

        response = self.client.patch(
            self._update_url(),
            {
                "name": "재분배된 따라잡기",
                "target_rejoin_date": (today + timedelta(days=30)).isoformat(),
                "max_daily_readings": 10,
                "recalculate": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(CatchupSchedule.objects.filter(pk=completed_schedule.pk).exists())
        self.assertFalse(CatchupSchedule.objects.filter(pk__in=old_incomplete_pks).exists())
        redistributed_original_ids = set(
            CatchupSchedule.objects
            .filter(session=self.session, is_completed=False)
            .values_list("original_schedule_id", flat=True)
        )
        self.assertEqual(redistributed_original_ids, {originals[1].id, originals[2].id})

    def test_preview_overflow_warning_string_is_unchanged(self):
        today = timezone.now().date()
        subscription, schedules = self._subscription_with_overdue_schedules("overflow-preview")
        response = self.client.post(
            self._catchup_preview_url(subscription),
            {
                "range_start": schedules[0].date.isoformat(),
                "range_end": schedules[-1].date.isoformat(),
                "target_rejoin_date": today.isoformat(),
                "max_daily_readings": 1,
                "max_daily_chapters": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIs(response.data["valid"], False)
        self.assertEqual(response.data["warnings"], [self._overflow_message(2)])

    def test_update_rejects_invalid_limits_without_write(self):
        response = self.client.patch(
            self._update_url(),
            {
                "name": "오염된 따라잡기",
                "max_daily_readings": 0,
                "max_daily_chapters": -1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "원래 따라잡기")
        self.assertEqual(self.session.max_daily_readings, 2)
        self.assertEqual(self.session.max_daily_chapters, 4)

    def test_update_rejects_invalid_weekend_multiplier_without_write(self):
        response = self.client.patch(
            self._update_url(),
            {
                "name": "오염된 따라잡기",
                "weekend_multiplier": "9.9",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "원래 따라잡기")
        self.assertEqual(self.session.weekend_multiplier, Decimal("1.5"))

    def test_create_rejects_invalid_planning_limits_before_session_write(self):
        response = self.client.post(
            f"/api/v1/todos/subscriptions/{self.subscription.id}/catchup/",
            {
                "name": "잘못된 따라잡기",
                "range_start": "2026-01-01",
                "range_end": "2026-01-10",
                "max_daily_readings": 0,
                "weekend_multiplier": "9.9",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            CatchupSession.objects.filter(name="잘못된 따라잡기").exists()
        )

    def test_active_session_identity_rejects_direct_duplicate_active_session(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CatchupSession.objects.create(
                    subscription=self.subscription,
                    name="중복 활성 따라잡기",
                    range_start=date(2026, 1, 1),
                    range_end=date(2026, 1, 10),
                )

        self.session.status = "completed"
        self.session.save(update_fields=["status"])
        archived_duplicate = CatchupSession.objects.create(
            subscription=self.subscription,
            name="완료 후 새 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
        )
        self.assertEqual(archived_duplicate.status, "active")

    def test_create_rejects_second_active_session_without_extra_write(self):
        subscription = self._subscription_with_overdue_schedule("api-duplicate")
        url = f"/api/v1/todos/subscriptions/{subscription.id}/catchup/"

        first_response = self.client.post(url, self._create_payload(), format="json")
        second_response = self.client.post(url, self._create_payload(), format="json")

        self.assertEqual(first_response.status_code, 201, first_response.data)
        self.assertEqual(second_response.status_code, 400, second_response.data)
        self.assertIn("이미 진행 중인 따라잡기", second_response.data["error"])
        self.assertEqual(
            CatchupSession.objects.filter(
                subscription=subscription,
                status="active",
            ).count(),
            1,
        )

    def test_create_maps_active_identity_integrity_race_to_duplicate_response(self):
        subscription = self._subscription_with_overdue_schedule("integrity-race")
        url = f"/api/v1/todos/subscriptions/{subscription.id}/catchup/"

        with patch(
            "todos.catchup_views.CatchupSession.objects.create",
            side_effect=IntegrityError("active_subscription_identity"),
        ):
            response = self.client.post(url, self._create_payload(), format="json")

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("이미 진행 중인 따라잡기", response.data["error"])
        self.assertFalse(
            CatchupSession.objects.filter(subscription=subscription).exists()
        )

    def test_update_recalculate_false_string_does_not_delete_schedules(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)

        response = self.client.patch(
            self._update_url(),
            {"name": "이름만 변경", "recalculate": "false"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "이름만 변경")
        self.assertTrue(CatchupSchedule.objects.filter(pk=catchup_schedule.pk).exists())

    def test_update_rejects_invalid_recalculate_without_write(self):
        response = self.client.patch(
            self._update_url(),
            {"name": "오염된 따라잡기", "recalculate": "sometimes"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "원래 따라잡기")

    def test_update_recalculate_failure_rolls_back_session_and_schedules(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self.client.raise_request_exception = False

        with patch(
            "todos.catchup_views.CatchupSchedule.objects.bulk_create",
            side_effect=RuntimeError("forced redistribution failure"),
        ):
            response = self.client.patch(
                self._update_url(),
                {"name": "롤백되어야 하는 이름", "recalculate": True},
                format="json",
            )

        self.assertEqual(response.status_code, 500)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "원래 따라잡기")
        self.assertTrue(CatchupSchedule.objects.filter(pk=catchup_schedule.pk).exists())

    def test_active_session_schedule_toggle_still_updates_completion(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 200, response.data)
        catchup_schedule.refresh_from_db()
        self.assertTrue(catchup_schedule.is_completed)
        self.assertIsNotNone(catchup_schedule.completed_at)

    def test_completed_session_schedule_toggle_is_rejected_without_mutation(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        catchup_schedule.is_completed = True
        catchup_schedule.completed_at = timezone.now()
        catchup_schedule.save(update_fields=["is_completed", "completed_at"])
        completed_at = catchup_schedule.completed_at
        self.session.status = "completed"
        self.session.completed_at = timezone.now()
        self.session.save(update_fields=["status", "completed_at"])

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 404)
        catchup_schedule.refresh_from_db()
        self.assertTrue(catchup_schedule.is_completed)
        self.assertEqual(catchup_schedule.completed_at, completed_at)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription, schedule=original).exists())

    def test_abandoned_session_schedule_toggle_is_rejected_without_mutation(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self.session.status = "abandoned"
        self.session.save(update_fields=["status"])

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 404)
        catchup_schedule.refresh_from_db()
        self.assertFalse(catchup_schedule.is_completed)
        self.assertIsNone(catchup_schedule.completed_at)
        self.assertFalse(UserBibleProgress.objects.filter(subscription=self.subscription, schedule=original).exists())

    def test_foreign_active_session_schedule_toggle_still_returns_not_found(self):
        other_user = User.objects.create_user(
            username="catchup-other-reader",
            nickname="다른따라잡기독자",
            password="pw-test-1234",
        )
        other_plan = BibleReadingPlan.objects.create(
            name="다른 따라잡기 플랜",
            created_by=other_user,
        )
        other_subscription = PlanSubscription.objects.create(
            user=other_user,
            plan=other_plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        other_session = CatchupSession.objects.create(
            subscription=other_subscription,
            name="다른 활성 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
        )
        other_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan,
            date=date(2026, 1, 3),
            book="Genesis",
            start_chapter=1,
            end_chapter=1,
        )
        catchup_schedule = CatchupSchedule.objects.create(
            session=other_session,
            original_schedule=other_schedule,
            scheduled_date=date(2026, 1, 20),
        )

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 404)
        catchup_schedule.refresh_from_db()
        self.assertFalse(catchup_schedule.is_completed)
        self.assertFalse(
            UserBibleProgress.objects.filter(
                subscription=other_subscription,
                schedule=other_schedule,
            ).exists()
        )

    def test_inactive_subscription_schedule_toggle_on_is_rejected_without_progress_creation(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self._set_subscription_active(False)

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 404)
        catchup_schedule.refresh_from_db()
        self.assertFalse(catchup_schedule.is_completed)
        self.assertIsNone(catchup_schedule.completed_at)
        self.assertFalse(
            UserBibleProgress.objects.filter(
                subscription=self.subscription,
                schedule=original,
            ).exists()
        )

    def test_inactive_subscription_schedule_toggle_off_is_rejected_without_progress_update(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        catchup_schedule.is_completed = True
        catchup_schedule.completed_at = timezone.now()
        catchup_schedule.save(update_fields=["is_completed", "completed_at"])
        progress = UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=original,
            is_completed=True,
            completed_at=catchup_schedule.completed_at,
        )
        completed_at = catchup_schedule.completed_at
        self._set_subscription_active(False)

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 404)
        catchup_schedule.refresh_from_db()
        progress.refresh_from_db()
        self.assertTrue(catchup_schedule.is_completed)
        self.assertEqual(catchup_schedule.completed_at, completed_at)
        self.assertTrue(progress.is_completed)
        self.assertEqual(progress.completed_at, completed_at)

    def test_schedules_without_date_filter_returns_all_groups(self):
        first, second = self._catchup_schedules_for_date_filter()

        response = self.client.get(self._schedules_url())

        self.assertEqual(response.status_code, 200, response.data)
        data = response.json()
        self.assertIn("session", data)
        self.assertIn("schedules", data)
        self.assertEqual(
            {group["date"] for group in data["schedules"]},
            {
                first.scheduled_date.isoformat(),
                second.scheduled_date.isoformat(),
            },
        )
        self.assertEqual(
            sum(len(group["items"]) for group in data["schedules"]),
            2,
        )

    def test_schedules_date_filter_returns_only_matching_date(self):
        first, second = self._catchup_schedules_for_date_filter()

        response = self.client.get(
            self._schedules_url(),
            {"date": second.scheduled_date.isoformat()},
        )

        self.assertEqual(response.status_code, 200, response.data)
        data = response.json()
        self.assertEqual(len(data["schedules"]), 1)
        self.assertEqual(
            data["schedules"][0]["date"],
            second.scheduled_date.isoformat(),
        )
        self.assertEqual(
            [item["id"] for item in data["schedules"][0]["items"]],
            [second.id],
        )
        self.assertNotEqual(first.scheduled_date, second.scheduled_date)

    def test_schedules_reject_invalid_date_filters(self):
        self._catchup_schedules_for_date_filter()

        for invalid_date in ["not-a-date", "2026-02-30", ""]:
            with self.subTest(date=invalid_date):
                response = self.client.get(
                    self._schedules_url(),
                    {"date": invalid_date},
                )

                self.assertEqual(response.status_code, 400)
                data = response.json()
                self.assertIn("date", data)
                self.assertFalse("session" in data and "schedules" in data)

    def test_inactive_subscription_complete_is_rejected_without_status_change(self):
        self._set_subscription_active(False)

        response = self.client.post(self._complete_url())

        self.assertEqual(response.status_code, 404)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "active")
        self.assertIsNone(self.session.completed_at)

    def test_inactive_subscription_abandon_is_rejected_without_status_change(self):
        self._set_subscription_active(False)

        response = self.client.post(self._abandon_url())

        self.assertEqual(response.status_code, 404)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "active")

    def test_inactive_subscription_active_session_detail_schedules_and_update_return_not_found(self):
        original = self._original_schedule()
        self._catchup_schedule(original)
        self._set_subscription_active(False)

        detail_response = self.client.get(self._detail_url())
        schedules_response = self.client.get(self._schedules_url())
        update_response = self.client.patch(
            self._update_url(),
            {"name": "비활성 구독에서 바뀌면 안 됨"},
            format="json",
        )

        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(schedules_response.status_code, 404)
        self.assertEqual(update_response.status_code, 404)
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "원래 따라잡기")

    def test_active_sessions_list_excludes_inactive_subscription_sessions(self):
        other_plan = BibleReadingPlan.objects.create(
            name="활성 따라잡기 플랜",
            created_by=self.user,
        )
        other_subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=other_plan,
            start_date=date(2026, 2, 1),
            is_active=True,
        )
        visible_session = CatchupSession.objects.create(
            subscription=other_subscription,
            name="보이는 따라잡기",
            range_start=date(2026, 2, 1),
            range_end=date(2026, 2, 10),
        )
        self._set_subscription_active(False)

        response = self.client.get(self._active_sessions_url())

        self.assertEqual(response.status_code, 200, response.data)
        session_ids = {item["id"] for item in response.data}
        self.assertNotIn(self.session.id, session_ids)
        self.assertIn(visible_session.id, session_ids)

    def test_inactive_plan_rejects_subscription_catchup_endpoints_while_subscription_stays_active(self):
        self._set_plan_active(False)

        status_response = self.client.get(self._catchup_status_url())
        preview_response = self.client.post(self._catchup_preview_url(self.subscription), {}, format="json")
        create_response = self.client.post(self._catchup_create_url(self.subscription), {}, format="json")

        self.assertEqual(status_response.status_code, 404)
        self.assertEqual(preview_response.status_code, 404)
        self.assertEqual(create_response.status_code, 404)
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.is_active)

    def test_inactive_plan_catchup_create_does_not_materialize_session_or_schedules(self):
        subscription, schedules = self._subscription_with_overdue_schedules(
            "inactive-plan-create",
        )
        subscription.plan.is_active = False
        subscription.plan.save(update_fields=["is_active"])

        response = self.client.post(
            self._catchup_create_url(subscription),
            {
                "name": "생성되면 안 되는 따라잡기",
                "range_start": schedules[0].date.isoformat(),
                "range_end": schedules[-1].date.isoformat(),
                "target_rejoin_date": (timezone.now().date() + timedelta(days=7)).isoformat(),
                "max_daily_readings": 3,
                "max_daily_chapters": 3,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(CatchupSession.objects.filter(subscription=subscription).exists())
        self.assertFalse(
            CatchupSchedule.objects.filter(session__subscription=subscription).exists()
        )
        subscription.refresh_from_db()
        self.assertTrue(subscription.is_active)

    def test_inactive_plan_blocks_active_session_operations_while_subscription_stays_active(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self._set_plan_active(False)

        detail_response = self.client.get(self._detail_url())
        schedules_response = self.client.get(self._schedules_url())
        update_response = self.client.patch(
            self._update_url(),
            {"name": "비활성 플랜에서 바뀌면 안 됨"},
            format="json",
        )
        complete_response = self.client.post(self._complete_url())
        abandon_response = self.client.post(self._abandon_url())
        toggle_response = self.client.post(self._toggle_url(catchup_schedule))
        active_sessions_response = self.client.get(self._active_sessions_url())

        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(schedules_response.status_code, 404)
        self.assertEqual(update_response.status_code, 404)
        self.assertEqual(complete_response.status_code, 404)
        self.assertEqual(abandon_response.status_code, 404)
        self.assertEqual(toggle_response.status_code, 404)
        self.assertNotIn(
            self.session.id,
            {item["id"] for item in active_sessions_response.data},
        )
        self.session.refresh_from_db()
        catchup_schedule.refresh_from_db()
        self.subscription.refresh_from_db()
        self.assertEqual(self.session.status, "active")
        self.assertEqual(self.session.name, "원래 따라잡기")
        self.assertFalse(catchup_schedule.is_completed)
        self.assertFalse(
            UserBibleProgress.objects.filter(
                subscription=self.subscription,
                schedule=original,
            ).exists()
        )
        self.assertTrue(self.subscription.is_active)

    def test_inactive_plan_schedule_toggle_off_preserves_completion_and_progress(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        catchup_schedule.is_completed = True
        catchup_schedule.completed_at = timezone.now()
        catchup_schedule.save(update_fields=["is_completed", "completed_at"])
        progress = UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=original,
            is_completed=True,
            completed_at=catchup_schedule.completed_at,
        )
        completed_at = catchup_schedule.completed_at
        self._set_plan_active(False)

        response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(response.status_code, 404)
        catchup_schedule.refresh_from_db()
        progress.refresh_from_db()
        self.assertTrue(catchup_schedule.is_completed)
        self.assertEqual(catchup_schedule.completed_at, completed_at)
        self.assertTrue(progress.is_completed)
        self.assertEqual(progress.completed_at, completed_at)

    def test_reenabled_plan_restores_active_session_detail_and_toggle(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self._set_plan_active(False)

        inactive_detail = self.client.get(self._detail_url())
        inactive_toggle = self.client.post(self._toggle_url(catchup_schedule))
        self._set_plan_active(True)
        active_detail = self.client.get(self._detail_url())
        active_toggle = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(inactive_detail.status_code, 404)
        self.assertEqual(inactive_toggle.status_code, 404)
        self.assertEqual(active_detail.status_code, 200, active_detail.data)
        self.assertEqual(active_toggle.status_code, 200, active_toggle.data)
        catchup_schedule.refresh_from_db()
        self.assertTrue(catchup_schedule.is_completed)

    def test_terminal_session_history_remains_visible_when_plan_is_inactive(self):
        original = self._original_schedule()
        self._catchup_schedule(original)
        self.session.status = "completed"
        self.session.completed_at = timezone.now()
        self.session.save(update_fields=["status", "completed_at"])
        abandoned_session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="포기한 따라잡기",
            range_start=date(2026, 2, 1),
            range_end=date(2026, 2, 10),
            status="abandoned",
        )
        CatchupSchedule.objects.create(
            session=abandoned_session,
            original_schedule=original,
            scheduled_date=date(2026, 2, 20),
        )
        self._set_plan_active(False)

        completed_detail = self.client.get(self._detail_url())
        completed_schedules = self.client.get(self._schedules_url())
        abandoned_detail = self.client.get(self._detail_url(abandoned_session))
        abandoned_schedules = self.client.get(self._schedules_url(abandoned_session))

        self.assertEqual(completed_detail.status_code, 200, completed_detail.data)
        self.assertEqual(completed_schedules.status_code, 200, completed_schedules.data)
        self.assertEqual(abandoned_detail.status_code, 200, abandoned_detail.data)
        self.assertEqual(abandoned_schedules.status_code, 200, abandoned_schedules.data)
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.is_active)

    def test_terminal_session_detail_and_schedules_remain_visible_when_subscription_is_inactive(self):
        original = self._original_schedule()
        self._catchup_schedule(original)
        self.session.status = "completed"
        self.session.completed_at = timezone.now()
        self.session.save(update_fields=["status", "completed_at"])
        abandoned_session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="포기한 따라잡기",
            range_start=date(2026, 2, 1),
            range_end=date(2026, 2, 10),
            status="abandoned",
        )
        CatchupSchedule.objects.create(
            session=abandoned_session,
            original_schedule=original,
            scheduled_date=date(2026, 2, 20),
        )
        self._set_subscription_active(False)

        completed_detail = self.client.get(self._detail_url())
        completed_schedules = self.client.get(self._schedules_url())
        abandoned_detail = self.client.get(self._detail_url(abandoned_session))
        abandoned_schedules = self.client.get(self._schedules_url(abandoned_session))

        self.assertEqual(completed_detail.status_code, 200, completed_detail.data)
        self.assertEqual(completed_schedules.status_code, 200, completed_schedules.data)
        self.assertEqual(abandoned_detail.status_code, 200, abandoned_detail.data)
        self.assertEqual(abandoned_schedules.status_code, 200, abandoned_schedules.data)

    def test_reactivated_subscription_active_session_becomes_visible_and_operable_again(self):
        original = self._original_schedule()
        catchup_schedule = self._catchup_schedule(original)
        self._set_subscription_active(False)

        inactive_detail = self.client.get(self._detail_url())
        inactive_toggle = self.client.post(self._toggle_url(catchup_schedule))
        self._set_subscription_active(True)
        active_detail = self.client.get(self._detail_url())
        update_response = self.client.patch(
            self._update_url(),
            {"name": "다시 활성화된 따라잡기"},
            format="json",
        )
        toggle_response = self.client.post(self._toggle_url(catchup_schedule))

        self.assertEqual(inactive_detail.status_code, 404)
        self.assertEqual(inactive_toggle.status_code, 404)
        self.assertEqual(active_detail.status_code, 200, active_detail.data)
        self.assertEqual(update_response.status_code, 200, update_response.data)
        self.assertEqual(toggle_response.status_code, 200, toggle_response.data)
        catchup_schedule.refresh_from_db()
        self.session.refresh_from_db()
        self.assertEqual(self.session.name, "다시 활성화된 따라잡기")
        self.assertTrue(catchup_schedule.is_completed)
        self.assertTrue(
            UserBibleProgress.objects.filter(
                subscription=self.subscription,
                schedule=original,
                is_completed=True,
            ).exists()
        )

    def _complete_url(self, session=None):
        session = session or self.session
        return f"/api/v1/todos/catchup-sessions/{session.id}/complete/"

    def _abandon_url(self, session=None):
        session = session or self.session
        return f"/api/v1/todos/catchup-sessions/{session.id}/abandon/"

    def test_complete_active_session_transitions_and_frees_identity(self):
        response = self.client.post(self._complete_url())

        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "completed")
        self.assertIsNotNone(self.session.completed_at)
        # update_fields must still let the DB recompute the unique
        # active_subscription_identity so a new active session is allowed.
        new_session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="완료 후 새 따라잡기",
            range_start=date(2026, 2, 1),
            range_end=date(2026, 2, 10),
        )
        self.assertEqual(new_session.status, "active")

    def test_complete_already_completed_session_is_rejected(self):
        self.session.status = "completed"
        self.session.completed_at = timezone.now()
        self.session.save(update_fields=["status", "completed_at"])

        response = self.client.post(self._complete_url())

        self.assertEqual(response.status_code, 404)

    def test_abandon_active_session_transitions_and_frees_identity(self):
        response = self.client.post(self._abandon_url())

        self.assertEqual(response.status_code, 200)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "abandoned")
        new_session = CatchupSession.objects.create(
            subscription=self.subscription,
            name="포기 후 새 따라잡기",
            range_start=date(2026, 2, 1),
            range_end=date(2026, 2, 10),
        )
        self.assertEqual(new_session.status, "active")

    def test_abandon_already_terminal_session_is_rejected(self):
        self.session.status = "abandoned"
        self.session.save(update_fields=["status"])

        response = self.client.post(self._abandon_url())

        self.assertEqual(response.status_code, 404)

    def test_complete_and_abandon_are_mutually_exclusive_transitions(self):
        complete_response = self.client.post(self._complete_url())
        self.assertEqual(complete_response.status_code, 200)

        # A racing abandon on the now-completed session must not override it.
        abandon_response = self.client.post(self._abandon_url())
        self.assertEqual(abandon_response.status_code, 404)

        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "completed")

    def test_complete_foreign_session_returns_not_found(self):
        other_user = User.objects.create_user(
            username="catchup-foreign-owner",
            nickname="남의따라잡기",
            password="pw-test-1234",
        )
        other_plan = BibleReadingPlan.objects.create(
            name="남의 따라잡기 플랜",
            created_by=other_user,
        )
        other_subscription = PlanSubscription.objects.create(
            user=other_user,
            plan=other_plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        other_session = CatchupSession.objects.create(
            subscription=other_subscription,
            name="남의 활성 따라잡기",
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 10),
        )

        complete_response = self.client.post(self._complete_url(other_session))
        abandon_response = self.client.post(self._abandon_url(other_session))

        self.assertEqual(complete_response.status_code, 404)
        self.assertEqual(abandon_response.status_code, 404)
        other_session.refresh_from_db()
        self.assertEqual(other_session.status, "active")

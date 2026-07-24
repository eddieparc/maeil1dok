from datetime import date

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription, UserBibleProgress

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class MonthScheduleVisibilityApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.owner = User.objects.create_user(
            username="month-plan-owner",
            nickname="월간플랜관리자",
            password="pw-test-1234",
        )
        self.inactive_plan = self._plan("비공개 월간 플랜", is_active=False)
        self.active_plan = self._plan("공개 월간 플랜", is_active=True)
        self.inactive_schedule = self._schedule(self.inactive_plan)
        self.active_schedule = self._schedule(self.active_plan)

    def _plan(self, name, is_active):
        return BibleReadingPlan.objects.create(
            name=name,
            is_active=is_active,
            created_by=self.owner,
        )

    def _schedule(
        self,
        plan,
        schedule_date=None,
        book="창세기",
        start_chapter=1,
        end_chapter=1,
    ):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=schedule_date or self.today,
            book=book,
            start_chapter=start_chapter,
            end_chapter=end_chapter,
            audio_link="https://example.com/audio.mp3",
            guide_link="https://example.com/guide",
        )

    def test_month_schedules_hide_inactive_plan_from_anonymous_user(self):
        response = self.client.get(
            "/api/v1/todos/schedules/month/",
            {"plan_id": self.inactive_plan.id, "month": self.today.month},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(response, str(self.inactive_schedule.id), status_code=404)
        self.assertNotContains(response, "https://example.com/audio.mp3", status_code=404)

    def test_month_schedules_active_plan_public_read_still_works(self):
        response = self.client.get(
            "/api/v1/todos/schedules/month/",
            {"plan_id": self.active_plan.id, "month": self.today.month},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()], [self.active_schedule.id])

    def test_month_schedules_reject_out_of_range_month_without_server_error(self):
        response = self.client.get(
            "/api/v1/todos/schedules/month/",
            {"plan_id": self.active_plan.id, "month": 13},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Month must be between 1 and 12")

    def test_month_schedules_with_year_returns_only_that_year(self):
        plan = self._plan("연도 필터 플랜", is_active=True)
        july_2025 = self._schedule(plan, date(2025, 7, 3), book="출애굽기")
        july_2026 = self._schedule(plan, date(2026, 7, 4), book="레위기")
        august_2026 = self._schedule(plan, date(2026, 8, 1), book="민수기")

        response = self.client.get(
            "/api/v1/todos/schedules/month/",
            {"plan_id": plan.id, "month": 7, "year": 2026},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()], [july_2026.id])
        self.assertNotIn(july_2025.id, [item["id"] for item in response.json()])
        self.assertNotIn(august_2026.id, [item["id"] for item in response.json()])

    def test_month_schedules_without_year_preserves_cross_year_month_behavior(self):
        plan = self._plan("월 필터 호환 플랜", is_active=True)
        july_2025 = self._schedule(plan, date(2025, 7, 3), book="여호수아")
        july_2026 = self._schedule(plan, date(2026, 7, 4), book="사사기")
        self._schedule(plan, date(2026, 8, 1), book="룻기")

        response = self.client.get(
            "/api/v1/todos/schedules/month/",
            {"plan_id": plan.id, "month": 7},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()], [july_2025.id, july_2026.id])

    def test_month_schedules_completed_state_uses_only_returned_year_schedule_ids(self):
        plan = self._plan("완료 상태 연도 필터 플랜", is_active=True)
        user = User.objects.create_user(username="month-reader", password="pw-test-1234")
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        july_2025 = self._schedule(plan, date(2025, 7, 3), book="사무엘상")
        july_2026 = self._schedule(plan, date(2026, 7, 4), book="사무엘하")
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=july_2025,
            is_completed=True,
        )

        self.client.force_authenticate(user=user)
        response = self.client.get(
            "/api/v1/todos/schedules/month/",
            {"plan_id": plan.id, "month": 7, "year": 2026},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [
            {
                "id": july_2026.id,
                "plan": plan.id,
                "plan_name": plan.name,
                "date": "2026-07-04",
                "book": "사무엘하",
                "start_chapter": 1,
                "end_chapter": 1,
                "audio_link": "https://example.com/audio.mp3",
                "guide_link": "https://example.com/guide",
                "is_completed": False,
            }
        ])

    def test_month_schedules_reject_invalid_year_values(self):
        for invalid_year in ["abc", "", "0", "10000"]:
            with self.subTest(year=invalid_year):
                response = self.client.get(
                    "/api/v1/todos/schedules/month/",
                    {"plan_id": self.active_plan.id, "month": 7, "year": invalid_year},
                )

                self.assertEqual(response.status_code, 400)

    def test_month_schedules_year_query_has_constant_query_count(self):
        plan = self._plan("월간 N+1 방지 플랜", is_active=True)
        for index in range(25):
            self._schedule(
                plan,
                date(2026, 7, (index % 28) + 1),
                book=f"성경{index}",
                start_chapter=index + 1,
                end_chapter=index + 1,
            )

        with CaptureQueriesContext(connection) as context:
            response = self.client.get(
                "/api/v1/todos/schedules/month/",
                {"plan_id": plan.id, "month": 7, "year": 2026},
            )

        self.assertEqual(response.status_code, 200)
        self.assertLess(len(context.captured_queries), 5)
        self.assertEqual(len(response.json()), 25)
        self.assertTrue(all(item["plan_name"] == plan.name for item in response.json()))

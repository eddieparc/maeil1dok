from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class ScheduleVisibilityApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.owner = User.objects.create_user(
            username="plan-owner",
            nickname="플랜관리자",
            password="pw-test-1234",
        )
        self.reader = User.objects.create_user(
            username="reader",
            nickname="독자",
            password="pw-test-1234",
        )
        self.allowed_plan = self._plan("구독 중 공개 플랜", is_active=True)
        self.unsubscribed_plan = self._plan("미구독 공개 플랜", is_active=True)
        self.inactive_plan = self._plan("구독 중 비공개 플랜", is_active=False)
        self.inactive_subscription_plan = self._plan("비활성 구독 플랜", is_active=True)

        self.allowed_schedule = self._schedule(self.allowed_plan, "창세기", 1)
        self.unsubscribed_schedule = self._schedule(self.unsubscribed_plan, "출애굽기", 2)
        self.inactive_schedule = self._schedule(self.inactive_plan, "레위기", 3)
        self.inactive_subscription_schedule = self._schedule(
            self.inactive_subscription_plan,
            "민수기",
            4,
        )

        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.allowed_plan,
            start_date=self.today,
            is_active=True,
        )
        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.inactive_plan,
            start_date=self.today,
            is_active=True,
        )
        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.inactive_subscription_plan,
            start_date=self.today,
            is_active=False,
        )

    def _plan(self, name, is_active):
        return BibleReadingPlan.objects.create(
            name=name,
            is_active=is_active,
            created_by=self.owner,
        )

    def _schedule(self, plan, book, day_offset):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=self.today + timedelta(days=day_offset),
            book=book,
            start_chapter=1,
            end_chapter=1,
            audio_link="https://example.com/audio.mp3",
            guide_link="https://example.com/guide",
        )

    def test_reader_cannot_list_or_detail_unsubscribed_or_inactive_plan_schedules(self):
        self.client.force_authenticate(user=self.reader)

        for plan in [
            self.unsubscribed_plan,
            self.inactive_plan,
            self.inactive_subscription_plan,
        ]:
            response = self.client.get("/api/v1/todos/schedules/", {"plan_id": plan.id})
            self.assertEqual(response.status_code, 404)

        for schedule in [
            self.unsubscribed_schedule,
            self.inactive_schedule,
            self.inactive_subscription_schedule,
        ]:
            response = self.client.get(f"/api/v1/todos/schedules/{schedule.id}/")
            self.assertEqual(response.status_code, 404)

        response = self.client.get("/api/v1/todos/schedules/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()], [self.allowed_schedule.id])

    def test_subscribed_reader_can_list_and_detail_own_active_plan_schedules(self):
        self.client.force_authenticate(user=self.reader)

        list_response = self.client.get(
            "/api/v1/todos/schedules/",
            {"plan_id": self.allowed_plan.id},
        )
        all_response = self.client.get("/api/v1/todos/schedules/")
        detail_response = self.client.get(
            f"/api/v1/todos/schedules/{self.allowed_schedule.id}/",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([item["id"] for item in list_response.json()], [self.allowed_schedule.id])
        self.assertEqual(all_response.status_code, 200)
        self.assertEqual([item["id"] for item in all_response.json()], [self.allowed_schedule.id])
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["id"], self.allowed_schedule.id)
    def test_oversized_plan_id_returns_not_found_without_server_error(self):
        self.client.force_authenticate(user=self.reader)

        response = self.client.get(
            "/api/v1/todos/schedules/",
            {"plan_id": str(10**100)},
        )

        self.assertEqual(response.status_code, 404)

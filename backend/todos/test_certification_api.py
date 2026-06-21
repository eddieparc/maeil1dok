from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from rest_framework.test import APIClient

from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
)

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class CertificationProgressApiTest(TestCase):
    URL = "/api/v1/todos/certification/progress/"

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="cert-reader",
            nickname="공유독자",
            email="reader@example.com",
            password="pw-test-1234",
            is_social=True,
            social_provider="kakao",
            social_id="secret-social-id",
        )
        self.user.profile.current_streak = 4
        self.user.profile.total_completed_days = 10
        self.user.profile.save(update_fields=["current_streak", "total_completed_days"])
        self.client.force_authenticate(user=self.user)
        self.plan = BibleReadingPlan.objects.create(
            name="SNS 인증 플랜",
            created_by=self.user,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        self.first_schedule = self._schedule(date(2026, 1, 1), "창세기", 1, 2)
        self.second_schedule = self._schedule(date(2026, 1, 2), "출애굽기", 1, 1)
        self._schedule(date(2026, 1, 3), "레위기", 1, 1)

    def _schedule(self, schedule_date, book, start_chapter, end_chapter):
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book=book,
            start_chapter=start_chapter,
            end_chapter=end_chapter,
        )

    def _complete(self, schedule, completed_at):
        return UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=schedule,
            is_completed=True,
            completed_at=completed_at,
        )

    def test_progress_returns_certification_dto_for_first_active_subscription(self):
        # Given
        latest_completed_at = datetime(2026, 1, 2, 9, 30)
        self._complete(self.first_schedule, datetime(2026, 1, 1, 9, 30))
        self._complete(self.second_schedule, latest_completed_at)

        # When
        response = self.client.get(self.URL)

        # Then
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"], {"id": self.user.id, "nickname": "공유독자"})
        self.assertEqual(data["plan"], {"id": self.plan.id, "name": "SNS 인증 플랜"})
        self.assertEqual(data["period"], {"startDate": "2026-01-01", "endDate": "2026-01-03"})
        self.assertEqual(data["progress"]["totalSchedules"], 3)
        self.assertEqual(data["progress"]["completedSchedules"], 2)
        self.assertEqual(data["progress"]["completionRate"], 66.67)
        self.assertEqual(data["progress"]["currentStreak"], 4)
        self.assertEqual(data["progress"]["totalCompletedDays"], 10)
        self.assertEqual(data["progress"]["latestCompletedAt"], "2026-01-02T09:30:00")
        self.assertEqual(data["progress"]["status"], "in_progress")
        self.assertEqual(data["card"]["title"], "오늘 통독 완료")
        self.assertEqual(data["card"]["subtitle"], "오늘도 말씀을 읽었습니다")
        self.assertEqual(data["card"]["readingRange"], "출애굽기 1장")
        self.assertEqual(data["card"]["dateLabel"], "2026-01-02")
        self.assertEqual(data["card"]["footer"], "매일 말씀을 읽는 작은 습관")
        self.assertEqual(set(data["user"].keys()), {"id", "nickname"})

    def test_progress_returns_no_progress_status_without_completed_schedules(self):
        # Given
        inactive_plan = BibleReadingPlan.objects.create(name="비활성 플랜", created_by=self.user)
        PlanSubscription.objects.create(
            user=self.user,
            plan=inactive_plan,
            start_date=date(2026, 1, 1),
            is_active=False,
        )

        # When
        response = self.client.get(self.URL)

        # Then
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["progress"]["completedSchedules"], 0)
        self.assertEqual(data["progress"]["completionRate"], 0)
        self.assertIsNone(data["progress"]["latestCompletedAt"])
        self.assertEqual(data["progress"]["status"], "no_progress")
        self.assertEqual(data["card"]["readingRange"], "")

    def test_progress_selects_active_subscription_by_plan_id_and_schedule_id(self):
        # Given
        other_plan = BibleReadingPlan.objects.create(name="선택 플랜", created_by=self.user)
        other_subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=other_plan,
            start_date=date(2026, 2, 1),
            is_active=True,
        )
        other_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan,
            date=date(2026, 2, 1),
            book="마태복음",
            start_chapter=5,
            end_chapter=7,
        )
        UserBibleProgress.objects.create(
            subscription=other_subscription,
            schedule=other_schedule,
            is_completed=True,
            completed_at=datetime(2026, 2, 1, 7, 0),
        )

        # When
        response = self.client.get(
            self.URL,
            {"plan_id": other_plan.id, "schedule_id": other_schedule.id},
        )

        # Then
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["plan"], {"id": other_plan.id, "name": "선택 플랜"})
        self.assertEqual(data["period"], {"startDate": "2026-02-01", "endDate": "2026-02-01"})
        self.assertEqual(data["progress"]["status"], "completed")
        self.assertEqual(data["card"]["readingRange"], "마태복음 5-7장")

    def test_progress_rejects_malformed_numeric_params(self):
        # Given
        cases = [
            {"plan_id": "not-a-number"},
            {"schedule_id": "not-a-number"},
            {"plan_id": str(10**100)},
            {"schedule_id": str(10**100)},
        ]

        for params in cases:
            # When
            response = self.client.get(self.URL, params)

            # Then
            self.assertEqual(response.status_code, 400)
            self.assertFalse(response.json()["success"])

    def test_progress_returns_404_without_active_subscription(self):
        # Given
        self.subscription.is_active = False
        self.subscription.save(update_fields=["is_active"])

        # When
        response = self.client.get(self.URL)

        # Then
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()["success"])

    def test_progress_rejects_schedule_from_another_plan(self):
        # Given
        other_plan = BibleReadingPlan.objects.create(name="다른 플랜", created_by=self.user)
        other_schedule = DailyBibleSchedule.objects.create(
            plan=other_plan,
            date=date(2026, 3, 1),
            book="요한복음",
            start_chapter=1,
            end_chapter=1,
        )

        # When
        response = self.client.get(
            self.URL,
            {"plan_id": self.plan.id, "schedule_id": other_schedule.id},
        )

        # Then
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])

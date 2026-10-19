from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from todos.models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
)


class ChapterScheduleSelectionTest(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="schedule-qa",
            nickname="일정 QA",
            password="test-only",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="반복 본문 플랜", created_by=self.user,
        )
        self.first = self.schedule(date(2026, 10, 1))
        self.second = self.schedule(date(2026, 10, 8))

    def schedule(self, day: date, book: str = "창세기") -> DailyBibleSchedule:
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=day,
            book=book,
            start_chapter=1,
            end_chapter=1,
        )

    def test_selected_date_returns_the_repeated_passages_day(self) -> None:
        response = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "gen", "chapter": 1,
            "date": "2026-10-08",
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_date"], "2026-10-08")
        self.assertEqual(
            [int(row["schedule_id"]) for row in response.data["plan_detail"]],
            [self.second.id],
        )

    def test_selected_schedule_preserves_the_whole_day_across_books(self) -> None:
        same_day = self.schedule(date(2026, 10, 8), "출애굽기")

        response = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "exo", "chapter": 1,
            "schedule_id": self.second.id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_date"], "2026-10-08")
        self.assertEqual(
            {int(row["schedule_id"]) for row in response.data["plan_detail"]},
            {self.second.id, same_day.id},
        )

    def test_a_schedule_from_another_plan_is_not_selected(self) -> None:
        other = BibleReadingPlan.objects.create(
            name="다른 플랜", created_by=self.user,
        )
        foreign = DailyBibleSchedule.objects.create(
            plan=other, date=date(2026, 10, 8), book="창세기",
            start_chapter=1, end_chapter=1,
        )

        response = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "gen", "chapter": 1,
            "schedule_id": foreign.id,
        })

        self.assertEqual(response.status_code, 404)

    def test_mismatched_explicit_date_and_schedule_are_rejected(self) -> None:
        response = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "gen", "chapter": 1,
            "schedule_id": self.second.id, "date": "2026-10-01",
        })

        self.assertEqual(response.status_code, 400)

    def test_malformed_selectors_are_rejected(self) -> None:
        for selector in (
            {"schedule_id": "invalid"},
            {"schedule_id": "0"},
            {"date": "2026-02-30"},
        ):
            with self.subTest(selector=selector):
                response = self.client.get("/api/v1/todos/detail/", {
                    "plan_id": self.plan.id, "book": "gen", "chapter": 1,
                    **selector,
                })

                self.assertEqual(response.status_code, 400)

    def test_off_day_passage_does_not_fall_back_to_a_different_day(self) -> None:
        self.schedule(date(2026, 10, 1), "출애굽기")

        response = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "exo", "chapter": 1,
            "schedule_id": self.second.id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_detail"], [])

    def test_legacy_request_without_selectors_keeps_its_first_day(self) -> None:
        response = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "gen", "chapter": 1,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan_date"], "2026-10-01")

    def test_completion_updates_only_the_explicitly_selected_day(self) -> None:
        self.client.force_authenticate(self.user)
        subscription = PlanSubscription.objects.create(
            user=self.user, plan=self.plan, start_date=date(2026, 10, 1),
        )
        detail = self.client.get("/api/v1/todos/detail/", {
            "plan_id": self.plan.id, "book": "gen", "chapter": 1,
            "schedule_id": self.second.id, "date": "2026-10-08",
        })

        response = self.client.post("/api/v1/todos/reading/update/", {
            "plan_id": self.plan.id,
            "schedule_ids": [row["schedule_id"] for row in detail.data["plan_detail"]],
            "action": "complete",
        }, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            list(UserBibleProgress.objects.filter(
                subscription=subscription, is_completed=True,
            ).values_list("schedule_id", flat=True)),
            [self.second.id],
        )

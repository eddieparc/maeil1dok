import json
import os
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription


class PlanReadContractTest(TestCase):
    """Every advertised reading plan must work through the app's real GET routes."""

    def setUp(self):
        self.clock = patch(
            "django.utils.timezone.now",
            return_value=datetime(2026, 9, 24, 12),
        )
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.user = get_user_model().objects.create_user(
            username="plan-flow-reader", nickname="독자", password="test-password",
        )
        self.active = BibleReadingPlan.objects.create(
            name="Current", is_active=True, is_default=True, created_by=self.user,
        )
        self.inactive = BibleReadingPlan.objects.create(
            name="Archived", is_active=False, created_by=self.user,
        )
        self.secondary = BibleReadingPlan.objects.create(
            name="Second", is_active=True, created_by=self.user,
        )
        self.hidden = BibleReadingPlan.objects.create(
            name="Hidden", is_active=True, created_by=self.user,
        )
        for plan in (self.active, self.inactive, self.secondary, self.hidden):
            PlanSubscription.objects.create(
                user=self.user, plan=plan, start_date=date(2026, 1, 1),
                is_active=plan != self.hidden,
            )
            DailyBibleSchedule.objects.create(
                plan=plan, date=date(2026, 9, 24), book="창세기",
                start_chapter=1, end_chapter=2,
                audio_link="https://www.youtube.com/watch?v=m3Fk5UcyIeU",
            )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_advertised_plans_are_readable_and_management_preserves_history(self):
        # Given an account with both kinds of inactive state and two readable plans.
        responses = {}

        def get(path):
            response = self.client.get(path)
            responses[path] = {"status": response.status_code, "body": response.json()}
            return response

        # When the app loads its reading and management collections.
        readable = get("/api/v1/todos/plan/")
        management = get("/api/v1/todos/plans/user/")

        # Then only readable plans are advertised; history is still manageable.
        self.assertEqual(readable.status_code, 200)
        self.assertEqual(
            {row["plan_id"] for row in readable.json()},
            {self.active.pk, self.secondary.pk},
        )
        self.assertEqual(management.status_code, 200)
        managed = {row["plan_id"]: row for row in management.json()["subscriptions"]}
        self.assertEqual(len(managed), 4)
        self.assertIs(managed[self.inactive.pk]["plan_is_active"], False)
        self.assertIs(managed[self.active.pk]["plan_is_active"], True)
        self.assertIs(managed[self.hidden.pk]["is_active"], False)
        for plan in (self.active, self.secondary):
            schedule_id = plan.schedules.get().pk
            paths = [
                f"/api/v1/todos/stats/progress/?plan_id={plan.pk}",
                f"/api/v1/todos/stats/progress/?plan_id={plan.pk}&year=2026",
                f"/api/v1/todos/schedules/month/?plan_id={plan.pk}&month=9&year=2026",
                f"/api/v1/todos/schedules/today/?plan_id={plan.pk}",
                f"/api/v1/todos/detail/?plan_id={plan.pk}&book=gen&chapter=1",
                f"/api/v1/todos/next-position/?plan_id={plan.pk}",
                f"/api/v1/todos/detail/?plan_id={plan.pk}&book=gen&chapter=1&schedule_id={schedule_id}&date=2026-09-24",
                f"/api/v1/todos/detail/?plan_id={plan.pk}&book=gen&chapter=2&schedule_id={schedule_id}&date=2026-09-24",
            ]
            for path in paths:
                with self.subTest(path=path):
                    response = get(path)
                    self.assertEqual(response.status_code, 200, response.content)
                    if isinstance(response.data, dict):
                        self.assertIsNot(response.data.get("success"), False)
            month = responses[paths[2]]["body"]
            self.assertEqual(len(month), 1)
            self.assertEqual(month[0]["plan"], plan.pk)
        for path in [
            "/api/v1/auth/user/",
            f"/api/v1/auth/profile/{self.user.pk}/",
            f"/api/v1/auth/profile/{self.user.pk}/calendar/?year=2026&month=9",
            "/api/v1/todos/notifications/",
        ]:
            self.assertEqual(get(path).status_code, 200)
        target = os.environ.get("PLAN_FLOW_FIXTURE_PATH")
        if target:
            Path(target).write_text(json.dumps({
                "version": 1,
                "today": "2026-09-24",
                "ids": {
                    "activePlan": self.active.pk,
                    "inactivePlan": self.inactive.pk,
                    "secondaryPlan": self.secondary.pk,
                },
                "responses": responses,
            }), encoding="utf-8")

    def test_inactive_plan_remains_private_to_readers_and_guests(self):
        # Given an existing subscriber, an unrelated reader and a guest.
        other = get_user_model().objects.create_user(username="other-reader")
        # When they try to read an inactive plan rather than an advertised plan.
        for user in (self.user, other, None):
            self.client.force_authenticate(user)
            for suffix in (
                f"stats/progress/?plan_id={self.inactive.pk}",
                f"schedules/month/?plan_id={self.inactive.pk}&month=9&year=2026",
                f"schedules/today/?plan_id={self.inactive.pk}",
                f"detail/?plan_id={self.inactive.pk}&book=gen&chapter=1",
                f"next-position/?plan_id={self.inactive.pk}",
            ):
                with self.subTest(user=user is not None, suffix=suffix):
                    response = self.client.get(f"/api/v1/todos/{suffix}")
                    # Then no inactive plan data is disclosed.
                    self.assertEqual(response.status_code, 404)

    def test_guest_collection_advertises_only_active_plans(self):
        # Given a guest without subscriptions.
        self.client.force_authenticate(None)
        # When the guest loads the public reading collection.
        response = self.client.get("/api/v1/todos/plan/")
        # Then subscription ownership is not required for active public plans.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {row["plan_id"] for row in response.json()},
            {self.active.pk, self.secondary.pk, self.hidden.pk},
        )

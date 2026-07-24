from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.urls import include, path
from django.test.utils import CaptureQueriesContext
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
class CalendarSettingsValidationTest(TestCase):
    SETTINGS_URL = "/api/v1/todos/calendar/settings/"
    REORDER_URL = "/api/v1/todos/calendar/settings/reorder/"
    MONTH_URL = "/api/v1/todos/calendar/month/"

    def setUp(self):
        self.client = APIClient()
        self.reader = User.objects.create_user(
            username="calendar-reader",
            nickname="달력독자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="calendar-other",
            nickname="다른독자",
            password="pw-test-1234",
        )
        self.first_setting = self._create_setting(self.reader, "첫번째 플랜")
        self.second_setting = self._create_setting(self.reader, "두번째 플랜")
        self.other_setting = self._create_setting(self.other, "다른 플랜")
        self.client.force_authenticate(user=self.reader)

    def _create_setting(self, user, plan_name):
        plan = BibleReadingPlan.objects.create(name=plan_name, created_by=user)
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        return subscription.display_settings

    def _deactivate_setting_subscription(self, setting):
        setting.subscription.is_active = False
        setting.subscription.save(update_fields=["is_active"])

    def _setting_url(self, setting_id):
        return f"{self.SETTINGS_URL}{setting_id}/"

    def _orders(self):
        return list(
            self.reader.plan_display_settings.order_by("id").values_list(
                "id",
                "display_order",
            )
        )

    def test_update_rejects_invalid_color_without_write(self):
        response = self.client.patch(
            self._setting_url(self.first_setting.id),
            {"color": "red", "is_visible": False},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.first_setting.refresh_from_db()
        self.assertNotEqual(self.first_setting.color, "red")
        self.assertTrue(self.first_setting.is_visible)

    def test_update_rejects_inactive_subscription_setting_without_write(self):
        self._deactivate_setting_subscription(self.first_setting)

        response = self.client.patch(
            self._setting_url(self.first_setting.id),
            {"color": "#111111", "is_visible": False},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.first_setting.refresh_from_db()
        self.assertEqual(self.first_setting.color, "#3B82F6")
        self.assertTrue(self.first_setting.is_visible)

    def test_reorder_rejects_invalid_order_without_partial_write(self):
        before = self._orders()

        response = self.client.post(
            self.REORDER_URL,
            {
                "orders": [
                    {"id": self.first_setting.id, "display_order": 10},
                    {"id": self.second_setting.id, "display_order": "last"},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self._orders(), before)

    def test_reorder_rejects_foreign_setting_without_partial_write(self):
        before = self._orders()

        response = self.client.post(
            self.REORDER_URL,
            {
                "orders": [
                    {"id": self.first_setting.id, "display_order": 10},
                    {"id": self.other_setting.id, "display_order": 11},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(self._orders(), before)

    def test_reorder_rejects_duplicate_setting_ids_without_write(self):
        before = self._orders()

        response = self.client.post(
            self.REORDER_URL,
            {
                "orders": [
                    {"id": self.first_setting.id, "display_order": 10},
                    {"id": self.first_setting.id, "display_order": 11},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self._orders(), before)

    def test_reorder_updates_owned_settings_after_full_validation(self):
        response = self.client.post(
            self.REORDER_URL,
            {
                "orders": [
                    {"id": self.first_setting.id, "display_order": 2},
                    {"id": self.second_setting.id, "display_order": 1},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.first_setting.refresh_from_db()
        self.second_setting.refresh_from_db()
        self.assertEqual(self.first_setting.display_order, 2)
        self.assertEqual(self.second_setting.display_order, 1)

    def test_month_rejects_non_integer_year_without_server_error(self):
        response = self.client.get(self.MONTH_URL, {"year": "next", "month": "1"})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
        self.assertIn("year", response.json()["errors"])

    def test_month_rejects_out_of_range_month_without_server_error(self):
        response = self.client.get(self.MONTH_URL, {"year": "2026", "month": "13"})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
        self.assertIn("month", response.json()["errors"])

    def test_month_rejects_partial_date_query(self):
        response = self.client.get(self.MONTH_URL, {"year": "2026"})

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
        self.assertIn("non_field_errors", response.json()["errors"])

    def test_month_accepts_valid_query(self):
        response = self.client.get(self.MONTH_URL, {"year": "2026", "month": "2"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["meta"], {"year": 2026, "month": 2})


@override_settings(ROOT_URLCONF=__name__)
class CalendarMonthDataBatchingTest(TestCase):
    MONTH_URL = "/api/v1/todos/calendar/month/"

    def _authenticated_client(self, username="calendar-batch-reader"):
        user = User.objects.create_user(
            username=username,
            nickname=username,
            password="pw-test-1234",
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client, user

    def _create_subscription(self, user, plan_name, display_order, color, is_visible=True):
        plan = BibleReadingPlan.objects.create(name=plan_name, created_by=user)
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        setting = subscription.display_settings
        setting.display_order = display_order
        setting.color = color
        setting.is_visible = is_visible
        setting.save(update_fields=["display_order", "color", "is_visible"])
        return subscription, setting

    def _create_schedule(self, plan, book, start_chapter, end_chapter=1):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=date(2026, 7, 11),
            book=book,
            start_chapter=start_chapter,
            end_chapter=end_chapter,
        )

    def _month_response(self, client):
        return client.get(self.MONTH_URL, {"year": "2026", "month": "7"})

    def _create_batch_fixture(self, plan_count):
        client, user = self._authenticated_client(f"calendar-batch-{plan_count}")
        subscriptions = []
        schedules = []

        for index in range(plan_count):
            subscription, _ = self._create_subscription(
                user,
                f"배치 플랜 {plan_count}-{index}",
                display_order=index,
                color=f"#{index + 1:06X}",
            )
            subscriptions.append(subscription)
            schedules.append(
                self._create_schedule(
                    subscription.plan,
                    book=f"Book {plan_count}-{index}",
                    start_chapter=index + 1,
                    end_chapter=index + 1,
                )
            )

        for subscription, schedule in zip(subscriptions, schedules):
            UserBibleProgress.objects.create(
                subscription=subscription,
                schedule=schedule,
                is_completed=True,
            )

        return client

    def _captured_select_count(self, client):
        with CaptureQueriesContext(connection) as captured:
            response = self._month_response(client)

        self.assertEqual(response.status_code, 200)
        return sum(
            1
            for query in captured.captured_queries
            if query["sql"].strip().upper().startswith("SELECT")
        )

    def test_month_payload_preserves_multi_plan_semantics(self):
        client, user = self._authenticated_client()
        first_subscription, first_setting = self._create_subscription(
            user,
            "느린 플랜",
            display_order=20,
            color="#111111",
        )
        hidden_subscription, hidden_setting = self._create_subscription(
            user,
            "숨김 플랜",
            display_order=10,
            color="#222222",
            is_visible=False,
        )
        third_subscription, third_setting = self._create_subscription(
            user,
            "완료 플랜",
            display_order=30,
            color="#333333",
        )
        first_schedule = self._create_schedule(
            first_subscription.plan,
            book="창세기",
            start_chapter=1,
        )
        hidden_schedule = self._create_schedule(
            hidden_subscription.plan,
            book="출애굽기",
            start_chapter=2,
            end_chapter=3,
        )
        third_schedule = self._create_schedule(
            third_subscription.plan,
            book="레위기",
            start_chapter=4,
            end_chapter=4,
        )
        other_user = User.objects.create_user(
            username="calendar-other-progress",
            nickname="다른진도",
            password="pw-test-1234",
        )
        other_subscription = PlanSubscription.objects.create(
            user=other_user,
            plan=first_subscription.plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        UserBibleProgress.objects.create(
            subscription=other_subscription,
            schedule=first_schedule,
            is_completed=True,
        )
        UserBibleProgress.objects.create(
            subscription=third_subscription,
            schedule=third_schedule,
            is_completed=True,
        )

        response = self._month_response(client)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(list(payload.keys()), ["success", "calendar", "settings", "meta"])
        self.assertEqual(payload["meta"], {"year": 2026, "month": 7})

        day_entries = payload["calendar"]["2026-07-11"]
        self.assertEqual(
            [entry["subscription_id"] for entry in day_entries],
            [
                hidden_subscription.id,
                first_subscription.id,
                third_subscription.id,
            ],
        )
        self.assertEqual(
            {entry["subscription_id"]: entry["is_completed"] for entry in day_entries},
            {
                hidden_subscription.id: False,
                first_subscription.id: False,
                third_subscription.id: True,
            },
        )
        self.assertEqual(
            {entry["subscription_id"]: entry["is_visible"] for entry in day_entries},
            {
                hidden_subscription.id: False,
                first_subscription.id: True,
                third_subscription.id: True,
            },
        )
        self.assertEqual(day_entries[0]["chapters"], "2-3장")
        self.assertEqual(day_entries[1]["chapters"], "1장")
        expected_calendar_fields = {"plan_id", "plan_name", "subscription_id", "color", "book", "chapters", "is_completed", "schedule_id", "is_visible"}
        self.assertTrue(all(set(entry.keys()) == expected_calendar_fields for entry in day_entries))
        self.assertEqual(
            [setting["id"] for setting in payload["settings"]],
            [hidden_setting.id, first_setting.id, third_setting.id],
        )
        self.assertEqual(
            set(payload["settings"][0].keys()),
            {"id", "subscription_id", "plan_id", "plan_name", "color", "display_order", "is_visible", "is_active"},
        )

    def test_month_query_count_is_constant_for_multiple_plans(self):
        single_client = self._create_batch_fixture(plan_count=1)
        five_client = self._create_batch_fixture(plan_count=5)

        single_selects = self._captured_select_count(single_client)
        five_selects = self._captured_select_count(five_client)

        self.assertLessEqual(five_selects, 5)
        self.assertLessEqual(five_selects, single_selects + 1)


@override_settings(ROOT_URLCONF=__name__)
class CalendarLastIncompletePositionsTest(TestCase):
    LAST_INCOMPLETE_URL = "/api/v1/todos/calendar/last-incomplete/"

    def _authenticated_client(self, username="last-incomplete-reader"):
        user = User.objects.create_user(
            username=username,
            nickname=username,
            password="pw-test-1234",
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client, user

    def _create_subscription(
        self, user, plan_name, color="#123456", display_order=0,
        is_visible=True, with_settings=True,
    ):
        plan = BibleReadingPlan.objects.create(name=plan_name, created_by=user)
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        setting = subscription.display_settings
        if with_settings:
            setting.color = color
            setting.display_order = display_order
            setting.is_visible = is_visible
            setting.save(update_fields=["color", "display_order", "is_visible"])
        else:
            setting.delete()
        return subscription

    def _create_schedule(self, plan, book, start_chapter, end_chapter=None, days_ago=0):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=date.today() - timedelta(days=days_ago),
            book=book,
            start_chapter=start_chapter,
            end_chapter=end_chapter if end_chapter is not None else start_chapter,
        )

    def _captured_select_count(self, client):
        with CaptureQueriesContext(connection) as captured:
            response = client.get(self.LAST_INCOMPLETE_URL)
        self.assertEqual(response.status_code, 200)
        selects = sum(
            1
            for query in captured.captured_queries
            if query["sql"].strip().upper().startswith("SELECT")
        )
        return response, selects

    def test_last_incomplete_semantics(self):
        client, user = self._authenticated_client()

        # 최신 완료 스케줄은 건너뛰고 이전 미완료 스케줄을 반환
        sub_a = self._create_subscription(user, "플랜A", color="#AAAAAA")
        latest_completed = self._create_schedule(sub_a.plan, "창세기", 3, days_ago=0)
        previous_incomplete = self._create_schedule(sub_a.plan, "창세기", 2, days_ago=1)
        UserBibleProgress.objects.create(
            subscription=sub_a, schedule=latest_completed, is_completed=True,
        )

        # 다른 사용자/구독의 완료 진도는 현재 구독에 영향 없음
        other_user = User.objects.create_user(
            username="last-incomplete-other",
            nickname="타인",
            password="pw-test-1234",
        )
        other_sub = PlanSubscription.objects.create(
            user=other_user, plan=sub_a.plan,
            start_date=date(2026, 1, 1), is_active=True,
        )
        UserBibleProgress.objects.create(
            subscription=other_sub, schedule=previous_incomplete, is_completed=True,
        )

        # 명시적 미완료 진도 행이 있는 스케줄도 여전히 미완료로 취급
        sub_b = self._create_subscription(user, "플랜B", color="#BBBBBB")
        b_schedule = self._create_schedule(sub_b.plan, "출애굽기", 5, end_chapter=6, days_ago=2)
        UserBibleProgress.objects.create(
            subscription=sub_b, schedule=b_schedule, is_completed=False,
        )

        # 완전히 완료된 활성 구독은 제외
        sub_c = self._create_subscription(user, "플랜C", color="#CCCCCC")
        c_schedule = self._create_schedule(sub_c.plan, "레위기", 1, days_ago=0)
        UserBibleProgress.objects.create(
            subscription=sub_c, schedule=c_schedule, is_completed=True,
        )

        # 숨김 표시 설정도 여전히 포함
        sub_d = self._create_subscription(
            user, "플랜D", color="#DDDDDD", is_visible=False,
        )
        d_schedule = self._create_schedule(sub_d.plan, "민수기", 7, days_ago=3)

        # 표시 설정이 없으면 기본색 #3B82F6
        sub_e = self._create_subscription(user, "플랜E", with_settings=False)
        e_schedule = self._create_schedule(sub_e.plan, "신명기", 9, days_ago=1)

        response = client.get(self.LAST_INCOMPLETE_URL)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        positions = payload["positions"]

        by_sub = {pos["subscription_id"]: pos for pos in positions}

        # sub_c(완전 완료)는 제외
        self.assertNotIn(sub_c.id, by_sub)

        # sub_a는 이전 미완료 스케줄 반환
        self.assertEqual(by_sub[sub_a.id]["schedule_id"], previous_incomplete.id)
        self.assertEqual(by_sub[sub_a.id]["color"], "#AAAAAA")

        # sub_b는 명시적 미완료 행이 있어도 반환
        self.assertEqual(by_sub[sub_b.id]["schedule_id"], b_schedule.id)
        self.assertEqual(by_sub[sub_b.id]["chapters"], "5-6장")

        # sub_d(숨김)도 포함
        self.assertEqual(by_sub[sub_d.id]["schedule_id"], d_schedule.id)

        # sub_e(표시 설정 없음)는 기본색
        self.assertEqual(by_sub[sub_e.id]["schedule_id"], e_schedule.id)
        self.assertEqual(by_sub[sub_e.id]["color"], "#3B82F6")

        # 정확한 응답 키
        expected_keys = {
            "plan_id", "plan_name", "subscription_id", "color", "date",
            "book", "book_code", "chapters", "start_chapter", "schedule_id",
        }
        self.assertTrue(all(set(pos.keys()) == expected_keys for pos in positions))

        # 날짜 내림차순 정렬
        dates = [pos["date"] for pos in positions]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def _create_query_fixture(self, plan_count, username):
        client, user = self._authenticated_client(username)
        for index in range(plan_count):
            subscription = self._create_subscription(
                user, f"쿼리 플랜 {username}-{index}",
                color=f"#{index + 1:06X}", display_order=index,
            )
            self._create_schedule(
                subscription.plan,
                book=f"Book {index}",
                start_chapter=index + 1,
                days_ago=index,
            )
        return client

    def test_query_count_is_constant_for_multiple_plans(self):
        single_client = self._create_query_fixture(1, "last-incomplete-single")
        five_client = self._create_query_fixture(5, "last-incomplete-five")

        single_response, single_selects = self._captured_select_count(single_client)
        five_response, five_selects = self._captured_select_count(five_client)

        self.assertEqual(len(single_response.json()["positions"]), 1)
        self.assertEqual(len(five_response.json()["positions"]), 5)
        self.assertLessEqual(five_selects, 4)
        self.assertLessEqual(five_selects, single_selects + 1)

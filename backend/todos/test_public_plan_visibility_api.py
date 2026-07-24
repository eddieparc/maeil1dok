from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription, VideoBibleIntro

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class PublicPlanVisibilityApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.owner = User.objects.create_user(
            username="plan-owner",
            nickname="플랜관리자",
            password="pw-test-1234",
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="비공개 준비 플랜",
            is_active=False,
            created_by=self.owner,
        )
        self.active_plan = BibleReadingPlan.objects.create(
            name="공개 플랜",
            is_active=True,
            created_by=self.owner,
        )
        self.inactive_schedule = self._schedule(self.inactive_plan)
        self.active_schedule = self._schedule(self.active_plan)

    def _schedule(self, plan):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=self.today,
            book="창세기",
            start_chapter=1,
            end_chapter=1,
            audio_link="https://example.com/audio.mp3",
            guide_link="https://example.com/guide",
        )

    def test_chapter_detail_hides_inactive_plan_from_anonymous_user(self):
        response = self.client.get(
            "/api/v1/todos/detail/",
            {"plan_id": self.inactive_plan.id, "book": "gen", "chapter": "1"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(
            response,
            "https://example.com/audio.mp3",
            status_code=404,
        )

    def test_chapter_detail_rejects_malformed_chapter_before_schedule_lookup(self):
        response = self.client.get(
            "/api/v1/todos/detail/",
            {"plan_id": self.active_plan.id, "book": "gen", "chapter": "not-a-number"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "chapter는 1 이상의 정수여야 합니다.")

    def test_today_schedules_hides_inactive_plan_from_anonymous_user(self):
        response = self.client.get(
            "/api/v1/todos/schedules/today/",
            {"plan_id": self.inactive_plan.id},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(
            response,
            str(self.inactive_schedule.id),
            status_code=404,
        )

    def test_next_position_hides_inactive_plan_from_anonymous_user(self):
        response = self.client.get(
            "/api/v1/todos/next-position/",
            {"plan_id": self.inactive_plan.id},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(
            response,
            str(self.inactive_schedule.id),
            status_code=404,
        )

    def test_active_plan_public_reads_still_work(self):
        detail_response = self.client.get(
            "/api/v1/todos/detail/",
            {"plan_id": self.active_plan.id, "book": "gen", "chapter": "1"},
        )
        schedules_response = self.client.get(
            "/api/v1/todos/schedules/today/",
            {"plan_id": self.active_plan.id},
        )
        next_response = self.client.get(
            "/api/v1/todos/next-position/",
            {"plan_id": self.active_plan.id},
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["audio_link"], "https://example.com/audio.mp3")
        self.assertEqual(schedules_response.status_code, 200)
        self.assertEqual(
            schedules_response.json()["schedules"][0]["id"],
            self.active_schedule.id,
        )
        self.assertEqual(next_response.status_code, 200)
        self.assertEqual(next_response.json()["schedule_id"], self.active_schedule.id)


@override_settings(ROOT_URLCONF=__name__)
class PublicPlanStatsVisibilityApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.owner = User.objects.create_user(
            username="stats-plan-owner",
            nickname="통계플랜관리자",
            password="pw-test-1234",
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="비공개 통계 플랜",
            is_active=False,
            created_by=self.owner,
        )
        self.active_plan = BibleReadingPlan.objects.create(
            name="공개 통계 플랜",
            is_active=True,
            is_default=True,
            created_by=self.owner,
        )
        self._schedule(self.inactive_plan)
        self._schedule(self.active_plan)

    def _schedule(self, plan):
        return DailyBibleSchedule.objects.create(
            plan=plan,
            date=self.today,
            book="출애굽기",
            start_chapter=2,
            end_chapter=2,
        )

    def test_anonymous_plan_stats_hide_inactive_plan(self):
        response = self.client.get(
            "/api/v1/todos/stats/plan/",
            {"plan_id": self.inactive_plan.id},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(response, self.inactive_plan.name, status_code=404)

    def test_progress_stats_hide_inactive_plan_and_preserve_default_fallback(self):
        inactive_response = self.client.get(
            "/api/v1/todos/stats/progress/",
            {"plan_id": self.inactive_plan.id},
        )
        default_response = self.client.get("/api/v1/todos/stats/progress/")

        self.assertEqual(inactive_response.status_code, 404)
        self.assertNotContains(
            inactive_response,
            self.inactive_plan.name,
            status_code=404,
        )
        self.assertEqual(default_response.status_code, 200)
        self.assertEqual(default_response.json()["plan_name"], self.active_plan.name)

    def test_total_users_stats_hide_inactive_plan_subscriber_count(self):
        PlanSubscription.objects.create(
            user=self.owner,
            plan=self.inactive_plan,
            start_date=self.today,
            is_active=True,
        )

        response = self.client.get(
            "/api/v1/todos/stats/users/",
            {"plan_id": self.inactive_plan.id},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(response, "total_users", status_code=404)

    def test_total_users_stats_active_plan_count_still_works(self):
        PlanSubscription.objects.create(
            user=self.owner,
            plan=self.active_plan,
            start_date=self.today,
            is_active=True,
        )

        response = self.client.get(
            "/api/v1/todos/stats/users/",
            {"plan_id": self.active_plan.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_users"], 1)


@override_settings(ROOT_URLCONF=__name__)
class VideoIntroPublicVisibilityApiTest(TestCase):
    INACTIVE_URL_LINK = "https://example.com/inactive-intro"
    ACTIVE_URL_LINK = "https://example.com/active-intro"

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="video-intro-visibility-owner",
            nickname="영상개론관리자",
            password="pw-test-1234",
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="비공개 영상개론 플랜",
            is_active=False,
            created_by=self.owner,
        )
        self.active_plan = BibleReadingPlan.objects.create(
            name="공개 영상개론 플랜",
            is_active=True,
            is_default=True,
            created_by=self.owner,
        )
        self.inactive_intro = VideoBibleIntro.objects.create(
            plan=self.inactive_plan,
            book="창세기",
            url_link=self.INACTIVE_URL_LINK,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
        )
        self.active_intro = VideoBibleIntro.objects.create(
            plan=self.active_plan,
            book="출애굽기",
            url_link=self.ACTIVE_URL_LINK,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
        )

    def _intro_detail_url(self, pk):
        return f"/api/v1/todos/video/intro/{pk}/"

    def test_anonymous_video_intro_list_hides_inactive_plan_intros(self):
        response = self.client.get(
            "/api/v1/todos/video/intro/",
            {"plan_id": self.inactive_plan.id},
        )

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(
            response,
            self.INACTIVE_URL_LINK,
            status_code=404,
        )

    def test_anonymous_video_intro_list_without_plan_id_hides_inactive_plan_intros(self):
        response = self.client.get("/api/v1/todos/video/intro/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload, list)
        url_links = [item.get("url_link") for item in payload]
        self.assertNotIn(self.INACTIVE_URL_LINK, url_links)

    def test_anonymous_video_intro_detail_hides_inactive_plan_intro(self):
        response = self.client.get(self._intro_detail_url(self.inactive_intro.id))

        self.assertEqual(response.status_code, 404)
        self.assertNotContains(
            response,
            self.INACTIVE_URL_LINK,
            status_code=404,
        )

    def test_anonymous_user_video_intros_endpoint_stays_auth_gated(self):
        response = self.client.get(
            "/api/v1/todos/user/video/intro/",
            {"plan_id": self.inactive_plan.id},
        )

        self.assertEqual(response.status_code, 401)
        self.assertNotContains(
            response,
            self.INACTIVE_URL_LINK,
            status_code=401,
        )

    def test_active_plan_video_intro_public_reads_still_work(self):
        list_response = self.client.get(
            "/api/v1/todos/video/intro/",
            {"plan_id": self.active_plan.id},
        )
        detail_response = self.client.get(self._intro_detail_url(self.active_intro.id))

        self.assertEqual(list_response.status_code, 200)
        list_payload = list_response.json()
        self.assertTrue(
            any(item.get("url_link") == self.ACTIVE_URL_LINK for item in list_payload),
            f"active plan intro url_link should be present in list response: {list_payload}",
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json().get("url_link"), self.ACTIVE_URL_LINK)

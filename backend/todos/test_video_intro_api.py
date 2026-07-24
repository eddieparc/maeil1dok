from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from rest_framework.test import APIClient

from todos.models import (
    BibleReadingPlan,
    PlanSubscription,
    UserVideoIntroProgress,
    VideoBibleIntro,
)

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class VideoIntroAdminAuthorizationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.reader = User.objects.create_user(
            username="video-reader",
            nickname="영상독자",
            email="reader@example.com",
            password="pw-test-1234",
        )
        self.admin = User.objects.create_user(
            username="video-admin",
            nickname="영상관리자",
            email="admin@example.com",
            password="pw-test-1234",
            is_staff=True,
        )
        self.plan = BibleReadingPlan.objects.create(
            name="영상 개론 플랜",
            created_by=self.admin,
        )
        self.video_intro = VideoBibleIntro.objects.create(
            plan=self.plan,
            book="창세기",
            url_link="https://example.com/genesis",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
        )

    def _detail_url(self, video_intro_id):
        return f"/api/v1/todos/video/intro/{video_intro_id}/"

    def test_public_get_detail_still_returns_video_intro(self):
        response = self.client.get(self._detail_url(self.video_intro.id))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.video_intro.id)

    def test_anonymous_delete_cannot_enumerate_video_intro_ids(self):
        existing_response = self.client.delete(self._detail_url(self.video_intro.id))
        missing_response = self.client.delete(self._detail_url(999999))

        self.assertEqual(existing_response.status_code, 401)
        self.assertEqual(missing_response.status_code, 401)
        self.assertTrue(VideoBibleIntro.objects.filter(id=self.video_intro.id).exists())

    def test_non_admin_delete_cannot_enumerate_video_intro_ids(self):
        self.client.force_authenticate(user=self.reader)

        existing_response = self.client.delete(self._detail_url(self.video_intro.id))
        missing_response = self.client.delete(self._detail_url(999999))

        self.assertEqual(existing_response.status_code, 403)
        self.assertEqual(missing_response.status_code, 403)
        self.assertTrue(VideoBibleIntro.objects.filter(id=self.video_intro.id).exists())

    def test_admin_delete_preserves_not_found_and_delete_behavior(self):
        self.client.force_authenticate(user=self.admin)

        missing_response = self.client.delete(self._detail_url(999999))
        delete_response = self.client.delete(self._detail_url(self.video_intro.id))

        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(VideoBibleIntro.objects.filter(id=self.video_intro.id).exists())


@override_settings(ROOT_URLCONF=__name__)
class VideoIntroProgressAuthorizationTest(TestCase):
    PROGRESS_URL = "/api/v1/todos/video/intro/progress/"

    def setUp(self):
        self.client = APIClient()
        self.reader = User.objects.create_user(
            username="intro-progress-reader",
            nickname="개론독자",
            password="pw-test-1234",
        )
        self.owner = User.objects.create_user(
            username="intro-progress-owner",
            nickname="개론작성자",
            password="pw-test-1234",
        )
        self.subscribed_plan = BibleReadingPlan.objects.create(
            name="구독 플랜",
            created_by=self.owner,
        )
        self.foreign_plan = BibleReadingPlan.objects.create(
            name="미구독 플랜",
            created_by=self.owner,
        )
        self.subscribed_intro = self._create_intro(self.subscribed_plan, "창세기")
        self.foreign_intro = self._create_intro(self.foreign_plan, "출애굽기")
        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.subscribed_plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        self.client.force_authenticate(user=self.reader)

    def _create_intro(self, plan, book):
        return VideoBibleIntro.objects.create(
            plan=plan,
            book=book,
            url_link=f"https://example.com/{book}",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
        )

    def test_unsubscribed_user_cannot_create_progress_for_foreign_plan_intro(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": self.foreign_intro.id,
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "존재하지 않는 영상 개론입니다.")
        self.assertFalse(
            UserVideoIntroProgress.objects.filter(
                user=self.reader,
                video_intro=self.foreign_intro,
            ).exists()
        )

    def test_subscribed_user_can_update_progress_for_subscribed_intro(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": self.subscribed_intro.id,
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 200, response.json())
        progress = UserVideoIntroProgress.objects.get(
            user=self.reader,
            video_intro=self.subscribed_intro,
        )
        self.assertTrue(progress.is_completed)
        self.assertIsNotNone(progress.completed_at)
    def test_numeric_string_video_intro_id_succeeds(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": str(self.subscribed_intro.id),
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 200, response.json())
        self.assertTrue(
            UserVideoIntroProgress.objects.filter(
                user=self.reader,
                video_intro=self.subscribed_intro,
                is_completed=True,
            ).exists()
        )

    def test_malformed_video_intro_ids_are_rejected_without_write(self):
        malformed_ids = ["abc", True, 0, -1, 1.5, [], {}, " ", str(10**100)]

        for malformed_id in malformed_ids:
            with self.subTest(video_intro_id=malformed_id):
                response = self.client.post(self.PROGRESS_URL, {
                    "video_intro_id": malformed_id,
                    "is_completed": True,
                }, format="json")

                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.json()["detail"],
                    "video_intro_id는 양의 정수여야 합니다.",
                )
                self.assertFalse(UserVideoIntroProgress.objects.exists())

    def test_boolean_video_intro_id_does_not_target_intro_one(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": True,
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "video_intro_id는 양의 정수여야 합니다.",
        )
        self.assertFalse(
            UserVideoIntroProgress.objects.filter(
                user=self.reader,
                video_intro=self.subscribed_intro,
            ).exists()
        )

    def test_missing_video_intro_id_keeps_required_field_message(self):
        response = self.client.post(self.PROGRESS_URL, {
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "영상 개론 ID가 필요합니다.")
        self.assertFalse(UserVideoIntroProgress.objects.exists())

    def test_empty_video_intro_id_keeps_required_field_message(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": "",
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "영상 개론 ID가 필요합니다.")
        self.assertFalse(UserVideoIntroProgress.objects.exists())

    def test_well_formed_missing_video_intro_id_returns_not_found(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": 999999,
            "is_completed": True,
        }, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "존재하지 않는 영상 개론입니다.")
        self.assertFalse(UserVideoIntroProgress.objects.exists())

    def test_subscribed_user_can_mark_progress_incomplete_with_boolean_false(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": self.subscribed_intro.id,
            "is_completed": False,
        }, format="json")

        self.assertEqual(response.status_code, 200, response.json())
        progress = UserVideoIntroProgress.objects.get(
            user=self.reader,
            video_intro=self.subscribed_intro,
        )
        self.assertFalse(progress.is_completed)
        self.assertIsNone(progress.completed_at)

    def test_string_boolean_progress_value_is_rejected_without_write(self):
        response = self.client.post(self.PROGRESS_URL, {
            "video_intro_id": self.subscribed_intro.id,
            "is_completed": "false",
        }, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "is_completed는 true 또는 false 값이어야 합니다.",
        )
        self.assertFalse(
            UserVideoIntroProgress.objects.filter(
                user=self.reader,
                video_intro=self.subscribed_intro,
            ).exists()
        )


@override_settings(ROOT_URLCONF=__name__)
class UserVideoIntroAuthorizationTest(TestCase):
    URL = "/api/v1/todos/user/video/intro/"

    def setUp(self):
        self.client = APIClient()
        self.reader = User.objects.create_user(
            username="user-intro-reader",
            nickname="사용자개론독자",
            password="pw-test-1234",
        )
        self.owner = User.objects.create_user(
            username="user-intro-owner",
            nickname="사용자개론작성자",
            password="pw-test-1234",
        )
        self.subscribed_plan = BibleReadingPlan.objects.create(
            name="사용자 개론 구독 플랜",
            created_by=self.owner,
        )
        self.foreign_plan = BibleReadingPlan.objects.create(
            name="사용자 개론 비구독 플랜",
            created_by=self.owner,
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="사용자 개론 비활성 구독 플랜",
            created_by=self.owner,
        )
        self.subscribed_intro = self._create_intro(
            self.subscribed_plan, "창세기", 1
        )
        self.foreign_intro = self._create_intro(self.foreign_plan, "출애굽기", 2)
        self.inactive_intro = self._create_intro(self.inactive_plan, "레위기", 3)
        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.subscribed_plan,
            start_date=date(2026, 1, 1),
            is_active=True,
        )
        PlanSubscription.objects.create(
            user=self.reader,
            plan=self.inactive_plan,
            start_date=date(2026, 1, 1),
            is_active=False,
        )

    def _create_intro(self, plan, book, start_day):
        return VideoBibleIntro.objects.create(
            plan=plan,
            book=book,
            url_link=f"https://example.com/{book}",
            start_date=date(2026, 1, start_day),
            end_date=date(2026, 1, start_day + 1),
        )

    def test_anonymous_user_cannot_read_user_video_intros(self):
        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 401)

    def test_subscriber_receives_only_active_subscription_intro_data(self):
        self.client.force_authenticate(user=self.reader)

        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual([intro["id"] for intro in response.json()], [self.subscribed_intro.id])
        self.assertFalse(response.json()[0]["is_completed"])
        self.assertIsNone(response.json()[0]["completed_at"])

    def test_foreign_plan_query_cannot_disclose_foreign_intro(self):
        self.client.force_authenticate(user=self.reader)

        response = self.client.get(self.URL, {"plan_id": self.foreign_plan.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([intro["id"] for intro in response.json()], [self.subscribed_intro.id])
        self.assertNotIn(self.foreign_intro.id, [intro["id"] for intro in response.json()])

    def test_inactive_only_subscription_returns_no_intro_data(self):
        PlanSubscription.objects.filter(
            user=self.reader,
            plan=self.subscribed_plan,
        ).update(is_active=False)
        self.client.force_authenticate(user=self.reader)

        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

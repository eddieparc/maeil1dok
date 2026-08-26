"""프로필·소셜·캘린더 쓰기 경로의 인가를 HTTP 경계에서 고정한다."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Follow
from tests.test_authz_write_endpoints import _bearer
from todos.models import BibleReadingPlan, PlanSubscription

User = get_user_model()

AUTH_PROFILE_URL = "/api/v1/auth/profile/"
ACCOUNTS_PROFILE_URL = "/api/v1/accounts/profile/"
FOLLOW_URL = "/api/v1/auth/follow/"
UNFOLLOW_URL = "/api/v1/auth/unfollow/{user_id}/"
CALENDAR_SETTING_URL = "/api/v1/todos/calendar/settings/{pk}/"
CALENDAR_REORDER_URL = "/api/v1/todos/calendar/settings/reorder/"


class ProfileWriteAuthorizationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="profile-write-owner",
            nickname="프로필쓰기소유자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="profile-write-other",
            nickname="프로필쓰기타인",
            password="pw-test-1234",
        )
        self.owner.profile.bio = "원래소개"
        self.owner.profile.save()
        self.other.profile.bio = "타인소개"
        self.other.profile.save()

    def test_owner_can_update_own_profile(self):
        response = _bearer(self.owner).put(
            AUTH_PROFILE_URL, {"bio": "새소개"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner.profile.refresh_from_db()
        self.assertEqual(self.owner.profile.bio, "새소개")

    def test_accounts_prefix_updates_the_same_self_profile(self):
        response = _bearer(self.owner).put(
            ACCOUNTS_PROFILE_URL, {"bio": "별칭경로"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner.profile.refresh_from_db()
        self.assertEqual(self.owner.profile.bio, "별칭경로")

    def test_other_user_update_does_not_change_owner_profile(self):
        response = _bearer(self.other).put(
            AUTH_PROFILE_URL, {"bio": "탈취시도"}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner.profile.refresh_from_db()
        self.other.profile.refresh_from_db()
        self.assertEqual(self.owner.profile.bio, "원래소개")
        self.assertEqual(self.other.profile.bio, "탈취시도")

    def test_anonymous_cannot_update_profile(self):
        response = APIClient().put(
            AUTH_PROFILE_URL, {"bio": "익명"}, format="json"
        )
        self.assertEqual(response.status_code, 401)
        self.owner.profile.refresh_from_db()
        self.assertEqual(self.owner.profile.bio, "원래소개")


class FollowWriteAuthorizationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="follow-write-owner",
            nickname="팔로우쓰기소유자",
            password="pw-test-1234",
        )
        self.public_target = User.objects.create_user(
            username="follow-write-public",
            nickname="팔로우공개대상",
            password="pw-test-1234",
        )
        self.private_target = User.objects.create_user(
            username="follow-write-private",
            nickname="팔로우비공개대상",
            password="pw-test-1234",
        )
        self.private_target.profile.is_public = False
        self.private_target.profile.save()

    def test_authenticated_user_can_follow_public_target(self):
        response = _bearer(self.owner).post(
            FOLLOW_URL, {"user_id": self.public_target.id}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            Follow.objects.filter(
                follower=self.owner, following=self.public_target
            ).exists()
        )

    def test_follow_private_target_is_hidden_and_creates_no_row(self):
        response = _bearer(self.owner).post(
            FOLLOW_URL, {"user_id": self.private_target.id}, format="json"
        )
        self.assertEqual(response.status_code, 404, response.data)
        self.assertEqual(response.data["error"], "사용자를 찾을 수 없습니다.")
        self.assertFalse(
            Follow.objects.filter(
                follower=self.owner, following=self.private_target
            ).exists()
        )

    def test_self_follow_is_rejected_and_creates_no_row(self):
        response = _bearer(self.owner).post(
            FOLLOW_URL, {"user_id": self.owner.id}, format="json"
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Follow.objects.filter(follower=self.owner).exists())

    def test_owner_can_unfollow_existing_edge(self):
        Follow.objects.create(follower=self.owner, following=self.public_target)
        response = _bearer(self.owner).delete(
            UNFOLLOW_URL.format(user_id=self.public_target.id)
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            Follow.objects.filter(
                follower=self.owner, following=self.public_target
            ).exists()
        )

    def test_unfollow_without_edge_does_not_create_or_delete_other_rows(self):
        other_edge = Follow.objects.create(
            follower=self.public_target, following=self.owner
        )
        response = _bearer(self.owner).delete(
            UNFOLLOW_URL.format(user_id=self.public_target.id)
        )
        self.assertEqual(response.status_code, 404, response.data)
        self.assertTrue(Follow.objects.filter(pk=other_edge.pk).exists())

    def test_anonymous_follow_leaves_no_row(self):
        response = APIClient().post(
            FOLLOW_URL, {"user_id": self.public_target.id}, format="json"
        )
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Follow.objects.exists())


class CalendarSettingWriteAuthorizationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="cal-write-owner",
            nickname="캘린더쓰기소유자",
            password="pw-test-1234",
        )
        self.other = User.objects.create_user(
            username="cal-write-other",
            nickname="캘린더쓰기타인",
            password="pw-test-1234",
        )
        owner_plan = BibleReadingPlan.objects.create(
            name="캘린더 소유 플랜", created_by=self.owner
        )
        other_plan = BibleReadingPlan.objects.create(
            name="캘린더 타인 플랜", created_by=self.other
        )
        owner_sub = PlanSubscription.objects.create(
            user=self.owner, plan=owner_plan, start_date="2026-01-01", is_active=True
        )
        other_sub = PlanSubscription.objects.create(
            user=self.other, plan=other_plan, start_date="2026-01-01", is_active=True
        )
        self.owner_setting = owner_sub.display_settings
        self.owner_setting.color = "#AAAAAA"
        self.owner_setting.display_order = 1
        self.owner_setting.save()
        self.other_setting = other_sub.display_settings
        self.other_setting.color = "#BBBBBB"
        self.other_setting.display_order = 1
        self.other_setting.save()

    def test_owner_can_update_own_calendar_setting(self):
        response = _bearer(self.owner).patch(
            CALENDAR_SETTING_URL.format(pk=self.owner_setting.id),
            {"color": "#00FF00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner_setting.refresh_from_db()
        self.assertEqual(self.owner_setting.color, "#00FF00")

    def test_non_owner_cannot_update_another_users_setting(self):
        response = _bearer(self.other).patch(
            CALENDAR_SETTING_URL.format(pk=self.owner_setting.id),
            {"color": "#FF0000"},
            format="json",
        )
        self.assertEqual(response.status_code, 404, response.data)
        self.assertEqual(response.data["error"], "설정을 찾을 수 없습니다.")
        self.owner_setting.refresh_from_db()
        self.assertEqual(self.owner_setting.color, "#AAAAAA")

    def test_owner_can_reorder_own_settings(self):
        response = _bearer(self.owner).post(
            CALENDAR_REORDER_URL,
            {"orders": [{"id": self.owner_setting.id, "display_order": 3}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.owner_setting.refresh_from_db()
        self.assertEqual(self.owner_setting.display_order, 3)

    def test_non_owner_reorder_leaves_owner_order_unchanged(self):
        response = _bearer(self.other).post(
            CALENDAR_REORDER_URL,
            {"orders": [{"id": self.owner_setting.id, "display_order": 9}]},
            format="json",
        )
        self.assertEqual(response.status_code, 404, response.data)
        self.owner_setting.refresh_from_db()
        self.assertEqual(self.owner_setting.display_order, 1)

    def test_anonymous_cannot_update_calendar_setting(self):
        response = APIClient().patch(
            CALENDAR_SETTING_URL.format(pk=self.owner_setting.id),
            {"color": "#000000"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        self.owner_setting.refresh_from_db()
        self.assertEqual(self.owner_setting.color, "#AAAAAA")

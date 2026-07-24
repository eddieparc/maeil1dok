from unittest.mock import patch

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Follow
from todos.models import BibleReadingPlan, DailyBibleSchedule, PlanSubscription

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class ProfileDiscoveryPrivacyApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.public_user = self._user("public-reader", "공개독자", is_public=True)
        self.public_peer = self._user("public-peer", "공개친구", is_public=True)
        self.private_peer = self._user("private-peer", "비공개친구", is_public=False)

    def _user(self, username, nickname, is_public):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            email=f"{username}@example.com",
            password="pw-test-1234",
        )
        user.profile.is_public = is_public
        user.profile.save(update_fields=["is_public"])
        return user

    def test_anonymous_search_hides_private_profiles(self):
        response = self.client.get("/api/v1/accounts/search/", {"q": "친구"})

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["username"] for item in response.data["data"]["users"]}
        self.assertIn(self.public_peer.username, usernames)
        self.assertNotIn(self.private_peer.username, usernames)

    def test_anonymous_followers_hide_private_users(self):
        Follow.objects.create(follower=self.public_peer, following=self.public_user)
        Follow.objects.create(follower=self.private_peer, following=self.public_user)

        response = self.client.get(f"/api/v1/accounts/followers/{self.public_user.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["username"] for item in response.data["data"]["followers"]}
        self.assertEqual(usernames, {self.public_peer.username})

    def test_private_follower_can_see_their_own_entry(self):
        Follow.objects.create(follower=self.private_peer, following=self.public_user)
        self.client.force_authenticate(user=self.private_peer)

        response = self.client.get(f"/api/v1/accounts/followers/{self.public_user.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["username"] for item in response.data["data"]["followers"]}
        self.assertIn(self.private_peer.username, usernames)

    def test_follow_private_profile_is_denied_without_creating_relationship(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": self.private_peer.id},
            format="json",
        )

        self.assertEqual(response.status_code, 404, response.data)
        self.assertFalse(
            Follow.objects.filter(
                follower=self.public_user,
                following=self.private_peer,
            ).exists()
        )

    def test_follow_missing_profile_matches_private_profile_and_writes_nothing(self):
        self.client.force_authenticate(user=self.public_user)

        private_response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": self.private_peer.id},
            format="json",
        )
        missing_response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": 999999},
            format="json",
        )

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        self.assertFalse(
            Follow.objects.filter(
                follower=self.public_user,
                following=self.private_peer,
            ).exists()
        )

    def test_unfollow_missing_profile_returns_not_found_without_server_error(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.delete("/api/v1/accounts/unfollow/999999/")

        self.assertEqual(response.status_code, 404, response.data)
        self.assertFalse(response.data["success"])
        self.assertNotIn("No User matches", response.data.get("error", ""))

    def test_private_user_self_follow_still_returns_bad_request(self):
        self.client.force_authenticate(user=self.private_peer)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": self.private_peer.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["error"], "자기 자신은 팔로우할 수 없습니다.")
        self.assertFalse(
            Follow.objects.filter(
                follower=self.private_peer,
                following=self.private_peer,
            ).exists()
        )

    def test_unfollow_existing_private_profile_relationship_still_succeeds(self):
        Follow.objects.create(follower=self.public_user, following=self.private_peer)
        self.client.force_authenticate(user=self.public_user)

        response = self.client.delete(f"/api/v1/accounts/unfollow/{self.private_peer.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            Follow.objects.filter(
                follower=self.public_user,
                following=self.private_peer,
            ).exists()
        )

    def test_follow_public_profile_response_does_not_expose_account_email(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": self.public_peer.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        following = response.data["data"]["follow"]["following"]
        follower = response.data["data"]["follow"]["follower"]
        self.assertEqual(following["username"], self.public_peer.username)
        self.assertNotIn("email", following)
        self.assertNotIn("email", follower)

    def test_private_profile_object_reads_match_missing_user_response(self):
        endpoints = [
            f"/api/v1/accounts/profile/{self.private_peer.id}/",
            f"/api/v1/accounts/profile/{self.private_peer.id}/calendar/",
            f"/api/v1/accounts/profile/{self.private_peer.id}/achievements/",
            f"/api/v1/accounts/followers/{self.private_peer.id}/",
            f"/api/v1/accounts/following/{self.private_peer.id}/",
        ]
        missing_endpoints = [
            "/api/v1/accounts/profile/999999/",
            "/api/v1/accounts/profile/999999/calendar/",
            "/api/v1/accounts/profile/999999/achievements/",
            "/api/v1/accounts/followers/999999/",
            "/api/v1/accounts/following/999999/",
        ]

        for private_path, missing_path in zip(endpoints, missing_endpoints):
            with self.subTest(path=private_path):
                private_response = self.client.get(private_path)
                missing_response = self.client.get(missing_path)

                self.assertEqual(private_response.status_code, 404)
                self.assertEqual(missing_response.status_code, 404)
                self.assertEqual(private_response.data, missing_response.data)
                self.assertNotContains(private_response, self.private_peer.username, status_code=404)

    def test_private_profile_owner_can_read_own_private_surfaces(self):
        self.client.force_authenticate(user=self.private_peer)

        profile_response = self.client.get(f"/api/v1/accounts/profile/{self.private_peer.id}/")
        calendar_response = self.client.get(f"/api/v1/accounts/profile/{self.private_peer.id}/calendar/")
        achievements_response = self.client.get(
            f"/api/v1/accounts/profile/{self.private_peer.id}/achievements/"
        )

        self.assertEqual(profile_response.status_code, 200, profile_response.data)
        self.assertEqual(calendar_response.status_code, 200, calendar_response.data)
        self.assertEqual(achievements_response.status_code, 200, achievements_response.data)

    def test_anonymous_following_hides_private_users(self):
        Follow.objects.create(follower=self.public_user, following=self.public_peer)
        Follow.objects.create(follower=self.public_user, following=self.private_peer)

        response = self.client.get(f"/api/v1/accounts/following/{self.public_user.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["username"] for item in response.data["data"]["following"]}
        self.assertEqual(usernames, {self.public_peer.username})

    def test_anonymous_profile_counts_hide_private_relationships(self):
        Follow.objects.create(follower=self.public_peer, following=self.public_user)
        Follow.objects.create(follower=self.private_peer, following=self.public_user)
        Follow.objects.create(follower=self.public_user, following=self.public_peer)
        Follow.objects.create(follower=self.public_user, following=self.private_peer)

        response = self.client.get(f"/api/v1/accounts/profile/{self.public_user.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        profile = response.data["data"]["profile"]
        self.assertEqual(profile["followers_count"], 1)
        self.assertEqual(profile["following_count"], 1)

    def test_private_authenticated_user_can_see_own_relationship_in_profile_counts(self):
        Follow.objects.create(follower=self.public_peer, following=self.public_user)
        Follow.objects.create(follower=self.private_peer, following=self.public_user)
        Follow.objects.create(follower=self.public_user, following=self.public_peer)
        Follow.objects.create(follower=self.public_user, following=self.private_peer)
        self.client.force_authenticate(user=self.private_peer)

        response = self.client.get(f"/api/v1/accounts/profile/{self.public_user.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        profile = response.data["data"]["profile"]
        self.assertEqual(profile["followers_count"], 2)
        self.assertEqual(profile["following_count"], 2)

    def test_public_calendar_rejects_non_integer_year_without_server_error(self):
        response = self.client.get(
            f"/api/v1/accounts/profile/{self.public_user.id}/calendar/",
            {"year": "next", "month": "1"},
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(response.data["success"])
        self.assertIn("year", response.data["errors"])

    def test_public_calendar_rejects_out_of_range_month_without_server_error(self):
        response = self.client.get(
            f"/api/v1/accounts/profile/{self.public_user.id}/calendar/",
            {"year": "2026", "month": "13"},
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(response.data["success"])
        self.assertIn("month", response.data["errors"])

    def test_public_calendar_rejects_partial_date_query(self):
        response = self.client.get(
            f"/api/v1/accounts/profile/{self.public_user.id}/calendar/",
            {"year": "2026"},
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(response.data["success"])
        self.assertIn("non_field_errors", response.data["errors"])

    def test_public_calendar_accepts_valid_query(self):
        plan = BibleReadingPlan.objects.create(
            name="공개 달력 플랜",
            created_by=self.public_user,
        )
        PlanSubscription.objects.create(
            user=self.public_user,
            plan=plan,
            start_date="2026-01-01",
            is_active=True,
        )
        DailyBibleSchedule.objects.create(
            plan=plan,
            date="2026-02-03",
            book="Genesis",
            start_chapter=1,
            end_chapter=1,
        )

        response = self.client.get(
            f"/api/v1/accounts/profile/{self.public_user.id}/calendar/",
            {"year": "2026", "month": "2"},
        )

        self.assertEqual(response.status_code, 200, response.data)
        calendar = response.data["data"]["calendar"]
        self.assertEqual(len(calendar), 1)
        self.assertEqual(calendar[0]["date"].isoformat(), "2026-02-03")

    def test_public_calendar_precomputes_fallback_colors_per_subscription(self):
        subscriptions = []
        expected_schedule_count = 0

        for plan_index in range(3):
            plan = BibleReadingPlan.objects.create(
                name=f"공개 달력 플랜 {plan_index}",
                created_by=self.public_user,
            )
            subscriptions.append(
                PlanSubscription.objects.create(
                    user=self.public_user,
                    plan=plan,
                    start_date="2026-01-01",
                    is_active=True,
                )
            )

            for day in range(1, 5):
                DailyBibleSchedule.objects.create(
                    plan=plan,
                    date=f"2026-02-{day + plan_index * 4:02d}",
                    book="창세기",
                    start_chapter=day,
                    end_chapter=day,
                )
                expected_schedule_count += 1

        with patch(
            "accounts.profile_views.get_plan_color",
            side_effect=lambda index: f"#{index:06X}",
        ) as get_plan_color:
            response = self.client.get(
                f"/api/v1/accounts/profile/{self.public_user.id}/calendar/",
                {"year": "2026", "month": "2"},
            )

        self.assertEqual(response.status_code, 200, response.data)
        calendar = response.data["data"]["calendar"]
        self.assertEqual(len(calendar), expected_schedule_count)
        self.assertLessEqual(get_plan_color.call_count, len(subscriptions))

    def test_follow_malformed_user_id_returns_bad_request_without_relationship(self):
        self.client.force_authenticate(user=self.public_user)
        malformed_payloads = [
            "abc",
            True,
            [self.public_peer.id],
            {"id": self.public_peer.id},
            0,
            -1,
            9223372036854775808,
            "1.5",
        ]

        for payload in malformed_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    "/api/v1/accounts/follow/",
                    {"user_id": payload},
                    format="json",
                )

                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(response.data["success"])
                self.assertEqual(
                    response.data["error"],
                    "팔로우할 사용자 ID가 올바르지 않습니다.",
                )

        self.assertFalse(
            Follow.objects.filter(follower=self.public_user).exists()
        )
        self.assertFalse(
            Follow.objects.filter(following_id=1).exists()
        )

    def test_follow_missing_and_empty_user_id_return_required_field_error(self):
        self.client.force_authenticate(user=self.public_user)

        for payload in ({}, {"user_id": ""}):
            with self.subTest(payload=payload):
                response = self.client.post(
                    "/api/v1/accounts/follow/",
                    payload,
                    format="json",
                )

                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(response.data["success"])
                self.assertEqual(
                    response.data["error"],
                    "팔로우할 사용자 ID가 필요합니다.",
                )

        self.assertFalse(
            Follow.objects.filter(follower=self.public_user).exists()
        )

    def test_follow_numeric_string_user_id_creates_relationship(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": str(self.public_peer.id)},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(
            Follow.objects.filter(
                follower=self.public_user,
                following=self.public_peer,
            ).exists()
        )

    def test_follow_wellformed_nonexistent_id_still_returns_not_found(self):
        self.client.force_authenticate(user=self.public_user)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": 999999},
            format="json",
        )

        self.assertEqual(response.status_code, 404, response.data)
        self.assertFalse(
            Follow.objects.filter(follower=self.public_user).exists()
        )


@override_settings(ROOT_URLCONF="config.urls")
class InactiveUserPublicVisibilityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.viewer = self._user("inactive-viewer", "조회독자", is_public=True)
        self.inactive_user = self._user("inactive-public-reader", "삭제대상독자", is_public=True)
        self.inactive_user.is_active = False
        self.inactive_user.scheduled_deletion_at = timezone.now() + timedelta(days=29)
        self.inactive_user.save(update_fields=["is_active", "scheduled_deletion_at"])
        self.scheduled_user = self._user("scheduled-public-reader", "예약삭제독자", is_public=True)
        self.scheduled_user.scheduled_deletion_at = timezone.now() + timedelta(days=29)
        self.scheduled_user.save(update_fields=["scheduled_deletion_at"])

    def _user(self, username, nickname, is_public):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            email=f"{username}@example.com",
            password="pw-test-1234",
        )
        user.profile.is_public = is_public
        user.profile.save(update_fields=["is_public"])
        return user

    def test_inactive_public_profile_object_reads_match_missing_user_response(self):
        endpoints = [
            f"/api/v1/accounts/profile/{self.inactive_user.id}/",
            f"/api/v1/accounts/profile/{self.inactive_user.id}/calendar/",
            f"/api/v1/accounts/profile/{self.inactive_user.id}/achievements/",
            f"/api/v1/accounts/followers/{self.inactive_user.id}/",
            f"/api/v1/accounts/following/{self.inactive_user.id}/",
        ]
        missing_endpoints = [
            "/api/v1/accounts/profile/999999/",
            "/api/v1/accounts/profile/999999/calendar/",
            "/api/v1/accounts/profile/999999/achievements/",
            "/api/v1/accounts/followers/999999/",
            "/api/v1/accounts/following/999999/",
        ]

        for inactive_path, missing_path in zip(endpoints, missing_endpoints):
            with self.subTest(path=inactive_path):
                inactive_response = self.client.get(inactive_path)
                missing_response = self.client.get(missing_path)

                self.assertEqual(inactive_response.status_code, 404)
                self.assertEqual(missing_response.status_code, 404)
                self.assertEqual(inactive_response.data, missing_response.data)
                self.assertNotContains(
                    inactive_response,
                    self.inactive_user.username,
                    status_code=404,
                )

    def test_search_omits_inactive_public_user(self):
        response = self.client.get("/api/v1/accounts/search/", {"q": "삭제대상"})

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["username"] for item in response.data["data"]["users"]}
        self.assertNotIn(self.inactive_user.username, usernames)
        self.assertNotContains(response, self.inactive_user.nickname)

    def test_search_omits_scheduled_deletion_public_user(self):
        response = self.client.get("/api/v1/accounts/search/", {"q": "예약삭제"})

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["username"] for item in response.data["data"]["users"]}
        self.assertNotIn(self.scheduled_user.username, usernames)
        self.assertNotContains(response, self.scheduled_user.nickname)

    def test_follow_inactive_public_user_is_denied_without_creating_relationship(self):
        self.client.force_authenticate(user=self.viewer)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": self.inactive_user.id},
            format="json",
        )

        self.assertEqual(response.status_code, 404, response.data)
        self.assertFalse(
            Follow.objects.filter(
                follower=self.viewer,
                following=self.inactive_user,
            ).exists()
        )

    def test_follow_scheduled_deletion_public_user_is_denied_without_creating_relationship(self):
        self.client.force_authenticate(user=self.viewer)

        response = self.client.post(
            "/api/v1/accounts/follow/",
            {"user_id": self.scheduled_user.id},
            format="json",
        )

        self.assertEqual(response.status_code, 404, response.data)
        self.assertFalse(
            Follow.objects.filter(
                follower=self.viewer,
                following=self.scheduled_user,
            ).exists()
        )


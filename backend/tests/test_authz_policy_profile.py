from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase

from accounts.models import Follow, UserProfile
from authz import can, subject_from_request
from authz.policies.calendar_settings import (
    CalendarSettingResource,
    CalendarSettingsCollection,
    CalendarSettingsReorder,
    ReadingCalendarCurrent,
)
from authz.policies.user_profile import (
    FollowEdge,
    FollowTarget,
    FriendsCollection,
    ProfileSearch,
    ProfileUpdate,
    UserProfileResource,
)
from todos.models import BibleReadingPlan, PlanSubscription

User = get_user_model()


class ProfileSocialCalendarAuthzPolicyTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="profile-owner",
            nickname="프로필소유자",
            password="pw-test-1234",
        )
        self.public_other = User.objects.create_user(
            username="profile-public",
            nickname="공개타인",
            password="pw-test-1234",
        )
        self.private_other = User.objects.create_user(
            username="profile-private",
            nickname="비공개타인",
            password="pw-test-1234",
        )
        self.private_other.profile.is_public = False
        self.private_other.profile.save()

        self.anonymous_subject = subject_from_request(
            SimpleNamespace(user=AnonymousUser())
        )
        self.owner_subject = subject_from_request(SimpleNamespace(user=self.owner))
        self.public_subject = subject_from_request(
            SimpleNamespace(user=self.public_other)
        )
        self.private_subject = subject_from_request(
            SimpleNamespace(user=self.private_other)
        )

        owner_plan = BibleReadingPlan.objects.create(
            name="소유자 플랜", created_by=self.owner
        )
        other_plan = BibleReadingPlan.objects.create(
            name="타인 플랜", created_by=self.public_other
        )
        self.owner_subscription = PlanSubscription.objects.create(
            user=self.owner, plan=owner_plan, start_date="2026-01-01", is_active=True
        )
        self.other_subscription = PlanSubscription.objects.create(
            user=self.public_other,
            plan=other_plan,
            start_date="2026-01-01",
            is_active=True,
        )
        self.owner_setting = self.owner_subscription.display_settings
        self.owner_setting.color = "#111111"
        self.owner_setting.save()
        self.other_setting = self.other_subscription.display_settings
        self.other_setting.color = "#222222"
        self.other_setting.save()

    def test_view_profile_personas_preserve_hidden_not_found(self):
        owner_own = can(
            self.owner_subject, "view_profile", UserProfileResource(self.owner.id)
        )
        self.assertTrue(owner_own)
        self.assertTrue(owner_own.value.is_own_profile)

        owner_private = can(
            self.private_subject,
            "view_profile",
            UserProfileResource(self.private_other.id),
        )
        self.assertTrue(owner_private)

        public_ok = can(
            self.anonymous_subject,
            "view_profile",
            UserProfileResource(self.public_other.id),
        )
        self.assertTrue(public_ok)
        self.assertFalse(public_ok.value.is_own_profile)

        hidden = can(
            self.anonymous_subject,
            "view_profile",
            UserProfileResource(self.private_other.id),
        )
        self.assertFalse(hidden)
        self.assertEqual(hidden.denial.status_code, 404)
        self.assertEqual(hidden.denial.body["error"], "사용자를 찾을 수 없습니다.")

        stranger_hidden = can(
            self.public_subject,
            "view_profile",
            UserProfileResource(self.private_other.id),
        )
        self.assertFalse(stranger_hidden)
        self.assertEqual(stranger_hidden.denial.status_code, 404)

        missing = can(self.owner_subject, "view_profile", UserProfileResource(999999))
        self.assertFalse(missing)
        self.assertEqual(missing.denial.status_code, 404)

    def test_achievements_and_profile_calendar_reuse_visibility(self):
        for action in ("view_achievements", "view_profile_calendar"):
            allowed = can(
                self.public_subject, action, UserProfileResource(self.public_other.id)
            )
            self.assertTrue(allowed, action)
            denied = can(
                self.public_subject, action, UserProfileResource(self.private_other.id)
            )
            self.assertFalse(denied, action)
            self.assertEqual(denied.denial.status_code, 404, action)

    def test_update_profile_is_authenticated_self_only(self):
        allowed = can(self.owner_subject, "update_profile", ProfileUpdate())
        self.assertTrue(allowed)
        denied = can(self.anonymous_subject, "update_profile", ProfileUpdate())
        self.assertFalse(denied)
        self.assertEqual(denied.denial.status_code, 401)

    def test_follow_is_directional_and_hides_private_targets(self):
        allowed = can(
            self.owner_subject, "follow", FollowTarget(self.public_other.id)
        )
        self.assertTrue(allowed)
        self.assertEqual(allowed.value, self.public_other)

        hidden = can(
            self.owner_subject, "follow", FollowTarget(self.private_other.id)
        )
        self.assertFalse(hidden)
        self.assertEqual(hidden.denial.status_code, 404)

        self_follow = can(self.owner_subject, "follow", FollowTarget(self.owner.id))
        self.assertFalse(self_follow)
        self.assertEqual(self_follow.denial.status_code, 400)

        anon = can(self.anonymous_subject, "follow", FollowTarget(self.public_other.id))
        self.assertFalse(anon)
        self.assertEqual(anon.denial.status_code, 401)

    def test_unfollow_requires_subject_owned_edge(self):
        Follow.objects.create(follower=self.owner, following=self.public_other)
        allowed = can(
            self.owner_subject, "unfollow", FollowEdge(self.public_other.id)
        )
        self.assertTrue(allowed)

        reverse_missing = can(
            self.public_subject, "unfollow", FollowEdge(self.owner.id)
        )
        self.assertFalse(reverse_missing)
        self.assertEqual(reverse_missing.denial.status_code, 404)
        self.assertEqual(
            reverse_missing.denial.body["error"], "팔로우 관계가 존재하지 않습니다."
        )

        missing_user = can(self.owner_subject, "unfollow", FollowEdge(999999))
        self.assertFalse(missing_user)
        self.assertEqual(missing_user.denial.body["error"], "사용자를 찾을 수 없습니다.")

    def test_followers_and_following_are_opposite_directions(self):
        Follow.objects.create(follower=self.owner, following=self.public_other)
        Follow.objects.create(follower=self.private_other, following=self.public_other)

        following = can(
            self.anonymous_subject,
            "view_following",
            UserProfileResource(self.owner.id),
        )
        self.assertTrue(following)
        self.assertEqual(list(following.value), [self.public_other])

        followers = can(
            self.anonymous_subject,
            "view_followers",
            UserProfileResource(self.public_other.id),
        )
        self.assertTrue(followers)
        self.assertEqual(list(followers.value), [self.owner])

        hidden_graph = can(
            self.anonymous_subject,
            "view_followers",
            UserProfileResource(self.private_other.id),
        )
        self.assertFalse(hidden_graph)
        self.assertEqual(hidden_graph.denial.status_code, 404)

    def test_friends_and_search_hide_private_profiles(self):
        Follow.objects.create(follower=self.owner, following=self.public_other)
        Follow.objects.create(follower=self.public_other, following=self.owner)
        Follow.objects.create(follower=self.owner, following=self.private_other)
        Follow.objects.create(follower=self.private_other, following=self.owner)

        friends = can(self.owner_subject, "view_friends", FriendsCollection())
        self.assertTrue(friends)
        self.assertEqual(list(friends.value), [self.public_other])

        anon_friends = can(self.anonymous_subject, "view_friends", FriendsCollection())
        self.assertFalse(anon_friends)
        self.assertEqual(anon_friends.denial.status_code, 401)

        visible = can(self.anonymous_subject, "search_profiles", ProfileSearch())
        self.assertTrue(visible)
        ids = set(visible.value.values_list("id", flat=True))
        self.assertIn(self.owner.id, ids)
        self.assertIn(self.public_other.id, ids)
        self.assertNotIn(self.private_other.id, ids)

        owner_search = can(self.owner_subject, "search_profiles", ProfileSearch())
        owner_ids = set(owner_search.value.values_list("id", flat=True))
        self.assertIn(self.owner.id, owner_ids)
        self.assertNotIn(self.private_other.id, owner_ids)

    def test_calendar_setting_owner_check_is_required(self):
        own = can(
            self.owner_subject,
            "update_calendar_setting",
            CalendarSettingResource(self.owner_setting.id),
        )
        self.assertTrue(own)
        self.assertEqual(own.value, self.owner_setting)

        stolen = can(
            self.public_subject,
            "update_calendar_setting",
            CalendarSettingResource(self.owner_setting.id),
        )
        self.assertFalse(stolen)
        self.assertEqual(stolen.denial.status_code, 404)

        settings = can(
            self.owner_subject,
            "view_calendar_settings",
            CalendarSettingsCollection(),
        )
        self.assertTrue(settings)
        self.assertEqual(list(settings.value), [self.owner_setting])

        reorder_ok = can(
            self.owner_subject,
            "reorder_calendar_settings",
            CalendarSettingsReorder((self.owner_setting.id,)),
        )
        self.assertTrue(reorder_ok)

        reorder_stolen = can(
            self.public_subject,
            "reorder_calendar_settings",
            CalendarSettingsReorder((self.owner_setting.id,)),
        )
        self.assertFalse(reorder_stolen)
        self.assertEqual(reorder_stolen.denial.status_code, 404)

        month = can(
            self.owner_subject, "view_calendar_month", ReadingCalendarCurrent()
        )
        self.assertTrue(month)
        anon_month = can(
            self.anonymous_subject, "view_calendar_month", ReadingCalendarCurrent()
        )
        self.assertFalse(anon_month)
        self.assertEqual(anon_month.denial.status_code, 401)

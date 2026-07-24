from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    BibleReadingPlan,
    DailyBibleSchedule,
    GroupInvitation,
    GroupMembership,
    PlanSubscription,
    ReadingGroup,
    UserBibleProgress,
)

User = get_user_model()


class GroupListPrivacyTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="group-owner",
            nickname="그룹장",
            password="pw-test-1234",
        )
        self.member = User.objects.create_user(
            username="group-member",
            nickname="그룹원",
            password="pw-test-1234",
        )
        self.outsider = User.objects.create_user(
            username="group-outsider",
            nickname="외부인",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="그룹 테스트 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.public_group = self._group("공개 그룹", is_public=True)
        self.private_group = self._group("비공개 그룹", is_public=False)
        GroupMembership.objects.create(
            group=self.private_group,
            user=self.owner,
            role="admin",
            is_active=True,
        )
        GroupMembership.objects.create(
            group=self.private_group,
            user=self.member,
            role="member",
            is_active=True,
        )

    def _group(self, name, is_public):
        group = ReadingGroup.objects.create(
            name=name,
            creator=self.owner,
            is_public=is_public,
        )
        group.plans.add(self.plan)
        return group

    def _list_group_names(self, user=None, query=None):
        if user is not None:
            self.client.force_authenticate(user=user)
        response = self.client.get("/api/v1/todos/groups/", query or {})
        self.client.force_authenticate(user=None)
        self.assertEqual(response.status_code, 200)
        return {group["name"] for group in response.data["groups"]}

    def test_unauthenticated_group_list_hides_private_groups(self):
        names = self._list_group_names()

        self.assertIn(self.public_group.name, names)
        self.assertNotIn(self.private_group.name, names)

    def test_authenticated_outsider_group_list_hides_private_groups(self):
        names = self._list_group_names(self.outsider)

        self.assertIn(self.public_group.name, names)
        self.assertNotIn(self.private_group.name, names)

    def test_private_group_member_can_list_their_group(self):
        names = self._list_group_names(self.member)

        self.assertIn(self.public_group.name, names)
        self.assertIn(self.private_group.name, names)

    def test_only_public_filter_hides_private_group_even_for_member(self):
        names = self._list_group_names(self.member, {"only_public": "true"})

        self.assertEqual(names, {self.public_group.name})

    def test_inactive_private_group_member_cannot_rejoin_without_pending_invitation(self):
        membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.member,
        )
        membership.is_active = False
        membership.role = "admin"
        membership.save(update_fields=["is_active", "role"])

        self.client.force_authenticate(user=self.member)
        response = self.client.post(f"/api/v1/todos/groups/{self.private_group.id}/join/")
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 403)
        membership.refresh_from_db()
        self.assertFalse(membership.is_active)
        self.assertEqual(membership.role, "admin")

    def test_private_group_admin_can_reinvite_inactive_member_before_rejoin(self):
        membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.member,
        )
        membership.is_active = False
        membership.role = "admin"
        membership.save(update_fields=["is_active", "role"])
        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.owner,
            invitee=self.member,
            status="accepted",
        )

        self.client.force_authenticate(user=self.owner)
        invite_response = self.client.post(
            f"/api/v1/todos/groups/{self.private_group.id}/invite/",
            {"user_id": self.member.id, "message": "다시 초대합니다."},
            format="json",
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(invite_response.status_code, 201)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "pending")

        self.client.force_authenticate(user=self.member)
        join_response = self.client.post(f"/api/v1/todos/groups/{self.private_group.id}/join/")
        self.client.force_authenticate(user=None)

        self.assertEqual(join_response.status_code, 200)
        membership.refresh_from_db()
        invitation.refresh_from_db()
        self.assertTrue(membership.is_active)
        self.assertEqual(membership.role, "member")
        self.assertEqual(invitation.status, "accepted")

    def test_inactive_member_rejoin_cannot_overfill_private_group(self):
        self.private_group.max_members = 1
        self.private_group.save(update_fields=["max_members"])
        membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.member,
        )
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.owner,
            invitee=self.member,
            status="pending",
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.post(f"/api/v1/todos/groups/{self.private_group.id}/join/")
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 400)
        membership.refresh_from_db()
        invitation.refresh_from_db()
        self.assertFalse(membership.is_active)
        self.assertEqual(invitation.status, "pending")

    def test_private_join_rolls_back_invitation_when_membership_create_fails(self):
        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.owner,
            invitee=self.outsider,
            status="pending",
        )

        self.client.force_authenticate(user=self.outsider)
        with patch(
            "todos.group_views.GroupMembership.objects.create",
            side_effect=IntegrityError("membership write failed"),
        ):
            response = self.client.post(f"/api/v1/todos/groups/{self.private_group.id}/join/")
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("membership write failed", str(response.data))
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "pending")
        self.assertFalse(
            GroupMembership.objects.filter(
                group=self.private_group,
                user=self.outsider,
                is_active=True,
            ).exists()
        )

    def test_invitation_accept_rolls_back_membership_when_invitation_save_fails(self):
        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.owner,
            invitee=self.outsider,
            status="pending",
        )

        self.client.force_authenticate(user=self.outsider)
        with patch(
            "todos.group_views.GroupInvitation.save",
            side_effect=IntegrityError("invitation write failed"),
        ):
            response = self.client.post(
                f"/api/v1/todos/invitations/{invitation.id}/respond/",
                {"action": "accept"},
                format="json",
            )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 500)
        self.assertNotIn("invitation write failed", str(response.data))
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "pending")
        self.assertFalse(
            GroupMembership.objects.filter(
                group=self.private_group,
                user=self.outsider,
                is_active=True,
            ).exists()
        )

    def test_outsider_group_visibility_update_returns_not_found_without_mutation(self):
        membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.member,
        )

        self.client.force_authenticate(user=self.outsider)
        response = self.client.patch(
            f"/api/v1/todos/groups/{self.private_group.id}/visibility/",
            {"show_in_profile": False},
            format="json",
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 404)
        membership.refresh_from_db()
        self.assertTrue(membership.show_in_profile)

    def test_group_visibility_update_rejects_non_boolean_values(self):
        membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.member,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/v1/todos/groups/{self.private_group.id}/visibility/",
            {"show_in_profile": "definitely"},
            format="json",
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 400)
        membership.refresh_from_db()
        self.assertTrue(membership.show_in_profile)

    def test_group_visibility_update_parses_false_string_as_false(self):
        membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.member,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.patch(
            f"/api/v1/todos/groups/{self.private_group.id}/visibility/",
            {"show_in_profile": "false"},
            format="json",
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertFalse(membership.show_in_profile)
        self.assertFalse(response.data["show_in_profile"])


class GroupMutationObjectAuthorizationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="mutation-owner",
            nickname="비공개수정그룹장",
            password="pw-test-1234",
        )
        self.outsider = User.objects.create_user(
            username="mutation-outsider",
            nickname="비공개수정외부인",
            password="pw-test-1234",
        )
        self.invitee = User.objects.create_user(
            username="mutation-invitee",
            nickname="비공개수정초대대상",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="비공개 수정 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.private_group = self._group("비공개 수정 그룹", is_public=False)
        GroupMembership.objects.create(
            group=self.private_group,
            user=self.owner,
            role="admin",
            is_active=True,
        )

    def _group(self, name, is_public):
        group = ReadingGroup.objects.create(
            name=name,
            creator=self.owner,
            is_public=is_public,
        )
        group.plans.add(self.plan)
        return group

    def _post(self, path, data=None):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(path, data or {}, format="json")
        self.client.force_authenticate(user=None)
        return response

    def _respond_to_invitation(self, user, invitation_id, action="accept"):
        self.client.force_authenticate(user=user)
        response = self.client.post(
            f"/api/v1/todos/invitations/{invitation_id}/respond/",
            {"action": action},
            format="json",
        )
        self.client.force_authenticate(user=None)
        return response

    def test_private_group_join_without_invitation_matches_missing_group_and_writes_nothing(self):
        private_response = self._post(
            f"/api/v1/todos/groups/{self.private_group.id}/join/"
        )
        missing_response = self._post("/api/v1/todos/groups/999999/join/")

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        self.assertFalse(
            GroupMembership.objects.filter(
                group=self.private_group,
                user=self.outsider,
                is_active=True,
            ).exists()
        )

    def test_private_group_invite_by_outsider_matches_missing_group_and_writes_nothing(self):
        payload = {"user_id": self.invitee.id, "message": "초대합니다."}

        private_response = self._post(
            f"/api/v1/todos/groups/{self.private_group.id}/invite/",
            payload,
        )
        missing_response = self._post("/api/v1/todos/groups/999999/invite/", payload)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        self.assertFalse(
            GroupInvitation.objects.filter(
                group=self.private_group,
                invitee=self.invitee,
                status="pending",
            ).exists()
        )

    def test_private_group_leave_by_outsider_matches_missing_group_and_writes_nothing(self):
        owner_membership = GroupMembership.objects.get(
            group=self.private_group,
            user=self.owner,
        )

        private_response = self._post(
            f"/api/v1/todos/groups/{self.private_group.id}/leave/"
        )
        missing_response = self._post("/api/v1/todos/groups/999999/leave/")

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        owner_membership.refresh_from_db()
        self.assertTrue(owner_membership.is_active)

    def test_invitation_response_by_outsider_matches_missing_invitation_and_writes_nothing(self):
        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.owner,
            invitee=self.invitee,
            status="pending",
        )

        private_response = self._respond_to_invitation(self.outsider, invitation.id)
        missing_response = self._respond_to_invitation(self.outsider, 999999)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "pending")
        self.assertFalse(
            GroupMembership.objects.filter(
                group=self.private_group,
                user=self.outsider,
                is_active=True,
            ).exists()
        )

    def test_invited_user_can_accept_private_group_invitation(self):
        invitation = GroupInvitation.objects.create(
            group=self.private_group,
            inviter=self.owner,
            invitee=self.invitee,
            status="pending",
        )

        response = self._respond_to_invitation(self.invitee, invitation.id)

        self.assertEqual(response.status_code, 200)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "accepted")
        self.assertTrue(
            GroupMembership.objects.filter(
                group=self.private_group,
                user=self.invitee,
                is_active=True,
            ).exists()
        )


class GroupInviteMalformedPayloadTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="invite-owner",
            nickname="초대검증그룹장",
            password="pw-test-1234",
        )
        self.invitee = User.objects.create_user(
            username="invite-target",
            nickname="초대검증대상",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="초대 검증 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.group = ReadingGroup.objects.create(
            name="초대 검증 그룹",
            creator=self.owner,
            is_public=True,
        )
        self.group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=self.group,
            user=self.owner,
            role="admin",
            is_active=True,
        )

    def _invite(self, payload):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/v1/todos/groups/{self.group.id}/invite/",
            payload,
            format="json",
        )
        self.client.force_authenticate(user=None)
        return response

    def _assert_no_invitation(self):
        self.assertFalse(
            GroupInvitation.objects.filter(group=self.group).exists()
        )

    def test_malformed_user_id_values_return_400_without_writing(self):
        for bad_value in ["abc", True, 0, -1, [], {}, 1.5, "  "]:
            with self.subTest(bad_value=bad_value):
                response = self._invite({"user_id": bad_value})
                self.assertEqual(
                    response.status_code,
                    400,
                    msg=f"expected 400 for {bad_value!r}, got {response.status_code}",
                )
                self.assertFalse(response.data["success"])
                self._assert_no_invitation()

    def test_boolean_true_does_not_target_user_id_one(self):
        # A user with primary key 1 exists in the fixture set; boolean True must
        # not be coerced into targeting it via ORM id=1.
        first_user = User.objects.order_by("id").first()
        response = self._invite({"user_id": True})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertFalse(
            GroupInvitation.objects.filter(
                group=self.group, invitee=first_user
            ).exists()
        )
        self._assert_no_invitation()

    def test_missing_user_id_returns_required_field_error(self):
        response = self._invite({"message": "안녕"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"], "초대할 사용자 ID가 필요합니다.")
        self._assert_no_invitation()

    def test_wellformed_missing_user_returns_not_found(self):
        response = self._invite({"user_id": 9999999})
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self._assert_no_invitation()

    def test_numeric_string_for_existing_user_creates_invitation(self):
        response = self._invite({"user_id": str(self.invitee.id)})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["success"])
        self.assertTrue(
            GroupInvitation.objects.filter(
                group=self.group,
                invitee=self.invitee,
                status="pending",
            ).exists()
        )

    def test_positive_integer_for_existing_user_creates_invitation(self):
        response = self._invite({"user_id": self.invitee.id})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            GroupInvitation.objects.filter(
                group=self.group,
                invitee=self.invitee,
                status="pending",
            ).exists()
        )

    def test_inactive_user_invitee_matches_missing_user_and_writes_nothing(self):
        inactive_user = User.objects.create_user(
            username="invite-inactive-target",
            nickname="비활성초대대상",
            password="pw-test-1234",
        )
        inactive_user.is_active = False
        inactive_user.save(update_fields=["is_active"])

        response = self._invite({"user_id": inactive_user.id})

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertFalse(
            GroupInvitation.objects.filter(
                group=self.group, invitee=inactive_user
            ).exists()
        )

    def test_deletion_scheduled_user_invitee_matches_missing_user_and_writes_nothing(self):
        pending_delete_user = User.objects.create_user(
            username="invite-pending-delete-target",
            nickname="삭제예정초대대상",
            password="pw-test-1234",
        )
        pending_delete_user.scheduled_deletion_at = timezone.now()
        pending_delete_user.save(update_fields=["scheduled_deletion_at"])

        response = self._invite({"user_id": pending_delete_user.id})

        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["success"])
        self.assertFalse(
            GroupInvitation.objects.filter(
                group=self.group, invitee=pending_delete_user
            ).exists()
        )


class GroupPrivateObjectReadPrivacyTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="private-read-owner",
            nickname="비공개조회그룹장",
            password="pw-test-1234",
        )
        self.member = User.objects.create_user(
            username="private-read-member",
            nickname="비공개조회멤버",
            password="pw-test-1234",
        )
        self.outsider = User.objects.create_user(
            username="private-read-outsider",
            nickname="비공개조회외부인",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="비공개 조회 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.public_group = self._group("공개 조회 그룹", is_public=True)
        self.private_group = self._group("비공개 조회 그룹", is_public=False)
        GroupMembership.objects.create(
            group=self.private_group,
            user=self.member,
            role="member",
            is_active=True,
        )

    def _group(self, name, is_public):
        group = ReadingGroup.objects.create(
            name=name,
            creator=self.owner,
            is_public=is_public,
        )
        group.plans.add(self.plan)
        return group

    def _get(self, path, user=None):
        if user is not None:
            self.client.force_authenticate(user=user)
        response = self.client.get(path)
        self.client.force_authenticate(user=None)
        return response

    def test_private_group_detail_hidden_from_anonymous_like_missing(self):
        private_response = self._get(f"/api/v1/todos/groups/{self.private_group.id}/")
        missing_response = self._get("/api/v1/todos/groups/999999/")

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)

    def test_private_group_detail_hidden_from_outsider_like_missing(self):
        private_response = self._get(
            f"/api/v1/todos/groups/{self.private_group.id}/",
            user=self.outsider,
        )
        missing_response = self._get("/api/v1/todos/groups/999999/", user=self.outsider)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)

    def test_private_group_members_hidden_from_outsider_like_missing(self):
        private_response = self._get(
            f"/api/v1/todos/groups/{self.private_group.id}/members/",
            user=self.outsider,
        )
        missing_response = self._get(
            "/api/v1/todos/groups/999999/members/",
            user=self.outsider,
        )

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)

    def test_private_group_member_can_read_detail_and_members(self):
        detail_response = self._get(
            f"/api/v1/todos/groups/{self.private_group.id}/",
            user=self.member,
        )
        members_response = self._get(
            f"/api/v1/todos/groups/{self.private_group.id}/members/",
            user=self.member,
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data["group"]["id"], self.private_group.id)
        self.assertEqual(members_response.status_code, 200)
        member_ids = {item["user"]["id"] for item in members_response.data["members"]}
        self.assertEqual(member_ids, {self.member.id})

    def test_public_group_detail_and_members_still_public(self):
        detail_response = self._get(f"/api/v1/todos/groups/{self.public_group.id}/")
        members_response = self._get(
            f"/api/v1/todos/groups/{self.public_group.id}/members/"
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data["group"]["id"], self.public_group.id)
        self.assertEqual(members_response.status_code, 200)


class UserPublicGroupsPrivacyTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.private_owner = self._user(
            "private-groups-owner",
            "비공개그룹소유자",
            is_public=False,
        )
        self.public_owner = self._user(
            "public-groups-owner",
            "공개그룹소유자",
            is_public=True,
        )
        self.outsider = self._user("groups-outsider", "그룹외부인", is_public=True)
        self.plan = BibleReadingPlan.objects.create(
            name="프로필 그룹 플랜",
            created_by=self.public_owner,
            is_active=True,
        )

    def _user(self, username, nickname, is_public):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            password="pw-test-1234",
        )
        user.profile.is_public = is_public
        user.profile.save(update_fields=["is_public"])
        return user

    def _group(self, owner, name, is_public=True, show_in_profile=True):
        group = ReadingGroup.objects.create(
            name=name,
            creator=owner,
            is_public=is_public,
        )
        group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=group,
            user=owner,
            role="admin",
            is_active=True,
            show_in_profile=show_in_profile,
        )
        return group

    def _get_user_groups(self, user_id, viewer=None):
        if viewer is not None:
            self.client.force_authenticate(user=viewer)
        response = self.client.get(f"/api/v1/todos/users/{user_id}/groups/")
        self.client.force_authenticate(user=None)
        return response

    def test_anonymous_private_profile_group_list_matches_missing_user_response(self):
        private_response = self._get_user_groups(self.private_owner.id)
        missing_response = self._get_user_groups(999999)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)

    def test_authenticated_non_owner_private_profile_group_list_matches_missing_user_response(self):
        private_response = self._get_user_groups(
            self.private_owner.id,
            viewer=self.outsider,
        )
        missing_response = self._get_user_groups(999999, viewer=self.outsider)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)

    def test_private_profile_owner_can_read_own_groups(self):
        visible_group = self._group(
            self.private_owner,
            "비공개 프로필 표시 그룹",
            is_public=True,
            show_in_profile=True,
        )
        hidden_group = self._group(
            self.private_owner,
            "비공개 프로필 숨김 그룹",
            is_public=False,
            show_in_profile=False,
        )

        response = self._get_user_groups(self.private_owner.id, viewer=self.private_owner)

        self.assertEqual(response.status_code, 200)
        group_ids = {group["id"] for group in response.data["groups"]}
        self.assertEqual(group_ids, {visible_group.id, hidden_group.id})

    def test_public_profile_group_list_only_returns_visible_public_groups(self):
        visible_public_group = self._group(
            self.public_owner,
            "공개 프로필 표시 공개 그룹",
            is_public=True,
            show_in_profile=True,
        )
        self._group(
            self.public_owner,
            "공개 프로필 숨김 공개 그룹",
            is_public=True,
            show_in_profile=False,
        )
        self._group(
            self.public_owner,
            "공개 프로필 표시 비공개 그룹",
            is_public=False,
            show_in_profile=True,
        )

        response = self._get_user_groups(self.public_owner.id)

        self.assertEqual(response.status_code, 200)
        group_ids = {group["id"] for group in response.data["groups"]}
        self.assertEqual(group_ids, {visible_public_group.id})


class GroupMemberProgressPrivacyTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="progress-owner",
            nickname="진도 그룹장",
            password="pw-test-1234",
        )
        self.member = User.objects.create_user(
            username="progress-member",
            nickname="진도 멤버",
            password="pw-test-1234",
        )
        self.outsider = User.objects.create_user(
            username="progress-outsider",
            nickname="진도 외부인",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="멤버 진도 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.group = ReadingGroup.objects.create(
            name="멤버 진도 공개 그룹",
            creator=self.owner,
            is_public=True,
        )
        self.group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=self.group,
            user=self.owner,
            role="admin",
            is_active=True,
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.member,
            role="member",
            is_active=True,
        )
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=timezone.datetime(2026, 7, 6).date(),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        self.subscription = PlanSubscription.objects.create(
            user=self.member,
            plan=self.plan,
            start_date=timezone.datetime(2026, 7, 1).date(),
            is_active=True,
        )
        UserBibleProgress.objects.create(
            subscription=self.subscription,
            schedule=self.schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def _member_progress(self, user=None):
        if user is not None:
            self.client.force_authenticate(user=user)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id},
        )
        self.client.force_authenticate(user=None)
        return response

    def _member_progress_for_group(self, group_id, user=None):
        if user is not None:
            self.client.force_authenticate(user=user)
        response = self.client.get(
            f"/api/v1/todos/groups/{group_id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id},
        )
        self.client.force_authenticate(user=None)
        return response

    def test_anonymous_user_cannot_read_public_group_member_progress(self):
        response = self._member_progress()

        self.assertEqual(response.status_code, 401)

    def test_outsider_cannot_read_public_group_member_progress(self):
        response = self._member_progress(self.outsider)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"], "그룹 멤버만 조회할 수 있습니다.")

    def test_private_group_member_progress_for_outsider_matches_missing_group(self):
        private_group = ReadingGroup.objects.create(
            name="멤버 진도 비공개 그룹",
            creator=self.owner,
            is_public=False,
        )
        private_group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=private_group,
            user=self.owner,
            role="admin",
            is_active=True,
        )

        private_response = self._member_progress_for_group(private_group.id, self.outsider)
        missing_response = self._member_progress_for_group(999999, self.outsider)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        self.assertNotContains(private_response, private_group.name, status_code=404)

    def test_active_member_can_read_group_member_progress(self):
        response = self._member_progress(self.member)

        self.assertEqual(response.status_code, 200)
        day = response.data["calendar"]["2026-07-06"]
        completed = [item for item in day["members"] if item["is_completed"]]
        self.assertEqual(day["completed_count"], 1)
        self.assertEqual(completed[0]["id"], self.member.id)


class PrivateGroupCreatorProfileVisibilityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.creator = User.objects.create_user(
            username="private-creator",
            nickname="비공개생성자",
            password="pw-test-1234",
        )
        self.creator.profile.is_public = False
        self.creator.profile.save(update_fields=["is_public"])
        self.outsider = User.objects.create_user(
            username="private-creator-outsider",
            nickname="외부인",
            password="pw-test-1234",
        )
        self.group = ReadingGroup.objects.create(
            name="비공개 생성자 공개 그룹",
            creator=self.creator,
            is_public=True,
        )

    def _assert_creator_is_redacted(self, creator):
        self.assertEqual(
            creator,
            {"id": None, "nickname": None, "profile_image": None},
        )

    def test_anonymous_group_list_and_detail_redact_private_creator(self):
        list_response = self.client.get("/api/v1/todos/groups/")
        detail_response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")

        self.assertEqual(list_response.status_code, 200, list_response.data)
        self.assertEqual(detail_response.status_code, 200, detail_response.data)
        list_group = next(
            group for group in list_response.data["groups"] if group["id"] == self.group.id
        )
        self._assert_creator_is_redacted(list_group["creator"])
        self._assert_creator_is_redacted(detail_response.data["group"]["creator"])

    def test_non_owner_group_list_and_detail_redact_private_creator(self):
        self.client.force_authenticate(user=self.outsider)
        list_response = self.client.get("/api/v1/todos/groups/")
        detail_response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")
        self.client.force_authenticate(user=None)

        self.assertEqual(list_response.status_code, 200, list_response.data)
        self.assertEqual(detail_response.status_code, 200, detail_response.data)
        list_group = next(
            group for group in list_response.data["groups"] if group["id"] == self.group.id
        )
        self._assert_creator_is_redacted(list_group["creator"])
        self._assert_creator_is_redacted(detail_response.data["group"]["creator"])

    def test_creator_group_list_and_detail_keep_private_creator_metadata(self):
        self.client.force_authenticate(user=self.creator)
        list_response = self.client.get("/api/v1/todos/groups/")
        detail_response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")
        self.client.force_authenticate(user=None)

        self.assertEqual(list_response.status_code, 200, list_response.data)
        self.assertEqual(detail_response.status_code, 200, detail_response.data)
        list_group = next(
            group for group in list_response.data["groups"] if group["id"] == self.group.id
        )
        self.assertEqual(list_group["creator"]["id"], self.creator.id)
        self.assertEqual(list_group["creator"]["nickname"], self.creator.nickname)
        self.assertEqual(detail_response.data["group"]["creator"]["id"], self.creator.id)
        self.assertEqual(
            detail_response.data["group"]["creator"]["nickname"],
            self.creator.nickname,
        )

    def test_anonymous_group_detail_redacts_creator_without_profile(self):
        self.creator.profile.delete()

        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        self._assert_creator_is_redacted(response.data["group"]["creator"])

    def test_creator_group_list_and_detail_keep_metadata_without_profile(self):
        self.creator.profile.delete()
        self.client.force_authenticate(user=self.creator)

        list_response = self.client.get("/api/v1/todos/groups/")
        detail_response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")

        self.client.force_authenticate(user=None)
        self.assertEqual(list_response.status_code, 200, list_response.data)
        self.assertEqual(detail_response.status_code, 200, detail_response.data)
        list_group = next(
            group for group in list_response.data["groups"] if group["id"] == self.group.id
        )
        self.assertEqual(list_group["creator"]["id"], self.creator.id)
        self.assertEqual(list_group["creator"]["nickname"], self.creator.nickname)
        self.assertEqual(detail_response.data["group"]["creator"]["id"], self.creator.id)
        self.assertEqual(
            detail_response.data["group"]["creator"]["nickname"],
            self.creator.nickname,
        )


class GroupMemberProfilePrivacyTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="profile-privacy-owner",
            nickname="공개그룹장",
            password="pw-test-1234",
        )
        self.private_member = User.objects.create_user(
            username="private-profile-member",
            nickname="비공개멤버",
            password="pw-test-1234",
        )
        self.public_member = User.objects.create_user(
            username="public-profile-member",
            nickname="공개멤버",
            password="pw-test-1234",
        )
        self.private_member.profile.is_public = False
        self.private_member.profile.save(update_fields=["is_public"])
        self.plan = BibleReadingPlan.objects.create(
            name="프로필 공개 범위 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.group = ReadingGroup.objects.create(
            name="프로필 공개 범위 그룹",
            creator=self.owner,
            is_public=True,
        )
        self.group.plans.add(self.plan)
        for user, role in [(self.owner, "admin"), (self.private_member, "member"), (self.public_member, "member")]:
            GroupMembership.objects.create(
                group=self.group,
                user=user,
                role=role,
                is_active=True,
            )
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=timezone.datetime(2026, 7, 6).date(),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        self._subscribe_and_complete(self.private_member)

    def _subscribe_and_complete(self, user):
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=self.plan,
            start_date=timezone.datetime(2026, 7, 1).date(),
            is_active=True,
        )
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=self.schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def _member_list(self, user=None):
        if user is not None:
            self.client.force_authenticate(user=user)
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")
        self.client.force_authenticate(user=None)
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def _member_progress(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id},
        )
        self.client.force_authenticate(user=None)
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def _day_members_by_id(self, response):
        day = response.data["calendar"]["2026-07-06"]
        return day, {item["id"]: item for item in day["members"]}

    def test_anonymous_member_list_hides_private_profile_members(self):
        response = self._member_list()

        usernames = {item["user"]["username"] for item in response.data["members"]}
        self.assertNotIn(self.private_member.username, usernames)
        self.assertEqual(response.data["meta"]["total_members"], 2)

    def test_member_list_hides_private_profiles_from_other_members(self):
        response = self._member_list(self.public_member)

        usernames = {item["user"]["username"] for item in response.data["members"]}
        self.assertNotIn(self.private_member.username, usernames)
        self.assertEqual(response.data["meta"]["total_members"], 2)

    def test_member_list_shows_private_profile_to_self(self):
        response = self._member_list(self.private_member)

        user_ids = {item["user"]["id"] for item in response.data["members"]}
        self.assertIn(self.private_member.id, user_ids)
        self.assertEqual(response.data["meta"]["total_members"], 3)

    def test_member_progress_hides_private_profile_members(self):
        response = self._member_progress(self.owner)
        day, members_by_id = self._day_members_by_id(response)

        self.assertNotIn(self.private_member.id, members_by_id)
        self.assertEqual(day["completed_count"], 0)
        self.assertEqual(response.data["meta"]["total_members"], 2)

    def test_member_progress_shows_private_profile_to_self(self):
        response = self._member_progress(self.private_member)
        day, members_by_id = self._day_members_by_id(response)

        self.assertIn(self.private_member.id, members_by_id)
        self.assertTrue(members_by_id[self.private_member.id]["is_completed"])
        self.assertEqual(day["completed_count"], 1)
        self.assertEqual(response.data["meta"]["total_members"], 3)

class InactiveGroupMemberVisibilityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="inactive-member-owner",
            nickname="비활성 그룹장",
            password="pw-test-1234",
        )
        self.inactive_member = User.objects.create_user(
            username="inactive-group-member",
            nickname="삭제대상멤버",
            password="pw-test-1234",
        )
        self.inactive_member.profile.is_public = True
        self.inactive_member.profile.save(update_fields=["is_public"])
        self.inactive_member.is_active = False
        self.inactive_member.scheduled_deletion_at = timezone.now()
        self.inactive_member.save(update_fields=["is_active", "scheduled_deletion_at"])
        self.scheduled_member = User.objects.create_user(
            username="scheduled-group-member",
            nickname="예약삭제멤버",
            password="pw-test-1234",
        )
        self.scheduled_member.profile.is_public = True
        self.scheduled_member.profile.save(update_fields=["is_public"])
        self.scheduled_member.scheduled_deletion_at = timezone.now()
        self.scheduled_member.save(update_fields=["scheduled_deletion_at"])
        self.group = ReadingGroup.objects.create(
            name="비활성 멤버 공개 그룹",
            creator=self.owner,
            is_public=True,
        )
        self.plan = BibleReadingPlan.objects.create(
            name="비활성 멤버 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.group.plans.add(self.plan)
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=timezone.datetime(2026, 7, 6).date(),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.owner,
            role="admin",
            is_active=True,
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.inactive_member,
            role="member",
            is_active=True,
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.scheduled_member,
            role="member",
            is_active=True,
        )
        self._subscribe_and_complete(self.inactive_member)
        self._subscribe_and_complete(self.scheduled_member)
        self.inactive_creator_group = self._group_with_hidden_creator(
            "비활성 생성자 공개 그룹",
            username="inactive-group-creator",
            nickname="비활성생성자",
            is_active=False,
        )
        self.scheduled_creator_group = self._group_with_hidden_creator(
            "예약삭제 생성자 공개 그룹",
            username="scheduled-group-creator",
            nickname="예약삭제생성자",
            is_active=True,
        )

    def _subscribe_and_complete(self, user):
        subscription = PlanSubscription.objects.create(
            user=user,
            plan=self.plan,
            start_date=timezone.datetime(2026, 7, 1).date(),
            is_active=True,
        )
        UserBibleProgress.objects.create(
            subscription=subscription,
            schedule=self.schedule,
            is_completed=True,
            completed_at=timezone.now(),
        )

    def _group_with_hidden_creator(self, name, username, nickname, is_active):
        creator = User.objects.create_user(
            username=username,
            nickname=nickname,
            password="pw-test-1234",
        )
        creator.profile.is_public = True
        creator.profile.save(update_fields=["is_public"])
        creator.scheduled_deletion_at = timezone.now()
        if not is_active:
            creator.is_active = False
        creator.save(update_fields=["is_active", "scheduled_deletion_at"])
        group = ReadingGroup.objects.create(
            name=name,
            creator=creator,
            is_public=True,
        )
        group.plans.add(self.plan)
        return group

    def test_public_group_member_list_hides_inactive_users(self):
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")

        self.assertEqual(response.status_code, 200, response.data)
        usernames = {item["user"]["username"] for item in response.data["members"]}
        self.assertIn(self.owner.username, usernames)
        self.assertNotIn(self.inactive_member.username, usernames)
        self.assertNotIn(self.scheduled_member.username, usernames)
        self.assertEqual(response.data["meta"]["total_members"], 1)

    def test_group_member_progress_hides_inactive_and_scheduled_users(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id},
        )

        self.assertEqual(response.status_code, 200, response.data)
        day = response.data["calendar"]["2026-07-06"]
        member_ids = {item["id"] for item in day["members"]}
        self.assertIn(self.owner.id, member_ids)
        self.assertNotIn(self.inactive_member.id, member_ids)
        self.assertNotIn(self.scheduled_member.id, member_ids)
        self.assertEqual(response.data["meta"]["total_members"], 1)

    def test_group_list_redacts_inactive_and_scheduled_creator_metadata(self):
        response = self.client.get("/api/v1/todos/groups/")

        self.assertEqual(response.status_code, 200, response.data)
        groups_by_name = {group["name"]: group for group in response.data["groups"]}
        for group in [self.inactive_creator_group, self.scheduled_creator_group]:
            creator = groups_by_name[group.name]["creator"]
            self.assertIsNone(creator["id"])
            self.assertIsNone(creator["nickname"])
            self.assertIsNone(creator["profile_image"])
        self.assertNotContains(response, "비활성생성자")
        self.assertNotContains(response, "예약삭제생성자")

    def test_group_detail_redacts_inactive_creator_metadata(self):
        response = self.client.get(f"/api/v1/todos/groups/{self.inactive_creator_group.id}/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["group"]["name"], self.inactive_creator_group.name)
        self.assertIsNone(response.data["group"]["creator"]["id"])
        self.assertIsNone(response.data["group"]["creator"]["nickname"])
        self.assertNotContains(response, "비활성생성자")


class GroupReadErrorEnvelopeTest(TestCase):
    INTERNAL_MARKER = "database password leaked"

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="read-error-owner",
            nickname="조회오류그룹장",
            password="pw-test-1234",
        )
        self.member = User.objects.create_user(
            username="read-error-member",
            nickname="조회오류멤버",
            password="pw-test-1234",
        )
        self.invitee = User.objects.create_user(
            username="read-error-invitee",
            nickname="조회오류초대자",
            password="pw-test-1234",
        )
        self.owner.profile.is_public = True
        self.owner.profile.save(update_fields=["is_public"])
        self.plan = BibleReadingPlan.objects.create(
            name="조회 오류 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.group = ReadingGroup.objects.create(
            name="조회 오류 공개 그룹",
            creator=self.owner,
            is_public=True,
        )
        self.group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=self.group,
            user=self.owner,
            role="admin",
            is_active=True,
            show_in_profile=True,
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.member,
            role="member",
            is_active=True,
        )
        GroupInvitation.objects.create(
            group=self.group,
            inviter=self.owner,
            invitee=self.invitee,
            status="pending",
        )

    def _assert_internal_error_hidden(self, response):
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data["success"], False)
        self.assertNotIn(self.INTERNAL_MARKER, str(response.data))

    def test_group_list_error_does_not_expose_internal_exception_text(self):
        with patch(
            "todos.group_views.ReadingGroupSerializer.to_dict",
            side_effect=RuntimeError(self.INTERNAL_MARKER),
        ):
            response = self.client.get("/api/v1/todos/groups/")

        self._assert_internal_error_hidden(response)

    def test_group_detail_error_does_not_expose_internal_exception_text(self):
        with patch(
            "todos.group_views.ReadingGroupSerializer.to_dict",
            side_effect=RuntimeError(self.INTERNAL_MARKER),
        ):
            response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")

        self._assert_internal_error_hidden(response)

    def test_group_members_error_does_not_expose_internal_exception_text(self):
        with patch(
            "todos.group_views.UserSearchSerializer",
            side_effect=RuntimeError(self.INTERNAL_MARKER),
        ):
            response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")

        self._assert_internal_error_hidden(response)

    def test_group_member_progress_error_does_not_expose_internal_exception_text(self):
        self.client.force_authenticate(user=self.member)
        with patch(
            "todos.group_views.DailyBibleSchedule.objects.filter",
            side_effect=RuntimeError(self.INTERNAL_MARKER),
        ):
            response = self.client.get(
                f"/api/v1/todos/groups/{self.group.id}/member-progress/",
                {"year": 2026, "month": 7, "plan_id": self.plan.id},
            )
        self.client.force_authenticate(user=None)

        self._assert_internal_error_hidden(response)

    def test_my_invitations_error_does_not_expose_internal_exception_text(self):
        self.client.force_authenticate(user=self.invitee)
        with patch(
            "todos.group_views.ReadingGroupSerializer.to_dict",
            side_effect=RuntimeError(self.INTERNAL_MARKER),
        ):
            response = self.client.get("/api/v1/todos/invitations/")
        self.client.force_authenticate(user=None)

        self._assert_internal_error_hidden(response)

    def test_user_public_groups_error_does_not_expose_internal_exception_text(self):
        with patch(
            "todos.group_views.ReadingGroupSerializer.to_dict",
            side_effect=RuntimeError(self.INTERNAL_MARKER),
        ):
            response = self.client.get(f"/api/v1/todos/users/{self.owner.id}/groups/")

        self._assert_internal_error_hidden(response)

class GroupInactivePlanVisibilityTest(TestCase):
    """Non-admin/public group reads must never surface inactive reading plans."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username="inactive-plan-owner",
            nickname="비활성플랜그룹장",
            password="pw-test-1234",
        )
        self.owner.profile.is_public = True
        self.owner.profile.save(update_fields=["is_public"])
        self.member = User.objects.create_user(
            username="inactive-plan-member",
            nickname="비활성플랜멤버",
            password="pw-test-1234",
        )
        self.active_plan = BibleReadingPlan.objects.create(
            name="활성 그룹 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.inactive_plan = BibleReadingPlan.objects.create(
            name="비활성 그룹 플랜",
            created_by=self.owner,
            is_active=False,
        )
        self.group = ReadingGroup.objects.create(
            name="플랜 노출 검증 그룹",
            creator=self.owner,
            is_public=True,
        )
        self.group.plans.add(self.active_plan, self.inactive_plan)
        GroupMembership.objects.create(
            group=self.group,
            user=self.owner,
            role="admin",
            is_active=True,
            show_in_profile=True,
        )
        GroupMembership.objects.create(
            group=self.group,
            user=self.member,
            role="member",
            is_active=True,
        )

    def _plan_ids(self, plans):
        return {plan["id"] for plan in plans}

    def test_group_detail_excludes_inactive_plan(self):
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/")

        self.assertEqual(response.status_code, 200)
        plans = response.data["group"]["plans"]
        plan_ids = self._plan_ids(plans)
        self.assertIn(self.active_plan.id, plan_ids)
        self.assertNotIn(self.inactive_plan.id, plan_ids)
        self.assertTrue(all(plan["is_active"] for plan in plans))
        self.assertNotContains(response, self.inactive_plan.name)

    def test_group_list_card_excludes_inactive_plan(self):
        response = self.client.get("/api/v1/todos/groups/")

        self.assertEqual(response.status_code, 200)
        card = next(
            group for group in response.data["groups"] if group["id"] == self.group.id
        )
        plan_ids = self._plan_ids(card["plans"])
        self.assertIn(self.active_plan.id, plan_ids)
        self.assertNotIn(self.inactive_plan.id, plan_ids)

    def test_group_list_plan_filter_ignores_inactive_plan(self):
        active_response = self.client.get(
            "/api/v1/todos/groups/", {"plan_id": self.active_plan.id}
        )
        inactive_response = self.client.get(
            "/api/v1/todos/groups/", {"plan_id": self.inactive_plan.id}
        )

        self.assertEqual(active_response.status_code, 200)
        self.assertEqual(inactive_response.status_code, 200)
        active_ids = {group["id"] for group in active_response.data["groups"]}
        inactive_ids = {group["id"] for group in inactive_response.data["groups"]}
        self.assertIn(self.group.id, active_ids)
        self.assertNotIn(self.group.id, inactive_ids)

    def test_user_public_groups_card_excludes_inactive_plan(self):
        response = self.client.get(f"/api/v1/todos/users/{self.owner.id}/groups/")

        self.assertEqual(response.status_code, 200)
        card = next(
            group for group in response.data["groups"] if group["id"] == self.group.id
        )
        plan_ids = self._plan_ids(card["plans"])
        self.assertIn(self.active_plan.id, plan_ids)
        self.assertNotIn(self.inactive_plan.id, plan_ids)

    def test_member_progress_rejects_inactive_plan_id(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.inactive_plan.id},
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "그룹에 포함되지 않은 플랜입니다.")
        self.assertNotContains(response, self.inactive_plan.name, status_code=400)

    def test_member_progress_default_plan_skips_inactive_plan(self):
        inactive_only_group = ReadingGroup.objects.create(
            name="비활성 플랜만 있는 그룹",
            creator=self.owner,
            is_public=True,
        )
        inactive_only_group.plans.add(self.inactive_plan)
        GroupMembership.objects.create(
            group=inactive_only_group,
            user=self.member,
            role="member",
            is_active=True,
        )

        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/v1/todos/groups/{inactive_only_group.id}/member-progress/",
            {"year": 2026, "month": 7},
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "그룹에 설정된 플랜이 없습니다.")

    def test_member_progress_active_plan_still_works(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.active_plan.id},
        )
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["plan"]["id"], self.active_plan.id)

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from accounts.models import UserProfile
from .models import (
    BibleReadingPlan,
    GroupMembership,
    PlanSubscription,
    ReadingGroup,
)

User = get_user_model()

SEARCH_MARKER = "QCMARKER"


@override_settings(ROOT_URLCONF="config.urls")
class GroupListQueryCountTests(TestCase):
    """`/groups/` must serialize N group cards with a constant SQL query count."""

    def setUp(self):
        self.client = APIClient()
        self.viewer = User.objects.create_user(
            username="qc-viewer",
            nickname="뷰어",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="QC 플랜",
            created_by=self.viewer,
            is_active=True,
        )

    def _make_group(self, index, member_users):
        group = ReadingGroup.objects.create(
            name=f"{SEARCH_MARKER} 그룹 {index}",
            description="쿼리 카운트 검증용",
            creator=self.viewer,
            is_public=True,
            max_members=5,
        )
        group.plans.add(self.plan)
        for user in member_users:
            GroupMembership.objects.create(
                group=group,
                user=user,
                role="member",
                is_active=True,
            )
        return group

    def _seed_members(self, count):
        users = []
        for i in range(count):
            users.append(
                User.objects.create_user(
                    username=f"qc-member-{self._next_member_id()}",
                    nickname=f"멤버{self._next_member_id()}",
                    password="pw-test-1234",
                )
            )
            self._member_seq += 1
        return users

    _member_seq = 0

    def _next_member_id(self):
        return self._member_seq

    def _list(self, marker_suffix=""):
        self.client.force_authenticate(user=self.viewer)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(
                "/api/v1/todos/groups/",
                {"search": SEARCH_MARKER + marker_suffix},
            )
        self.client.force_authenticate(user=None)
        self.assertEqual(response.status_code, 200)
        return response.json(), len(ctx.captured_queries)

    def test_query_count_is_constant_from_one_to_twenty_groups(self):
        # One group with two active members (+ the viewer as a member).

        two_members = self._seed_members(2)
        self._make_group(0, [self.viewer] + two_members)

        one_body, one_queries = self._list()
        self.assertEqual(one_body["total"], 1)

        # Add nineteen more matching groups (twenty total).
        for i in range(1, 20):
            extra = self._seed_members(2)
            self._make_group(i, extra)

        many_body, many_queries = self._list()
        self.assertEqual(many_body["total"], 20)

        # Query count must stay effectively constant as result size grows.
        self.assertLessEqual(many_queries, one_queries + 2)
        self.assertLessEqual(many_queries, 15)

    def test_serialized_fields_are_correct(self):
        two_members = self._seed_members(2)
        group = self._make_group(0, [self.viewer] + two_members)

        body, _ = self._list()
        self.assertEqual(body["total"], 1)
        card = body["groups"][0]

        self.assertEqual(card["id"], group.id)
        # viewer + 2 active members = 3
        self.assertEqual(card["member_count"], 3)
        self.assertFalse(card["is_full"])  # 3 < max_members(5)
        self.assertTrue(card["is_member"])
        self.assertEqual(card["my_role"], "멤버")
        self.assertTrue(card["show_in_profile"])
        self.assertEqual(len(card["plans"]), 1)
        self.assertEqual(card["plans"][0]["created_by_username"], self.viewer.username)

    def test_is_full_reflects_active_member_count(self):
        # max_members is 5; add viewer + 4 members => full.
        four = self._seed_members(4)
        self._make_group(0, [self.viewer] + four)

        body, _ = self._list()
        card = body["groups"][0]
        self.assertEqual(card["member_count"], 5)
        self.assertTrue(card["is_full"])

    def test_inactive_memberships_are_not_counted(self):
        one = self._seed_members(1)
        group = self._make_group(0, [self.viewer] + one)
        inactive = self._seed_members(1)[0]
        GroupMembership.objects.create(
            group=group,
            user=inactive,
            role="member",
            is_active=False,
        )

        body, _ = self._list()
        card = body["groups"][0]
        # viewer + 1 active member; inactive excluded.
        self.assertEqual(card["member_count"], 2)


@override_settings(ROOT_URLCONF="config.urls")
class UserPublicGroupsQueryCountTests(TestCase):
    """`/users/<id>/groups/` must use the same batched serialization path."""

    def setUp(self):
        self.client = APIClient()
        self.target = User.objects.create_user(
            username="qc-target",
            nickname="대상",
            password="pw-test-1234",
        )
        UserProfile.objects.update_or_create(
            user=self.target,
            defaults={"is_public": True},
        )
        self.plan = BibleReadingPlan.objects.create(
            name="QC 프로필 플랜",
            created_by=self.target,
            is_active=True,
        )
        self._seq = 0

    def _make_public_group(self, index):
        group = ReadingGroup.objects.create(
            name=f"프로필 그룹 {index}",
            creator=self.target,
            is_public=True,
            max_members=50,
        )
        group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=group,
            user=self.target,
            role="admin",
            is_active=True,
            show_in_profile=True,
        )
        return group

    def _list(self):
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(
                f"/api/v1/todos/users/{self.target.id}/groups/"
            )
        self.assertEqual(response.status_code, 200)
        return response.json(), len(ctx.captured_queries)

    def test_public_groups_query_count_is_constant(self):
        self._make_public_group(0)
        one_body, one_queries = self._list()
        self.assertEqual(one_body["total"], 1)

        for i in range(1, 20):
            self._make_public_group(i)
        many_body, many_queries = self._list()
        self.assertEqual(many_body["total"], 20)

        self.assertLessEqual(many_queries, one_queries + 2)
        self.assertLessEqual(many_queries, 15)

    def test_public_group_card_fields(self):
        group = self._make_public_group(0)
        body, _ = self._list()
        card = body["groups"][0]
        self.assertEqual(card["id"], group.id)
        self.assertEqual(card["member_count"], 1)
        self.assertFalse(card["is_full"])
        self.assertEqual(len(card["plans"]), 1)
        self.assertEqual(card["plans"][0]["created_by_username"], self.target.username)

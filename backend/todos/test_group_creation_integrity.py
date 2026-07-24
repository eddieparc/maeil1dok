from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from .models import BibleReadingPlan, GroupMembership, ReadingGroup

User = get_user_model()


class GroupCreationIntegrityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="group-creator",
            nickname="그룹생성자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="그룹 생성 테스트 플랜",
            created_by=self.user,
            is_active=True,
        )
        self.url = "/api/v1/todos/groups/create/"

    def _post_group(self, payload):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url, payload, format="json")
        self.client.force_authenticate(user=None)
        return response

    def test_create_group_rejects_ambiguous_public_flag_before_write(self):
        response = self._post_group({
            "name": "잘못된 공개 플래그",
            "plan_ids": [self.plan.id],
            "is_public": "maybe",
            "max_members": 50,
        })

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("is_public", response.data["error"])
        self.assertFalse(ReadingGroup.objects.exists())
        self.assertFalse(GroupMembership.objects.exists())

    def test_create_group_rejects_boolean_max_members_before_write(self):
        response = self._post_group({
            "name": "잘못된 최대 멤버",
            "plan_ids": [self.plan.id],
            "is_public": True,
            "max_members": True,
        })

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("최대 멤버 수", response.data["error"])
        self.assertFalse(ReadingGroup.objects.exists())
        self.assertFalse(GroupMembership.objects.exists())

    def test_create_group_rolls_back_group_when_creator_membership_fails(self):
        with patch(
            "todos.group_views.GroupMembership.objects.create",
            side_effect=IntegrityError("creator membership write failed"),
        ):
            response = self._post_group({
                "name": "원자적 생성",
                "plan_ids": [self.plan.id],
                "is_public": False,
                "max_members": 50,
            })

        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"], "그룹 생성 중 오류가 발생했습니다.")
        self.assertNotIn("creator membership write failed", response.data["error"])
        self.assertFalse(ReadingGroup.objects.exists())
        self.assertFalse(GroupMembership.objects.exists())

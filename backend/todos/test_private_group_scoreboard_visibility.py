from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan, GroupMembership, PlanSubscription, ReadingGroup

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


@override_settings(ROOT_URLCONF=__name__)
class PrivateGroupScoreboardVisibilityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = self._user("score-private-owner", "비공개그룹장")
        self.member = self._user("score-private-member", "비공개멤버")
        self.outsider = self._user("score-private-outsider", "비공개외부인")
        self.plan = BibleReadingPlan.objects.create(
            name="비공개 점수판 플랜",
            created_by=self.owner,
            is_active=True,
        )
        self.group = ReadingGroup.objects.create(
            name="비밀 점수판 그룹",
            creator=self.owner,
            is_public=False,
        )
        self.group.plans.add(self.plan)
        self._add_member(self.owner, "admin")
        self._add_member(self.member, "member")

    def _user(self, username, nickname):
        user = User.objects.create_user(
            username=username,
            nickname=nickname,
            password="pw-test-1234",
        )
        user.profile.is_public = True
        user.profile.save(update_fields=["is_public"])
        return user

    def _add_member(self, user, role):
        GroupMembership.objects.create(
            group=self.group,
            user=user,
            role=role,
            is_active=True,
        )
        PlanSubscription.objects.create(
            user=user,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )

    def _scoreboard(self, group_id, user=None):
        self.client.force_authenticate(user=user)
        response = self.client.get(f"/api/v1/todos/scoreboard/group/{group_id}/")
        self.client.force_authenticate(user=None)
        return response

    def test_anonymous_private_group_scoreboard_matches_missing_group_response(self):
        private_response = self._scoreboard(self.group.id)
        missing_response = self._scoreboard(999999)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        self.assertNotContains(private_response, self.group.name, status_code=404)

    def test_non_member_private_group_scoreboard_matches_missing_group_response(self):
        private_response = self._scoreboard(self.group.id, self.outsider)
        missing_response = self._scoreboard(999999, self.outsider)

        self.assertEqual(private_response.status_code, 404)
        self.assertEqual(missing_response.status_code, 404)
        self.assertEqual(private_response.data, missing_response.data)
        self.assertNotContains(private_response, self.group.name, status_code=404)

    def test_private_member_and_public_group_scoreboards_still_work(self):
        public_group = ReadingGroup.objects.create(
            name="공개 점수판 그룹",
            creator=self.owner,
            is_public=True,
        )
        public_group.plans.add(self.plan)
        GroupMembership.objects.create(
            group=public_group,
            user=self.owner,
            role="admin",
            is_active=True,
        )

        member_response = self._scoreboard(self.group.id, self.member)
        public_response = self._scoreboard(public_group.id)

        self.assertEqual(member_response.status_code, 200)
        self.assertEqual(member_response.data["group"]["name"], self.group.name)
        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(public_response.data["group"]["name"], public_group.name)

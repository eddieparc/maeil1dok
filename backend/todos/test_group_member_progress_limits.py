"""
Tests for group member progress resource limits and pagination.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from datetime import date
from todos.models import (
    BibleReadingPlan,
    ReadingGroup,
    GroupMembership,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
)
from todos.group_views import MAX_GROUP_MEMBERS_PER_REQUEST

User = get_user_model()


class GroupMemberProgressLimitsTest(TestCase):
    """Test resource limits and pagination for group member progress endpoint."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()

        # Create creator first
        self.creator = User.objects.create_user(
            username="creator",
            password="password",
            nickname="creator",
        )

        # Create a plan
        self.plan = BibleReadingPlan.objects.create(
            name="Test Plan",
            is_active=True,
            created_by=self.creator,
        )

        # Create a schedule for the current month
        self.schedule = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date(2026, 7, 1),
            book="창세기",
            start_chapter=1,
            end_chapter=1,
        )

        # Create group
        self.group = ReadingGroup.objects.create(
            name="Large Group",
            creator=self.creator,
            is_public=True,
            max_members=500,  # Allow many members
        )
        self.group.plans.add(self.plan)

        # Creator is automatically a member
        GroupMembership.objects.create(
            group=self.group,
            user=self.creator,
            is_active=True,
        )

        # Create many users to test pagination (150 members total including creator)
        self.members = [self.creator]
        for i in range(150):
            user = User.objects.create_user(
                username=f"member{i}",
                password="password",
                nickname=f"Member {i}",
            )
            GroupMembership.objects.create(
                group=self.group,
                user=user,
                is_active=True,
            )
            # Subscribe each user to the plan
            PlanSubscription.objects.create(
                user=user,
                plan=self.plan,
                start_date=date(2026, 7, 1),
                is_active=True,
            )
            self.members.append(user)

    def _get_member_progress(self, **params):
        query = {"month": 7, "plan_id": self.plan.id}
        query.update(params)
        return self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            query,
        )

    def _assert_year_bound_rejected(self, year):
        self.client.force_authenticate(user=self.creator)
        response = self._get_member_progress(year=year)

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("year는 1부터 9999 사이여야 합니다", data["error"])

    def test_year_below_minimum_is_rejected(self):
        """Test that year=0 is rejected before date construction."""
        self._assert_year_bound_rejected(0)

    def test_negative_year_is_rejected(self):
        """Test that negative years are rejected before date construction."""
        self._assert_year_bound_rejected(-1)

    def test_year_above_maximum_is_rejected(self):
        """Test that year=10000 is rejected before date construction."""
        self._assert_year_bound_rejected(10000)

    def test_minimum_boundary_year_is_accepted(self):
        """Test that year=1 remains a valid calendar boundary."""
        self.client.force_authenticate(user=self.creator)
        response = self._get_member_progress(year=1)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_maximum_boundary_year_is_accepted(self):
        """Test that year=9999 remains a valid calendar boundary."""
        self.client.force_authenticate(user=self.creator)
        response = self._get_member_progress(year=9999)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

    def test_default_limit_is_enforced(self):
        """Test that default limit of 100 members is enforced."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        
        # Check metadata
        meta = data["meta"]
        self.assertEqual(meta["total_members"], 151)  # 150 members + 1 creator
        self.assertEqual(meta["offset"], 0)
        self.assertEqual(meta["limit"], MAX_GROUP_MEMBERS_PER_REQUEST)
        self.assertEqual(meta["returned_members"], MAX_GROUP_MEMBERS_PER_REQUEST)
        self.assertTrue(meta["has_more"])
        
        # Check that only limited members are returned
        for date_str, day_data in data["calendar"].items():
            self.assertEqual(len(day_data["members"]), MAX_GROUP_MEMBERS_PER_REQUEST)

    def test_custom_limit_within_bounds(self):
        """Test that custom limit within bounds is respected."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "limit": 50},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        
        meta = data["meta"]
        self.assertEqual(meta["limit"], 50)
        self.assertEqual(meta["returned_members"], 50)
        
        for date_str, day_data in data["calendar"].items():
            self.assertEqual(len(day_data["members"]), 50)

    def test_limit_exceeding_max_is_rejected(self):
        """Test that limit exceeding MAX_GROUP_MEMBERS_PER_REQUEST is rejected."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {
                "year": 2026,
                "month": 7,
                "plan_id": self.plan.id,
                "limit": MAX_GROUP_MEMBERS_PER_REQUEST + 1,
            },
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn(f"limit은 {MAX_GROUP_MEMBERS_PER_REQUEST} 이하여야 합니다", data["error"])

    def test_negative_limit_is_rejected(self):
        """Test that negative limit is rejected."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "limit": -1},
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("limit은 1 이상이어야 합니다", data["error"])

    def test_invalid_limit_is_rejected(self):
        """Test that non-numeric limit is rejected."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "limit": "invalid"},
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("limit은 숫자여야 합니다", data["error"])

    def test_pagination_with_offset(self):
        """Test pagination with offset parameter."""
        self.client.force_authenticate(user=self.creator)
        
        # First page
        response1 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "offset": 0, "limit": 50},
        )
        
        # Second page
        response2 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "offset": 50, "limit": 50},
        )

        self.assertEqual(response1.status_code, 200)
        self.assertEqual(response2.status_code, 200)
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Check that different members are returned
        members1_ids = set()
        members2_ids = set()
        
        for date_str, day_data in data1["calendar"].items():
            members1_ids.update(m["id"] for m in day_data["members"])
        
        for date_str, day_data in data2["calendar"].items():
            members2_ids.update(m["id"] for m in day_data["members"])
        
        # No overlap between pages
        self.assertEqual(len(members1_ids & members2_ids), 0)
        
        # Correct counts
        self.assertEqual(len(members1_ids), 50)
        self.assertEqual(len(members2_ids), 50)

    def test_negative_offset_is_rejected(self):
        """Test that negative offset is rejected."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "offset": -1},
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("offset은 0 이상이어야 합니다", data["error"])

    def test_invalid_offset_is_rejected(self):
        """Test that non-numeric offset is rejected."""
        self.client.force_authenticate(user=self.creator)
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "offset": "invalid"},
        )

        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("offset은 숫자여야 합니다", data["error"])

    def test_has_more_flag_is_correct(self):
        """Test that has_more flag is correctly set."""
        self.client.force_authenticate(user=self.creator)
        
        # Request with offset that leaves more members
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "offset": 0, "limit": 50},
        )
        
        data = response.json()
        self.assertTrue(data["meta"]["has_more"])
        
        # Request with offset that exhausts members
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id, "offset": 140, "limit": 50},
        )
        
        data = response.json()
        self.assertFalse(data["meta"]["has_more"])
        # Should return 11 members (151 total - 140 offset)
        self.assertEqual(data["meta"]["returned_members"], 11)

    def test_resource_usage_is_bounded(self):
        """Test that memory usage is bounded even with large groups."""
        self.client.force_authenticate(user=self.creator)
        
        # Even though group has 151 members, response should only include 100
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/member-progress/",
            {"year": 2026, "month": 7, "plan_id": self.plan.id},
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # With 1 schedule and 100 members, we should have exactly 100 member entries
        # (not 151), preventing resource exhaustion
        for date_str, day_data in data["calendar"].items():
            member_count = len(day_data["members"])
            self.assertEqual(member_count, MAX_GROUP_MEMBERS_PER_REQUEST)
            # This prevents (151 members * 30 days = 4530 entries) from being
            # returned, instead limiting to (100 members * 30 days = 3000 entries)

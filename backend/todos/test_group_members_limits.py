from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from django.db import connection
from django.test.utils import CaptureQueriesContext
from accounts.models import Follow
from todos.models import BibleReadingPlan, ReadingGroup, GroupMembership

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class GroupMembersLimitsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create owner
        self.owner = User.objects.create_user(
            username="group_owner",
            nickname="그룹장",
            email="owner@example.com",
            password="testpass123"
        )
        
        # Create plan
        self.plan = BibleReadingPlan.objects.create(
            name="테스트플랜",
            description="테스트",
            is_active=True,
            is_default=False,
            created_by=self.owner,
        )
        
        # Create public group
        self.group = ReadingGroup.objects.create(
            name="대규모그룹",
            description="멤버 많은 그룹",
            creator=self.owner,
            is_public=True,
            max_members=10000
        )
        self.group.plans.add(self.plan)
        
        # Add owner membership
        GroupMembership.objects.create(
            user=self.owner,
            group=self.group,
            role='admin',
            is_active=True
        )
        
        # Create 151 additional members (152 total including owner)
        self.members = [self.owner]
        for i in range(151):
            user = User.objects.create_user(
                username=f"member{i}",
                nickname=f"멤버{i}",
                email=f"member{i}@example.com"
            )
            GroupMembership.objects.create(
                user=user,
                group=self.group,
                is_active=True
            )
            self.members.append(user)

    def test_default_limit_is_enforced(self):
        """기본 limit=100이 적용되는지 검증"""
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data['success'])
        self.assertEqual(len(data['members']), 100)
        self.assertEqual(data['meta']['total_members'], 152)
        self.assertEqual(data['meta']['offset'], 0)
        self.assertEqual(data['meta']['limit'], 100)
        self.assertEqual(data['meta']['returned_members'], 100)
        self.assertTrue(data['meta']['has_more'])

    def test_custom_limit_within_bounds(self):
        """커스텀 limit이 범위 내일 때 동작 검증"""
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 50}
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data['success'])
        self.assertEqual(len(data['members']), 50)
        self.assertEqual(data['meta']['limit'], 50)
        self.assertEqual(data['meta']['returned_members'], 50)
        self.assertTrue(data['meta']['has_more'])

    def test_limit_exceeding_max_is_rejected(self):
        """limit이 최대값을 초과하면 400 에러"""
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 101}
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('limit', data['error'])

    def test_negative_limit_is_rejected(self):
        """음수 limit은 400 에러"""
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": -1}
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('limit', data['error'])

    def test_invalid_limit_is_rejected(self):
        """잘못된 타입의 limit은 400 에러"""
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": "invalid"}
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('숫자', data['error'])

    def test_pagination_with_offset(self):
        """offset 페이지네이션이 올바르게 동작하는지 검증"""
        # First page
        response1 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 50, "offset": 0}
        )
        
        self.assertEqual(response1.status_code, 200)
        data1 = response1.json()
        
        self.assertEqual(len(data1['members']), 50)
        self.assertEqual(data1['meta']['offset'], 0)
        self.assertTrue(data1['meta']['has_more'])
        
        # Second page
        response2 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 50, "offset": 50}
        )
        
        self.assertEqual(response2.status_code, 200)
        data2 = response2.json()
        
        self.assertEqual(len(data2['members']), 50)
        self.assertEqual(data2['meta']['offset'], 50)
        self.assertTrue(data2['meta']['has_more'])
        
        # Third page
        response3 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 50, "offset": 100}
        )
        
        self.assertEqual(response3.status_code, 200)
        data3 = response3.json()
        
        self.assertEqual(len(data3['members']), 50)
        self.assertEqual(data3['meta']['offset'], 100)
        self.assertTrue(data3['meta']['has_more'])

        # Fourth page (partial)
        response4 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 50, "offset": 150}
        )

        self.assertEqual(response4.status_code, 200)
        data4 = response4.json()

        self.assertEqual(len(data4['members']), 2)
        self.assertEqual(data4['meta']['offset'], 150)
        self.assertFalse(data4['meta']['has_more'])

    def test_negative_offset_is_rejected(self):
        """음수 offset은 400 에러"""
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"offset": -1}
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('offset', data['error'])

    def test_invalid_offset_is_rejected(self):
        """잘못된 타입의 offset은 400 에러"""
        response = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"offset": "invalid"}
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertIn('숫자', data['error'])

    def test_has_more_flag_is_correct(self):
        """has_more 플래그가 정확한지 검증"""
        # When there are more members
        response1 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 50, "offset": 0}
        )
        
        self.assertEqual(response1.status_code, 200)
        data1 = response1.json()
        
        self.assertTrue(data1['meta']['has_more'])
        
        # When at the end
        response2 = self.client.get(
            f"/api/v1/todos/groups/{self.group.id}/members/",
            {"limit": 100, "offset": 100}
        )
        
        self.assertEqual(response2.status_code, 200)
        data2 = response2.json()
        
        self.assertFalse(data2['meta']['has_more'])

    def test_resource_usage_is_bounded(self):
        """리소스 사용량이 제한되는지 검증"""
        # Group has 152 members, but only 100 should be returned by default
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify only 100 members returned (not 152)
        self.assertEqual(len(data['members']), 100)
        self.assertEqual(data['meta']['total_members'], 152)
        self.assertEqual(data['meta']['returned_members'], 100)
        # This prevents (152 members) from being returned in one response,
        # limiting to maximum of 100 members per request


    def test_authenticated_member_list_query_count_is_constant(self):
        """인증 사용자 멤버 목록: 페이지 크기와 무관하게 SELECT 수가 일정한지 검증 (N+1 방지)"""
        # Viewer follows several returned members so is_following=True paths execute.
        followed = self.members[-6:-1]
        for target in followed:
            Follow.objects.create(follower=self.owner, following=target)

        self.client.force_authenticate(user=self.owner)

        def _select_count_and_payload(limit):
            with CaptureQueriesContext(connection) as ctx:
                response = self.client.get(
                    f"/api/v1/todos/groups/{self.group.id}/members/?limit={limit}"
                )
            selects = [
                q for q in ctx.captured_queries
                if q['sql'].lstrip().upper().startswith('SELECT')
            ]
            return len(selects), response

        one_selects, one_resp = _select_count_and_payload(1)
        many_selects, many_resp = _select_count_and_payload(100)

        self.assertEqual(one_resp.status_code, 200)
        self.assertEqual(many_resp.status_code, 200)
        one_data = one_resp.json()
        many_data = many_resp.json()
        self.assertTrue(one_data['success'])
        self.assertTrue(many_data['success'])

        self.assertEqual(len(one_data['members']), 1)
        self.assertEqual(len(many_data['members']), 100)

        # Constant query count: large page uses no more than one extra SELECT.
        self.assertLessEqual(many_selects, one_selects + 1)
        # Conservative absolute ceiling independent of page size.
        self.assertLessEqual(many_selects, 6)

        followed_ids = {u.id for u in followed}
        users = [m['user'] for m in many_data['members']]
        following_flags = [u for u in users if u['id'] in followed_ids]
        self.assertTrue(following_flags)
        self.assertTrue(any(u['is_following'] for u in following_flags))
        self.assertTrue(any(not u['is_following'] for u in users))
        for u in users:
            self.assertIn('total_completed_days', u)


@override_settings(ROOT_URLCONF="config.urls")
class GroupMembersPrivateGroupTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create owner
        self.owner = User.objects.create_user(
            username="private_owner",
            nickname="비공개그룹장",
            email="private_owner@example.com",
            password="testpass123"
        )
        
        # Create non-member
        self.outsider = User.objects.create_user(
            username="outsider",
            nickname="외부인",
            email="outsider@example.com",
            password="testpass123"
        )
        
        # Create plan
        self.plan = BibleReadingPlan.objects.create(
            name="비공개그룹플랜",
            description="테스트",
            is_active=True,
            is_default=False,
            created_by=self.owner,
        )
        
        # Create private group
        self.group = ReadingGroup.objects.create(
            name="비공개그룹",
            description="비공개 그룹",
            creator=self.owner,
            is_public=False,
            max_members=100
        )
        self.group.plans.add(self.plan)
        
        # Add owner membership
        GroupMembership.objects.create(
            user=self.owner,
            group=self.group,
            role='admin',
            is_active=True
        )

    def test_private_group_members_require_authentication(self):
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")
        
        self.assertEqual(response.status_code, 404)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertEqual(data['error'], '그룹을 찾을 수 없습니다.')

    def test_private_group_members_require_membership(self):
        self.client.force_authenticate(user=self.outsider)
        
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")
        
        self.assertEqual(response.status_code, 404)
        data = response.json()
        
        self.assertFalse(data['success'])
        self.assertEqual(data['error'], '그룹을 찾을 수 없습니다.')

    def test_private_group_member_can_view_members_list(self):
        """비공개 그룹 멤버는 멤버 목록 조회 가능"""
        self.client.force_authenticate(user=self.owner)
        
        response = self.client.get(f"/api/v1/todos/groups/{self.group.id}/members/")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data['success'])
        self.assertEqual(len(data['members']), 1)  # Only owner

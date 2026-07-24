"""
Test for N+1 query optimization in DailyBibleScheduleViewSet
"""
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient
from todos.models import BibleReadingPlan, DailyBibleSchedule
from datetime import date, timedelta


User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class DailyBibleScheduleNPlusOneTest(TestCase):
    """
    Test that DailyBibleScheduleViewSet does not have N+1 query issues.
    
    The serializer accesses obj.plan.name (requires select_related('plan')).
    
    Without optimization, listing 50 schedules would cause:
    - 1 query for schedules
    - 50 queries for plans
    = 51 queries total
    
    With optimization, it should be constant (around 2-3 queries).
    """
    
    def setUp(self):
        self.client = APIClient()
        
        # Create admin user
        self.admin = User.objects.create_user(
            username='admin',
            password='testpass123',
            is_staff=True,
            is_superuser=True
        )
        
        # Create plans
        self.plan1 = BibleReadingPlan.objects.create(
            name='Plan 1',
            description='Test plan 1',
            is_active=True,
            created_by=self.admin
        )
        self.plan2 = BibleReadingPlan.objects.create(
            name='Plan 2',
            description='Test plan 2',
            is_active=True,
            created_by=self.admin
        )
    
    def test_list_schedules_has_no_n_plus_one_queries(self):
        """Listing schedules should use constant queries regardless of schedule count"""
        # Create 50 schedules across multiple plans
        base_date = date.today()
        for i in range(50):
            plan = self.plan1 if i % 2 == 0 else self.plan2
            DailyBibleSchedule.objects.create(
                plan=plan,
                date=base_date + timedelta(days=i),
                book='gen',
                start_chapter=i + 1,
                end_chapter=i + 1
            )
        
        self.client.force_authenticate(user=self.admin)
        
        # Count queries for listing schedules
        with CaptureQueriesContext(connection) as context:
            response = self.client.get('/api/v1/todos/schedules/')
            self.assertEqual(response.status_code, 200)
        
        num_queries = len(context.captured_queries)
        
        # Should be around 2-3 queries:
        # 1. SELECT schedules with select_related('plan')
        # 2. Possibly auth/session query
        # Should NOT be 51+ queries (1 + 50 for N+1)
        self.assertLess(
            num_queries,
            5,
            f"Expected <5 queries but got {num_queries}. "
            f"This suggests N+1 query issue. Queries:\n" +
            "\n".join([q['sql'] for q in context.captured_queries])
        )
        
        # Verify response data is correct
        data = response.json()
        self.assertEqual(len(data), 50)
        
        # Verify all schedules have plan_name (no None due to missing select_related)
        for schedule_data in data:
            self.assertIsNotNone(schedule_data.get('plan_name'))
            self.assertIn(schedule_data['plan_name'], ['Plan 1', 'Plan 2'])
    
    def test_filter_by_plan_id_has_no_n_plus_one(self):
        """Filtering schedules by plan_id should also avoid N+1"""
        # Create schedules for plan1
        base_date = date.today()
        for i in range(30):
            DailyBibleSchedule.objects.create(
                plan=self.plan1,
                date=base_date + timedelta(days=i),
                book='gen',
                start_chapter=i + 1,
                end_chapter=i + 1
            )
        
        self.client.force_authenticate(user=self.admin)
        
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(f'/api/v1/todos/schedules/?plan_id={self.plan1.id}')
            self.assertEqual(response.status_code, 200)
        
        num_queries = len(context.captured_queries)
        
        # Should be <5 queries
        self.assertLess(
            num_queries,
            5,
            f"Expected <5 queries but got {num_queries} when filtering by plan_id"
        )
        
        # Verify data
        data = response.json()
        self.assertEqual(len(data), 30)
        for schedule_data in data:
            self.assertEqual(schedule_data['plan_name'], 'Plan 1')

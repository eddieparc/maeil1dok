"""
Test for N+1 query optimization in BibleReadingPlanViewSet
"""
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient
from todos.models import BibleReadingPlan, PlanSubscription
from datetime import date
import warnings
from django.core.paginator import UnorderedObjectListWarning


User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class BibleReadingPlanNPlusOneTest(TestCase):
    """
    Test that BibleReadingPlanViewSet does not have N+1 query issues.
    
    The serializer accesses:
    1. obj.created_by.username (requires select_related('created_by'))
    2. obj.plansubscription_set.filter(is_active=True).count() (requires annotate)
    
    Without optimization, listing 10 plans would cause:
    - 1 query for plans
    - 10 queries for created_by
    - 10 queries for subscription counts
    = 21 queries total
    
    With optimization, it should be constant (around 2-3 queries regardless of plan count).
    """
    
    def setUp(self):
        self.client = APIClient()
        
        # Create admin user
        self.admin = User.objects.create_user(
            username='admin',
            nickname='관리자',
            password='testpass123',
            is_staff=True,
            is_superuser=True
        )
        
        # Create plan creators
        self.creator1 = User.objects.create_user(
            username='creator1', nickname='제작자1', password='pass'
        )
        self.creator2 = User.objects.create_user(
            username='creator2', nickname='제작자2', password='pass'
        )
        
        # Create subscriber users
        self.users = [
            User.objects.create_user(
                username=f'user{i}', nickname=f'구독자{i}', password='pass'
            )
            for i in range(5)
        ]
    
    def test_list_plans_has_no_n_plus_one_queries(self):
        """Listing plans should use constant queries regardless of plan count"""
        # Create 10 plans with subscriptions
        for i in range(10):
            creator = self.creator1 if i % 2 == 0 else self.creator2
            plan = BibleReadingPlan.objects.create(
                name=f'Plan {i}',
                description=f'Test plan {i}',
                is_active=True,
                created_by=creator
            )
            
            # Add some subscriptions
            for user in self.users[:i % 3]:
                PlanSubscription.objects.create(
                    user=user,
                    plan=plan,
                    start_date=date.today(),
                    is_active=True
                )
        
        self.client.force_authenticate(user=self.admin)
        
        # Count queries for listing plans
        with CaptureQueriesContext(connection) as context:
            response = self.client.get('/api/v1/todos/bible-plans/')
            self.assertEqual(response.status_code, 200)
        
        num_queries = len(context.captured_queries)
        
        # Should be around 2-3 queries:
        # 1. SELECT plans with select_related('created_by') and annotate(subscriber_count)
        # 2. Possibly auth/session query
        # Should NOT be 21+ queries (1 + 10*2 for N+1)
        self.assertLess(
            num_queries,
            5,
            f"Expected <5 queries but got {num_queries}. "
            f"This suggests N+1 query issue. Queries:\n" +
            "\n".join([q['sql'] for q in context.captured_queries])
        )
        
        # Verify response data is correct (paginated response envelope)
        results = response.json()['results']
        self.assertEqual(len(results), 10)
        
        # Verify all plans have created_by_username (no None due to missing select_related)
        for plan_data in results:
            self.assertIsNotNone(plan_data.get('created_by_username'))
            self.assertIn('subscriber_count', plan_data)
    
    def test_regular_user_cannot_list_plans(self):
        """Plan management is admin-only; regular users are denied by default."""
        for i in range(5):
            plan = BibleReadingPlan.objects.create(
                name=f'Plan {i}',
                description=f'Test plan {i}',
                is_active=True,
                created_by=self.creator1
            )
            PlanSubscription.objects.create(
                user=self.users[0],
                plan=plan,
                start_date=date.today(),
                is_active=True
            )

        self.client.force_authenticate(user=self.users[0])
        response = self.client.get('/api/v1/todos/bible-plans/')

        # Deny-by-default: the ModelViewSet requires IsAdminUser.
        self.assertEqual(response.status_code, 403)
    
    def test_subscriber_count_annotation_is_correct(self):
        """Verify the annotated subscriber_count matches actual active subscriptions"""
        plan = BibleReadingPlan.objects.create(
            name='Test Plan',
            description='Test',
            is_active=True,
            created_by=self.creator1
        )
        
        # Create active subscriptions
        for user in self.users[:3]:
            PlanSubscription.objects.create(
                user=user,
                plan=plan,
                start_date=date.today(),
                is_active=True
            )
        
        # Create inactive subscription (should not count)
        PlanSubscription.objects.create(
            user=self.users[3],
            plan=plan,
            start_date=date.today(),
            is_active=False
        )
        
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/todos/bible-plans/')
        self.assertEqual(response.status_code, 200)
        
        results = response.json()['results']
        plan_data = next(p for p in results if p['name'] == 'Test Plan')
        
        # Should have 3 active subscribers
        self.assertEqual(plan_data['subscriber_count'], 3)

    def test_plan_list_is_deterministically_ordered(self):
        """Paginated plan lists must have a stable ORDER BY to avoid skips/dupes."""
        # Names created out of order to prove server-side ordering, not insertion order.
        BibleReadingPlan.objects.create(
            name='Zeta', description='z', is_active=True,
            is_default=False, created_by=self.creator1,
        )
        BibleReadingPlan.objects.create(
            name='Alpha', description='a', is_active=True,
            is_default=False, created_by=self.creator1,
        )
        default_plan = BibleReadingPlan.objects.create(
            name='Mid', description='m', is_active=True,
            is_default=True, created_by=self.creator1,
        )

        self.client.force_authenticate(user=self.admin)

        with warnings.catch_warnings():
            warnings.simplefilter('error', UnorderedObjectListWarning)
            response = self.client.get('/api/v1/todos/bible-plans/')
            self.assertEqual(response.status_code, 200)

        names = [p['name'] for p in response.json()['results']]
        # Default plan first, then remaining plans alphabetically by name.
        self.assertEqual(names[0], default_plan.name)
        self.assertEqual(names, ['Mid', 'Alpha', 'Zeta'])

    def test_set_default_missing_plan_does_not_clear_existing_default(self):
        default_plan = BibleReadingPlan.objects.create(
            name='Current Default', description='default', is_active=True,
            is_default=True, created_by=self.creator1,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/v1/todos/bible-plans/999999/set_default/')

        self.assertEqual(response.status_code, 404)
        default_plan.refresh_from_db()
        self.assertTrue(default_plan.is_default)

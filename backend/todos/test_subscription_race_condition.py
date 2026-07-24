"""
Test suite for PlanSubscription race condition protection.

Tests verify that concurrent subscription requests are handled correctly
without duplicate subscriptions or unhandled database errors.
"""
import threading
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from todos.models import BibleReadingPlan, PlanSubscription, UserVideoIntroProgress, VideoBibleIntro
from datetime import date

User = get_user_model()
SUBSCRIPTIONS_URL = '/api/v1/todos/plan/'


class SubscriptionRaceConditionTestCase(TransactionTestCase):
    """
    Race condition tests require TransactionTestCase because:
    1. We need real database commits (not just in-memory rollback)
    2. We're testing concurrent access patterns with threading
    3. We rely on actual unique_together constraint enforcement
    """

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            nickname='Test User'
        )
        self.plan = BibleReadingPlan.objects.create(
            name='Test Plan',
            description='Test Description',
            is_active=True,
            created_by=self.user
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_duplicate_subscription_prevented_by_get_or_create(self):
        """Test that duplicate subscriptions return 400 instead of creating duplicates"""
        # First subscription should succeed
        response1 = self.client.post(SUBSCRIPTIONS_URL, {
            'plan': self.plan.id
        })
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PlanSubscription.objects.filter(user=self.user, plan=self.plan).count(), 1)

        # Second subscription should fail with 400
        response2 = self.client.post(SUBSCRIPTIONS_URL, {
            'plan': self.plan.id
        })
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('이미 구독 중인 플랜입니다', response2.data['detail'])
        
        # Still only one subscription
        self.assertEqual(PlanSubscription.objects.filter(user=self.user, plan=self.plan).count(), 1)

    def test_anonymous_subscription_post_is_denied_before_public_plan_listing(self):
        anonymous_client = APIClient()

        response = anonymous_client.post(SUBSCRIPTIONS_URL, {
            'plan': self.plan.id
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(PlanSubscription.objects.count(), 0)

    def test_concurrent_subscription_requests_no_duplicates(self):
        """Test that concurrent subscription requests don't create duplicates"""
        results = []
        errors = []
        
        def create_subscription():
            try:
                # Create a new client for each thread
                client = APIClient()
                client.force_authenticate(user=self.user)
                response = client.post(SUBSCRIPTIONS_URL, {
                    'plan': self.plan.id
                })
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # Start 5 concurrent threads trying to subscribe to the same plan
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=create_subscription)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # No unhandled errors
        self.assertEqual(len(errors), 0, f"Unexpected errors: {errors}")
        
        # Exactly one 201 CREATED, rest are 400 BAD_REQUEST
        created_count = results.count(status.HTTP_201_CREATED)
        bad_request_count = results.count(status.HTTP_400_BAD_REQUEST)
        
        self.assertEqual(created_count, 1, "Should have exactly one successful creation")
        self.assertEqual(bad_request_count, 4, "Other 4 requests should be rejected")
        
        # Database should have exactly one subscription
        subscription_count = PlanSubscription.objects.filter(
            user=self.user,
            plan=self.plan
        ).count()
        self.assertEqual(subscription_count, 1, "Should have exactly one subscription in database")

    def test_concurrent_subscriptions_different_plans(self):
        """Test that concurrent subscriptions to different plans work correctly"""
        plan2 = BibleReadingPlan.objects.create(
            name='Test Plan 2',
            description='Test Description 2',
            is_active=True,
            created_by=self.user
        )
        
        results = {'plan1': [], 'plan2': []}
        errors = []
        
        def subscribe_to_plan(plan, result_key):
            try:
                client = APIClient()
                client.force_authenticate(user=self.user)
                response = client.post(SUBSCRIPTIONS_URL, {
                    'plan': plan.id
                })
                results[result_key].append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # 3 threads for plan1, 3 threads for plan2
        threads = []
        for _ in range(3):
            t1 = threading.Thread(target=subscribe_to_plan, args=(self.plan, 'plan1'))
            t2 = threading.Thread(target=subscribe_to_plan, args=(plan2, 'plan2'))
            threads.extend([t1, t2])
            t1.start()
            t2.start()
        
        for thread in threads:
            thread.join()
        
        self.assertEqual(len(errors), 0, f"Unexpected errors: {errors}")
        
        # Each plan should have exactly one successful subscription
        self.assertEqual(results['plan1'].count(status.HTTP_201_CREATED), 1)
        self.assertEqual(results['plan2'].count(status.HTTP_201_CREATED), 1)
        
        # Database verification
        self.assertEqual(PlanSubscription.objects.filter(user=self.user).count(), 2)
        self.assertEqual(PlanSubscription.objects.filter(user=self.user, plan=self.plan).count(), 1)
        self.assertEqual(PlanSubscription.objects.filter(user=self.user, plan=plan2).count(), 1)

    def test_inactive_plan_rejected_before_race_window(self):
        """Test that inactive plan check happens before subscription creation"""
        self.plan.is_active = False
        self.plan.save()
        
        response = self.client.post(SUBSCRIPTIONS_URL, {
            'plan': self.plan.id
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('신규 구독이 중단된', response.data['detail'])
        self.assertEqual(PlanSubscription.objects.filter(user=self.user, plan=self.plan).count(), 0)

    def test_nonexistent_plan_rejected_gracefully(self):
        """Test that nonexistent plan returns 404"""
        response = self.client.post(SUBSCRIPTIONS_URL, {
            'plan': 99999
        })
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('존재하지 않는 플랜', response.data['detail'])

    def test_subscription_start_date_set_correctly(self):
        """Test that subscription start_date is set to current date"""
        response = self.client.post(SUBSCRIPTIONS_URL, {
            'plan': self.plan.id
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        subscription = PlanSubscription.objects.get(user=self.user, plan=self.plan)
        self.assertEqual(subscription.start_date, date.today())

    def test_default_subscription_cannot_be_deactivated_via_detail_put(self):
        self.plan.is_default = True
        self.plan.save(update_fields=['is_default'])
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )

        response = self.client.put(
            f'{SUBSCRIPTIONS_URL}{subscription.id}/',
            {'is_active': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        subscription.refresh_from_db()
        self.assertTrue(subscription.is_active)

    def test_non_default_subscription_can_be_deactivated_via_detail_put(self):
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )

        response = self.client.put(
            f'{SUBSCRIPTIONS_URL}{subscription.id}/',
            {'is_active': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        subscription.refresh_from_db()
        self.assertFalse(subscription.is_active)

    def test_inactive_plan_subscription_cannot_be_reactivated_via_detail_put(self):
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=False,
        )
        self.plan.is_active = False
        self.plan.save(update_fields=['is_active'])

        response = self.client.put(
            f'{SUBSCRIPTIONS_URL}{subscription.id}/',
            {'is_active': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('중단된 플랜', str(response.data))
        subscription.refresh_from_db()
        self.assertFalse(subscription.is_active)

    def test_inactive_plan_subscription_cannot_be_reactivated_via_toggle(self):
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=False,
        )
        self.plan.is_active = False
        self.plan.save(update_fields=['is_active'])

        response = self.client.post(f'{SUBSCRIPTIONS_URL}{subscription.id}/toggle-active/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('중단된 플랜', response.data['detail'])
        subscription.refresh_from_db()
        self.assertFalse(subscription.is_active)

    def test_detail_put_cannot_rewrite_subscription_start_date(self):
        original_start_date = date(2026, 1, 1)
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=original_start_date,
            is_active=True,
        )

        response = self.client.put(
            f'{SUBSCRIPTIONS_URL}{subscription.id}/',
            {'start_date': '2026-12-31', 'is_active': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        subscription.refresh_from_db()
        self.assertEqual(subscription.start_date, original_start_date)

    def test_detail_delete_removes_video_intro_progress_for_subscription_plan(self):
        subscription = PlanSubscription.objects.create(
            user=self.user,
            plan=self.plan,
            start_date=date.today(),
            is_active=True,
        )
        video_intro = VideoBibleIntro.objects.create(
            plan=self.plan,
            book='Genesis',
            url_link='https://example.com/genesis',
            start_date=date.today(),
            end_date=date.today(),
        )
        progress = UserVideoIntroProgress.objects.create(
            user=self.user,
            video_intro=video_intro,
            is_completed=True,
        )

        response = self.client.delete(f'{SUBSCRIPTIONS_URL}{subscription.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(UserVideoIntroProgress.objects.filter(pk=progress.pk).exists())

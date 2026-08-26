from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from todos.models import (
    BibleReadingPlan,
    CatchupSession,
    DailyBibleSchedule,
    PlanSubscription,
    UserBibleProgress,
    UserPlanDisplaySettings,
    UserVideoIntroProgress,
    VideoBibleIntro,
)

User = get_user_model()
SUBSCRIPTIONS_URL = '/api/v1/todos/plan/'


class PlanSubscriptionDestructiveEndpointTestCase(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='user-a',
            password='testpass123',
            nickname='User A',
        )
        self.user_b = User.objects.create_user(
            username='user-b',
            password='testpass123',
            nickname='User B',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user_a)

        self.default_plan = BibleReadingPlan.objects.create(
            name='Default Plan',
            description='Default protected plan',
            is_default=True,
            is_active=True,
            created_by=self.user_a,
        )
        self.plan_p1 = BibleReadingPlan.objects.create(
            name='Plan P1',
            description='Destructive endpoint plan',
            is_active=True,
            created_by=self.user_a,
        )
        self.plan_p2 = BibleReadingPlan.objects.create(
            name='Plan P2',
            description='Survivor plan',
            is_active=True,
            created_by=self.user_a,
        )

        self.default_subscription = self.create_subscription(self.user_a, self.default_plan)
        self.subscription_a_p1 = self.create_subscription(self.user_a, self.plan_p1)
        self.subscription_b_p1 = self.create_subscription(self.user_b, self.plan_p1)
        self.subscription_a_p2 = self.create_subscription(self.user_a, self.plan_p2)

        self.schedule_p1 = DailyBibleSchedule.objects.create(
            plan=self.plan_p1,
            date=date(2026, 1, 1),
            book='Genesis',
            start_chapter=1,
            end_chapter=2,
        )
        self.schedule_p2 = DailyBibleSchedule.objects.create(
            plan=self.plan_p2,
            date=date(2026, 1, 2),
            book='Exodus',
            start_chapter=1,
            end_chapter=1,
        )
        self.progress_a_p1 = UserBibleProgress.objects.create(
            subscription=self.subscription_a_p1,
            schedule=self.schedule_p1,
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.progress_b_p1 = UserBibleProgress.objects.create(
            subscription=self.subscription_b_p1,
            schedule=self.schedule_p1,
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.progress_a_p2 = UserBibleProgress.objects.create(
            subscription=self.subscription_a_p2,
            schedule=self.schedule_p2,
            is_completed=True,
            completed_at=timezone.now(),
        )

        self.video_intro_p1 = VideoBibleIntro.objects.create(
            plan=self.plan_p1,
            book='Genesis',
            url_link='https://example.com/genesis-intro',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 3),
        )
        self.video_progress_a_p1 = UserVideoIntroProgress.objects.create(
            user=self.user_a,
            video_intro=self.video_intro_p1,
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.video_progress_b_p1 = UserVideoIntroProgress.objects.create(
            user=self.user_b,
            video_intro=self.video_intro_p1,
            is_completed=True,
            completed_at=timezone.now(),
        )
        self.display_settings_a_p1 = UserPlanDisplaySettings.objects.get(
            subscription=self.subscription_a_p1,
        )
        self.display_settings_a_p1.color = '#123456'
        self.display_settings_a_p1.display_order = 1
        self.display_settings_a_p1.save(update_fields=['color', 'display_order'])
        self.catchup_session_a_p1 = CatchupSession.objects.create(
            subscription=self.subscription_a_p1,
            name='P1 catchup',
            range_start=date(2026, 1, 1),
            range_end=date(2026, 1, 2),
            status='active',
        )

    def create_subscription(self, user, plan):
        return PlanSubscription.objects.create(
            user=user,
            plan=plan,
            start_date=date(2026, 1, 1),
        )

    def detail_url(self, subscription):
        return f'{SUBSCRIPTIONS_URL}{subscription.pk}/'

    def assert_no_seed_data_deleted(self):
        self.assertTrue(PlanSubscription.objects.filter(pk=self.default_subscription.pk).exists())
        self.assertTrue(PlanSubscription.objects.filter(pk=self.subscription_a_p1.pk).exists())
        self.assertTrue(PlanSubscription.objects.filter(pk=self.subscription_b_p1.pk).exists())
        self.assertTrue(PlanSubscription.objects.filter(pk=self.subscription_a_p2.pk).exists())
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_a_p1.pk).exists())
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_b_p1.pk).exists())
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_a_p2.pk).exists())
        self.assertTrue(UserVideoIntroProgress.objects.filter(pk=self.video_progress_a_p1.pk).exists())
        self.assertTrue(UserVideoIntroProgress.objects.filter(pk=self.video_progress_b_p1.pk).exists())
        self.assertTrue(UserPlanDisplaySettings.objects.filter(pk=self.display_settings_a_p1.pk).exists())
        self.assertTrue(CatchupSession.objects.filter(pk=self.catchup_session_a_p1.pk).exists())
        self.assertTrue(DailyBibleSchedule.objects.filter(pk=self.schedule_p1.pk).exists())
        self.assertTrue(VideoBibleIntro.objects.filter(pk=self.video_intro_p1.pk).exists())

    def assert_p1_user_a_artifacts_deleted(self):
        self.assertFalse(PlanSubscription.objects.filter(pk=self.subscription_a_p1.pk).exists())
        self.assertFalse(UserBibleProgress.objects.filter(pk=self.progress_a_p1.pk).exists())
        self.assertFalse(UserVideoIntroProgress.objects.filter(pk=self.video_progress_a_p1.pk).exists())
        self.assertFalse(UserPlanDisplaySettings.objects.filter(pk=self.display_settings_a_p1.pk).exists())
        self.assertFalse(CatchupSession.objects.filter(pk=self.catchup_session_a_p1.pk).exists())

    def assert_p1_survivors_intact(self):
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_b_p1.pk).exists())
        self.assertTrue(UserVideoIntroProgress.objects.filter(pk=self.video_progress_b_p1.pk).exists())
        self.assertTrue(PlanSubscription.objects.filter(pk=self.subscription_a_p2.pk).exists())
        self.assertTrue(UserBibleProgress.objects.filter(pk=self.progress_a_p2.pk).exists())
        self.assertTrue(DailyBibleSchedule.objects.filter(pk=self.schedule_p1.pk).exists())
        self.assertTrue(VideoBibleIntro.objects.filter(pk=self.video_intro_p1.pk).exists())


class PlanSubscriptionDeleteBehaviorTests(PlanSubscriptionDestructiveEndpointTestCase):
    def test_anonymous_delete_is_denied_without_deleting_anything(self):
        anonymous_client = APIClient()

        response = anonymous_client.delete(self.detail_url(self.subscription_a_p1))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assert_no_seed_data_deleted()

    def test_delete_foreign_subscription_returns_404_without_deleting_owner_data(self):
        self.client.force_authenticate(user=self.user_b)

        response = self.client.delete(self.detail_url(self.subscription_a_p1))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assert_no_seed_data_deleted()

    def test_delete_nonexistent_subscription_returns_404(self):
        response = self.client.delete(f'{SUBSCRIPTIONS_URL}999999/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assert_no_seed_data_deleted()

    def test_delete_default_plan_subscription_is_rejected(self):
        response = self.client.delete(self.detail_url(self.default_subscription))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('기본 플랜', response.data['detail'])
        self.assertTrue(PlanSubscription.objects.filter(pk=self.default_subscription.pk).exists())

    def test_delete_removes_only_requesting_users_plan_artifacts(self):
        response = self.client.delete(self.detail_url(self.subscription_a_p1))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assert_p1_user_a_artifacts_deleted()
        self.assert_p1_survivors_intact()

    def test_resubscribe_after_delete_creates_fresh_subscription_without_progress(self):
        delete_response = self.client.delete(self.detail_url(self.subscription_a_p1))
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        response = self.client.post(SUBSCRIPTIONS_URL, {'plan': self.plan_p1.pk})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_subscription = PlanSubscription.objects.get(user=self.user_a, plan=self.plan_p1)
        self.assertNotEqual(new_subscription.pk, self.subscription_a_p1.pk)
        self.assertEqual(UserBibleProgress.objects.filter(subscription=new_subscription).count(), 0)
        self.assertEqual(
            UserVideoIntroProgress.objects.filter(
                user=self.user_a,
                video_intro__plan=self.plan_p1,
            ).count(),
            0,
        )
        self.assert_p1_survivors_intact()


class PlanSubscriptionDeleteApiTests(PlanSubscriptionDestructiveEndpointTestCase):
    def test_delete_default_plan_subscription_is_rejected(self):
        response = self.client.delete(self.detail_url(self.default_subscription))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('기본 플랜', response.data['detail'])
        self.assertTrue(PlanSubscription.objects.filter(pk=self.default_subscription.pk).exists())

    def test_delete_foreign_subscription_returns_404_without_deleting_owner_data(self):
        self.client.force_authenticate(user=self.user_b)

        response = self.client.delete(self.detail_url(self.subscription_a_p1))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assert_no_seed_data_deleted()

    def test_delete_deletes_only_requesting_users_plan_artifacts(self):
        response = self.client.delete(self.detail_url(self.subscription_a_p1))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assert_p1_user_a_artifacts_deleted()
        self.assert_p1_survivors_intact()

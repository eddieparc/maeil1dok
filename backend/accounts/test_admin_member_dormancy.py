"""Exercise operational dormancy through HTTP and the real sender/scoreboard surfaces."""
from datetime import datetime, time, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Follow, User
from accounts.test_admin_members_api import BASE, client_for
from todos.models import (
    BibleReadingPlan, DailyBibleSchedule, GroupMembership, Notification,
    NotificationSettings, PlanSubscription, ReadingGroup, UserBibleProgress,
)
from todos.services.notifications import (
    ensure_reminder_notifications, notify_friend_hasena_completed, send_due_reminder_notifications,
)
from todos.services.push_notifications import deliver_push_notification


class MemberDormancyIntegrationTests(TestCase):
    def setUp(self):
        self.enterContext(patch('django.utils.timezone.now', return_value=datetime(2026, 3, 2, 20)))
        cache.clear()
        self.staff = User.objects.create_user(username='dormant-admin', nickname='dormant-admin', is_staff=True)
        self.user = User.objects.create_user(username='dormant-reader', nickname='dormant-reader')
        self.friend = User.objects.create_user(username='dormant-friend', nickname='dormant-friend')
        self.client = client_for(self.staff)
        self.preferences = NotificationSettings.objects.create(user=self.user,
            reading_reminder_time=time(20), hasena_reminder_time=time(20))
        self.plan = BibleReadingPlan.objects.create(name='dormancy plan', created_by=self.staff)
        subscription = PlanSubscription.objects.create(user=self.user, plan=self.plan, start_date=timezone.now().date())
        self.schedule = DailyBibleSchedule.objects.create(plan=self.plan, date=timezone.now().date(),
            book='gen', start_chapter=1, end_chapter=1)
        UserBibleProgress.objects.create(subscription=subscription, schedule=self.schedule, is_completed=True,
            completed_at=timezone.now())
        Follow.objects.create(follower=self.friend, following=self.user)
        Follow.objects.create(follower=self.user, following=self.friend)
        self.group = ReadingGroup.objects.create(name='dormancy group', creator=self.friend, is_public=True)
        self.group.plans.add(self.plan)
        GroupMembership.objects.create(group=self.group, user=self.user)

    def action(self, action):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f'{BASE}{self.user.pk}/actions/', {'action': action}, format='json')
        self.assertEqual(response.status_code, 200, response.content)

    def test_pause_and_resume_all_senders_without_changing_preferences(self):
        before = NotificationSettings.objects.values().get(pk=self.preferences.pk)
        self.action('set_dormant')
        ensure_reminder_notifications(self.user)
        send_due_reminder_notifications()
        notify_friend_hasena_completed(self.friend, timezone.now().date())
        self.assertFalse(Notification.objects.filter(recipient=self.user).exists())
        self.assertEqual(NotificationSettings.objects.values().get(pk=self.preferences.pk), before)
        queued = Notification.objects.create(recipient=self.user, type='system', title='queued', body='queued')
        with patch('todos.services.push_notifications.is_web_push_configured', return_value=True):
            self.assertEqual(deliver_push_notification(queued.pk)['skipped'], 'account_paused')
        self.action('clear_dormant')
        ensure_reminder_notifications(self.user)
        self.assertTrue(Notification.objects.filter(recipient=self.user, type='hasena_reminder').exists())
        self.assertEqual(NotificationSettings.objects.values().get(pk=self.preferences.pk), before)

    def test_global_friend_group_and_own_cached_rank_exclude_then_restore(self):
        surfaces = [
            (APIClient(), '/api/v1/todos/scoreboard/'),
            (client_for(self.friend), '/api/v1/todos/scoreboard/friends/'),
            (APIClient(), f'/api/v1/todos/scoreboard/group/{self.group.pk}/'),
        ]
        for client, route in surfaces:
            response = client.get(route)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertIn(self.user.pk, {row['user']['id'] for row in response.data['leaderboard']})
        own = client_for(self.user)
        self.assertEqual(own.get('/api/v1/todos/scoreboard/my-ranking/').status_code, 200)
        self.action('set_dormant')
        for client, route in surfaces:
            response = client.get(route)
            self.assertNotIn(self.user.pk, {row['user']['id'] for row in response.data['leaderboard']})
        self.assertIsNone(own.get('/api/v1/todos/scoreboard/my-ranking/').data['ranking']['rank'])
        self.action('clear_dormant')
        for client, route in surfaces:
            response = client.get(route)
            self.assertIn(self.user.pk, {row['user']['id'] for row in response.data['leaderboard']})

    def test_automatic_dormancy_excludes_idle_user_and_cached_board_at_boundary(self):
        old = timezone.now() - timedelta(days=30)
        User.objects.filter(pk=self.user.pk).update(date_joined=old)
        UserBibleProgress.objects.filter(subscription__user=self.user).update(updated_at=old, completed_at=old)
        now = timezone.now()
        with patch('django.utils.timezone.now', return_value=now - timedelta(seconds=10)):
            response = APIClient().get('/api/v1/todos/scoreboard/')
        self.assertIn(self.user.pk, {row['user']['id'] for row in response.data['leaderboard']})
        response = APIClient().get('/api/v1/todos/scoreboard/')
        self.assertNotIn(self.user.pk, {row['user']['id'] for row in response.data['leaderboard']})
        ensure_reminder_notifications(self.user)
        self.assertFalse(Notification.objects.filter(recipient=self.user).exists())

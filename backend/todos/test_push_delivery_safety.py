import json
import uuid
from datetime import datetime, date, timedelta
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import requests
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.db import close_old_connections
from django.db.models.query import QuerySet
from django.utils import timezone

from .models import (
    NativePushSubscription, NativePushReceipt, Notification, NotificationSettings,
    PersonalReadingRecord, BibleReadingPlan, PlanSubscription, DailyBibleSchedule, UserBibleProgress,
)
from .services.expo_push import ExpoDeliveryError, send_expo_push
from .services.push_notifications import deliver_push_notification, check_expo_push_receipts
from .services.notifications import send_due_reminder_notifications, _create_notification
from .notification_serializers import NotificationSettingsSerializer, NativePushSubscriptionRegisterSerializer


def expo_response(ticket):
    response = requests.Response()
    response.status_code = 200
    response._content = json.dumps({'data': [ticket]}).encode()
    return response


class ExpoWireContractTests(SimpleTestCase):
    def test_single_item_batch_parses_array_ticket(self):
        with patch('todos.services.expo_push.requests.post',
                   return_value=expo_response({'status': 'ok', 'id': 'receipt-1'})):
            result = send_expo_push('ExpoPushToken[fixture]', {'to': 'ExpoPushToken[fixture]'})
        self.assertEqual(result['id'], 'receipt-1')

    def test_device_not_registered_is_typed_delivery_failure(self):
        response = expo_response({'status': 'error', 'details': {'error': 'DeviceNotRegistered'}})
        with patch('todos.services.expo_push.requests.post', return_value=response):
            with self.assertRaises(ExpoDeliveryError) as caught:
                send_expo_push('ExpoPushToken[fixture]', {'to': 'ExpoPushToken[fixture]'})
        self.assertEqual(caught.exception.error_code, 'DeviceNotRegistered')


class PushDeliverySafetyTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='push-safety', nickname='push-safety')
        NotificationSettings.objects.create(user=self.user, daily_push_limit=1)
        NativePushSubscription.objects.create(
            user=self.user, token='ExpoPushToken[safety]', platform='ios',
            installation_id=uuid.uuid4(),
        )

    def test_daily_limit_one_allows_first_and_blocks_second_actual_send(self):
        with patch('django.utils.timezone.now', return_value=datetime(2026, 3, 2, 20)):
            first = Notification.objects.create(recipient=self.user, type='system', title='one', body='one')
            second = Notification.objects.create(recipient=self.user, type='system', title='two', body='two')
            with patch('todos.services.expo_push.requests.post',
                       return_value=expo_response({'status': 'ok', 'id': 'safety-ticket'})) as transport:
                first_result = deliver_push_notification(first.pk)
                second_result = deliver_push_notification(second.pk)
        self.assertEqual(first_result['sent'], 1)
        self.assertEqual(second_result['sent'], 0)
        self.assertEqual(transport.call_count, 1)

    def test_repeated_delivery_does_not_send_the_same_notification_again(self):
        NotificationSettings.objects.filter(user=self.user).update(daily_push_limit=10)
        notification = Notification.objects.create(recipient=self.user, type='system', title='one', body='one')
        with patch('todos.services.expo_push.requests.post',
                   return_value=expo_response({'status': 'ok', 'id': 'safety-ticket'})) as transport:
            first = deliver_push_notification(notification.pk)
            second = deliver_push_notification(notification.pk)
        self.assertEqual(first['sent'], 1)
        self.assertEqual(second['sent'], 0)
        self.assertEqual(transport.call_count, 1)

    def test_morning_reminder_is_not_created_when_opening_the_app_at_night(self):
        NotificationSettings.objects.filter(user=self.user).update(reading_reminders_enabled=False)
        with patch('django.utils.timezone.now', return_value=datetime(2026, 3, 2, 22)):
            self.assertEqual(send_due_reminder_notifications(), 0)
        self.assertFalse(Notification.objects.exists())

    def test_personal_streak_without_plan_and_completion_before_delivery(self):
        NotificationSettings.objects.filter(user=self.user).update(streak_reminders_enabled=True)
        PersonalReadingRecord.objects.create(user=self.user, book='gen', chapter=1, read_date=date(2026, 3, 1))
        with patch('django.utils.timezone.now', return_value=datetime(2026, 3, 2, 22)):
            self.assertEqual(send_due_reminder_notifications(), 1)
            notification = Notification.objects.get(recipient=self.user)
            self.assertEqual(notification.type, 'streak_reminder')
            self.assertEqual(notification.data['streak_scope'], 'personal')
            self.assertEqual(notification.target_url, '/bible')
            PersonalReadingRecord.objects.create(
                user=self.user, book='gen', chapter=2, read_date=date(2026, 3, 2),
            )
            with patch('todos.services.expo_push.requests.post') as transport:
                result = deliver_push_notification(notification.pk)
        self.assertEqual(result['skipped'], 'no_longer_relevant')
        transport.assert_not_called()

    @override_settings(TIME_ZONE='UTC')
    def test_streak_date_stays_seoul_when_reminder_timezone_is_los_angeles(self):
        NotificationSettings.objects.filter(user=self.user).update(
            streak_reminders_enabled=True, timezone='America/Los_Angeles',
        )
        PersonalReadingRecord.objects.create(user=self.user, book='gen', chapter=1, read_date=date(2026, 3, 2))
        with patch('django.utils.timezone.now', return_value=datetime(2026, 3, 3, 6)):
            self.assertEqual(send_due_reminder_notifications(), 1)
        notification = Notification.objects.get(recipient=self.user)
        self.assertEqual(notification.data['local_date'], '2026-03-02')
        self.assertEqual(notification.data['reading_date'], '2026-03-03')

    def test_partial_reading_targets_and_delivers_the_unfinished_chapter(self):
        today = date(2026, 3, 2)
        plan = BibleReadingPlan.objects.create(name='partial', created_by=self.user)
        subscription = PlanSubscription.objects.create(user=self.user, plan=plan, start_date=today)
        first = DailyBibleSchedule.objects.create(plan=plan, date=today, book='창세기', start_chapter=1, end_chapter=1)
        DailyBibleSchedule.objects.create(plan=plan, date=today, book='출애굽기', start_chapter=2, end_chapter=2)
        UserBibleProgress.objects.create(subscription=subscription, schedule=first, is_completed=True)
        with patch('django.utils.timezone.now', return_value=datetime(2026, 3, 2, 20)):
            self.assertEqual(send_due_reminder_notifications(), 1)
            notification = Notification.objects.get(recipient=self.user)
            self.assertIn('book=exo&chapter=2', notification.target_url)
            with patch('todos.services.expo_push.requests.post',
                       return_value=expo_response({'status': 'ok', 'id': 'partial-ticket'})):
                self.assertEqual(deliver_push_notification(notification.pk)['sent'], 1)

    def test_each_send_keeps_a_receipt_instead_of_overwriting_the_previous_one(self):
        NotificationSettings.objects.filter(user=self.user).update(daily_push_limit=10)
        notifications = [
            Notification.objects.create(recipient=self.user, type='system', title=str(i), body=str(i))
            for i in range(2)
        ]
        with patch('todos.services.expo_push.requests.post', side_effect=[
            expo_response({'status': 'ok', 'id': f'ticket-{i}'}) for i in range(2)
        ]):
            for notification in notifications:
                self.assertEqual(deliver_push_notification(notification.pk)['sent'], 1)
        NativePushReceipt.objects.update(created_at=timezone.now() - timedelta(minutes=16))
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps({'data': {f'ticket-{i}': {'status': 'ok'} for i in range(2)}}).encode()
        with patch('todos.services.expo_push.requests.post', return_value=response) as transport:
            result = check_expo_push_receipts()
        self.assertEqual(result['checked'], 2)
        self.assertEqual(transport.call_args.kwargs['json'], {'ids': ['ticket-0', 'ticket-1']})
        self.assertEqual(NativePushReceipt.objects.filter(checked_at__isnull=False).count(), 2)

    def test_old_receipt_cannot_disable_a_rotated_token(self):
        notification = Notification.objects.create(recipient=self.user, type='system', title='one', body='one')
        with patch('todos.services.expo_push.requests.post',
                   return_value=expo_response({'status': 'ok', 'id': 'old-token-ticket'})):
            deliver_push_notification(notification.pk)
        NativePushReceipt.objects.update(created_at=timezone.now() - timedelta(minutes=16))
        NativePushSubscription.objects.filter(user=self.user).update(token='ExpoPushToken[rotated]')
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps({'data': {
            'old-token-ticket': {'status': 'error', 'details': {'error': 'DeviceNotRegistered'}},
        }}).encode()
        with patch('todos.services.expo_push.requests.post', return_value=response):
            result = check_expo_push_receipts()
        self.assertEqual(result['disabled'], 0)
        self.assertTrue(NativePushSubscription.objects.get(user=self.user).enabled)

    def test_reassigned_subscription_is_not_sent_the_previous_accounts_notification(self):
        other = get_user_model().objects.create_user(username='next-owner', nickname='next-owner')
        notification = Notification.objects.create(recipient=self.user, type='system', title='private', body='private')
        original_iter = QuerySet.__iter__
        reassigned = False

        def change_owner_after_selection(queryset):
            nonlocal reassigned
            if queryset.model is NativePushSubscription and not queryset.query.select_for_update and not reassigned:
                selected = list(original_iter(queryset))
                reassigned = True
                NativePushSubscription.objects.filter(user=self.user).update(user=other)
                return iter(selected)
            return original_iter(queryset)

        with patch.object(QuerySet, '__iter__', change_owner_after_selection):
            with patch('todos.services.expo_push.requests.post',
                       return_value=expo_response({'status': 'ok', 'id': 'private-ticket'})) as transport:
                result = deliver_push_notification(notification.pk)
        self.assertTrue(reassigned)
        self.assertEqual(result['sent'], 0)
        transport.assert_not_called()

    def test_old_receipt_cannot_disable_a_new_registration_of_the_same_ios_token(self):
        notification = Notification.objects.create(recipient=self.user, type='system', title='one', body='one')
        with patch('todos.services.expo_push.requests.post',
                   return_value=expo_response({'status': 'ok', 'id': 'pre-reinstall-ticket'})):
            deliver_push_notification(notification.pk)
        NativePushReceipt.objects.update(created_at=timezone.now() - timedelta(minutes=16))
        subscription = NativePushSubscription.objects.get(user=self.user)
        registration = NativePushSubscriptionRegisterSerializer(data={
            'token': subscription.token, 'platform': 'ios',
            'installation_id': str(subscription.installation_id), 'explicit': False,
        })
        self.assertTrue(registration.is_valid(), registration.errors)
        registration.register(self.user)
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps({'data': {
            'pre-reinstall-ticket': {'status': 'error', 'details': {'error': 'DeviceNotRegistered'}},
        }}).encode()
        with patch('todos.services.expo_push.requests.post', return_value=response):
            result = check_expo_push_receipts()
        self.assertEqual(result['disabled'], 0)
        self.assertTrue(NativePushSubscription.objects.get(user=self.user).enabled)

    def test_pause_instant_round_trips_between_utc_api_and_local_database(self):
        preferences = NotificationSettings.objects.get(user=self.user)
        serializer = NotificationSettingsSerializer(
            preferences, data={'paused_until': '2026-03-02T00:00:00Z'}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.paused_until, datetime(2026, 3, 2, 9))
        represented = NotificationSettingsSerializer(saved).data['paused_until']
        self.assertEqual(datetime.fromisoformat(represented).utcoffset(), timedelta(0))

    def test_delivery_is_enqueued_only_after_notification_commit(self):
        with patch('todos.tasks.deliver_notification_push_task.delay') as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                notification, _ = _create_notification(
                    recipient=self.user, notification_type='system', title='one', body='one',
                )
                enqueue.assert_not_called()
            enqueue.assert_called_once_with(notification.id)

    def test_pending_dispatch_only_recovers_fresh_unclaimed_notifications(self):
        from .tasks import dispatch_pending_push_notifications_task

        fresh = Notification.objects.create(recipient=self.user, type='system', title='fresh', body='fresh')
        old = Notification.objects.create(recipient=self.user, type='system', title='old', body='old')
        Notification.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(minutes=31))
        Notification.objects.create(
            recipient=self.user, type='system', title='claimed', body='claimed', push_attempted_at=timezone.now(),
        )
        with patch('todos.tasks.deliver_notification_push_task.delay') as enqueue:
            dispatch_pending_push_notifications_task()
        enqueue.assert_called_once_with(fresh.id)


class PushClaimConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='push-concurrent', nickname='push-concurrent')
        NotificationSettings.objects.create(user=self.user, daily_push_limit=1)
        NativePushSubscription.objects.create(
            user=self.user, token='ExpoPushToken[concurrent]', platform='ios',
            installation_id=uuid.uuid4(),
        )

    def _delivery(self, notification_id):
        close_old_connections()
        try:
            return deliver_push_notification(notification_id)
        finally:
            close_old_connections()

    def _while_first_provider_call_is_pending(self, same_notification):
        first = Notification.objects.create(recipient=self.user, type='system', title='one', body='one')
        second = first if same_notification else Notification.objects.create(
            recipient=self.user, type='system', title='two', body='two',
        )
        entered = Event()
        release = Event()

        def transport_response(*_args, **_kwargs):
            entered.set()
            if not release.wait(timeout=10):
                raise AssertionError('Provider response was not released')
            return expo_response({'status': 'ok', 'id': 'concurrent-ticket'})

        with patch('todos.services.expo_push.requests.post', side_effect=transport_response) as transport:
            with ThreadPoolExecutor(max_workers=2) as pool:
                first_delivery = pool.submit(self._delivery, first.id)
                try:
                    self.assertTrue(entered.wait(timeout=5), 'First delivery did not reach the provider')
                    second_result = pool.submit(self._delivery, second.id).result(timeout=5)
                    self.assertEqual(second_result['skipped'],
                                     'already_attempted' if same_notification else 'daily_limit')
                finally:
                    release.set()
                self.assertEqual(first_delivery.result(timeout=5)['sent'], 1)
        self.assertEqual(transport.call_count, 1)

    def test_duplicate_worker_does_not_repeat_inflight_delivery(self):
        self._while_first_provider_call_is_pending(same_notification=True)

    def test_another_notification_cannot_exceed_inflight_daily_budget(self):
        self._while_first_provider_call_is_pending(same_notification=False)

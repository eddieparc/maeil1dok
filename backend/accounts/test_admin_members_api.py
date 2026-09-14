"""H07 real HTTP contracts. Network mail transport is replaced by a local outbox."""
import csv
import io
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import AdminAuditLog, EmailVerificationToken, PasswordResetToken, SocialAccount, User
from accounts.services.admin_members import ACTIONS, BULK_ACTIONS
from todos.models import (
    BibleReadingPlan, DailyBibleSchedule, NotificationSettings, PersonalReadingRecord,
    PlanSubscription, UserBibleProgress, UserReadingPosition,
)

BASE = '/api/v1/admin/members/'


def client_for(user):
    token = AccessToken.for_user(user)
    token['token_version'] = user.token_version
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


def local_mail(to_email, subject, html_content, **kwargs):
    return bool(mail.send_mail(subject, '', 'isolated@example.invalid', [to_email], html_message=html_content))


class AdminMemberHTTPTests(TestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user(username='member-admin', nickname='member-admin', is_staff=True)
        self.user = User.objects.create_user(username='member-target', nickname='member-target',
                                             email='target@example.invalid', password='Test12345',
                                             has_usable_password_flag=True)
        self.other = User.objects.create_user(username='member-other', nickname='member-other')
        self.client = client_for(self.staff)
        self.mail_patch = patch('accounts.email_utils.send_email', side_effect=local_mail)
        self.mail_patch.start()
        self.addCleanup(self.mail_patch.stop)

    def action(self, action, user=None, **extra):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(f'{BASE}{(user or self.user).pk}/actions/',
                                    {'action': action, **extra}, format='json')

    def test_every_route_requires_staff_before_input_or_target_lookup(self):
        routes = [('', 'get', {}), ('stats/', 'get', {}), ('export.csv', 'get', {}),
                  (f'{self.user.pk}/', 'get', {}), (f'{self.user.pk}/activity/', 'get', {}),
                  ('999999/actions/', 'post', {'action': 'revoke_sessions'}),
                  ('bulk/', 'post', {'ids': [self.user.pk], 'action': 'revoke_sessions'})]
        for client, expected in [(APIClient(), 401), (client_for(self.other), 403)]:
            for path, method, body in routes:
                with self.subTest(path=path, expected=expected):
                    response = getattr(client, method)(BASE + path, body, format='json')
                    self.assertEqual(response.status_code, expected, response.content)
        self.assertEqual(AdminAuditLog.objects.count(), 0)

    def test_every_action_denied_to_nonstaff_and_anonymous_without_mutation(self):
        for action in ACTIONS:
            body = {'action': action}
            if action == 'unlink_social':
                body['provider'] = 'google'
            for client, status in [(APIClient(), 401), (client_for(self.other), 403)]:
                response = client.post(f'{BASE}{self.user.pk}/actions/', body, format='json')
                self.assertEqual(response.status_code, status, (action, response.content))
        self.user.refresh_from_db()
        self.assertEqual(self.user.token_version, 0)
        self.assertTrue(self.user.is_active)
        self.assertEqual(AdminAuditLog.objects.count(), 0)

    def test_list_search_filter_sort_and_server_page_50(self):
        User.objects.bulk_create([User(username=f'p{i}', nickname=f'p{i}') for i in range(52)])
        response = self.client.get(BASE)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['count'], 55)
        self.assertEqual(len(response.data['results']), 50)
        self.assertEqual(response.data['next'], 2)
        second = self.client.get(BASE, {'page': 2})
        self.assertEqual(len(second.data['results']), 5)
        for q in ['target@example.invalid', 'member-target', f'#{self.user.pk}']:
            result = self.client.get(BASE, {'q': q})
            self.assertEqual([x['id'] for x in result.data['results']], [self.user.pk])
        self.assertEqual(self.client.get(BASE, {'filter': 'staff'}).data['count'], 1)
        self.assertEqual(self.client.get(BASE, {'sort': 'joined'}).data['results'][0]['id'], self.staff.pk)
        self.user.profile.current_streak = 100
        self.user.profile.save()
        self.assertEqual(self.client.get(BASE, {'sort': 'streak'}).data['results'][0]['id'], self.user.pk)
        for params in [{'page': 0}, {'page': 'bad'}, {'filter': 'bad'}, {'sort': 'bad'}]:
            self.assertEqual(self.client.get(BASE, params).status_code, 400)

    def test_detail_read_only_settings_providers_and_exact_plan_days(self):
        SocialAccount.objects.create(user=self.user, provider='google', provider_id='public-provider-id',
                                     access_token='NEVER-EXPOSE', refresh_token='NEVER-EXPOSE', extra_data={'secret': 'NEVER-EXPOSE'})
        plan = BibleReadingPlan.objects.create(name='whole plan', created_by=self.staff)
        sub = PlanSubscription.objects.create(user=self.user, plan=plan, start_date=timezone.now().date())
        for book in ['gen', 'exo']:
            schedule = DailyBibleSchedule.objects.create(plan=plan, date=timezone.now().date(), book=book,
                                                         start_chapter=1, end_chapter=1)
            if book == 'gen':
                UserBibleProgress.objects.create(subscription=sub, schedule=schedule, is_completed=True,
                                                  completed_at=timezone.now())
        NotificationSettings.objects.create(user=self.user, reading_reminders_enabled=False)
        response = self.client.get(f'{BASE}{self.user.pk}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn('NEVER-EXPOSE', response.content.decode())
        self.assertNotIn('password', response.data)
        self.assertEqual(response.data['social_accounts'][0]['provider_id'], 'public-provider-id')
        self.assertEqual(response.data['subscriptions'][0]['percent'], 0)
        self.assertEqual(response.data['subscriptions'][0]['total_days'], 1)
        self.assertFalse(response.data['notification_settings']['reading_reminders_enabled'])
        self.assertIn('theme', response.data['reading_settings'])
        self.assertEqual(self.client.patch(f'{BASE}{self.user.pk}/', {'nickname': 'hacked'}, format='json').status_code, 405)
        self.assertEqual(self.client.delete(f'{BASE}{self.user.pk}/').status_code, 405)

    def test_activity_is_paginated_real_scoped_snapshots_not_invented_logins(self):
        PersonalReadingRecord.objects.bulk_create([
            PersonalReadingRecord(user=self.user, book='psa', chapter=i + 1, read_date=timezone.now().date())
            for i in range(55)
        ])
        PersonalReadingRecord.objects.create(user=self.other, book='gen', chapter=1, read_date=timezone.now().date())
        first = self.client.get(f'{BASE}{self.user.pk}/activity/')
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(first.data['count'], 56)
        self.assertEqual(len(first.data['results']), 50)
        second = self.client.get(f'{BASE}{self.user.pk}/activity/', {'page': 2})
        all_rows = first.data['results'] + second.data['results']
        self.assertEqual(len({(r['kind'], r['source_id']) for r in all_rows}), 56)
        self.assertNotIn('login', {r['kind'] for r in all_rows})
        self.assertEqual([r['kind'] for r in all_rows].count('signup'), 1)
        self.assertIsNone(self.client.get(f'{BASE}{self.staff.pk}/').data['last_active_at'])
        self.assertEqual(self.client.get(f'{BASE}999999/activity/').status_code, 404)

    def test_all_actions_have_explicit_state_token_and_audit_contracts(self):
        transitions = [
            ('verify_email', 'email_verified', True, 0),
            ('unverify_email', 'email_verified', False, 1),
            ('resend_verification', 'email_verified', False, 1),
            ('send_password_reset', 'email_verified', False, 1),
            ('revoke_sessions', 'email_verified', False, 2),
            ('grant_staff', 'is_staff', True, 3),
            ('revoke_staff', 'is_staff', False, 4),
            ('set_dormant', 'is_dormant', True, 4),
            ('clear_dormant', 'is_dormant', False, 4),
            ('deactivate', 'is_active', False, 5),
            ('activate', 'is_active', True, 6),
            ('schedule_deletion', 'is_active', False, 7),
            ('cancel_deletion', 'is_active', True, 8),
            ('unlink_social', 'is_active', True, 9),
        ]
        SocialAccount.objects.create(user=self.user, provider='google', provider_id='unlink-me')
        for action, field, value, version in transitions:
            with self.subTest(action=action):
                response = self.action(action, **({'provider': 'google'} if action == 'unlink_social' else {}))
                self.assertEqual(response.status_code, 200, response.content)
                self.user.refresh_from_db()
                self.assertEqual(getattr(self.user, field), value)
                self.assertEqual(self.user.token_version, version)
                self.assertEqual(response.data['token_version'], version)
                audit = AdminAuditLog.objects.latest('pk')
                self.assertEqual((audit.actor_id, audit.target_user_id, audit.action),
                                 (self.staff.pk, self.user.pk, action))
                self.assertEqual(audit.payload['outcome'], 'applied')
                if action == 'schedule_deletion':
                    self.assertAlmostEqual((self.user.scheduled_deletion_at - timezone.now()).total_seconds(),
                                           14 * 86400, delta=10)
        self.assertEqual(AdminAuditLog.objects.count(), len(ACTIONS))
        self.assertEqual(len(mail.outbox), 2)
        verification = EmailVerificationToken.objects.get(user=self.user)
        self.assertAlmostEqual((verification.expires_at - verification.created_at).total_seconds(), 1800, delta=1)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())
        self.assertFalse(self.user.social_accounts.exists())

    def test_revoke_invalidates_real_access_refresh_and_bridge(self):
        from accounts import handoff
        from accounts.views import get_tokens_for_user
        tokens = get_tokens_for_user(self.user)
        old_client = APIClient()
        old_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        issued = handoff.build_code_payload(self.user.pk)
        self.assertEqual(old_client.get('/api/v1/auth/user/').status_code, 200)
        self.assertEqual(self.action('revoke_sessions').status_code, 200)
        self.assertEqual(old_client.get('/api/v1/auth/user/').status_code, 401)
        self.assertTrue(handoff.code_is_invalidated_by_logout(cache, self.user.pk, issued['issued_at']))
        self.assertEqual(APIClient().post('/api/v1/auth/token/refresh/', {'refresh': tokens['refresh']}, format='json').status_code, 401)

    def test_last_login_method_and_social_only_reset_rejections_are_audited(self):
        self.user.set_unusable_password()
        self.user.has_usable_password_flag = False
        self.user.save()
        SocialAccount.objects.create(user=self.user, provider='google', provider_id='only-one')
        rejected = self.action('unlink_social', provider='google')
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(rejected.data['error'], 'last_login_method')
        self.assertTrue(self.user.social_accounts.exists())
        self.assertEqual(self.action('send_password_reset').data['error'], 'social_only_unverified')
        self.assertEqual(AdminAuditLog.objects.count(), 2)
        SocialAccount.objects.create(user=self.user, provider='apple', provider_id='second')
        self.assertEqual(self.action('unlink_social', provider='google').status_code, 200)
        self.assertEqual(self.action('unlink_social', provider='apple').status_code, 400)

    def test_restore_deadline_merge_and_active_identity_conflicts(self):
        self.user.is_active = False
        self.user.scheduled_deletion_at = timezone.now() - timedelta(seconds=1)
        self.user.save()
        self.assertEqual(self.action('cancel_deletion').data['error'], 'account_not_restorable')
        self.assertEqual(self.action('activate').data['error'], 'cancel_deletion_first')
        self.user.scheduled_deletion_at = None
        self.user.save()
        User.objects.create_user(username='email-conflict', nickname='email-conflict', email=self.user.email)
        response = self.action('activate')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'identity_conflict')
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertEqual(self.user.token_version, 0)
        self.user.merged_into = self.other
        self.user.save()
        self.assertEqual(self.action('activate').data['error'], 'merged_account')

    def test_bulk_three_actions_partial_results_bounded_and_audited(self):
        for action in BULK_ACTIONS:
            response = self.client.post(BASE + 'bulk/', {'ids': [self.user.pk, self.other.pk], 'action': action}, format='json')
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(AdminAuditLog.objects.count(), 6)
        self.assertTrue(all(log.payload['bulk'] for log in AdminAuditLog.objects.all()))
        for ids in [[], [self.user.pk] * 2, list(range(1, 52))]:
            self.assertEqual(self.client.post(BASE + 'bulk/', {'ids': ids, 'action': 'revoke_sessions'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(BASE + 'bulk/', {'ids': [self.user.pk], 'action': 'grant_staff'}, format='json').status_code, 400)

    def test_masked_default_csv_filters_and_formula_cells(self):
        self.user.nickname = '=HYPERLINK("malicious")'
        self.user.save()
        masked = self.client.get(BASE + 'export.csv', {'q': str(self.user.pk)})
        self.assertEqual(masked.status_code, 200, masked.content)
        text = masked.content.decode('utf-8-sig')
        self.assertNotIn(self.user.email, text)
        self.assertNotIn(self.user.nickname, text)
        unmasked = self.client.get(BASE + 'export.csv', {'q': str(self.user.pk), 'masked': 0})
        rows = list(csv.DictReader(io.StringIO(unmasked.content.decode('utf-8-sig'))))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['nickname'], "'" + self.user.nickname)
        self.assertEqual(rows[0]['email'], self.user.email)
        self.assertNotIn('token_version', rows[0])

    def test_dormancy_truthful_clearance_and_unavailable_deltas(self):
        User.objects.filter(pk=self.user.pk).update(date_joined=timezone.now() - timedelta(days=31))
        detail = self.client.get(f'{BASE}{self.user.pk}/')
        self.assertEqual(detail.data['status'], 'dormant')
        self.assertIsNone(detail.data['last_active_at'])
        self.assertEqual(self.action('clear_dormant').status_code, 200)
        detail = self.client.get(f'{BASE}{self.user.pk}/')
        self.assertEqual(detail.data['status'], 'active')
        self.assertIsNone(detail.data['last_active_at'])
        stats = self.client.get(BASE + 'stats/')
        self.assertEqual(stats.status_code, 200, stats.content)
        self.assertEqual(stats.data['weekly_active'], 0)
        self.assertTrue(all(value is None for value in stats.data['deltas'].values()))
        UserReadingPosition.objects.create(user=self.user, book='gen', chapter=1)
        self.assertEqual(self.client.get(BASE + 'stats/').data['weekly_active'], 1)

    def test_list_queries_are_bounded_for_fifty_members(self):
        User.objects.bulk_create([User(username=f'bound{i}', nickname=f'bound{i}') for i in range(50)])
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(BASE)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertLessEqual(len(queries), 7)

    def test_cookie_csrf_and_conflicting_bearer_contexts(self):
        from accounts.authentication import ACCESS_TOKEN_COOKIE
        staff_token = AccessToken.for_user(self.staff)
        staff_token['token_version'] = self.staff.token_version
        cookie_client = APIClient(enforce_csrf_checks=True)
        cookie_client.cookies[ACCESS_TOKEN_COOKIE] = str(staff_token)
        self.assertEqual(cookie_client.get(BASE).status_code, 200)
        route = f'{BASE}{self.user.pk}/actions/'
        body = {'action': 'revoke_sessions'}
        self.assertEqual(cookie_client.post(route, body, format='json').status_code, 401)
        csrf = cookie_client.get('/api/v1/auth/csrf/').data['csrfToken']
        self.assertEqual(cookie_client.post(route, body, format='json', HTTP_X_CSRFTOKEN=csrf).status_code, 200)
        other_token = AccessToken.for_user(self.other)
        other_token['token_version'] = self.other.token_version
        cookie_client.credentials(HTTP_AUTHORIZATION=f'Bearer {other_token}')
        self.assertEqual(cookie_client.get(BASE).status_code, 403)
        self.assertEqual(cookie_client.post(route, body, format='json').status_code, 403)
        self.assertEqual(AdminAuditLog.objects.count(), 1)

    def test_noop_transitions_missing_targets_and_revoked_staff(self):
        for action in ['activate', 'clear_dormant', 'revoke_staff', 'unverify_email']:
            self.assertEqual(self.action(action).status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.token_version, 0)
        response = self.client.post(f'{BASE}999999/actions/', {'action': 'revoke_sessions'}, format='json')
        self.assertEqual(response.status_code, 404)
        audit = AdminAuditLog.objects.latest('pk')
        self.assertIsNone(audit.target_user_id)
        self.assertEqual(audit.payload['target_id'], 999999)
        old_staff_client = client_for(self.staff)
        self.assertEqual(self.action('revoke_staff', self.staff).status_code, 200)
        self.assertEqual(old_staff_client.get(BASE).status_code, 401)

    def test_failed_mail_does_not_leave_valid_token_and_is_audited(self):
        with patch('accounts.email_utils.send_email', return_value=False):
            response = self.action('resend_verification')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'mail_delivery_failed')
        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())
        self.assertEqual(AdminAuditLog.objects.get().payload['outcome'], 'mail_delivery_failed')

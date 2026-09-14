"""Real local test-mail capture; provider/network calls are forbidden."""
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
from pathlib import Path
import stat
import tempfile
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
import re

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from accounts import email_utils
from accounts.models import EmailVerificationToken, PasswordResetToken, User


class SpoolEnvironment:
    def setUp(self):
        super().setUp()
        temporary = tempfile.TemporaryDirectory(prefix='beta-test-mail-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.spool = self.root / 'spool'
        self.spool.mkdir(mode=0o700)
        self.config = override_settings(ACCOUNT_MAIL_TRANSPORT='beta-spool', BETA_TEST_MAIL_DIR=str(self.spool),
                                       BETA_TEST_MAIL_MAX_BYTES=1024 * 1024)
        self.config.enable()
        self.addCleanup(self.config.disable)
        self.provider = patch('accounts.email_utils.resend.Emails.send', side_effect=AssertionError('provider forbidden')).start()
        self.addCleanup(patch.stopall)
        patch('socket.socket.connect', side_effect=AssertionError('network forbidden')).start()
        patch.object(email_utils, 'FRONTEND_URL', 'https://beta.maeil1dok.app').start()

    def records(self):
        return [json.loads(path.read_text()) for path in sorted(self.spool.glob('*.json'))]


class BetaTestMailTests(SpoolEnvironment, SimpleTestCase):
    def test_beta_captures_real_rendered_verification_reset_and_welcome_without_provider(self):
        with patch.object(email_utils.resend, 'api_key', 'must-never-be-used'), self.assertLogs('accounts.email_utils', level='INFO') as logs:
            self.assertTrue(email_utils.send_verification_email('synthetic@example.test', 'verification-secret', 'tester', expiry_minutes=30))
            self.assertTrue(email_utils.send_password_reset_email('synthetic@example.test', 'reset-secret', 'tester'))
            self.assertTrue(email_utils.send_welcome_email('synthetic@example.test', 'tester'))
        records = self.records()
        self.assertEqual(len(records), 3)
        self.assertEqual({record['purpose'] for record in records}, {'email_verification', 'password_reset', 'welcome'})
        for record in records:
            self.assertEqual(record['transport'], 'beta-spool')
            self.assertEqual(record['delivery_status'], 'captured_not_delivered')
            self.assertEqual(record['message']['to'], ['synthetic@example.test'])
            self.assertTrue(record['message']['html'])
            mode = stat.S_IMODE((self.spool / f"{record['id']}.json").stat().st_mode)
            self.assertEqual(mode, 0o600)
        by_purpose = {record['purpose']: record for record in records}
        self.assertIn('https://beta.maeil1dok.app/auth/verify-email?token=verification-secret', by_purpose['email_verification']['message']['html'])
        self.assertIn('https://beta.maeil1dok.app/auth/reset-password?token=reset-secret', by_purpose['password_reset']['message']['html'])
        for secret in ['synthetic@example.test', 'verification-secret', 'reset-secret']:
            self.assertNotIn(secret, '\n'.join(logs.output))
        self.provider.assert_not_called()

    @override_settings(ACCOUNT_MAIL_TRANSPORT='resend')
    def test_primary_uses_unchanged_provider_payload_not_spool(self):
        self.provider.side_effect = None
        self.provider.return_value = {'id': 'primary-provider-id'}
        with patch.object(email_utils.resend, 'api_key', 'test-only-key'):
            self.assertTrue(email_utils.send_email('primary@example.test', 'subject', '<p>html</p>', purpose='welcome'))
        self.provider.assert_called_once_with({'from': f'{email_utils.FROM_NAME} <{email_utils.FROM_EMAIL}>',
                                              'to': ['primary@example.test'], 'subject': 'subject', 'html': '<p>html</p>'})
        self.assertEqual(self.records(), [])

    def test_unsafe_or_missing_directory_fails_closed_without_sensitive_logging(self):
        paths = [self.root / 'missing', Path('relative-spool')]
        public = self.root / 'public'
        public.mkdir(mode=0o755)
        paths.append(public)
        linked = self.root / 'linked'
        linked.symlink_to(self.spool, target_is_directory=True)
        paths.append(linked)
        for path in paths:
            with self.subTest(path=path), override_settings(BETA_TEST_MAIL_DIR=str(path)):
                with self.assertLogs('accounts.email_utils', level='WARNING') as logs:
                    self.assertFalse(email_utils.send_email('private@example.test', 'secret-subject', 'secret-token'))
                self.assertNotIn('secret', '\n'.join(logs.output))
                self.assertNotIn('private@example.test', '\n'.join(logs.output))
        self.provider.assert_not_called()
        self.assertEqual(self.records(), [])

    def test_static_or_source_directory_rejected_even_if_private(self):
        with override_settings(STATIC_ROOT=str(self.spool)):
            self.assertFalse(email_utils.send_email('private@example.test', 'subject', 'token'))
        with override_settings(BASE_DIR=self.spool):
            self.assertFalse(email_utils.send_email('private@example.test', 'subject', 'token'))
        self.assertEqual(self.records(), [])

    def test_atomic_write_failure_is_not_success_and_leaves_no_message(self):
        with patch('os.fsync', side_effect=OSError('secret-recipient secret-token')):
            with self.assertLogs('accounts.email_utils', level='WARNING') as logs:
                self.assertFalse(email_utils.send_password_reset_email('secret-recipient', 'secret-token'))
        self.assertEqual(self.records(), [])
        self.assertFalse(list(self.spool.glob('*.tmp')))
        self.assertNotIn('secret', '\n'.join(logs.output))
        self.provider.assert_not_called()

    @override_settings(BETA_TEST_MAIL_MAX_BYTES=1)
    def test_full_spool_fails_without_deleting_or_faking_delivery(self):
        self.assertFalse(email_utils.send_email('synthetic@example.test', 'subject', 'html'))
        self.assertEqual(self.records(), [])
        self.provider.assert_not_called()

    def test_concurrent_writes_are_complete_distinct_private_records(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda number: email_utils.send_email('synthetic@example.test', str(number), 'html'), range(8)))
        self.assertEqual(results, [True] * 8)
        records = self.records()
        self.assertEqual(len({record['id'] for record in records}), 8)
        self.assertEqual({record['message']['subject'] for record in records}, {str(number) for number in range(8)})
        self.assertFalse(list(self.spool.glob('*.tmp')))

    def test_wrong_owner_and_symlinked_parent_are_rejected(self):
        with patch('accounts.beta_test_mail.os.geteuid', return_value=os.geteuid() + 1):
            self.assertFalse(email_utils.send_email('synthetic@example.test', 'subject', 'html'))
        parent = self.root / 'alias'
        parent.symlink_to(self.root, target_is_directory=True)
        with override_settings(BETA_TEST_MAIL_DIR=str(parent / 'spool')):
            self.assertFalse(email_utils.send_email('synthetic@example.test', 'subject', 'html'))
        self.assertEqual(self.records(), [])

    def test_operator_export_never_prints_content_and_requires_private_new_output(self):
        self.assertTrue(email_utils.send_password_reset_email('synthetic@example.test', 'secret-token'))
        record = self.records()[0]
        listing = io.StringIO()
        call_command('beta_test_mail', '--list', stdout=listing)
        self.assertIn(record['id'], listing.getvalue())
        self.assertNotIn('secret-token', listing.getvalue())
        self.assertNotIn('synthetic@example.test', listing.getvalue())
        exported = self.root / 'export.json'
        output = io.StringIO()
        call_command('beta_test_mail', '--id', record['id'], '--output', str(exported), stdout=output)
        self.assertEqual(json.loads(exported.read_text()), record)
        self.assertEqual(stat.S_IMODE(exported.stat().st_mode), 0o600)
        self.assertNotIn('secret-token', output.getvalue())
        with self.assertRaises(CommandError):
            call_command('beta_test_mail', '--id', record['id'], '--output', str(exported))
        for identifier in ['../outside', '/etc/passwd', 'not-a-record']:
            with self.subTest(identifier=identifier), self.assertRaises(CommandError):
                call_command('beta_test_mail', '--id', identifier, '--output', str(self.root / 'other.json'))
        shared = self.root / 'shared'
        shared.mkdir(mode=0o755)
        with self.assertRaises(CommandError):
            call_command('beta_test_mail', '--id', record['id'], '--output', str(shared / 'export.json'))
        with override_settings(ACCOUNT_MAIL_TRANSPORT='resend'), self.assertRaises(CommandError):
            call_command('beta_test_mail', '--list')

    def test_operator_cannot_read_symlink_or_group_readable_capture(self):
        self.assertTrue(email_utils.send_email('synthetic@example.test', 'subject', 'html'))
        record = self.records()[0]
        path = self.spool / f"{record['id']}.json"
        path.chmod(0o640)
        with self.assertRaises(CommandError):
            call_command('beta_test_mail', '--id', record['id'], '--output', str(self.root / 'export.json'))
        path.unlink()
        outside = self.root / 'outside'
        outside.write_text('secret-token')
        path.symlink_to(outside)
        with self.assertRaises(CommandError):
            call_command('beta_test_mail', '--id', record['id'], '--output', str(self.root / 'export.json'))


class BetaMailApiTests(SpoolEnvironment, TestCase):
    def setUp(self):
        super().setUp()
        from django.conf import settings
        middleware = override_settings(MIDDLEWARE=[*settings.MIDDLEWARE, 'accounts.beta_test_mail.BetaTestMailMiddleware'])
        middleware.enable()
        self.addCleanup(middleware.disable)
        self.user = User.objects.create_user(username='beta-mail-test', nickname='beta-mail-user', email='beta-mail@example.test', password='isolated-password', has_usable_password_flag=True)
        self.staff = User.objects.create_user(username='beta-mail-staff', nickname='beta-mail-staff', email='beta-staff@example.test', password='isolated-password', is_staff=True)
        self.client = APIClient()

    def token_from(self, purpose):
        record = next(record for record in self.records() if record['purpose'] == purpose)
        links = re.findall(r'href="([^"]+)"', record['message']['html'])
        return parse_qs(urlparse(links[0]).query)['token'][0]

    def test_public_reset_and_verify_capture_actual_database_tokens(self):
        for route, purpose, model in [('/api/v1/auth/request-password-reset/', 'password_reset', PasswordResetToken),
                                      ('/api/v1/auth/send-verification/', 'email_verification', EmailVerificationToken)]:
            with self.subTest(route=route):
                response = self.client.post(route, {'email': self.user.email}, format='json')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['X-Beta-Test-Mail'], 'captured_not_delivered')
                self.assertTrue(response.json()['success'])
                self.assertEqual(self.token_from(purpose), model.objects.get(user=self.user).token)
        reset = self.client.post('/api/v1/auth/verify-reset-token/', {'token': self.token_from('password_reset')}, format='json')
        self.assertEqual(reset.status_code, 200)
        self.assertTrue(reset.json()['valid'])
        verified = self.client.post('/api/v1/auth/verify-email/', {'token': self.token_from('email_verification')}, format='json')
        self.assertEqual(verified.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)
        self.provider.assert_not_called()

    def test_failed_capture_and_no_capture_are_not_reported_as_mail_success(self):
        for email in [self.user.email, 'unknown@example.test']:
            with self.subTest(email=email), override_settings(BETA_TEST_MAIL_DIR=str(self.root / 'missing')):
                response = self.client.post('/api/v1/auth/request-password-reset/', {'email': email}, format='json')
                self.assertEqual(response.status_code, 503)
                self.assertFalse(response.json()['success'])
                self.assertEqual(response['X-Beta-Test-Mail'], 'not_captured')
                self.assertNotIn(email, str(response.json()))
        self.assertEqual(self.records(), [])

    @override_settings(ACCOUNT_MAIL_TRANSPORT='resend')
    def test_primary_generic_acknowledgement_remains_unchanged_without_capture(self):
        with patch.object(email_utils.resend, 'api_key', None):
            response = self.client.post('/api/v1/auth/request-password-reset/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertNotIn('X-Beta-Test-Mail', response)
        self.assertEqual(self.records(), [])

    def test_admin_capture_failure_rolls_back_token_without_provider_fallback(self):
        self.client.force_authenticate(self.staff)
        with override_settings(BETA_TEST_MAIL_DIR=str(self.root / 'missing')):
            response = self.client.post(f'/api/v1/admin/members/{self.user.pk}/actions/', {'action': 'resend_verification'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'mail_delivery_failed')
        self.assertFalse(EmailVerificationToken.objects.filter(user=self.user).exists())
        self.assertEqual(self.records(), [])
        self.provider.assert_not_called()

    def test_no_http_capture_read_route_exists(self):
        from django.urls import Resolver404, resolve
        for path in ['/api/v1/test-mail/', '/api/v1/admin/test-mail/', '/media/test-mail/', '/test-mail/']:
            with self.subTest(path=path), self.assertRaises(Resolver404):
                resolve(path)

    def test_authenticated_resend_and_admin_resend_use_real_spool(self):
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/v1/auth/resend-verification/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Beta-Test-Mail'], 'captured_not_delivered')
        first = EmailVerificationToken.objects.get(user=self.user)
        self.assertEqual(self.token_from('email_verification'), first.token)
        self.client.force_authenticate(self.staff)
        response = self.client.post(f'/api/v1/admin/members/{self.user.pk}/actions/', {'action': 'resend_verification'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response['X-Beta-Test-Mail'], 'captured_not_delivered')
        self.assertEqual(len(self.records()), 2)
        active = EmailVerificationToken.objects.get(user=self.user, is_used=False)
        self.assertNotEqual(active.token, first.token)
        self.assertTrue(any(active.token in record['message']['html'] for record in self.records()))
        reset = self.client.post(f'/api/v1/admin/members/{self.user.pk}/actions/', {'action': 'send_password_reset'}, format='json')
        self.assertEqual(reset.status_code, 200)
        self.assertEqual(reset['X-Beta-Test-Mail'], 'captured_not_delivered')
        self.assertEqual(self.token_from('password_reset'), PasswordResetToken.objects.get(user=self.user).token)
        self.provider.assert_not_called()

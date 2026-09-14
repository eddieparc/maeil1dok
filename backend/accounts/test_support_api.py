"""Support intake through real Django routing, authentication and disposable databases."""
from uuid import UUID

from django.apps import apps
from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from accounts.authentication import ACCESS_TOKEN_COOKIE, get_tokens_for_user
from accounts.models import User

URL = '/api/v1/support/inquiries/'
PAYLOAD = {'kind': 'bug', 'message': 'Reading progress did not save.'}


def client_for(user):
    client = APIClient(enforce_csrf_checks=True)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {get_tokens_for_user(user)['access']}")
    return client


@override_settings(ROOT_URLCONF='config.urls')
class SupportInquiryHTTPTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = User.objects.create_user(username='support-user', nickname='support-user')
        self.other = User.objects.create_user(username='support-other', nickname='support-other')
        self.client = APIClient(enforce_csrf_checks=True)

    @property
    def inquiries(self):
        return apps.get_model('accounts', 'SupportInquiry').objects

    def post(self, payload=None, client=None, **headers):
        return (client or self.client).post(URL, PAYLOAD if payload is None else payload,
                                          format='json', **headers)

    def test_anonymous_receipt_is_real_persistence_without_delivery(self):
        response = self.post({**PAYLOAD, 'message': '  Keep this message.  ',
                              'email': ' reply@example.invalid '})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(set(response.data), {'receipt_id', 'status'})
        self.assertEqual(response.data['status'], 'received')
        receipt_id = UUID(response.data['receipt_id'])
        inquiry = self.inquiries.get(pk=receipt_id)
        self.assertEqual(inquiry.kind, 'bug')
        self.assertEqual(inquiry.message, 'Keep this message.')
        self.assertEqual(inquiry.reply_email, 'reply@example.invalid')
        self.assertIsNone(inquiry.user_id)
        self.assertEqual(inquiry.status, 'received')
        self.assertIsNotNone(inquiry.created_at)
        self.assertEqual(len(mail.outbox), 0)

    def test_authenticated_identity_is_actual_caller_and_not_reply_address(self):
        response = self.post({**PAYLOAD, 'email': 'someone-else@example.invalid'},
                             client=client_for(self.user))
        self.assertEqual(response.status_code, 201, response.content)
        inquiry = self.inquiries.get(pk=response.data['receipt_id'])
        self.assertEqual(inquiry.user_id, self.user.pk)
        self.assertEqual(inquiry.reply_email, 'someone-else@example.invalid')
        self.assertNotIn('user', response.data)

    def test_forged_identity_and_server_fields_rejected_for_every_persona(self):
        for client in (self.client, client_for(self.user)):
            for key, value in [('user', self.other.pk), ('user_id', self.other.pk),
                               ('status', 'delivered'), ('receipt_id', str(UUID(int=1)))]:
                cache.clear()
                with self.subTest(key=key):
                    response = self.post({**PAYLOAD, key: value}, client=client)
                    self.assertEqual(response.status_code, 400, response.content)
                    self.assertIn(key, response.data)
        self.assertEqual(self.inquiries.count(), 0)

    def test_validation_errors_never_persist(self):
        cases = [({}, 'kind'), ({'kind': 'bug'}, 'message'),
                 ({**PAYLOAD, 'kind': 'unknown'}, 'kind'),
                 ({**PAYLOAD, 'kind': None}, 'kind'),
                 ({**PAYLOAD, 'message': ''}, 'message'),
                 ({**PAYLOAD, 'message': ' \n\t '}, 'message'),
                 ({**PAYLOAD, 'message': None}, 'message'),
                 ({**PAYLOAD, 'message': []}, 'message'),
                 ({**PAYLOAD, 'message': 'x' * 2001}, 'message'),
                 ({**PAYLOAD, 'email': 'not-an-email'}, 'email'),
                 ({**PAYLOAD, 'email': 'a' * 243 + '@example.com'}, 'email'),
                 ({**PAYLOAD, 'email': None}, 'email')]
        for payload, field in cases:
            cache.clear()
            with self.subTest(field=field, payload=payload):
                response = self.post(payload)
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn(field, response.data)
        self.assertEqual(self.inquiries.count(), 0)

    def test_all_kinds_and_boundary_message_are_accepted(self):
        for kind in ('bug', 'feature', 'account', 'other'):
            response = self.post({'kind': kind, 'message': 'x' * 2000, 'email': ''})
            self.assertEqual(response.status_code, 201, response.content)
            inquiry = self.inquiries.get(pk=response.data['receipt_id'])
            self.assertEqual((inquiry.kind, len(inquiry.message), inquiry.reply_email), (kind, 2000, ''))
        self.assertEqual(self.inquiries.count(), 4)

    def test_optional_reply_email_not_inferred_from_account(self):
        self.user.email = 'private@example.invalid'
        self.user.save(update_fields=['email'])
        response = self.post(client=client_for(self.user))
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(self.inquiries.get(pk=response.data['receipt_id']).reply_email, '')

    def test_json_only_and_malformed_input_cannot_persist(self):
        response = self.client.post(URL, data='{', content_type='application/json')
        self.assertEqual(response.status_code, 400)
        response = self.client.post(URL, data=PAYLOAD)
        self.assertEqual(response.status_code, 415)
        response = self.post([])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.inquiries.count(), 0)

    def test_no_public_or_authenticated_read_update_delete_surface(self):
        receipt = self.post().data['receipt_id']
        for client in (self.client, client_for(self.user), client_for(self.other)):
            for method in ('get', 'head', 'put', 'patch', 'delete'):
                cache.clear()
                response = getattr(client, method)(URL)
                self.assertEqual(response.status_code, 405, (method, response.content))
            for path in (f'{URL}{receipt}/', '/api/v1/auth/support/inquiries/',
                         '/api/v1/accounts/support/inquiries/'):
                self.assertEqual(client.get(path).status_code, 404)
        self.assertEqual(self.inquiries.count(), 1)
        cache.clear()
        options = self.client.options(URL)
        self.assertEqual(options.status_code, 200)
        self.assertEqual(set(options['Allow'].split(', ')), {'POST', 'OPTIONS'})

    def test_cookie_auth_keeps_csrf_required_and_records_user_after_valid_csrf(self):
        self.client.cookies[ACCESS_TOKEN_COOKIE] = get_tokens_for_user(self.user)['access']
        response = self.post()
        self.assertEqual(response.status_code, 401, response.content)
        self.assertEqual(self.inquiries.count(), 0)
        csrf = self.client.get('/api/v1/auth/csrf/')
        self.assertEqual(csrf.status_code, 200, csrf.content)
        response = self.post(HTTP_X_CSRFTOKEN=self.client.cookies[settings.CSRF_COOKIE_NAME].value)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(self.inquiries.get(pk=response.data['receipt_id']).user_id, self.user.pk)

    def test_invalid_bearer_cannot_downgrade_to_anonymous(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid')
        self.assertEqual(self.post().status_code, 401)
        self.assertEqual(self.inquiries.count(), 0)

    def test_anonymous_limit_cannot_be_bypassed_with_forwarded_headers(self):
        for index in range(5):
            response = self.post(HTTP_X_FORWARDED_FOR=f'192.0.2.{index + 1}')
            self.assertEqual(response.status_code, 201, response.content)
        response = self.post(HTTP_X_FORWARDED_FOR='192.0.2.99')
        self.assertEqual(response.status_code, 429, response.content)
        self.assertGreater(int(response['Retry-After']), 0)
        self.assertEqual(self.inquiries.count(), 5)
        self.assertEqual(self.post(REMOTE_ADDR='192.0.2.100').status_code, 201)

    def test_user_limit_follows_identity_across_peer_addresses(self):
        client = client_for(self.user)
        for index in range(5):
            self.assertEqual(self.post(client=client, REMOTE_ADDR=f'192.0.2.{index + 1}').status_code, 201)
        self.assertEqual(self.post(client=client, REMOTE_ADDR='192.0.2.99').status_code, 429)
        self.assertEqual(self.post(client=client_for(self.other)).status_code, 201)
        self.assertEqual(self.inquiries.count(), 6)

    def test_peer_limit_bounds_authenticated_identity_rotation(self):
        for index in range(4):
            user = User.objects.create_user(username=f'support-rotation-{index}', nickname=f'support-rotation-{index}')
            client = client_for(user)
            for _ in range(5):
                self.assertEqual(self.post(client=client).status_code, 201)
        response = self.post(client=client_for(self.other))
        self.assertEqual(response.status_code, 429, response.content)
        self.assertEqual(self.inquiries.count(), 20)


@override_settings(ROOT_URLCONF='config.urls')
class SupportInquiryDatabaseFailureTests(TransactionTestCase):
    def test_real_database_rejection_returns_no_receipt_or_success(self):
        cache.clear()
        self.addCleanup(cache.clear)
        table = connection.ops.quote_name(apps.get_model('accounts', 'SupportInquiry')._meta.db_table)
        # This trigger exists only inside the disposable Django test database.
        if connection.vendor == 'mysql':
            ddl = (f"CREATE TRIGGER support_test_reject BEFORE INSERT ON {table} FOR EACH ROW "
                   "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'support test insert rejected'")
        else:
            ddl = (f"CREATE TRIGGER support_test_reject BEFORE INSERT ON {table} "
                   "BEGIN SELECT RAISE(ABORT, 'support test insert rejected'); END")
        with connection.cursor() as cursor:
            cursor.execute(ddl)
        try:
            with self.assertLogs('accounts.support_views', level='ERROR'):
                response = APIClient().post(URL, PAYLOAD, format='json')
            self.assertEqual(response.status_code, 503, response.content)
            self.assertEqual(set(response.data), {'detail'})
            self.assertEqual(apps.get_model('accounts', 'SupportInquiry').objects.count(), 0)
        finally:
            with connection.cursor() as cursor:
                cursor.execute('DROP TRIGGER support_test_reject')
        response = APIClient().post(URL, PAYLOAD, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(apps.get_model('accounts', 'SupportInquiry').objects.filter(pk=response.data['receipt_id']).exists())

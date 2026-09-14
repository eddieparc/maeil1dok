"""Real locking HTTP races; run on MySQL, not SQLite's no-op FOR UPDATE."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import close_old_connections, connection, transaction
from django.test import TransactionTestCase, skipUnlessDBFeature

from accounts.models import AdminAuditLog, SocialAccount, User
from accounts.test_admin_members_api import BASE, client_for


@skipUnlessDBFeature('has_select_for_update')
class AdminMemberLockingHTTPTests(TransactionTestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='race-staff', nickname='race-staff', is_staff=True)
        self.second_staff = User.objects.create_user(username='race-staff2', nickname='race-staff2', is_staff=True)
        self.user = User.objects.create_user(username='race-user', nickname='race-user')

    def concurrent_posts(self, requests):
        # All requests authenticate first, then announce the exact lock SQL before
        # executing it. The parent holds the target lock until both requests arrive.
        ready = Barrier(len(requests) + 1, timeout=10)

        def worker(user, route, body):
            close_old_connections()
            announced = False

            def announce(execute, sql, params, many, context):
                nonlocal announced
                if not announced and 'FOR UPDATE' in sql.upper() and 'accounts_user' in sql:
                    announced = True
                    ready.wait()
                return execute(sql, params, many, context)

            try:
                with connection.execute_wrapper(announce):
                    response = client_for(user).post(route, body, format='json')
                self.assertTrue(announced, 'Request did not lock the account row.')
                return response.status_code, response.data
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=len(requests)) as pool:
            with transaction.atomic():
                User.objects.select_for_update().get(pk=self.user.pk)
                futures = [pool.submit(worker, *request) for request in requests]
                ready.wait()
            return [future.result(timeout=15) for future in futures]

    def test_two_staff_revocations_increment_twice_with_two_audits(self):
        route = f'{BASE}{self.user.pk}/actions/'
        results = self.concurrent_posts([
            (self.staff, route, {'action': 'revoke_sessions'}),
            (self.second_staff, route, {'action': 'revoke_sessions'}),
        ])
        self.assertEqual([status for status, _ in results], [200, 200], results)
        self.user.refresh_from_db()
        self.assertEqual(self.user.token_version, 2)
        self.assertEqual(AdminAuditLog.objects.filter(target_user=self.user).count(), 2)

    def test_staff_and_self_unlink_cannot_remove_both_login_methods(self):
        SocialAccount.objects.create(user=self.user, provider='google', provider_id='race-google')
        SocialAccount.objects.create(user=self.user, provider='apple', provider_id='race-apple')
        results = self.concurrent_posts([
            (self.staff, f'{BASE}{self.user.pk}/actions/', {'action': 'unlink_social', 'provider': 'google'}),
            (self.user, '/api/v1/auth/unlink-social/', {'provider': 'apple'}),
        ])
        self.assertEqual(sorted(status for status, _ in results), [200, 400], results)
        self.assertEqual(self.user.social_accounts.count(), 1)
        self.assertEqual(AdminAuditLog.objects.filter(target_user=self.user).count(), 1)

    def test_two_staff_unlinks_cannot_remove_both_login_methods(self):
        SocialAccount.objects.create(user=self.user, provider='google', provider_id='race-google')
        SocialAccount.objects.create(user=self.user, provider='apple', provider_id='race-apple')
        route = f'{BASE}{self.user.pk}/actions/'
        results = self.concurrent_posts([
            (self.staff, route, {'action': 'unlink_social', 'provider': 'google'}),
            (self.second_staff, route, {'action': 'unlink_social', 'provider': 'apple'}),
        ])
        self.assertEqual(sorted(status for status, _ in results), [200, 400], results)
        self.assertEqual(self.user.social_accounts.count(), 1)
        self.assertEqual(AdminAuditLog.objects.filter(target_user=self.user).count(), 2)

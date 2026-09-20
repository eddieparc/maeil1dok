"""Native (Expo) push subscription HTTP contract.

Covers register/status/remove/delete on /api/v1/todos/notifications/push/native*
plus the auth logout/logout-all/delete-account revocation hooks. Ownership rules:
an enabled token owned by another account can only be rebound when the caller
proves device possession with the same installation_id; a disabled binding may be
rebound freely; tokens and installation ids are never echoed or logged.
"""

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.authentication import REFRESH_TOKEN_COOKIE

from .models import NativePushSubscription

User = get_user_model()

INSTALL_A = '11111111-1111-4111-8111-111111111111'
INSTALL_B = '22222222-2222-4222-8222-222222222222'
TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'
TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]'

NATIVE_URL = '/api/v1/todos/notifications/push/native/'
STATUS_URL = '/api/v1/todos/notifications/push/native/status/'
REMOVE_URL = '/api/v1/todos/notifications/push/native/remove/'
LOGOUT_URL = '/api/v1/auth/logout/'
LOGOUT_ALL_URL = '/api/v1/auth/logout-all/'
DELETE_ACCOUNT_URL = '/api/v1/auth/delete-account/'


def _user(username):
    return User.objects.create_user(
        username=username,
        nickname=username[:20],
        password='pw-test-1234',
        has_usable_password_flag=True,
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _payload(token=TOKEN_A, installation_id=INSTALL_A, platform='ios'):
    return {
        'token': token,
        'platform': platform,
        'installation_id': installation_id,
    }


@override_settings(ROOT_URLCONF='config.urls')
class NativePushRegisterTest(TestCase):
    def setUp(self):
        self.user = _user('native-owner')
        self.client = _client(self.user)

    def test_anonymous_register_is_rejected(self):
        response = APIClient().post(NATIVE_URL, _payload(), format='json')
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_own_token_cannot_overwrite_another_active_installation(self):
        self.client.post(NATIVE_URL, _payload(), format='json')
        other = _user('other-installation')
        _client(other).post(NATIVE_URL, _payload(token=TOKEN_B, installation_id=INSTALL_B), format='json')
        response = self.client.post(NATIVE_URL, _payload(installation_id=INSTALL_B), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(str(NativePushSubscription.objects.get(token=TOKEN_A).installation_id), INSTALL_A)

    def test_opt_out_survives_another_account_using_and_leaving_the_device(self):
        self.client.post(NATIVE_URL, _payload(), format='json')
        self.client.post(REMOVE_URL, {'token': TOKEN_A, 'installation_id': INSTALL_A}, format='json')
        other = _client(_user('temporary-owner'))
        self.assertEqual(other.post(NATIVE_URL, _payload(), format='json').status_code, 200)
        other.post(LOGOUT_URL, {'installation_id': INSTALL_A}, format='json')
        response = self.client.post(
            STATUS_URL, {'token': TOKEN_A, 'installation_id': INSTALL_A}, format='json',
        )
        self.assertEqual(response.data, {'success': True, 'registered': True, 'enabled': False})

    def test_automatic_registration_cannot_race_a_manual_opt_out(self):
        self.client.post(NATIVE_URL, _payload(), format='json')
        self.client.post(REMOVE_URL, {'token': TOKEN_A, 'installation_id': INSTALL_A}, format='json')
        response = self.client.post(NATIVE_URL, {**_payload(), 'explicit': False}, format='json')
        self.assertEqual(response.data, {'success': True, 'enabled': False})
        self.assertFalse(NativePushSubscription.objects.get(token=TOKEN_A).enabled)
        enabled = self.client.post(NATIVE_URL, _payload(), format='json')
        self.assertEqual(enabled.data, {'success': True, 'enabled': True})

    def test_register_creates_enabled_subscription(self):
        response = self.client.post(NATIVE_URL, _payload(), format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'enabled': True},
        )
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.token, TOKEN_A)
        self.assertEqual(subscription.platform, 'ios')
        self.assertEqual(subscription.installation_id, uuid.UUID(INSTALL_A))
        self.assertTrue(subscription.enabled)

    def test_register_response_never_echoes_token(self):
        response = self.client.post(NATIVE_URL, _payload(), format='json')
        self.assertNotIn(TOKEN_A, response.content.decode())

    def test_register_rejects_invalid_installation_id(self):
        for bad in ['not-a-uuid', '12345', '', None]:
            with self.subTest(installation_id=bad):
                response = self.client.post(
                    NATIVE_URL,
                    _payload(installation_id=bad),
                    format='json',
                )
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_register_rejects_invalid_platform(self):
        response = self.client.post(
            NATIVE_URL,
            _payload(platform='web'),
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_register_rejects_non_expo_token(self):
        for bad in ['', 'random-token', 'ExponentPushToken[]', 'https://evil.test/x']:
            with self.subTest(token=bad):
                response = self.client.post(
                    NATIVE_URL,
                    _payload(token=bad),
                    format='json',
                )
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_register_rejects_missing_fields(self):
        response = self.client.post(NATIVE_URL, {}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_reregister_same_user_is_idempotent_and_reenables(self):
        self.client.post(NATIVE_URL, _payload(), format='json')
        NativePushSubscription.objects.filter(user=self.user).update(enabled=False)

        response = self.client.post(NATIVE_URL, _payload(), format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(NativePushSubscription.objects.count(), 1)
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertTrue(subscription.enabled)

    def test_same_user_new_installation_updates_binding(self):
        self.client.post(NATIVE_URL, _payload(), format='json')

        response = self.client.post(
            NATIVE_URL,
            _payload(installation_id=INSTALL_B),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.installation_id, uuid.UUID(INSTALL_B))

    def test_same_installation_rotates_token(self):
        self.client.post(NATIVE_URL, _payload(), format='json')

        response = self.client.post(
            NATIVE_URL,
            _payload(token=TOKEN_B),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(NativePushSubscription.objects.count(), 1)
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertEqual(subscription.token, TOKEN_B)

    def test_active_token_owned_by_other_user_cannot_be_stolen(self):
        other = _user('native-victim')
        _client(other).post(NATIVE_URL, _payload(), format='json')

        response = self.client.post(
            NATIVE_URL,
            _payload(installation_id=INSTALL_B),
            format='json',
        )

        self.assertEqual(response.status_code, 409, response.data)
        subscription = NativePushSubscription.objects.get(token=TOKEN_A)
        self.assertEqual(subscription.user, other)
        self.assertTrue(subscription.enabled)

    def test_disabled_binding_may_be_rebound_by_new_account(self):
        other = _user('native-prior')
        _client(other).post(NATIVE_URL, _payload(), format='json')
        NativePushSubscription.objects.filter(user=other).update(enabled=False)

        response = self.client.post(
            NATIVE_URL,
            _payload(installation_id=INSTALL_B),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        subscription = NativePushSubscription.objects.get(token=TOKEN_A)
        self.assertEqual(subscription.user, self.user)
        self.assertTrue(subscription.enabled)
        self.assertEqual(subscription.installation_id, uuid.UUID(INSTALL_B))

    def test_same_installation_proves_possession_for_rebind(self):
        # Device handoff: the previous owner logged out offline, so the row is
        # still enabled, but the caller holds the same installation identity.
        other = _user('native-offline')
        _client(other).post(NATIVE_URL, _payload(), format='json')

        response = self.client.post(NATIVE_URL, _payload(), format='json')

        self.assertEqual(response.status_code, 200, response.data)
        subscription = NativePushSubscription.objects.get(token=TOKEN_A)
        self.assertEqual(subscription.user, self.user)


@override_settings(ROOT_URLCONF='config.urls')
class NativePushStatusTest(TestCase):
    def setUp(self):
        self.user = _user('status-owner')
        self.client = _client(self.user)

    def _status(self, token=TOKEN_A, installation_id=INSTALL_A, client=None):
        return (client or self.client).post(
            STATUS_URL,
            {'token': token, 'installation_id': installation_id},
            format='json',
        )

    def test_anonymous_status_is_rejected(self):
        response = APIClient().post(
            STATUS_URL,
            {'token': TOKEN_A, 'installation_id': INSTALL_A},
            format='json',
        )
        self.assertIn(response.status_code, (401, 403))

    def test_unknown_token_reports_unregistered(self):
        response = self._status()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'registered': False, 'enabled': False},
        )

    def test_own_enabled_binding_reports_registered(self):
        self.client.post(NATIVE_URL, _payload(), format='json')

        response = self._status()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'registered': True, 'enabled': True},
        )

    def test_own_disabled_binding_reports_registered_but_disabled(self):
        self.client.post(NATIVE_URL, _payload(), format='json')
        self.client.post(
            REMOVE_URL, {'token': TOKEN_A, 'installation_id': INSTALL_A}, format='json',
        )

        response = self._status()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'registered': True, 'enabled': False},
        )

    def test_provider_disabled_binding_can_reregister_without_changing_token(self):
        self.client.post(NATIVE_URL, _payload(), format='json')
        NativePushSubscription.objects.filter(user=self.user).update(enabled=False)
        response = self._status()
        self.assertEqual(response.data, {'success': True, 'registered': False, 'enabled': False})
        registered = self.client.post(NATIVE_URL, {**_payload(), 'explicit': False}, format='json')
        self.assertEqual(registered.data, {'success': True, 'enabled': True})

    def test_other_users_active_token_is_conflict_not_leak(self):
        other = _user('status-victim')
        _client(other).post(NATIVE_URL, _payload(), format='json')

        response = self._status(installation_id=INSTALL_B)

        self.assertEqual(response.status_code, 409, response.data)
        self.assertNotIn('enabled', response.data)
        self.assertNotIn('registered', response.data)

    def test_other_users_disabled_token_reports_unregistered(self):
        other = _user('status-prior')
        _client(other).post(NATIVE_URL, _payload(), format='json')
        NativePushSubscription.objects.filter(user=other).update(enabled=False)

        response = self._status(installation_id=INSTALL_B)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'registered': False, 'enabled': False},
        )

    def test_other_users_token_with_same_installation_reports_unregistered(self):
        other = _user('status-offline')
        _client(other).post(NATIVE_URL, _payload(), format='json')

        response = self._status()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'registered': False, 'enabled': False},
        )

    def test_own_token_with_stale_installation_reports_unregistered(self):
        self.client.post(NATIVE_URL, _payload(), format='json')

        response = self._status(installation_id=INSTALL_B)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data,
            {'success': True, 'registered': False, 'enabled': False},
        )

    def test_status_rejects_invalid_installation_id(self):
        response = self._status(installation_id='not-a-uuid')
        self.assertEqual(response.status_code, 400, response.data)


@override_settings(ROOT_URLCONF='config.urls')
class NativePushRemoveTest(TestCase):
    def setUp(self):
        self.user = _user('remove-owner')
        self.client = _client(self.user)
        self.client.post(NATIVE_URL, _payload(), format='json')

    def test_delete_disables_owned_binding(self):
        response = self.client.delete(
            NATIVE_URL,
            {'token': TOKEN_A, 'installation_id': INSTALL_A},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {'success': True, 'updated_count': 1})
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertFalse(subscription.enabled)

    def test_post_remove_disables_owned_binding(self):
        response = self.client.post(
            REMOVE_URL,
            {'token': TOKEN_A, 'installation_id': INSTALL_A},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {'success': True, 'updated_count': 1})
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertFalse(subscription.enabled)

    def test_remove_with_wrong_installation_updates_nothing(self):
        response = self.client.post(
            REMOVE_URL,
            {'token': TOKEN_A, 'installation_id': INSTALL_B},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated_count'], 0)
        self.assertTrue(NativePushSubscription.objects.get(user=self.user).enabled)

    def test_remove_other_users_token_updates_nothing(self):
        other = _user('remove-other')
        response = _client(other).post(
            REMOVE_URL,
            {'token': TOKEN_A, 'installation_id': INSTALL_A},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['updated_count'], 0)
        self.assertTrue(NativePushSubscription.objects.get(user=self.user).enabled)

    def test_anonymous_remove_is_rejected(self):
        for method in ('delete', 'post'):
            url = NATIVE_URL if method == 'delete' else REMOVE_URL
            with self.subTest(method=method):
                response = getattr(APIClient(), method)(
                    url,
                    {'token': TOKEN_A, 'installation_id': INSTALL_A},
                    format='json',
                )
                self.assertIn(response.status_code, (401, 403))
        self.assertTrue(NativePushSubscription.objects.get(user=self.user).enabled)


@override_settings(ROOT_URLCONF='config.urls')
class NativePushLogoutRevocationTest(TestCase):
    def setUp(self):
        self.user = _user('logout-owner')
        self.client = _client(self.user)
        self.client.post(NATIVE_URL, _payload(), format='json')

    def test_logout_with_installation_id_deletes_enabled_binding(self):
        response = self.client.post(
            LOGOUT_URL,
            {'installation_id': INSTALL_A},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_authenticated_identity_wins_over_another_accounts_refresh_cookie(self):
        other = _user('foreign-refresh')
        self.client.cookies[REFRESH_TOKEN_COOKIE] = str(RefreshToken.for_user(other))
        response = self.client.post(LOGOUT_URL, {'installation_id': INSTALL_A}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(NativePushSubscription.objects.filter(user=self.user, enabled=True).exists())

    def test_logout_with_installation_header_deletes_enabled_binding(self):
        response = self.client.post(
            LOGOUT_URL,
            {},
            format='json',
            HTTP_X_INSTALLATION_ID=INSTALL_A,
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(NativePushSubscription.objects.exists())

    def test_logout_preserves_explicit_opt_out(self):
        # A disabled row records an explicit opt-out; logout must not erase it,
        # or the next login would silently re-register the device.
        NativePushSubscription.objects.filter(user=self.user).update(enabled=False)

        response = self.client.post(
            LOGOUT_URL,
            {'installation_id': INSTALL_A},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        subscription = NativePushSubscription.objects.get(user=self.user)
        self.assertFalse(subscription.enabled)

    def test_logout_without_installation_id_keeps_binding(self):
        response = self.client.post(LOGOUT_URL, {}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(NativePushSubscription.objects.get(user=self.user).enabled)

    def test_logout_all_devices_revokes_enabled_bindings(self):
        self.client.post(
            NATIVE_URL,
            _payload(token=TOKEN_B, installation_id=INSTALL_B),
            format='json',
        )
        NativePushSubscription.objects.create(
            user=self.user,
            token='ExponentPushToken[cccccccccccccccccccccc]',
            platform='android',
            installation_id=uuid.UUID('33333333-3333-4333-8333-333333333333'),
            enabled=False,
        )

        response = self.client.post(LOGOUT_ALL_URL, {}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        remaining = NativePushSubscription.objects.filter(user=self.user)
        self.assertEqual(remaining.count(), 1)
        self.assertFalse(remaining.get().enabled)

    def test_delete_account_revokes_enabled_bindings(self):
        response = self.client.post(
            DELETE_ACCOUNT_URL,
            {'password': 'pw-test-1234', 'confirm_delete': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(
            NativePushSubscription.objects.filter(user=self.user, enabled=True).exists()
        )

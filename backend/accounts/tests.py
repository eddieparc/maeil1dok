from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import get_tokens_for_user, token_version_is_current
from .cookie_views import CookieTokenRefreshView


class AuthTokenVersionTests(SimpleTestCase):
    def test_get_tokens_for_user_includes_token_version_on_access_and_refresh(self):
        user = SimpleNamespace(id=123, token_version=7, nickname='tester', is_social=False)

        tokens = issue_tokens(user)

        self.assertEqual(decode_token(tokens['refresh'])['token_version'], 7)
        self.assertEqual(decode_token(tokens['access'])['token_version'], 7)

    def test_token_version_check_rejects_missing_claim_for_version_zero_user(self):
        user = SimpleNamespace(id=123, token_version=0, nickname='tester', is_social=False)
        refresh = issue_legacy_refresh_without_token_version(user)

        self.assertFalse(token_version_is_current(refresh.access_token, user))

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rejects_missing_token_version_claim(self):
        user = SimpleNamespace(id=123, token_version=0, nickname='tester', is_social=False)
        refresh = str(issue_legacy_refresh_without_token_version(user))

        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(user)),
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 401)

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rejects_stale_refresh_token(self):
        old_user = SimpleNamespace(id=123, token_version=1, nickname='tester', is_social=False)
        current_user = SimpleNamespace(id=123, token_version=2, nickname='tester', is_social=False)
        refresh = issue_tokens(old_user)['refresh']

        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(current_user)),
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 401)

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rejects_future_token_version_after_account_recovery(self):
        deleted_user = SimpleNamespace(id=123, token_version=3, nickname='tester', is_social=False)
        recovered_user = SimpleNamespace(id=123, token_version=0, nickname='tester', is_social=False)
        refresh = issue_tokens(deleted_user)['refresh']

        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(recovered_user)),
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 401)

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rotates_with_current_token_version(self):
        user = SimpleNamespace(id=123, token_version=4, nickname='tester', is_social=False)
        refresh = issue_tokens(user)['refresh']

        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(user)),
            patch('rest_framework_simplejwt.tokens.OutstandingToken.objects.create'),
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(decode_token(response.data['refresh'])['token_version'], 4)
        self.assertEqual(decode_token(response.data['access'])['token_version'], 4)


def fake_user_model(user):
    class FakeUserModel:
        class DoesNotExist(Exception):
            pass

    FakeUserModel.objects = FakeUserManager(user, FakeUserModel.DoesNotExist)

    return FakeUserModel


def issue_tokens(user):
    with patch('rest_framework_simplejwt.tokens.OutstandingToken.objects.create'):
        return get_tokens_for_user(user)


def issue_legacy_refresh_without_token_version(user):
    with patch('rest_framework_simplejwt.tokens.OutstandingToken.objects.create'):
        refresh = RefreshToken.for_user(user)
    return refresh


def decode_token(token):
    return token_backend.decode(token, verify=True)


def patch_blacklist_lookup():
    class EmptyBlacklistQuery:
        def exists(self):
            return False

    return patch(
        'rest_framework_simplejwt.token_blacklist.models.BlacklistedToken.objects.filter',
        return_value=EmptyBlacklistQuery(),
    )


class FakeUserManager:
    def __init__(self, user, does_not_exist):
        self.user = user
        self.does_not_exist = does_not_exist

    def get(self, id):
        if str(id) == str(self.user.id):
            return self.user
        raise self.does_not_exist()

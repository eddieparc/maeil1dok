from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.middleware.csrf import _get_new_csrf_string
from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import (
    ACCESS_TOKEN_COOKIE,
    CookieJWTAuthentication,
    REFRESH_TOKEN_COOKIE,
    get_tokens_for_user,
    token_version_is_current,
)
from .cookie_views import CookieTokenRefreshView, cookie_logout


class AuthTokenVersionTests(SimpleTestCase):
    def test_get_tokens_for_user_includes_token_version_on_access_and_refresh(self):
        user = fake_user(token_version=7)

        tokens = issue_tokens(user)

        self.assertEqual(decode_token(tokens['refresh'])['token_version'], 7)
        self.assertEqual(decode_token(tokens['access'])['token_version'], 7)

    def test_token_version_check_rejects_missing_claim_for_version_zero_user(self):
        user = fake_user(token_version=0)
        refresh = issue_legacy_refresh_without_token_version(user)

        self.assertFalse(token_version_is_current(refresh.access_token, user))

    def test_cookie_access_with_malformed_authorization_header_still_requires_csrf(self):
        user = fake_user(token_version=4)
        access_token = issue_tokens(user)['access']
        request = APIRequestFactory().post(
            '/api/v1/todos/plan/',
            HTTP_AUTHORIZATION='Bearer malformed',
        )
        request.COOKIES[ACCESS_TOKEN_COOKIE] = access_token
        request._dont_enforce_csrf_checks = False

        with patch('rest_framework_simplejwt.authentication.get_user_model', return_value=fake_user_model(user)):
            with self.assertRaises(AuthenticationFailed):
                CookieJWTAuthentication().authenticate(request)

    def test_header_access_without_cookie_does_not_require_csrf(self):
        user = fake_user(token_version=4)
        access_token = issue_tokens(user)['access']
        request = APIRequestFactory().post(
            '/api/v1/todos/plan/',
            HTTP_AUTHORIZATION=f'Bearer {access_token}',
        )
        request._dont_enforce_csrf_checks = False

        with patch('rest_framework_simplejwt.authentication.get_user_model', return_value=fake_user_model(user)):
            authenticated_user, _ = CookieJWTAuthentication().authenticate(request)

        self.assertEqual(authenticated_user.id, user.id)

    def test_invalid_cookie_falls_back_to_valid_header_without_csrf(self):
        user = fake_user(token_version=4)
        access_token = issue_tokens(user)['access']
        request = APIRequestFactory().post(
            '/api/v1/todos/plan/',
            HTTP_AUTHORIZATION=f'Bearer {access_token}',
        )
        request.COOKIES[ACCESS_TOKEN_COOKIE] = 'malformed'
        request._dont_enforce_csrf_checks = False

        with patch('rest_framework_simplejwt.authentication.get_user_model', return_value=fake_user_model(user)):
            authenticated_user, _ = CookieJWTAuthentication().authenticate(request)

        self.assertEqual(authenticated_user.id, user.id)

    def test_stale_cookie_falls_back_to_current_header_without_csrf(self):
        stale_user = fake_user(token_version=3)
        current_user = fake_user(token_version=4)
        stale_cookie = issue_tokens(stale_user)['access']
        current_header = issue_tokens(current_user)['access']
        request = APIRequestFactory().post(
            '/api/v1/todos/plan/',
            HTTP_AUTHORIZATION=f'Bearer {current_header}',
        )
        request.COOKIES[ACCESS_TOKEN_COOKIE] = stale_cookie
        request._dont_enforce_csrf_checks = False

        with patch(
            'rest_framework_simplejwt.authentication.get_user_model',
            return_value=fake_user_model(current_user),
        ):
            authenticated_user, _ = CookieJWTAuthentication().authenticate(request)

        self.assertEqual(authenticated_user.id, current_user.id)

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rejects_missing_token_version_claim(self):
        user = fake_user(token_version=0)
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
        old_user = fake_user(token_version=1)
        current_user = fake_user(token_version=2)
        refresh = issue_tokens(old_user)['refresh']

        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(current_user)),
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 401)

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rejects_stale_token_version_after_account_recovery(self):
        deleted_user = fake_user(token_version=3)
        recovered_user = fake_user(token_version=4)
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
        user = fake_user(token_version=4)
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

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_rejects_cookie_token_without_csrf(self):
        user = fake_user(token_version=4)
        refresh = issue_tokens(user)['refresh']
        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {}, format='json')
        request.COOKIES[REFRESH_TOKEN_COOKIE] = refresh
        request._dont_enforce_csrf_checks = False

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(user)) as get_user_model_mock,
            patch('rest_framework_simplejwt.tokens.OutstandingToken.objects.create') as outstanding_create_mock,
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'CSRF validation failed')
        self.assertNotIn('access_token', response.cookies)
        self.assertNotIn(REFRESH_TOKEN_COOKIE, response.cookies)
        get_user_model_mock.assert_not_called()
        outstanding_create_mock.assert_not_called()

    @override_settings(SIMPLE_JWT={'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': False})
    def test_cookie_refresh_accepts_cookie_token_with_csrf(self):
        user = fake_user(token_version=4)
        refresh = issue_tokens(user)['refresh']
        csrf_secret = _get_new_csrf_string()
        request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {}, format='json')
        request.COOKIES[REFRESH_TOKEN_COOKIE] = refresh
        request.COOKIES[settings.CSRF_COOKIE_NAME] = csrf_secret
        request.META['CSRF_COOKIE'] = csrf_secret
        request.META['HTTP_X_CSRFTOKEN'] = csrf_secret
        request._dont_enforce_csrf_checks = False

        with (
            patch('accounts.cookie_views.get_user_model', return_value=fake_user_model(user)),
            patch('rest_framework_simplejwt.tokens.OutstandingToken.objects.create'),
            patch_blacklist_lookup(),
        ):
            response = CookieTokenRefreshView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(decode_token(response.data['refresh'])['token_version'], 4)
        self.assertIn('access_token', response.cookies)

    def test_cookie_logout_rejects_cookie_token_without_csrf_before_blacklist(self):
        user = fake_user(token_version=4)
        refresh = issue_tokens(user)['refresh']
        request = APIRequestFactory().post('/api/v1/auth/logout/', {}, format='json')
        request.COOKIES[REFRESH_TOKEN_COOKIE] = refresh
        request._dont_enforce_csrf_checks = False

        with patch('accounts.cookie_views.RefreshToken') as refresh_token_mock:
            response = cookie_logout(request)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], 'CSRF validation failed')
        refresh_token_mock.assert_not_called()
        self.assertNotIn(ACCESS_TOKEN_COOKIE, response.cookies)
        self.assertNotIn(REFRESH_TOKEN_COOKIE, response.cookies)

    def test_cookie_logout_accepts_cookie_token_with_csrf_and_clears_cookies(self):
        user = fake_user(token_version=4)
        refresh = issue_tokens(user)['refresh']
        csrf_secret = _get_new_csrf_string()
        request = APIRequestFactory().post('/api/v1/auth/logout/', {}, format='json')
        request.COOKIES[REFRESH_TOKEN_COOKIE] = refresh
        request.COOKIES[settings.CSRF_COOKIE_NAME] = csrf_secret
        request.META['CSRF_COOKIE'] = csrf_secret
        request.META['HTTP_X_CSRFTOKEN'] = csrf_secret
        request._dont_enforce_csrf_checks = False

        with patch('accounts.cookie_views.RefreshToken') as refresh_token_mock:
            response = cookie_logout(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Logged out successfully')
        refresh_token_mock.assert_called_once_with(refresh)
        refresh_token_mock.return_value.blacklist.assert_called_once_with()
        self.assertIn(ACCESS_TOKEN_COOKIE, response.cookies)
        self.assertIn(REFRESH_TOKEN_COOKIE, response.cookies)

    def test_cookie_logout_without_refresh_cookie_still_clears_cookies(self):
        request = APIRequestFactory().post('/api/v1/auth/logout/', {}, format='json')
        request._dont_enforce_csrf_checks = False

        with patch('accounts.cookie_views.RefreshToken') as refresh_token_mock:
            response = cookie_logout(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Logged out successfully')
        refresh_token_mock.assert_not_called()
        self.assertIn(ACCESS_TOKEN_COOKIE, response.cookies)
        self.assertIn(REFRESH_TOKEN_COOKIE, response.cookies)

    def test_cookie_logout_blacklist_failure_uses_generic_client_response(self):
        user = fake_user(token_version=4)
        refresh = issue_tokens(user)['refresh']
        csrf_secret = _get_new_csrf_string()
        request = APIRequestFactory().post('/api/v1/auth/logout/', {}, format='json')
        request.COOKIES[REFRESH_TOKEN_COOKIE] = refresh
        request.COOKIES[settings.CSRF_COOKIE_NAME] = csrf_secret
        request.META['CSRF_COOKIE'] = csrf_secret
        request.META['HTTP_X_CSRFTOKEN'] = csrf_secret
        request._dont_enforce_csrf_checks = False

        with (
            self.assertLogs('accounts.cookie_views', level='WARNING') as logs,
            patch('accounts.cookie_views.RefreshToken') as refresh_token_mock,
        ):
            refresh_token_mock.return_value.blacklist.side_effect = TokenError(
                'raw-error-sentinel'
            )
            response = cookie_logout(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Logged out successfully')
        self.assertNotIn('raw-error-sentinel', str(response.data))
        self.assertIn('TokenError', '\n'.join(logs.output))
        self.assertNotIn('raw-error-sentinel', '\n'.join(logs.output))
        self.assertIn(ACCESS_TOKEN_COOKIE, response.cookies)
        self.assertIn(REFRESH_TOKEN_COOKIE, response.cookies)


def fake_user_model(user):
    class FakeUserModel:
        class DoesNotExist(Exception):
            pass

    FakeUserModel.objects = FakeUserManager(user, FakeUserModel.DoesNotExist)

    return FakeUserModel


def issue_tokens(user):
    with patch('rest_framework_simplejwt.tokens.OutstandingToken.objects.create'):
        return get_tokens_for_user(user)


def fake_user(token_version):
    return SimpleNamespace(
        id=123,
        token_version=token_version,
        nickname='tester',
        is_social=False,
        is_active=True,
    )


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

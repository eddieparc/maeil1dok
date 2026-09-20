"""No database creation or provider calls: real JWT/CSRF validation at the boundary."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.http import HttpResponse
from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.test import RequestFactory, SimpleTestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.tokens import AccessToken

from accounts import authentication
from accounts.spectacular import CookieJWTAuthenticationScheme


class CookieIsolationTests(SimpleTestCase):
    def load_auth(self):
        # A deployment imports these constants once. A private module gives each
        # settings profile that same startup behavior without poisoning callers.
        spec = importlib.util.spec_from_file_location('isolated_auth', authentication.__file__)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_primary_defaults_and_domain_setting_clearing_remain_compatible(self):
        auth = self.load_auth()
        self.assertEqual((auth.ACCESS_TOKEN_COOKIE, auth.REFRESH_TOKEN_COOKIE, auth.SOCIAL_SIGNUP_COOKIE),
                         ('access_token', 'refresh_token', 'social_signup'))
        with override_settings(DEBUG=False, COOKIE_DOMAIN='.maeil1dok.app', COOKIE_SAMESITE='Lax'):
            self.assert_cookie_lifecycle(auth, '.maeil1dok.app')
        self.assertEqual(CookieJWTAuthenticationScheme(None).get_security_definition(None)[0]['name'], 'access_token')

    def assert_cookie_lifecycle(self, auth, domain):
        response = auth.set_auth_cookies(HttpResponse(), 'access', 'refresh')
        auth.set_social_signup_cookie(response, 'signup')
        names = {auth.ACCESS_TOKEN_COOKIE, auth.REFRESH_TOKEN_COOKIE, auth.SOCIAL_SIGNUP_COOKIE}
        self.assertEqual(set(response.cookies), names)
        for cookie in response.cookies.values():
            self.assertEqual(cookie['domain'], domain)
            self.assertEqual(cookie['path'], '/')
            self.assertEqual(cookie['samesite'], 'Lax')
            self.assertTrue(cookie['secure'])
            self.assertTrue(cookie['httponly'])
        response = auth.clear_auth_cookies(HttpResponse())
        auth.clear_social_signup_cookie(response)
        self.assertEqual(set(response.cookies), names)
        for cookie in response.cookies.values():
            self.assertEqual(cookie['max-age'], 0)
            self.assertEqual(cookie['domain'], domain)
            self.assertEqual(cookie['path'], '/')
            self.assertEqual(cookie['samesite'], 'Lax')

    @override_settings(ACCESS_TOKEN_COOKIE_NAME='beta_access_token', REFRESH_TOKEN_COOKIE_NAME='beta_refresh_token',
                       SOCIAL_SIGNUP_COOKIE_NAME='beta_social_signup', COOKIE_DOMAIN=None, DEBUG=False, COOKIE_SAMESITE='Lax')
    def test_beta_cookie_names_and_host_only_clearing(self):
        auth = self.load_auth()
        self.assertEqual((auth.ACCESS_TOKEN_COOKIE, auth.REFRESH_TOKEN_COOKIE, auth.SOCIAL_SIGNUP_COOKIE),
                         ('beta_access_token', 'beta_refresh_token', 'beta_social_signup'))
        self.assert_cookie_lifecycle(auth, '')
        self.assertEqual(CookieJWTAuthenticationScheme(None).get_security_definition(None)[0]['name'], 'beta_access_token')

    @override_settings(ACCESS_TOKEN_COOKIE_NAME='beta_access_token')
    def test_primary_cookie_is_never_consumed_even_when_cryptographically_valid(self):
        auth = self.load_auth().CookieJWTAuthentication()
        request = RequestFactory().get('/api/v1/auth/user/')
        request.COOKIES['access_token'] = str(AccessToken())
        with patch.object(auth, 'get_user') as get_user:
            self.assertIsNone(auth.authenticate(request))
        get_user.assert_not_called()

    @override_settings(ACCESS_TOKEN_COOKIE_NAME='beta_access_token')
    def test_coexisting_cookies_select_beta_and_do_not_fallback_to_primary(self):
        auth = self.load_auth().CookieJWTAuthentication()
        primary = AccessToken()
        primary['token_version'] = 1
        primary['user_id'] = 999
        beta = AccessToken()
        beta['token_version'] = 2
        beta['user_id'] = 123
        user = SimpleNamespace(token_version=2)
        request = RequestFactory().get('/api/v1/auth/user/')
        request.COOKIES = {'access_token': str(primary), 'beta_access_token': str(beta)}
        with patch.object(auth, 'get_user', return_value=user) as get_user:
            actual_user, token = auth.authenticate(request)
            self.assertIs(actual_user, user)
            self.assertEqual(token['user_id'], 123)
            get_user.assert_called_once()
        request.COOKIES['beta_access_token'] = 'invalid'
        with patch.object(auth, 'get_user') as get_user:
            self.assertIsNone(auth.authenticate(request))
        get_user.assert_not_called()

    @override_settings(ACCESS_TOKEN_COOKIE_NAME='beta_access_token')
    def test_cross_key_access_rejected_in_beta_cookie_and_explicit_bearer(self):
        auth = self.load_auth().CookieJWTAuthentication()
        token = AccessToken()
        token['user_id'] = 123
        token['token_version'] = 1
        foreign = TokenBackend('HS256', signing_key='primary-test-key-that-is-not-beta-123456').encode(token.payload)
        request = RequestFactory().get('/api/v1/auth/user/')
        request.COOKIES['beta_access_token'] = foreign
        with patch.object(auth, 'get_user') as get_user:
            self.assertIsNone(auth.authenticate(request))
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {foreign}'
            with self.assertRaises(AuthenticationFailed):
                auth.authenticate(request)
        get_user.assert_not_called()

    def test_signup_signing_has_no_cross_key_fallback_in_either_direction(self):
        from accounts.views import generate_signup_token, verify_signup_token
        primary_key = 'primary-test-signing-key-not-a-secret-12345'
        beta_key = 'beta-test-signing-key-not-a-secret-1234567'
        with override_settings(SECRET_KEY=primary_key, SECRET_KEY_FALLBACKS=[]):
            primary = generate_signup_token('google', 'primary-test-provider-id')
            self.assertEqual(verify_signup_token(primary)['provider_id'], 'primary-test-provider-id')
        with override_settings(SECRET_KEY=beta_key, SECRET_KEY_FALLBACKS=[]):
            self.assertIsNone(verify_signup_token(primary))
            beta = generate_signup_token('google', 'beta-test-provider-id')
            self.assertEqual(verify_signup_token(beta)['provider_id'], 'beta-test-provider-id')
        with override_settings(SECRET_KEY=primary_key, SECRET_KEY_FALLBACKS=[]):
            self.assertIsNone(verify_signup_token(beta))

    @override_settings(CSRF_COOKIE_NAME='beta_csrftoken', CSRF_COOKIE_DOMAIN=None,
                       CSRF_COOKIE_SECURE=True, CSRF_TRUSTED_ORIGINS=['https://beta.maeil1dok.app'])
    def test_csrf_bootstrap_ignores_primary_cookie_and_rejects_primary_origin(self):
        factory = RequestFactory()
        middleware = CsrfViewMiddleware(lambda request: HttpResponse())
        request = factory.get('/api/v1/auth/csrf/', secure=True, HTTP_HOST='beta.maeil1dok.app')
        request.COOKIES['csrftoken'] = 'a' * 32
        middleware.process_request(request)
        token = get_token(request)
        response = middleware.process_response(request, HttpResponse())
        self.assertEqual(set(response.cookies), {'beta_csrftoken'})
        cookie = response.cookies['beta_csrftoken']
        self.assertEqual(cookie['domain'], '')
        self.assertTrue(cookie['secure'])
        self.assertNotEqual(cookie.value, 'a' * 32)
        for origin, accepted in [('https://beta.maeil1dok.app', True), ('https://maeil1dok.app', False)]:
            request = factory.post('/api/v1/auth/logout/', secure=True, HTTP_HOST='beta.maeil1dok.app',
                                   HTTP_ORIGIN=origin, HTTP_X_CSRFTOKEN=token)
            request.COOKIES = {'csrftoken': 'a' * 32, 'beta_csrftoken': cookie.value}
            middleware.process_request(request)
            rejection = middleware.process_view(request, lambda request: HttpResponse(), (), {})
            self.assertEqual(rejection is None, accepted)


class BetaSettingsTests(SimpleTestCase):
    def test_beta_profile_overrides_primary_security_and_resources(self):
        # Base settings are already loaded with test-only env and an in-memory DB.
        with patch.dict(os.environ, {'BETA_SECRET_KEY': 'isolated-beta-test-key-not-a-secret-12345'}):
            from config import beta_settings as beta
            from config import settings as primary
        self.assertFalse(beta.DEBUG)
        self.assertEqual(beta.ALLOWED_HOSTS, ['beta.maeil1dok.app', 'beta-v.maeil1dok.app'])
        self.assertEqual(beta.CORS_ALLOWED_ORIGINS, [
            'https://beta.maeil1dok.app', 'https://beta-v.maeil1dok.app',
        ])
        self.assertEqual(beta.CSRF_TRUSTED_ORIGINS, beta.CORS_ALLOWED_ORIGINS)
        self.assertEqual(beta.OAUTH_CALLBACK_ORIGINS, beta.CORS_ALLOWED_ORIGINS)
        self.assertEqual(beta.FRONTEND_URL, beta.CORS_ALLOWED_ORIGINS[0])
        self.assertEqual(beta.SECRET_KEY_FALLBACKS, [])
        self.assertEqual(beta.SIMPLE_JWT['SIGNING_KEY'], beta.SECRET_KEY)
        self.assertEqual(beta.DATABASES['default']['HOST'], 'mysql-beta')
        self.assertEqual(beta.DATABASES['default']['NAME'], 'maeil1dok_beta')
        self.assertEqual(beta.DATABASES['default']['USER'], 'maeil1dok_beta')
        self.assertEqual(beta.CACHES['default']['LOCATION'], 'redis://redis-beta:6379/1')
        self.assertEqual(beta.CELERY_BROKER_URL, 'redis://redis-beta:6379/0')
        self.assertEqual(beta.CELERY_RESULT_BACKEND, beta.CELERY_BROKER_URL)
        self.assertEqual(beta.CSRF_COOKIE_NAME, 'beta_csrftoken')
        self.assertEqual(beta.SESSION_COOKIE_NAME, 'beta_sessionid')
        self.assertIsNone(beta.COOKIE_DOMAIN)
        self.assertIsNone(beta.CSRF_COOKIE_DOMAIN)
        self.assertIsNone(beta.SESSION_COOKIE_DOMAIN)
        self.assertTrue(beta.SECURE_SSL_REDIRECT)
        self.assertEqual(beta.SECURE_PROXY_SSL_HEADER, ('HTTP_X_FORWARDED_PROTO', 'https'))
        self.assertTrue(beta.SESSION_COOKIE_SECURE)
        self.assertTrue(beta.CSRF_COOKIE_SECURE)
        self.assertEqual(beta.COOKIE_SAMESITE, 'Lax')
        for name in ('CRON_SECRET', 'GEMINI_API_KEY', 'YOUTUBE_API_KEY'):
            self.assertTrue(getattr(beta, name) == getattr(primary, name), name)
        self.assertTrue(beta.RESEND_API_KEY is None)
        self.assertEqual(beta.ACCOUNT_MAIL_TRANSPORT, 'beta-spool')

    def test_real_beta_startup_csrf_and_refresh_never_use_primary_credentials(self):
        env = {
            'DJANGO_SETTINGS_MODULE': 'config.beta_settings',
            'SECRET_KEY': 'primary-bootstrap-test-key-not-a-secret-12345',
            'BETA_SECRET_KEY': 'beta-independent-test-key-not-a-secret-12345',
            'DB_HOST': 'unused-primary-host', 'DB_NAME': 'unused-primary-db',
            'DB_USER': 'unused-primary-user', 'DB_PASSWORD': 'test-only-password',
            'KAKAO_CLIENT_ID': 'test-only-client',
            'KAKAO_REDIRECT_URI': 'https://maeil1dok.app/auth/kakao/callback',
        }
        code = r'''
import django
django.setup()
from django.conf import settings
from django.middleware.csrf import get_token
from django.test import Client, override_settings
from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.backends import TokenBackend
from rest_framework_simplejwt.tokens import RefreshToken
from accounts import cookie_views, views
from unittest.mock import patch
# Use an isolated in-process throttle store, never connect to beta Redis/MySQL.
# Config tests separately assert the deployed resource URLs.
override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}).enable()
patch('socket.socket.connect', side_effect=AssertionError('outbound network forbidden in isolation test')).start()
assert settings.SECRET_KEY != 'primary-bootstrap-test-key-not-a-secret-12345'
assert cookie_views.REFRESH_TOKEN_COOKIE == 'beta_refresh_token'
assert views.SOCIAL_SIGNUP_COOKIE == 'beta_social_signup'
assert settings.SIMPLE_JWT['SIGNING_KEY'] == settings.SECRET_KEY
client = Client(enforce_csrf_checks=True)
client.cookies['csrftoken'] = 'a' * 32
client.cookies['sessionid'] = 'primary-session-identifier'
response = client.get('/api/v1/auth/csrf/', HTTP_HOST='beta.maeil1dok.app', HTTP_X_FORWARDED_PROTO='https')
assert response.status_code == 200, response.content
assert set(response.cookies) == {'beta_csrftoken'}
assert response.cookies['beta_csrftoken']['domain'] == ''
assert response.wsgi_request.session.session_key is None
assert client.cookies['csrftoken'].value == 'a' * 32
assert response.wsgi_request.is_secure()
# A primary refresh under its original name is absent, not a CSRF request.
request = APIRequestFactory().post('/api/v1/auth/token/refresh/', {}, format='json')
request.COOKIES['refresh_token'] = str(RefreshToken())
with patch('accounts.cookie_views.record_auth_event'):
    response = cookie_views.CookieTokenRefreshView.as_view()(request)
assert response.status_code == 400
assert not response.cookies
# Even relabelling or explicitly submitting a primary-signed JWT cannot cross keys.
foreign = TokenBackend('HS256', signing_key='primary-bootstrap-test-key-not-a-secret-12345').encode(RefreshToken().payload)
for body in [{}, {'refresh': foreign}]:
    request = APIRequestFactory().post('/api/v1/auth/token/refresh/', body, format='json')
    request.COOKIES['beta_refresh_token'] = foreign
    csrf = get_token(request)
    request.COOKIES['beta_csrftoken'] = request.META['CSRF_COOKIE']
    request.META['HTTP_X_CSRFTOKEN'] = csrf
    request._dont_enforce_csrf_checks = False
    with patch('accounts.cookie_views.record_auth_event'):
        response = cookie_views.CookieTokenRefreshView.as_view()(request)
    assert response.status_code == 401
    assert not response.cookies
print('beta startup, proxy HTTPS, CSRF bootstrap, session isolation, refresh name/key rejection: OK')
'''
        result = subprocess.run([sys.executable, '-c', code], cwd=Path(__file__).resolve().parents[1],
                                env=env, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        env.pop('BETA_SECRET_KEY')
        missing = subprocess.run([sys.executable, '-c', 'import config.beta_settings'],
                                 cwd=Path(__file__).resolve().parents[1], env=env,
                                 text=True, capture_output=True, timeout=30)
        self.assertNotEqual(missing.returncode, 0)
        self.assertIn('BETA_SECRET_KEY', missing.stderr)

    @override_settings(OAUTH_CALLBACK_ORIGINS=['https://beta.maeil1dok.app'],
                       GOOGLE_REDIRECT_URI='https://beta.maeil1dok.app/auth/google/callback')
    def test_beta_oauth_callback_rejects_primary_origin(self):
        from accounts.oauth_redirects import InvalidOAuthRedirectURIError, resolve_oauth_redirect_uri
        self.assertEqual(resolve_oauth_redirect_uri('google', None), settings.GOOGLE_REDIRECT_URI)
        with self.assertRaises(InvalidOAuthRedirectURIError):
            resolve_oauth_redirect_uri('google', 'https://maeil1dok.app/auth/google/callback')

"""Isolated beta only; load with docker-compose.beta-isolated.yml, never OCI env."""
from .settings import *
from .settings import _required_env

# A distinct required variable fails closed if someone supplies only primary env.
# Compose also supplies this value as SECRET_KEY for the base settings import.
SECRET_KEY = _required_env('BETA_SECRET_KEY')
SECRET_KEY_FALLBACKS = []
SIMPLE_JWT = {**SIMPLE_JWT, 'SIGNING_KEY': SECRET_KEY}
DEBUG = False

FRONTEND_URL = 'https://beta.maeil1dok.app'
ALLOWED_HOSTS = ['beta.maeil1dok.app']
CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CORS_EXPOSE_HEADERS = [*CORS_EXPOSE_HEADERS, 'x-beta-test-mail']
CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
OAUTH_CALLBACK_ORIGINS = [FRONTEND_URL]
KAKAO_REDIRECT_URI = f'{FRONTEND_URL}/auth/kakao/callback'
GOOGLE_REDIRECT_URI = f'{FRONTEND_URL}/auth/google/callback'
APPLE_REDIRECT_URI = f'{FRONTEND_URL}/auth/apple/callback'

ACCESS_TOKEN_COOKIE_NAME = 'beta_access_token'
REFRESH_TOKEN_COOKIE_NAME = 'beta_refresh_token'
SOCIAL_SIGNUP_COOKIE_NAME = 'beta_social_signup'
CSRF_COOKIE_NAME = 'beta_csrftoken'
SESSION_COOKIE_NAME = 'beta_sessionid'
COOKIE_DOMAIN = None
CSRF_COOKIE_DOMAIN = None
SESSION_COOKIE_DOMAIN = None
COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

DATABASES = {'default': {
    **DATABASES['default'],
    'HOST': 'mysql-beta',
    'PORT': '3306',
    'NAME': 'maeil1dok_beta',
    'USER': 'maeil1dok_beta',
    'OPTIONS': {'charset': 'utf8mb4'},
}}
CACHES = {'default': {
    'BACKEND': 'django.core.cache.backends.redis.RedisCache',
    'LOCATION': 'redis://redis-beta:6379/1',
}}
CELERY_BROKER_URL = 'redis://redis-beta:6379/0'
CELERY_RESULT_BACKEND = CELERY_BROKER_URL

# Worker/beat run like production, so GEMINI/CRON/YOUTUBE/VAPID fall through
# to env. Mail is the exception: success means durable operator-only TEST MAIL
# capture, never delivery — RESEND stays disabled so beta cannot send real mail.
ACCOUNT_MAIL_TRANSPORT = 'beta-spool'
BETA_TEST_MAIL_DIR = '/var/lib/maeil1dok-beta/test-mail'
BETA_TEST_MAIL_MAX_BYTES = 10 * 1024 * 1024
MIDDLEWARE = [*MIDDLEWARE, 'accounts.beta_test_mail.BetaTestMailMiddleware']
RESEND_API_KEY = None

import json
import os
from typing import Final


def _env_flag(name: str, default: bool = False) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.lower() in {'true', '1', 'yes'}


def _json_list_env(name: str) -> list[str]:
    try:
        value = json.loads(os.environ.get(name, '[]'))
    except json.JSONDecodeError:
        return []
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


DEBUG: Final = _env_flag('DEBUG')
PRODUCTION_ORIGINS: Final = [
    'https://maeil1dok.app',
    'https://www.maeil1dok.app',
    'https://api.maeil1dok.app',
]
LOCAL_ORIGINS: Final = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3019',
    'http://127.0.0.1:3019',
    'http://192.168.0.41:3000',
]

CORS_ALLOWED_ORIGINS = list({
    *PRODUCTION_ORIGINS,
    *_json_list_env('CORS_ALLOWED_ORIGINS'),
    *(LOCAL_ORIGINS if DEBUG else []),
})
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['x-csrftoken']

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'
CSRF_TRUSTED_ORIGINS = list({
    *PRODUCTION_ORIGINS,
    *_json_list_env('CSRF_TRUSTED_ORIGINS'),
    *(LOCAL_ORIGINS if DEBUG else []),
})

SECURE_SSL_REDIRECT = (
    _env_flag('SECURE_SSL_REDIRECT', True) if not DEBUG else False
)
SECURE_PROXY_SSL_HEADER = (
    ('HTTP_X_FORWARDED_PROTO', 'https') if not DEBUG else None
)
SESSION_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = (
    int(os.environ.get('SECURE_HSTS_SECONDS', '31536000')) if not DEBUG else 0
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True

COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN') or (
    '.maeil1dok.app' if not DEBUG else None
)
COOKIE_SAMESITE = os.environ.get('COOKIE_SAMESITE') or 'Lax'
CSRF_COOKIE_SAMESITE = COOKIE_SAMESITE
CSRF_COOKIE_DOMAIN = COOKIE_DOMAIN

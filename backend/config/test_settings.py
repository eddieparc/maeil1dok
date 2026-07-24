from .settings import *
import os

# 기본은 빠른 SQLite(:memory:). TEST_DB_ENGINE=mysql 이면 프로덕션과 동일한 MySQL 8 로 실행
# (CI 서비스 컨테이너용 — 레이스컨디션 테스트는 실제 동시 쓰기가 가능한 MySQL 이 필요).
if os.environ.get('TEST_DB_ENGINE') == 'mysql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('DB_NAME', 'maeil1dok_ci'),
            'USER': os.environ.get('DB_USER', 'root'),
            'PASSWORD': os.environ.get('DB_PASSWORD', 'root'),
            'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
            'PORT': os.environ.get('DB_PORT', '3306'),
            'OPTIONS': {'charset': 'utf8mb4'},
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': os.environ.get('SQLITE_TEST_DB', ':memory:'),
            'TEST': {
                'NAME': os.environ.get('SQLITE_TEST_DB'),
            },
        }
    }

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
ROOT_URLCONF = 'config.test_urls'
SECURE_SSL_REDIRECT = False
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'maeil1dok-tests',
    }
}
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
}

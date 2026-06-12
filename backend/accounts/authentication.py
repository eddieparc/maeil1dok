from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed
from django.middleware.csrf import CsrfViewMiddleware
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

ACCESS_TOKEN_COOKIE = 'access_token'
REFRESH_TOKEN_COOKIE = 'refresh_token'
TOKEN_VERSION_CLAIM = 'token_version'


class CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(ACCESS_TOKEN_COOKIE)
        used_cookie = raw_token is not None
        validated_token = None
        
        has_cookie = raw_token is not None
        auth_header = self.get_header(request)
        has_header = auth_header is not None
        
        logger.debug(f"[AUTH] path={request.path}, has_cookie={has_cookie}, has_header={has_header}")

        if raw_token is None:
            if auth_header is None:
                return None
            raw_token = self.get_raw_token(auth_header)
            if raw_token is None:
                return None
            used_cookie = False

        try:
            validated_token = self.get_validated_token(raw_token)
        except TokenError as e:
            logger.debug(f"[AUTH] Token validation failed: {e}")
            if not used_cookie:
                return None

        if validated_token is None and used_cookie:
            if auth_header is None:
                return None
            raw_token = self.get_raw_token(auth_header)
            if raw_token is None:
                return None
            used_cookie = False
            try:
                validated_token = self.get_validated_token(raw_token)
            except TokenError as e:
                logger.debug(f"[AUTH] Header fallback token also failed: {e}")
                return None

        if validated_token is None:
            return None

        user = self.get_user(validated_token)
        
        if not token_version_is_current(validated_token, user):
            token_version = validated_token.get(TOKEN_VERSION_CLAIM, 0)
            logger.debug(f"[AUTH] Token version mismatch: token={token_version}, user={user.token_version}")
            return None

        require_csrf = used_cookie and not has_header
        if require_csrf:
            self.enforce_csrf(request)

        return user, validated_token

    def enforce_csrf(self, request):
        if request.method in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            return

        check = CSRFCheck(lambda req: None)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise AuthenticationFailed(f'CSRF validation failed: {reason}')


def get_cookie_settings():
    is_production = not settings.DEBUG
    cookie_domain = getattr(settings, 'COOKIE_DOMAIN', None)
    samesite = getattr(settings, 'COOKIE_SAMESITE', 'Lax')

    cookie_settings = {
        'httponly': True,
        'secure': is_production,
        'samesite': samesite,
        'path': '/',
    }

    if cookie_domain:
        cookie_settings['domain'] = cookie_domain

    return cookie_settings


def set_auth_cookies(response, access_token, refresh_token=None):
    """
    응답에 인증 쿠키 설정

    Args:
        response: Django Response 객체
        access_token: JWT access token 문자열
        refresh_token: JWT refresh token 문자열 (optional)
    """
    cookie_settings = get_cookie_settings()

    # Access Token 쿠키 (1시간)
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=str(access_token),
        max_age=60 * 60,  # 1시간
        **cookie_settings
    )

    # Refresh Token 쿠키 (30일)
    if refresh_token:
        response.set_cookie(
            key=REFRESH_TOKEN_COOKIE,
            value=str(refresh_token),
            max_age=60 * 60 * 24 * 30,  # 30일
            **cookie_settings
        )

    return response


def clear_auth_cookies(response):
    cookie_settings = get_cookie_settings()
    
    delete_kwargs = {
        'path': cookie_settings['path'],
        'samesite': cookie_settings['samesite'],
    }
    if 'domain' in cookie_settings:
        delete_kwargs['domain'] = cookie_settings['domain']

    response.delete_cookie(key=ACCESS_TOKEN_COOKIE, **delete_kwargs)
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE, **delete_kwargs)

    return response


def get_tokens_for_user(user):
    """
    사용자에 대한 JWT 토큰 쌍 생성 (token_version 포함)
    """
    refresh = RefreshToken.for_user(user)
    refresh[TOKEN_VERSION_CLAIM] = user.token_version
    refresh['nickname'] = user.nickname
    refresh['is_social'] = user.is_social
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def token_version_is_current(validated_token, user):
    token_version = validated_token.get(TOKEN_VERSION_CLAIM)
    return token_version is not None and token_version == user.token_version

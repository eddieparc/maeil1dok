"""
HttpOnly Cookie 기반 JWT 인증 뷰

기존 토큰 응답 방식과 쿠키 방식을 모두 지원하여 점진적 마이그레이션 가능
"""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.middleware.csrf import get_token

from authmetrics import refresh as refresh_metrics
from authmetrics.models import AuthMethod, EventKind, Outcome
from authmetrics.recording import record_auth_event
from . import handoff
from django.conf import settings
from django.contrib.auth import get_user_model

from .authentication import (
    CSRFCheck,
    set_auth_cookies,
    clear_auth_cookies,
    get_tokens_for_user,
    token_version_is_current,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
)
from .serializers import (
    CustomTokenObtainPairSerializer,
    TokenPairResponseSerializer,
    TokenRefreshResponseSerializer,
    UserSerializer,
)
from .throttles import LoginThrottle
from . import openapi_serializers as openapi

import logging

logger = logging.getLogger(__name__)


class CookieTokenObtainPairView(TokenObtainPairView):
    """
    로그인 시 JWT 토큰을 HttpOnly 쿠키로 설정

    응답 본문에도 토큰을 포함하여 하위 호환성 유지
    프론트엔드가 완전히 마이그레이션되면 본문에서 토큰 제거 가능
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]

    @extend_schema(responses={200: TokenPairResponseSerializer})
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        # 토큰 데이터
        tokens = serializer.validated_data

        # 응답 생성 (하위 호환을 위해 토큰도 본문에 포함)
        response_data = {
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': UserSerializer(serializer.user).data if hasattr(serializer, 'user') else None
        }

        response = Response(response_data, status=status.HTTP_200_OK)

        # HttpOnly 쿠키 설정
        set_auth_cookies(response, tokens['access'], tokens['refresh'])

        # CSRF 토큰 설정 (쿠키 기반 인증을 위해)
        response['X-CSRFToken'] = get_token(request)

        logger.info(f"Login successful, cookies set")
        return response


def _record_refresh_rejection(request, cause, *, status_code=401, payload=None):
    """Record one refresh rejection with its cause and the token's age.

    Cause is recorded per rejection reason, not as one aggregate failure: the
    north-star metric needs `blacklisted` inside the token lifetime separated
    from an ordinary `expired`, and a single counter cannot express that.
    """
    record_auth_event(
        event=EventKind.REFRESH_401,
        method=AuthMethod.REFRESH_REDEMPTION,
        outcome=Outcome.FAIL,
        status=status_code,
        route=request.path,
        cause=cause,
        age_seconds=refresh_metrics.refresh_age_seconds(payload),
        client=request.headers.get('X-Client', ''),
    )


class CookieTokenRefreshView(TokenRefreshView):
    """
    토큰 갱신 시 새 토큰을 HttpOnly 쿠키로 설정

    쿠키 또는 요청 본문에서 refresh 토큰을 읽음
    """

    @extend_schema(responses={200: TokenRefreshResponseSerializer})
    def post(self, request, *args, **kwargs):
        # 본문에 토큰을 제시한 요청은 CSRF 검사 대상이 아니다.
        #
        # CSRF 가 막는 것은 "브라우저가 가진 주변 권한(쿠키)으로 공격자가 요청을
        # 일으키는 것"이다. 공격자는 HttpOnly refresh 쿠키를 읽을 수 없으므로 이
        # 본문을 만들 수 없다 — 그 값을 제시했다는 사실 자체가 소지 증명이고,
        # 쿠키의 주변 권한에 기대지 않았다는 증명이다.
        #
        # 이 분기가 없어서 실제로 무슨 일이 있었는지 (2026-08-30 프로덕션 실측):
        # 셸은 저장한 토큰을 본문에 담아 보내는데 `sharedCookiesEnabled` 때문에
        # 네이티브 fetch 가 refresh 쿠키까지 자동 첨부한다. 쿠키가 보이니 CSRF 검사가
        # 돌고, 네이티브 fetch 에는 Origin 도 Referer 도 없어 Django 의 검사는 절대
        # 통과할 수 없다. 그래서 **모든** 상환이 403 이었고 본문 토큰은 읽히지도
        # 않았다. 세션은 1시간짜리 access 쿠키로만 버텼고 사용자는 매시간 로그아웃됐다.
        body_token = request.data.get('refresh') if hasattr(request.data, 'get') else None
        cookie_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)

        if body_token:
            refresh_token = body_token
        else:
            # 쿠키 단독 상환 = 주변 권한에 기댄 요청. 여기서는 보호를 그대로 둔다.
            refresh_token = cookie_token
            if cookie_token is not None:
                csrf_rejection = CSRFCheck(lambda req: None).process_view(
                    request, None, (), {}
                )
                if csrf_rejection:
                    _record_refresh_rejection(
                        request, refresh_metrics.CAUSE_CSRF, status_code=403
                    )
                    return Response(
                        {'error': 'CSRF validation failed'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

        if not refresh_token:
            _record_refresh_rejection(
                request, refresh_metrics.CAUSE_MISSING_TOKEN, status_code=400
            )
            return Response(
                {'error': 'Refresh token not provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refresh = RefreshToken(refresh_token)
            User = get_user_model()
            user_id = refresh.payload.get('user_id')
            if not user_id:
                logger.warning("Token refresh failed: missing user_id claim")
                _record_refresh_rejection(
                    request,
                    refresh_metrics.CAUSE_MISSING_USER_CLAIM,
                    payload=refresh.payload,
                )
                return Response(
                    {'error': 'Invalid refresh token'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.warning(f"Token refresh failed: user {user_id} not found")
                _record_refresh_rejection(
                    request,
                    refresh_metrics.CAUSE_USER_NOT_FOUND,
                    payload=refresh.payload,
                )
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not getattr(user, 'is_active', True):
                logger.warning(f"Token refresh failed: inactive user {user_id}")
                _record_refresh_rejection(
                    request,
                    refresh_metrics.CAUSE_USER_INACTIVE,
                    payload=refresh.payload,
                )
                return Response(
                    {'error': 'User account is inactive'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not token_version_is_current(refresh, user):
                logger.warning(f"Token refresh failed: stale token for user {user_id}")
                _record_refresh_rejection(
                    request,
                    refresh_metrics.CAUSE_STALE_GENERATION,
                    payload=refresh.payload,
                )
                return Response(
                    {'error': 'Refresh token has been revoked'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
                    try:
                        refresh.blacklist()
                    except AttributeError:
                        logger.info("Refresh token blacklist app is not installed; skipping blacklist")

                tokens = get_tokens_for_user(user)
                access_token = tokens['access']
                new_refresh_token = tokens['refresh']
            else:
                access_token = str(refresh.access_token)
                new_refresh_token = refresh_token

            response_data = {
                'access': access_token,
                'refresh': new_refresh_token,
            }

            response = Response(response_data, status=status.HTTP_200_OK)
            set_auth_cookies(response, access_token, new_refresh_token)

            # CSRF 토큰 갱신 (쿠키 기반 인증에서 토큰 갱신 후 CSRF 유효성 유지를 위해)
            response['X-CSRFToken'] = get_token(request)

            return response

        except TokenError as e:
            logger.warning(f"Token refresh failed: {e}")
            # The north-star producer. `RefreshToken(...)` raises before a payload
            # exists, so age is read from the raw token without validating it --
            # an unverified `iat` is fine for bucketing and is the only way to tell
            # "rotated while still young" from "simply expired".
            _record_refresh_rejection(
                request,
                refresh_metrics.classify_token_error(e),
                payload=refresh_metrics.unverified_payload(refresh_token),
            )
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )


@extend_schema(responses={200: openapi.MessageResponseSerializer})
@api_view(['POST'])
@permission_classes([AllowAny])
def cookie_logout(request):
    """
    로그아웃 처리 - 토큰 만료 상태에서도 호출 가능해야 함
    
    AllowAny를 사용하는 이유:
    - access_token이 만료된 상태에서도 사용자가 로그아웃할 수 있어야 함
    - 쿠키 삭제는 인증 상태와 관계없이 수행되어야 함
    """
    refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)
    if refresh_token:
        csrf_rejection = CSRFCheck(lambda req: None).process_view(request, None, (), {})
        if csrf_rejection:
            return Response(
                {'error': 'CSRF validation failed'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info("Refresh token blacklisted")
        except (TokenError, AttributeError) as e:
            logger.warning(
                "Refresh token blacklist failed during logout: %s",
                e.__class__.__name__,
            )

    # Invalidate handoff codes already issued to this user. Without this, a code
    # that arrives moments later would mint fresh cookies and revive the session
    # the user just ended -- the app would look signed in again right after
    # signing out. See accounts/handoff.py.
    #
    # Identifying the user is best-effort: this endpoint is AllowAny so that an
    # expired access token can still log out, and the refresh token may be
    # unparseable. When the user cannot be identified there is nothing to mark,
    # and the shell-side cleanup is what covers that case.
    logout_user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else None
    if logout_user_id is None and refresh_token:
        payload = refresh_metrics.unverified_payload(refresh_token)
        if payload:
            logout_user_id = payload.get('user_id')
    if logout_user_id is not None:
        from django.core.cache import cache

        handoff.mark_logged_out(cache, logout_user_id)

    response = Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)

    clear_auth_cookies(response)
    return response


@extend_schema(responses={200: openapi.CsrfTokenResponseSerializer})
@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """
    CSRF 토큰 조회

    쿠키 기반 인증에서 CSRF 보호를 위해 사용
    """
    csrf_token = get_token(request)
    return Response({'csrfToken': csrf_token})


@extend_schema(
    responses={200: openapi.AuthenticatedUserResponseSerializer},
    description=(
        'Auth probe. `/api/v1/auth/user/` is the canonical current-user contract; '
        'this route returns the same user payload wrapped in `{authenticated, user}` '
        'and exists for callers that depend on that envelope.'
    ),
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_auth(request):
    # Not marked `deprecated` in the schema on purpose: that flag already carries a
    # different meaning here -- it distinguishes the /accounts/ compatibility alias
    # from the canonical /auth/ route, and tests.test_openapi_schema asserts exactly
    # one of each pair carries it. Overloading it would destroy that signal.
    #
    # The payload is built from the same serializer /api/v1/auth/user/ uses, so the
    # two cannot drift; only the envelope differs. Reaching this view means DRF has
    # already authenticated the request, so `authenticated` is always True.
    return Response({
        'authenticated': True,
        'user': UserSerializer(request.user).data
    })

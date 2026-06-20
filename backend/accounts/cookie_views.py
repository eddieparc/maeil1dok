"""
HttpOnly Cookie 기반 JWT 인증 뷰

기존 토큰 응답 방식과 쿠키 방식을 모두 지원하여 점진적 마이그레이션 가능
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.middleware.csrf import get_token
from django.conf import settings
from django.contrib.auth import get_user_model

from .authentication import (
    set_auth_cookies,
    clear_auth_cookies,
    get_tokens_for_user,
    token_version_is_current,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
)
from .serializers import CustomTokenObtainPairSerializer, UserSerializer

import logging

logger = logging.getLogger(__name__)


class CookieTokenObtainPairView(TokenObtainPairView):
    """
    로그인 시 JWT 토큰을 HttpOnly 쿠키로 설정

    응답 본문에도 토큰을 포함하여 하위 호환성 유지
    프론트엔드가 완전히 마이그레이션되면 본문에서 토큰 제거 가능
    """
    serializer_class = CustomTokenObtainPairSerializer

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


class CookieTokenRefreshView(TokenRefreshView):
    """
    토큰 갱신 시 새 토큰을 HttpOnly 쿠키로 설정

    쿠키 또는 요청 본문에서 refresh 토큰을 읽음
    """

    def post(self, request, *args, **kwargs):
        # 쿠키에서 refresh 토큰 읽기 (우선)
        refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)

        # 쿠키에 없으면 요청 본문에서 읽기 (하위 호환)
        if not refresh_token:
            refresh_token = request.data.get('refresh')

        if not refresh_token:
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
                return Response(
                    {'error': 'Invalid refresh token'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.warning(f"Token refresh failed: user {user_id} not found")
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not getattr(user, 'is_active', True):
                logger.warning(f"Token refresh failed: inactive user {user_id}")
                return Response(
                    {'error': 'User account is inactive'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not token_version_is_current(refresh, user):
                logger.warning(f"Token refresh failed: stale token for user {user_id}")
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
            return Response(
                {'error': 'Invalid or expired refresh token'},
                status=status.HTTP_401_UNAUTHORIZED
            )


@api_view(['POST'])
@permission_classes([AllowAny])
def cookie_logout(request):
    """
    로그아웃 처리 - 토큰 만료 상태에서도 호출 가능해야 함
    
    AllowAny를 사용하는 이유:
    - access_token이 만료된 상태에서도 사용자가 로그아웃할 수 있어야 함
    - 쿠키 삭제는 인증 상태와 관계없이 수행되어야 함
    """
    blacklist_success = False
    blacklist_error = None

    refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)
    if refresh_token:
        for attempt in range(2):
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
                blacklist_success = True
                logger.info("Refresh token blacklisted")
                break
            except (TokenError, AttributeError) as e:
                blacklist_error = str(e)
                if attempt == 0:
                    logger.warning(f"Blacklist attempt {attempt + 1} failed: {e}, retrying...")
                else:
                    logger.error(f"Failed to blacklist token after {attempt + 1} attempts: {e}")
    else:
        blacklist_success = True

    if blacklist_success:
        response = Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
    else:
        response = Response(
            {'message': 'Logged out, but token revocation failed', 'warning': blacklist_error},
            status=status.HTTP_200_OK
        )

    clear_auth_cookies(response)
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    """
    CSRF 토큰 조회

    쿠키 기반 인증에서 CSRF 보호를 위해 사용
    """
    csrf_token = get_token(request)
    return Response({'csrfToken': csrf_token})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_auth(request):
    """
    현재 인증 상태 확인

    쿠키 기반 인증이 정상 작동하는지 테스트용
    """
    return Response({
        'authenticated': True,
        'user': UserSerializer(request.user).data
    })

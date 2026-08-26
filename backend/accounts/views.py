# noqa: SIZE_OK  — account endpoints are kept in the legacy Django view module until a dedicated routing split lands
from django.shortcuts import render
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes, throttle_classes
from .throttles import LoginThrottle, PasswordResetThrottle, EmailVerificationThrottle
from . import openapi_serializers as openapi
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import (
    RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer, 
    SocialLoginSerializer, EmailRegisterSerializer, LinkedAccountsSerializer,
    SetPasswordSerializer, PasswordResetConfirmSerializer,
    AccountEmailSerializer, NotificationSettingsSerializer
)
from .authentication import clear_auth_cookies, get_tokens_for_user, set_auth_cookies
from .email_identity import normalize_email_identity
from .models import SocialAccount, EmailVerificationToken, PasswordResetToken, UserReadingSettings
from .visibility import is_live_user
from .email_utils import send_verification_email, send_password_reset_email, send_welcome_email
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction
from django.db.models import Q
import requests

# 외부 OAuth/소셜 API 호출 타임아웃(초): 무한 대기 방지
OAUTH_TIMEOUT = 10
from django.conf import settings
from django.core import signing
from django.utils import timezone
from datetime import timedelta
from todos.models import BibleReadingPlan, PlanSubscription
from authz import can, subject_from_request
from authz.policies.notification import NotificationSettingsCurrent
from todos.services.notifications import get_notification_settings
import logging
import uuid

logger = logging.getLogger(__name__)
User = get_user_model()

SIGNUP_TOKEN_SALT = 'social-signup-token'
SIGNUP_TOKEN_MAX_AGE = 600  # 10분
OAUTH_LINK_STATE_SALT = 'oauth-link-state'
OAUTH_LINK_STATE_MAX_AGE = 600
SOCIAL_MERGE_TOKEN_SALT = 'social-merge-token'
SOCIAL_MERGE_TOKEN_MAX_AGE = 600
SESSION_BRIDGE_TTL_SECONDS = 60


class OAuthProviderError(Exception):
    """Sanitized provider failure safe to include in server logs."""


def _valid_session_bridge_code(code):
    if not isinstance(code, str):
        return False
    try:
        return str(uuid.UUID(code)) == code
    except ValueError:
        return False


def _consume_session_bridge_user_id(cache, code):
    if not _valid_session_bridge_code(code):
        return None

    consumed_key = f'session_bridge_consumed:{code}'
    if not cache.add(consumed_key, True, timeout=SESSION_BRIDGE_TTL_SECONDS):
        return None

    cache_key = f'session_bridge:{code}'
    user_id = cache.get(cache_key)
    if user_id is None:
        return None

    cache.delete(cache_key)
    return user_id


def _is_session_bridge_user_eligible(user):
    return is_live_user(user)


def _raise_oauth_provider_error(provider, reason):
    raise OAuthProviderError(f"{provider} OAuth failed: {reason}")


def _is_active_email_identity_conflict(error):
    return 'active_email_identity' in str(error).lower()


def _resolve_email_login_identity(email_identity):
    """Select the login user for a normalized email.

    The ``active_email_identity`` generated field is unique, so at most one active
    user can own a normalized email. Prefer that active account so a legitimate
    active user is never locked out by an intentionally-preserved inactive
    duplicate (e.g. a scheduled-deletion account). When no active account owns the
    email, fall back to a single inactive duplicate so scheduled-deletion restore
    still works; ambiguous inactive duplicates resolve to ``None``.
    """
    active_user = User.objects.filter(
        email__iexact=email_identity, is_active=True
    ).first()
    if active_user is not None:
        return active_user
    inactive_users = list(
        User.objects.filter(email__iexact=email_identity, is_active=False)
        .order_by('id')[:2]
    )
    return inactive_users[0] if len(inactive_users) == 1 else None


def _create_email_user_with_default_subscription(email, password, nickname):
    with transaction.atomic():
        user = User.objects.create(
            username=f"email_{uuid.uuid4().hex[:12]}",
            email=email,
            nickname=nickname,
            is_social=False,
            has_usable_password_flag=True,
        )
        user.set_password(password)
        user.save(update_fields=['password'])
        _create_default_subscription(user)
    return user


def _require_oauth_field(data, field, provider):
    value = data.get(field) if isinstance(data, dict) else None
    if value in (None, ''):
        _raise_oauth_provider_error(provider, f"missing {field}")
    return value


def generate_signup_token(provider, provider_id, email=None, profile_image=None):
    """소셜 로그인 검증 완료 후 회원가입용 서명 토큰 생성"""
    return signing.dumps(
        {
            'provider': provider,
            'provider_id': str(provider_id),
            'email': email or '',
            'profile_image': profile_image or '',
        },
        salt=SIGNUP_TOKEN_SALT
    )

def verify_signup_token(token):
    """서명 토큰 검증 후 {provider, provider_id} 반환. 실패 시 None."""
    try:
        return signing.loads(token, salt=SIGNUP_TOKEN_SALT, max_age=SIGNUP_TOKEN_MAX_AGE)
    except (signing.BadSignature, signing.SignatureExpired):
        return None


def _social_signup_claims(provider, social_info):
    if provider == 'kakao':
        return {
            'email': social_info.get('kakao_account', {}).get('email') or '',
            'profile_image': social_info.get('properties', {}).get('profile_image') or '',
        }
    if provider == 'google':
        return {
            'email': social_info.get('email') or '',
            'profile_image': social_info.get('picture') or '',
        }
    return {'email': '', 'profile_image': ''}

def generate_oauth_link_state(user):
    return signing.dumps(
        {'action': 'link', 'user_id': user.id, 'nonce': uuid.uuid4().hex},
        salt=OAUTH_LINK_STATE_SALT,
    )

def verify_oauth_link_state(state, user):
    if not state:
        return False
    try:
        data = signing.loads(
            state,
            salt=OAUTH_LINK_STATE_SALT,
            max_age=OAUTH_LINK_STATE_MAX_AGE,
        )
    except (signing.BadSignature, signing.SignatureExpired):
        return False
    return data.get('action') == 'link' and data.get('user_id') == user.id


def generate_social_merge_token(user, provider, provider_id, email, profile_image, extra_data):
    return signing.dumps(
        {
            'action': 'merge',
            'user_id': user.id,
            'provider': provider,
            'provider_id': str(provider_id),
            'email': email,
            'profile_image': profile_image,
            'extra_data': extra_data or {},
        },
        salt=SOCIAL_MERGE_TOKEN_SALT,
    )


def verify_social_merge_token(token, user):
    if not token:
        return None
    try:
        data = signing.loads(
            token,
            salt=SOCIAL_MERGE_TOKEN_SALT,
            max_age=SOCIAL_MERGE_TOKEN_MAX_AGE,
        )
    except (signing.BadSignature, signing.SignatureExpired):
        return None
    if data.get('action') != 'merge' or data.get('user_id') != user.id:
        return None
    return data


def _required_probe_value(request, field_name):
    value = request.data.get(field_name)
    if not isinstance(value, str) or not value.strip():
        return None, Response(
            {'error': f'{field_name}은(는) 필수입니다.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return value.strip(), None


# Create your views here.

@extend_schema(responses={201: UserSerializer})
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        try:
            with transaction.atomic():
                user = serializer.save()
                _create_default_subscription(user)
        except IntegrityError as exc:
            logger.warning(
                "Legacy register failed during account creation: %s",
                exc.__class__.__name__,
            )
            return Response({'error': '회원가입 처리 중 오류가 발생했습니다.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(responses={200: UserSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

@extend_schema(responses={200: openapi.SOCIAL_LOGIN_RESPONSE})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def social_login(request):
    try:
        serializer = SocialLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        provider = serializer.validated_data.get('provider')
        code = serializer.validated_data.get('code')
        access_token = serializer.validated_data.get('access_token')

        if provider == 'kakao':
            if access_token:
                user_info = get_kakao_user_info_by_token(access_token)
            elif code:
                user_info = get_kakao_user_info(code)
            else:
                return Response({'error': 'code or access_token required'}, status=400)
            
            if 'id' not in user_info:
                return Response(user_info, status=400)
            
            social_id = f"kakao_{user_info['id']}"
            user = User.objects.filter(username=social_id).first()
            if user:
                if not user.is_active:
                    return Response({'error': '비활성화된 계정입니다.'}, status=400)
                tokens = get_tokens_for_user(user)
                logger.info(f"카카오 소셜 로그인 성공: user_id={user.id}, username={user.username}")

                # 응답 생성 (하위 호환을 위해 토큰도 본문에 포함)
                response = Response({
                    'refresh': tokens['refresh'],
                    'access': tokens['access'],
                    'user': UserSerializer(user).data
                })

                # HttpOnly 쿠키 설정
                set_auth_cookies(response, tokens['access'], tokens['refresh'])
                return response
            else:
                suggested_nickname = user_info.get('properties', {}).get('nickname', '')
                # 카카오 계정에서 이메일 가져오기 (동의한 경우에만 제공됨)
                kakao_email = user_info.get('kakao_account', {}).get('email')
                signup_token = generate_signup_token(
                    'kakao',
                    user_info['id'],
                    email=kakao_email,
                    profile_image=user_info.get('properties', {}).get('profile_image'),
                )
                return Response({
                    'needsSignup': True,
                    'kakao_id': user_info['id'],
                    'suggested_nickname': suggested_nickname,
                    'profile_image': user_info.get('properties', {}).get('profile_image'),
                    'email': kakao_email,
                    'signup_token': signup_token
                }, status=200)

    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic OAuth error
        # 보안: 내부 에러 상세를 클라이언트에 노출하지 않음
        logger.error(f"소셜 로그인 중 오류 발생: {str(e)}", exc_info=True)
        return Response({'error': '로그인 처리 중 오류가 발생했습니다.'}, status=400)

def get_kakao_user_info(code, redirect_uri=None):
    """
    카카오 OAuth 코드를 토큰으로 교환하고 사용자 정보 반환
    redirect_uri: 웹/앱에서 사용한 redirect_uri (없으면 기본값 사용)
    """
    # redirect_uri가 없으면 기본값 사용
    if not redirect_uri:
        redirect_uri = settings.KAKAO_REDIRECT_URI
    
    # 카카오 토큰 받기
    logger.debug("Kakao token request initiated")

    token_response = requests.post(
        'https://kauth.kakao.com/oauth/token',
        data={
            'grant_type': 'authorization_code',
            'client_id': settings.KAKAO_CLIENT_ID,
            'redirect_uri': redirect_uri,
            'code': code,
        },
        timeout=OAUTH_TIMEOUT,
    )
    logger.debug(f"Kakao token response status: {token_response.status_code}")
    
    # 토큰 응답 확인
    token_data = token_response.json()
    if 'access_token' not in token_data:
        _raise_oauth_provider_error('Kakao', 'missing access_token')
        
    access_token = token_data['access_token']
    
    # 사용자 정보 받기
    user_response = requests.get(
        'https://kapi.kakao.com/v2/user/me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=OAUTH_TIMEOUT,
    )
    logger.debug(f"Kakao user info response status: {user_response.status_code}")
    
    user_info = user_response.json()
    _require_oauth_field(user_info, 'id', 'Kakao')
        
    # 프로필 이미지 URL 가져오기
    profile_image = user_info.get('properties', {}).get('profile_image')
    if profile_image:
        user_info['profile_image'] = profile_image
        
    return user_info

def get_kakao_user_info_by_token(access_token):
    """
    Fetch Kakao user info using native access_token without exchanging code.
    """
    logger.debug("Fetching Kakao user info by token")
    response = requests.get(
        'https://kapi.kakao.com/v2/user/me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=OAUTH_TIMEOUT,
    )
    logger.debug(f"Kakao user info by token response status: {response.status_code}")
    data = response.json()
    _require_oauth_field(data, 'id', 'Kakao')
    return data

def get_google_user_info(code, redirect_uri=None):
    """
    Google OAuth 코드를 토큰으로 교환하고 사용자 정보 반환
    redirect_uri: 웹/앱에서 사용한 redirect_uri (없으면 기본값 사용)
    """
    # redirect_uri가 없으면 기본값 사용
    if not redirect_uri:
        redirect_uri = settings.GOOGLE_REDIRECT_URI
    
    # Google 토큰 받기
    token_response = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'code': code,
            'client_id': settings.GOOGLE_CLIENT_ID,
            'client_secret': settings.GOOGLE_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        },
        timeout=OAUTH_TIMEOUT,
    )
    
    token_data = token_response.json()
    if 'error' in token_data:
        _raise_oauth_provider_error('Google', token_data.get('error') or 'token exchange error')
    
    access_token = token_data.get('access_token')
    if not access_token:
        raise Exception("No access_token in Google response")
    
    # 사용자 정보 받기
    user_info = requests.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=OAUTH_TIMEOUT,
    ).json()
    
    return user_info


def get_apple_user_info(id_token):
    """
    Apple ID Token (JWT)을 검증하고 사용자 정보 반환
    
    Apple Sign In은 다른 OAuth와 달리 id_token (JWT)을 직접 검증해야 함
    - Apple public keys로 서명 검증
    - iss, aud, exp 클레임 확인
    - sub (subject)를 provider_id로 사용
    
    Returns:
        dict: {
            'sub': 사용자 고유 ID (provider_id로 사용),
            'email': 이메일 (privaterelay.appleid.com 도메인일 수 있음),
            'email_verified': 이메일 인증 여부,
            'is_private_email': Apple relay email 여부
        }
    """
    import jwt
    from jwt import PyJWKClient
    
    APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
    APPLE_ISSUER = "https://appleid.apple.com"
    
    # 환경변수에서 Apple Client ID 가져오기
    apple_client_id = getattr(settings, 'APPLE_CLIENT_ID', None)
    apple_ios_bundle_id = getattr(settings, 'APPLE_IOS_BUNDLE_ID', 'com.maeil1dok.app')
    if not apple_client_id:
        raise Exception("APPLE_CLIENT_ID 환경변수가 설정되지 않았습니다.")
    
    # 웹(Services ID)과 iOS(Bundle ID) 둘 다 허용
    allowed_audiences = [apple_client_id, apple_ios_bundle_id]
    
    try:
        # Apple public keys 가져오기 및 JWT 서명 검증
        jwks_client = PyJWKClient(APPLE_JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        
        # JWT 디코딩 및 검증
        decoded = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=allowed_audiences,
            issuer=APPLE_ISSUER,
        )
        
        # 필수 클레임 확인
        sub = decoded.get('sub')
        if not sub:
            raise Exception("Apple ID Token에 sub 클레임이 없습니다.")
        
        email = decoded.get('email')
        email_verified = decoded.get('email_verified', False)
        
        # Apple relay email 감지 (privaterelay.appleid.com 도메인)
        is_private_email = False
        if email and 'privaterelay.appleid.com' in email:
            is_private_email = True
        
        return {
            'sub': sub,
            'email': email,
            'email_verified': email_verified,
            'is_private_email': is_private_email,
        }
        
    except jwt.ExpiredSignatureError:
        logger.error("Apple ID Token이 만료되었습니다.")
        raise Exception("Apple ID Token이 만료되었습니다.")
    except jwt.InvalidAudienceError:
        logger.error("Apple ID Token의 audience가 일치하지 않습니다.")
        raise Exception("Apple ID Token 검증 실패: audience 불일치")
    except jwt.InvalidIssuerError:
        logger.error("Apple ID Token의 issuer가 일치하지 않습니다.")
        raise Exception("Apple ID Token 검증 실패: issuer 불일치")
    except jwt.PyJWKClientError as e:
        logger.error(f"Apple public key 가져오기 실패: {str(e)}")
        raise Exception(f"Apple 인증 서버 연결 실패: {str(e)}")
    except jwt.DecodeError as e:
        logger.error(f"Apple ID Token 디코딩 실패: {str(e)}")
        raise Exception(f"Apple ID Token 형식이 올바르지 않습니다.")
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — preserves legacy Apple token verification logging
        logger.error(f"Apple ID Token 검증 오류: {str(e)}")
        raise


@extend_schema(responses={200: openapi.AvailabilityResponseSerializer})
@api_view(['POST'])
@permission_classes([AllowAny])
def check_username(request):
    username, error_response = _required_probe_value(request, 'username')
    if error_response:
        return error_response
    exists = User.objects.filter(username=username).exists()
    return Response({'available': not exists})

@extend_schema(responses={200: openapi.AvailabilityResponseSerializer})
@api_view(['POST'])
@permission_classes([AllowAny])
def check_nickname(request):
    nickname, error_response = _required_probe_value(request, 'nickname')
    if error_response:
        return error_response
    exists = User.objects.filter(nickname=nickname).exists()
    return Response({'available': not exists})

@extend_schema(responses={200: openapi.TokenPairResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def complete_kakao_signup(request):
    try:
        nickname = request.data.get('nickname')
        kakao_id = request.data.get('kakao_id')
        access_token = request.data.get('access_token')
        
        if not nickname or not kakao_id or not access_token:
            return Response({'error': '필수 정보가 누락되었습니다.'}, status=400)
        
        user_info = get_kakao_user_info_by_token(access_token)
        verified_kakao_id = user_info.get('id')
        if not verified_kakao_id:
            return Response({'error': '카카오 계정 인증에 실패했습니다.'}, status=400)
        if str(verified_kakao_id) != str(kakao_id):
            return Response({'error': '카카오 계정 정보가 일치하지 않습니다.'}, status=400)
        provider_claims = _social_signup_claims('kakao', user_info)
        email = provider_claims['email']
        profile_image = provider_claims['profile_image']

        social_id = f"kakao_{kakao_id}"

        with transaction.atomic():
            user = User.objects.create(
                username=social_id,
                nickname=nickname,
                email=email,
                email_verified=bool(email),
                is_social=True,
                social_provider='kakao',
                social_id=social_id,
                profile_image=profile_image
            )
            _create_default_subscription(user)
        
        tokens = get_tokens_for_user(user)
        logger.info(f"카카오 회원가입 및 토큰 발급 성공: user_id={user.id}, username={user.username}")

        # 응답 생성 (하위 호환을 위해 토큰도 본문에 포함)
        response = Response({
            'refresh': tokens['refresh'],
            'access': tokens['access'],
            'user': UserSerializer(user).data
        })

        # HttpOnly 쿠키 설정
        set_auth_cookies(response, tokens['access'], tokens['refresh'])
        return response
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic signup error
        # 보안: 내부 에러 상세를 클라이언트에 노출하지 않음
        logger.error(f"카카오 회원가입 중 오류 발생: {str(e)}", exc_info=True)
        return Response({'error': '회원가입 처리 중 오류가 발생했습니다.'}, status=400)


# ========================================
# 이메일/비밀번호 인증 (매일일독 계정)
# ========================================

@extend_schema(responses={200: openapi.TokenPairResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def email_register(request):
    """이메일/비밀번호로 회원가입"""
    serializer = EmailRegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': _first_serializer_error(serializer.errors), 'errors': serializer.errors}, status=400)
    
    try:
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        nickname = serializer.validated_data['nickname']

        # 닉네임 중복 확인
        if User.objects.filter(nickname=nickname).exists():
            return Response({'error': '이미 사용 중인 닉네임입니다.'}, status=400)

        user = _create_email_user_with_default_subscription(email, password, nickname)
        
        # 토큰 발급
        tokens = get_tokens_for_user(user)
        response = Response({
            'refresh': tokens['refresh'],
            'access': tokens['access'],
            'user': UserSerializer(user).data
        })
        set_auth_cookies(response, tokens['access'], tokens['refresh'])
        
        logger.info(f"이메일 회원가입 성공: user_id={user.id}")
        return response
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic signup error
        if isinstance(e, IntegrityError) and _is_active_email_identity_conflict(e):
            return Response({'error': '이미 사용 중인 이메일입니다.'}, status=400)
        logger.error(f"이메일 회원가입 중 오류: {str(e)}", exc_info=True)
        return Response({'error': '회원가입 처리 중 오류가 발생했습니다.'}, status=400)


@extend_schema(responses={200: openapi.TokenPairResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def email_login(request):
    """이메일 또는 아이디/비밀번호로 로그인 (레거시 아이디 로그인 지원)"""
    raw_identifier = request.data.get('email')
    password = request.data.get('password')
    
    if not raw_identifier or not password:
        return Response({'error': '이메일(또는 아이디)과 비밀번호를 입력해주세요.'}, status=400)
    identifier = str(raw_identifier).strip()
    
    try:
        if '@' in identifier:
            email_identity = normalize_email_identity(identifier)
            user = _resolve_email_login_identity(email_identity)
        else:
            user = User.objects.filter(Q(email=identifier) | Q(username=identifier)).first()
        
        if not user or not user.check_password(password):
            return Response({'error': '이메일/아이디 또는 비밀번호가 올바르지 않습니다.'}, status=400)

        if not user.is_active:
            restored, error_message = _restore_scheduled_deletion_account(user)
            if not restored:
                return Response({'error': error_message}, status=400)
        
        tokens = get_tokens_for_user(user)
        response = Response({
            'refresh': tokens['refresh'],
            'access': tokens['access'],
            'user': UserSerializer(user).data
        })
        set_auth_cookies(response, tokens['access'], tokens['refresh'])
        
        logger.info(f"로그인 성공: user_id={user.id}, identifier={identifier}")
        return response
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic login error
        logger.error(f"로그인 중 오류: {str(e)}", exc_info=True)
        return Response({'error': '로그인 처리 중 오류가 발생했습니다.'}, status=400)


# ========================================
# 소셜 계정 연동 (신규)
# ========================================

@extend_schema(responses={200: openapi.SOCIAL_LOGIN_RESPONSE})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def social_login_v2(request):
    """
    통합 소셜 로그인 (v2)
    - 카카오/구글/애플 지원
    - SocialAccount 모델 사용
    - 계정 연동 지원
    
    Apple 로그인 시:
    - id_token (JWT) 필수
    - user_name (선택): 첫 로그인 시 Apple에서 제공하는 사용자 이름
    """
    serializer = SocialLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    
    provider = serializer.validated_data.get('provider')
    code = serializer.validated_data.get('code')
    access_token = serializer.validated_data.get('access_token')
    # 앱에서 사용한 redirect_uri (웹과 다를 수 있음)
    redirect_uri = request.data.get('redirect_uri')
    
    try:
        # 소셜 제공자별 사용자 정보 가져오기
        if provider == 'kakao':
            if access_token:
                social_info = get_kakao_user_info_by_token(access_token)
            elif code:
                social_info = get_kakao_user_info(code, redirect_uri)
            else:
                return Response({'error': 'code 또는 access_token이 필요합니다.'}, status=400)
            
            provider_id = str(social_info.get('id'))
            email = social_info.get('kakao_account', {}).get('email')
            profile_image = social_info.get('properties', {}).get('profile_image')
            nickname_suggestion = social_info.get('properties', {}).get('nickname', '')
            
        elif provider == 'google':
            if access_token:
                social_info = get_google_user_info_by_token(access_token)
            elif code:
                social_info = get_google_user_info(code, redirect_uri)
            else:
                return Response({'error': 'code 또는 access_token이 필요합니다.'}, status=400)
            
            provider_id = social_info.get('sub')
            email = social_info.get('email')
            profile_image = social_info.get('picture')
            nickname_suggestion = social_info.get('name', '')
            
        elif provider == 'apple':
            # Apple Sign In: id_token (JWT) 직접 검증
            id_token = request.data.get('id_token')
            if not id_token:
                return Response({'error': 'Apple 로그인에는 id_token이 필요합니다.'}, status=400)
            
            social_info = get_apple_user_info(id_token)
            
            provider_id = social_info.get('sub')
            email = social_info.get('email')
            # Apple은 프로필 이미지를 제공하지 않음
            profile_image = None
            # Apple은 첫 로그인 시에만 이름을 제공하므로 빈 문자열로 설정.
            # 이름표가 둘이다 — 모바일 셸(`mobile/App.tsx`)은 `full_name`으로 보내고
            # 웹/문서는 `user_name`을 쓴다. 한쪽만 읽으면 애플 가입자의 닉네임이
            # 항상 기본값이 되므로 **둘 다 수용**한다. 구버전 셸도 그대로 동작한다.
            nickname_suggestion = (
                request.data.get('user_name')
                or request.data.get('full_name')
                or ''
            ).strip()
            
            # Apple relay email인 경우 로그에 기록
            if social_info.get('is_private_email'):
                logger.info(f"Apple 로그인: relay email 사용 - {email}")
        else:
            return Response({'error': '지원하지 않는 소셜 제공자입니다.'}, status=400)
        
        if not provider_id:
            return Response({'error': '소셜 계정 정보를 가져올 수 없습니다.'}, status=400)
        
        # 기존 SocialAccount 확인
        social_account = SocialAccount.objects.filter(
            provider=provider,
            provider_id=provider_id
        ).select_related('user').first()
        
        if social_account:
            user = social_account.user
            
            if not user.is_active:
                restored, error_message = _restore_scheduled_deletion_account(user, nickname_suggestion)
                if not restored:
                    return Response({'error': error_message}, status=400)
                logger.info(f"계정 복구: provider={provider}, user_id={user.id}")
            
            tokens = get_tokens_for_user(user)
            
            response = Response({
                'refresh': tokens['refresh'],
                'access': tokens['access'],
                'user': UserSerializer(user).data
            })
            set_auth_cookies(response, tokens['access'], tokens['refresh'])
            
            logger.info(f"소셜 로그인 성공 (v2): provider={provider}, user_id={user.id}")
            return response
        
        # 레거시 계정 확인 (기존 social_id 필드)
        legacy_social_id = f"{provider}_{provider_id}"
        legacy_user = User.objects.filter(username=legacy_social_id).first()
        
        if legacy_user:
            if not legacy_user.is_active:
                restored, error_message = _restore_scheduled_deletion_account(legacy_user, nickname_suggestion)
                if not restored:
                    return Response({'error': error_message}, status=400)
            SocialAccount.objects.get_or_create(
                user=legacy_user,
                provider=provider,
                provider_id=provider_id,
                defaults={
                    'email': email,
                    'profile_image': profile_image,
                    'extra_data': social_info,
                }
            )
            
            # 소셜 로그인은 이메일 인증 완료 처리
            if email and not legacy_user.email_verified:
                legacy_user.email = email
                legacy_user.email_verified = True
                legacy_user.save(update_fields=['email', 'email_verified'])
            
            tokens = get_tokens_for_user(legacy_user)
            response = Response({
                'refresh': tokens['refresh'],
                'access': tokens['access'],
                'user': UserSerializer(legacy_user).data
            })
            set_auth_cookies(response, tokens['access'], tokens['refresh'])
            
            logger.info(f"레거시 계정 마이그레이션: provider={provider}, user_id={legacy_user.id}")
            return response
        
        # 신규 사용자 - 자동 가입 처리 (앱에서 auto_signup=true인 경우)
        auto_signup = request.data.get('auto_signup', False)
        
        if auto_signup:
            import random
            import string
            
            base_nickname = nickname_suggestion or '사용자'
            nickname = base_nickname
            suffix = 1
            while User.objects.filter(nickname=nickname).exists():
                nickname = f"{base_nickname}{suffix}"
                suffix += 1
                if suffix > 100:
                    nickname = f"user_{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"
                    break
            
            base_username = f"{provider}_{provider_id}"
            username = base_username
            suffix = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{suffix}"
                suffix += 1
                if suffix > 100:
                    username = f"{provider}_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"
                    break
            
            with transaction.atomic():
                user = User.objects.create(
                    username=username,
                    nickname=nickname,
                    email=email or '',
                    email_verified=bool(email),
                    profile_image=profile_image or ''
                )

                SocialAccount.objects.create(
                    user=user,
                    provider=provider,
                    provider_id=provider_id,
                    email=email,
                    profile_image=profile_image,
                    extra_data=social_info if 'social_info' in dir() else {}
                )

                _create_default_subscription(user)
            
            tokens = get_tokens_for_user(user)
            response = Response({
                'refresh': tokens['refresh'],
                'access': tokens['access'],
                'user': UserSerializer(user).data
            })
            set_auth_cookies(response, tokens['access'], tokens['refresh'])
            
            logger.info(f"소셜 자동 가입 완료: provider={provider}, user_id={user.id}, nickname={nickname}")
            return response
        
        # 기존 동작: 회원가입 필요 응답
        signup_token = generate_signup_token(
            provider,
            provider_id,
            email=email,
            profile_image=profile_image,
        )
        return Response({
            'needsSignup': True,
            'provider': provider,
            'provider_id': provider_id,
            'email': email,
            'suggested_nickname': nickname_suggestion,
            'profile_image': profile_image,
            'signup_token': signup_token
        }, status=200)
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic social-login error
        logger.error(f"소셜 로그인 v2 오류: {str(e)}", exc_info=True)
        return Response({'error': '로그인 처리 중 오류가 발생했습니다.'}, status=400)


@extend_schema(responses={200: openapi.TokenPairResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def complete_social_signup(request):
    """소셜 회원가입 완료 (통합)"""
    try:
        nickname = request.data.get('nickname')
        email = request.data.get('email')
        profile_image = request.data.get('profile_image')
        signup_token = request.data.get('signup_token')
        access_token = request.data.get('access_token')
        provider = request.data.get('provider')
        provider_id = request.data.get('provider_id')
        
        # signup_token 방식 (권장): 서명 토큰으로 소셜 인증 검증
        if signup_token:
            token_data = verify_signup_token(signup_token)
            if not token_data:
                return Response({'error': '유효하지 않거나 만료된 인증 토큰입니다.'}, status=400)
            provider = token_data['provider']
            provider_id = token_data['provider_id']
            email = token_data.get('email') or ''
            profile_image = token_data.get('profile_image') or ''
        elif access_token and provider and provider_id:
            # 레거시 방식: access_token으로 소셜 API 재검증
            if provider == 'kakao':
                social_info = get_kakao_user_info_by_token(access_token)
                verified_provider_id = social_info.get('id')
            elif provider == 'google':
                social_info = get_google_user_info_by_token(access_token)
                verified_provider_id = social_info.get('sub')
            else:
                return Response({'error': '지원하지 않는 소셜 제공자입니다.'}, status=400)
            
            if not verified_provider_id:
                return Response({'error': '소셜 계정 인증에 실패했습니다.'}, status=400)
            if str(verified_provider_id) != str(provider_id):
                return Response({'error': '소셜 계정 정보가 일치하지 않습니다.'}, status=400)
            provider_claims = _social_signup_claims(provider, social_info)
            email = provider_claims['email']
            profile_image = provider_claims['profile_image']
        else:
            return Response({'error': '필수 정보가 누락되었습니다.'}, status=400)
        
        if not nickname:
            return Response({'error': '닉네임은 필수입니다.'}, status=400)
        
        # 닉네임 중복 확인
        if User.objects.filter(nickname=nickname).exists():
            return Response({'error': '이미 사용 중인 닉네임입니다.'}, status=400)
        
        # 이미 연동된 계정인지 확인
        if SocialAccount.objects.filter(provider=provider, provider_id=provider_id).exists():
            return Response({'error': '이미 가입된 소셜 계정입니다.'}, status=400)
        
        with transaction.atomic():
            # 사용자 생성 (소셜 로그인은 이메일 인증 완료 처리)
            user = User.objects.create(
                username=f"{provider}_{provider_id}",
                nickname=nickname,
                email=email,
                email_verified=bool(email),
                profile_image=profile_image,
                is_social=True,
                social_provider=provider,
                social_id=f"{provider}_{provider_id}"
            )
            
            # SocialAccount 생성
            SocialAccount.objects.create(
                user=user,
                provider=provider,
                provider_id=provider_id,
                email=email,
                profile_image=profile_image
            )
            
            # 기본 플랜 구독 생성
            _create_default_subscription(user)
        
        tokens = get_tokens_for_user(user)
        response = Response({
            'refresh': tokens['refresh'],
            'access': tokens['access'],
            'user': UserSerializer(user).data
        })
        set_auth_cookies(response, tokens['access'], tokens['refresh'])
        
        logger.info(f"소셜 회원가입 완료: provider={provider}, user_id={user.id}")
        return response
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic signup error
        logger.error(f"소셜 회원가입 오류: {str(e)}", exc_info=True)
        return Response({'error': '회원가입 처리 중 오류가 발생했습니다.'}, status=400)


# ========================================
# 계정 연동 관리
# ========================================

@extend_schema(responses={200: openapi.LinkedAccountsResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_linked_accounts(request):
    """연결된 소셜 계정 목록 조회"""
    user = request.user
    social_accounts = SocialAccount.objects.filter(user=user)
    
    email = user.email
    if not email:
        for sa in social_accounts:
            if sa.email:
                email = sa.email
                break

    has_password = user.has_password_set()
    social_count = social_accounts.count()
    auth_method_total = social_count + (1 if has_password else 0)
    
    return Response({
        'has_password': has_password,
        'email': email,
        'primary_email': email,
        'auth_methods': {
            'total': auth_method_total,
            'password': has_password,
            'social_count': social_count,
            'providers': list(social_accounts.values_list('provider', flat=True)),
            'can_remove_login_method': auth_method_total > 1,
        },
        'linked_accounts': [
            {
                'provider': sa.provider,
                'provider_display': sa.get_provider_display(),
                'email': sa.email,
                'profile_image': sa.profile_image,
                'linked_at': sa.created_at,
                'can_unlink': user.can_unlink_provider(sa.provider)
            }
            for sa in social_accounts
        ]
    })


@extend_schema(methods=['GET'], responses={200: openapi.AccountEmailResponseSerializer})
@extend_schema(methods=['PATCH'], responses={200: openapi.AccountEmailUpdateResponseSerializer})
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def account_email(request):
    user = request.user
    if request.method == 'GET':
        return Response({
            'email': user.email,
            'email_verified': user.email_verified,
        })

    serializer = AccountEmailSerializer(data=request.data, context={'user': user})
    if not serializer.is_valid():
        return Response({'error': _first_serializer_error(serializer.errors), 'errors': serializer.errors}, status=400)

    new_email = serializer.validated_data['email']
    if normalize_email_identity(user.email) == new_email:
        return Response({
            'success': True,
            'email': user.email,
            'email_verified': user.email_verified,
            'message': '이메일이 유지되었습니다.',
        })

    try:
        user.email = new_email
        user.email_verified = False
        user.save(update_fields=['email', 'email_verified'])
    except IntegrityError as exc:
        if _is_active_email_identity_conflict(exc):
            return Response({'error': '이미 사용 중인 이메일입니다.'}, status=400)
        raise
    logger.info(f"계정 이메일 변경: user_id={user.id}")
    return Response({
        'success': True,
        'email': user.email,
        'email_verified': user.email_verified,
        'message': '이메일이 변경되었습니다.',
    })


@extend_schema(methods=['GET'], responses={200: NotificationSettingsSerializer})
@extend_schema(methods=['PATCH'], responses={200: NotificationSettingsSerializer})
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def notification_settings(request):
    # Legacy alias, now a facade over the model that actually drives delivery.
    # This used to read and write UserReadingSettings, which no sender consulted:
    # switching "daily reading reminder" off here left reminders being delivered.
    # Both routes now resolve to todos.NotificationSettings; the response shape is
    # unchanged, so existing clients keep working. Kept as a comment rather than a
    # docstring because drf-spectacular publishes docstrings as schema descriptions.
    decision = can(
        subject_from_request(request),
        'view_notification_settings'
        if request.method == 'GET'
        else 'update_notification_settings',
        NotificationSettingsCurrent(),
    )
    if not decision:
        return Response(
            {'error': decision.reason or '권한이 없습니다.'},
            status=404 if decision.hide else 403,
        )

    settings_obj = get_notification_settings(request.user)
    if request.method == 'GET':
        return Response(NotificationSettingsSerializer(settings_obj).data)

    serializer = NotificationSettingsSerializer(settings_obj, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response({'error': _first_serializer_error(serializer.errors), 'errors': serializer.errors}, status=400)
    serializer.save()
    return Response(serializer.data)


@extend_schema(responses={200: openapi.OAuthLinkStateResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def issue_oauth_link_state(request):
    return Response({'state': generate_oauth_link_state(request.user)})


@extend_schema(responses={200: openapi.AccountSuccessMessageResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def link_social_account(request):
    """
    소셜 계정 연동 추가
    
    이미 다른 계정에 연동된 경우 병합을 위한 상세 정보 반환
    """
    user = request.user
    provider = request.data.get('provider')
    access_token = request.data.get('access_token')
    code = request.data.get('code')
    state = request.data.get('state')
    
    if not provider:
        return Response({'error': '소셜 제공자를 지정해주세요.'}, status=400)
    if not verify_oauth_link_state(state, user):
        return Response({'error': '유효하지 않은 계정 연결 요청입니다.'}, status=400)
    
    try:
        # 소셜 정보 가져오기
        if provider == 'kakao':
            if access_token:
                social_info = get_kakao_user_info_by_token(access_token)
            elif code:
                social_info = get_kakao_user_info(code)
            else:
                return Response({'error': 'access_token 또는 code가 필요합니다.'}, status=400)
            
            provider_id = str(social_info.get('id'))
            email = social_info.get('kakao_account', {}).get('email')
            profile_image = social_info.get('properties', {}).get('profile_image')
            
        elif provider == 'google':
            if access_token:
                social_info = get_google_user_info_by_token(access_token)
            elif code:
                social_info = get_google_user_info(code)
            else:
                return Response({'error': 'access_token 또는 code가 필요합니다.'}, status=400)
            
            provider_id = social_info.get('sub')
            email = social_info.get('email')
            profile_image = social_info.get('picture')
        elif provider == 'apple':
            id_token = request.data.get('id_token')
            if not id_token:
                return Response({'error': 'Apple 계정 연결에는 id_token이 필요합니다.'}, status=400)

            social_info = get_apple_user_info(id_token)
            provider_id = social_info.get('sub')
            email = social_info.get('email')
            profile_image = None
        else:
            return Response({'error': '지원하지 않는 소셜 제공자입니다.'}, status=400)
        
        if not provider_id:
            return Response({'error': '소셜 계정 정보를 가져올 수 없습니다.'}, status=400)

        user_provider_account = SocialAccount.objects.filter(user=user, provider=provider).first()
        if user_provider_account:
            if user_provider_account.provider_id == provider_id:
                return Response({'error': '이미 연동된 계정입니다.'}, status=400)
            return Response({'error': f'이미 다른 {provider} 계정이 연동되어 있습니다.'}, status=400)
        
        # 이미 다른 계정에 연동되어 있는지 확인
        existing = SocialAccount.objects.filter(
            provider=provider, 
            provider_id=provider_id
        ).select_related('user').first()
        
        if existing:
            if existing.user_id == user.id:
                return Response({'error': '이미 연동된 계정입니다.'}, status=400)
            else:
                other_user = existing.user
                # 병합을 위한 상세 정보 반환
                return Response({
                    'error': '이 소셜 계정은 다른 사용자에게 연동되어 있습니다.',
                    'can_merge': True,
                    'merge_token': generate_social_merge_token(
                        user,
                        provider,
                        provider_id,
                        email,
                        profile_image,
                        social_info,
                    ),
                    'current_account': {
                        'id': user.id,
                        'nickname': user.nickname,
                        'email': user.email,
                        'profile_image': user.profile_image,
                        'providers': list(user.social_accounts.values_list('provider', flat=True)),
                        'has_password': user.has_password_set(),
                        'created_at': user.date_joined.isoformat(),
                    },
                    'other_account': {
                        'id': other_user.id,
                        'nickname': other_user.nickname,
                        'email': other_user.email,
                        'profile_image': other_user.profile_image,
                        'providers': list(other_user.social_accounts.values_list('provider', flat=True)),
                        'has_password': other_user.has_password_set(),
                        'created_at': other_user.date_joined.isoformat(),
                    },
                    'provider': provider,
                }, status=409)
        
        try:
            SocialAccount.objects.create(
                user=user,
                provider=provider,
                provider_id=provider_id,
                email=email,
                profile_image=profile_image,
                extra_data=social_info
            )
        except IntegrityError:
            return Response({'error': '이미 연동된 소셜 계정입니다.'}, status=400)
        
        logger.info(f"소셜 계정 연동 추가: user_id={user.id}, provider={provider}")
        return Response({'success': True, 'message': f'{provider} 계정이 연동되었습니다.'})
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic account-link error
        logger.error(f"소셜 계정 연동 오류: {str(e)}", exc_info=True)
        return Response({'error': '계정 연동 중 오류가 발생했습니다.'}, status=400)


@extend_schema(responses={200: openapi.AccountSuccessMessageResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unlink_social_account(request):
    """소셜 계정 연동 해제"""
    user = request.user
    provider = request.data.get('provider')
    
    if not provider:
        return Response({'error': '소셜 제공자를 지정해주세요.'}, status=400)
    
    if not user.can_unlink_provider(provider):
        return Response({
            'error': '비밀번호를 설정하거나 다른 로그인 방법을 연동한 후 해제할 수 있습니다.'
        }, status=400)
    
    try:
        deleted, _ = SocialAccount.objects.filter(user=user, provider=provider).delete()
        
        if deleted:
            logger.info(f"소셜 계정 연동 해제: user_id={user.id}, provider={provider}")
            return Response({'success': True, 'message': f'{provider} 계정 연동이 해제되었습니다.'})
        else:
            return Response({'error': '연동된 계정을 찾을 수 없습니다.'}, status=404)
            
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic unlink error
        logger.error(f"소셜 계정 연동 해제 오류: {str(e)}", exc_info=True)
        return Response({'error': '연동 해제 중 오류가 발생했습니다.'}, status=400)


@extend_schema(responses={200: openapi.PasswordUpdatedResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_password(request):
    user = request.user
    serializer = SetPasswordSerializer(data=request.data, context={'user': user})
    
    if not serializer.is_valid():
        return Response({'error': _first_serializer_error(serializer.errors), 'errors': serializer.errors}, status=400)
    
    new_password = serializer.validated_data['new_password']
    current_password = serializer.validated_data.get('current_password')
    
    if user.has_password_set():
        if not current_password:
            return Response({'error': '현재 비밀번호를 입력해주세요.'}, status=400)
        if not user.check_password(current_password):
            return Response({'error': '현재 비밀번호가 올바르지 않습니다.'}, status=400)
    
    user.set_password(new_password)
    user.has_usable_password_flag = True
    user.token_version += 1
    user.save(update_fields=['password', 'has_usable_password_flag', 'token_version'])

    tokens = get_tokens_for_user(user)
    response = Response({
        'success': True,
        'message': '비밀번호가 설정되었습니다.',
        'access': tokens['access'],
        'refresh': tokens['refresh'],
    })
    set_auth_cookies(response, tokens['access'], tokens['refresh'])
    
    logger.info(f"비밀번호 설정 완료: user_id={user.id}")
    return response


@extend_schema(responses={200: openapi.AccountSuccessMessageResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_all_devices(request):
    user = request.user
    user.token_version += 1
    user.save(update_fields=['token_version'])
    
    logger.info(f"모든 기기에서 로그아웃: user_id={user.id}")
    response = Response({'success': True, 'message': '모든 기기에서 로그아웃되었습니다.'})
    clear_auth_cookies(response)
    return response


# ========================================
# 계정 병합
# ========================================

@extend_schema(responses={200: openapi.AccountMergeResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merge_accounts(request):
    """
    계정 병합 API
    
    사용자가 어느 계정을 유지할지 선택 가능:
    - keep_account='current': 현재 로그인한 계정 유지
    - keep_account='other': 소셜 연동된 다른 계정 유지
    
    선택된 계정의 데이터만 유지하고, 다른 계정의 소셜 연동만 이전
    삭제될 계정은 30일 후 삭제 예정으로 표시
    """
    user = request.user
    merge_type = request.data.get('merge_type', 'social')
    provider = request.data.get('provider')
    code = request.data.get('code')
    id_token = request.data.get('id_token')
    merge_token = request.data.get('merge_token')
    keep_account = request.data.get('keep_account', 'current')  # 'current' or 'other'

    if keep_account not in ['current', 'other']:
        return Response({'error': 'keep_account는 current 또는 other여야 합니다.'}, status=400)

    if keep_account == 'other':
        proof_error = _current_account_proof_error(user, request.data.get('current_password'))
        if proof_error:
            return proof_error

    if merge_token:
        token_data = verify_social_merge_token(merge_token, user)
        if not token_data:
            return Response({'error': '유효하지 않거나 만료된 병합 요청입니다.'}, status=400)
        provider = token_data.get('provider')
        provider_id = token_data.get('provider_id')
        email = token_data.get('email')
        profile_image = token_data.get('profile_image')
        social_info = token_data.get('extra_data') or {}
        other_social = SocialAccount.objects.filter(
            provider=provider,
            provider_id=provider_id,
        ).select_related('user').first()
        if not other_social:
            return Response({'error': '병합할 계정을 찾을 수 없습니다.'}, status=404)
        other_user = other_social.user
        if other_user.id == user.id:
            return Response({'error': '같은 계정입니다.'}, status=400)
        if not other_user.is_active:
            return Response({'error': '병합 대상 계정이 비활성화되어 있습니다.'}, status=400)

        keep_user = user if keep_account == 'current' else other_user
        delete_user = other_user if keep_account == 'current' else user
        result = _merge_user_records(
            keep_user,
            delete_user,
            provider=provider,
            provider_id=provider_id,
            email=email,
            profile_image=profile_image,
            extra_data=social_info,
        )
        if keep_account == 'other':
            tokens = get_tokens_for_user(keep_user)
            result['access'] = tokens['access']
            result['refresh'] = tokens['refresh']
            result['user'] = UserSerializer(keep_user).data
            response = Response(result)
            set_auth_cookies(response, tokens['access'], tokens['refresh'])
            return response
        return Response(result)

    if merge_type == 'password':
        target_identifier = (request.data.get('target_identifier') or '').strip()
        target_password = request.data.get('target_password') or ''
        if not target_identifier or not target_password:
            return Response({'error': '병합할 계정 아이디/이메일과 비밀번호를 입력해주세요.'}, status=400)

        other_user = User.objects.filter(
            Q(username__iexact=target_identifier) | Q(email__iexact=target_identifier),
            is_active=True,
        ).first()
        if not other_user:
            return Response({'error': '병합할 계정을 찾을 수 없습니다.'}, status=404)
        if other_user.id == user.id:
            return Response({'error': '같은 계정입니다.'}, status=400)
        if not other_user.has_password_set() or not other_user.check_password(target_password):
            return Response({'error': '대상 계정 비밀번호가 올바르지 않습니다.'}, status=400)

        keep_user = user if keep_account == 'current' else other_user
        delete_user = other_user if keep_account == 'current' else user
        result = _merge_user_records(keep_user, delete_user)
        if keep_account == 'other':
            tokens = get_tokens_for_user(keep_user)
            result['access'] = tokens['access']
            result['refresh'] = tokens['refresh']
            result['user'] = UserSerializer(keep_user).data
            response = Response(result)
            set_auth_cookies(response, tokens['access'], tokens['refresh'])
            return response
        return Response(result)

    if not provider or (provider == 'apple' and not id_token) or (provider != 'apple' and not code):
        return Response({'error': '소셜 계정 정보가 필요합니다.'}, status=400)

    try:
        # 소셜 계정 정보 가져오기
        if provider == 'kakao':
            social_info = get_kakao_user_info(code)
            provider_id = str(social_info.get('id'))
            email = social_info.get('kakao_account', {}).get('email')
            profile_image = social_info.get('properties', {}).get('profile_image')
        elif provider == 'google':
            social_info = get_google_user_info(code)
            provider_id = social_info.get('sub')
            email = social_info.get('email')
            profile_image = social_info.get('picture')
        elif provider == 'apple':
            social_info = get_apple_user_info(id_token)
            provider_id = social_info.get('sub')
            email = social_info.get('email')
            profile_image = None
        else:
            return Response({'error': '지원하지 않는 소셜 제공자입니다.'}, status=400)
        
        if not provider_id:
            return Response({'error': '소셜 계정 정보를 가져올 수 없습니다.'}, status=400)
        
        # 대상 계정 찾기
        other_social = SocialAccount.objects.filter(
            provider=provider,
            provider_id=provider_id
        ).select_related('user').first()
        
        if not other_social:
            # 레거시 계정 확인
            legacy_id = f"{provider}_{provider_id}"
            other_user = User.objects.filter(username=legacy_id).first()
            if not other_user:
                return Response({'error': '병합할 계정을 찾을 수 없습니다.'}, status=404)
        else:
            other_user = other_social.user
        
        if other_user.id == user.id:
            return Response({'error': '같은 계정입니다.'}, status=400)
        if not other_user.is_active:
            return Response({'error': '병합 대상 계정이 비활성화되어 있습니다.'}, status=400)
        
        keep_user = user if keep_account == 'current' else other_user
        delete_user = other_user if keep_account == 'current' else user
        result = _merge_user_records(
            keep_user,
            delete_user,
            provider=provider,
            provider_id=provider_id,
            email=email,
            profile_image=profile_image,
            extra_data=social_info,
        )
        
        if keep_account == 'other':
            # 다른 계정을 선택한 경우 새 토큰 발급
            tokens = get_tokens_for_user(keep_user)
            result['access'] = tokens['access']
            result['refresh'] = tokens['refresh']
            result['user'] = {
                'id': keep_user.id,
                'nickname': keep_user.nickname,
                'email': keep_user.email,
                'profile_image': keep_user.profile_image,
            }

            response = Response(result)
            set_auth_cookies(response, tokens['access'], tokens['refresh'])
            return response

        return Response(result)
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic merge error
        logger.error(f"계정 병합 오류: {str(e)}", exc_info=True)
        return Response({'error': '계정 병합 중 오류가 발생했습니다.'}, status=400)


# ========================================
# 헬퍼 함수
# ========================================

def get_google_user_info_by_token(access_token):
    """Google access_token으로 사용자 정보 조회"""
    response = requests.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=OAUTH_TIMEOUT,
    )
    return response.json()


def _create_default_subscription(user):
    """기본 플랜 구독 생성"""
    default_plan = BibleReadingPlan.objects.filter(is_default=True).first()
    if default_plan:
        PlanSubscription.objects.create(
            user=user,
            plan=default_plan,
            start_date=timezone.now().date(),
            is_active=True
        )
        logger.info(f"사용자 {user.nickname}의 기본 플랜 구독 생성됨")
    else:
        logger.warning("기본 플랜이 설정되어 있지 않음")


def _first_serializer_error(errors):
    if isinstance(errors, dict):
        for value in errors.values():
            return _first_serializer_error(value)
    if isinstance(errors, list) and errors:
        return str(errors[0])
    return str(errors)


def _current_account_proof_error(user, current_password):
    if not user.has_password_set():
        return Response({'error': '현재 계정 비밀번호 설정 후 병합할 수 있습니다.'}, status=400)
    if not current_password:
        return Response({'error': '현재 계정 비밀번호를 입력해주세요.'}, status=400)
    if not user.check_password(current_password):
        return Response({'error': '현재 계정 비밀번호가 올바르지 않습니다.'}, status=400)
    return None


def _merge_user_records(keep_user, delete_user, provider=None, provider_id=None, email=None, profile_image=None, extra_data=None):
    with transaction.atomic():
        for social_account in SocialAccount.objects.select_for_update().filter(user=delete_user):
            if SocialAccount.objects.filter(user=keep_user, provider=social_account.provider).exists():
                social_account.delete()
                continue
            social_account.user = keep_user
            social_account.save(update_fields=['user', 'updated_at'])

        if provider and provider_id and not SocialAccount.objects.filter(user=keep_user, provider=provider).exists():
            SocialAccount.objects.create(
                user=keep_user,
                provider=provider,
                provider_id=provider_id,
                email=email,
                profile_image=profile_image,
                extra_data=extra_data or {},
            )

        if not keep_user.email and delete_user.email:
            keep_user.email = delete_user.email
            keep_user.email_verified = delete_user.email_verified
            keep_user.save(update_fields=['email', 'email_verified'])

        delete_user.is_active = False
        delete_user.scheduled_deletion_at = timezone.now() + timedelta(days=30)
        delete_user.merged_into = keep_user
        delete_user.token_version += 1
        delete_user.username = f"merged_{delete_user.id}_{timezone.now().strftime('%Y%m%d%H%M%S')}"
        delete_user.nickname = f"삭제예정_{delete_user.id}"
        delete_user.save()

        logger.info(f"계정 병합 완료: 유지={keep_user.id}, 삭제예정={delete_user.id}")

    return {
        'success': True,
        'message': '계정이 병합되었습니다. 삭제될 계정은 30일 후 완전히 삭제됩니다.',
        'kept_user_id': keep_user.id,
        'deleted_user_id': delete_user.id,
    }


def _restore_scheduled_deletion_account(user, nickname=None):
    if user.merged_into_id:
        return False, '병합되어 비활성화된 계정입니다.'
    if not user.scheduled_deletion_at:
        return False, '비활성화된 계정입니다.'
    if user.scheduled_deletion_at <= timezone.now():
        return False, '계정 복구 가능 기간이 만료되었습니다.'

    user.is_active = True
    user.scheduled_deletion_at = None
    user.token_version += 1
    if nickname and user.nickname.startswith('삭제예정_'):
        user.nickname = nickname
        update_fields = ['is_active', 'scheduled_deletion_at', 'nickname', 'token_version']
    else:
        update_fields = ['is_active', 'scheduled_deletion_at', 'token_version']
    user.save(update_fields=update_fields)
    return True, None


# ========================================
# 이메일 인증
# ========================================

@extend_schema(responses={200: openapi.AccountSuccessMessageResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([EmailVerificationThrottle])
def send_verification_email_view(request):
    """이메일 인증 메일 발송

    계정 존재 여부가 응답으로 드러나지 않도록 항상 동일한 성공 응답을 반환한다.
    """
    email = normalize_email_identity(request.data.get('email'))

    if not email:
        return Response({'error': '이메일을 입력해주세요.'}, status=400)

    generic_response = Response({
        'success': True,
        'message': '가입된 이메일이라면 인증 메일이 발송됩니다. 메일함을 확인해주세요.'
    })

    try:
        users = list(User.objects.filter(email__iexact=email, is_active=True).order_by('id')[:2])
        user = users[0] if len(users) == 1 else None
    except Exception:  # noqa: BROAD_EXCEPT_OK  — email enumeration guard intentionally collapses lookup errors
        user = None

    if user is None:
        return generic_response

    if user.email_verified:
        return generic_response

    token_obj = EmailVerificationToken.create_token(user, user.email)

    if send_verification_email(user.email, token_obj.token, user.nickname):
        logger.info(f"이메일 인증 메일 발송: user_id={user.id}")

    return generic_response


@extend_schema(responses={200: openapi.UserMessageResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def verify_email(request):
    """이메일 인증 토큰 검증"""
    token = request.data.get('token')
    
    if not token:
        return Response({'error': '인증 토큰이 필요합니다.'}, status=400)
    
    try:
        token_obj = EmailVerificationToken.objects.select_related('user').get(token=token)
    except EmailVerificationToken.DoesNotExist:
        return Response({'error': '유효하지 않은 인증 링크입니다.'}, status=400)
    
    if not token_obj.is_valid():
        return Response({'error': '인증 링크가 만료되었습니다. 새로운 인증 메일을 요청해주세요.'}, status=400)

    user = token_obj.user
    if not user.is_active:
        return Response({'error': '비활성화된 계정입니다.'}, status=400)
    
    if token_obj.verify():
        send_welcome_email(user.email, user.nickname)
        
        tokens = get_tokens_for_user(user)
        response = Response({
            'success': True,
            'message': '이메일 인증이 완료되었습니다.',
            'user': UserSerializer(user).data
        })
        set_auth_cookies(response, tokens['access'], tokens['refresh'])
        
        logger.info(f"이메일 인증 완료: user_id={user.id}")
        return response
    else:
        return Response({'error': '인증 처리 중 오류가 발생했습니다.'}, status=400)


@extend_schema(responses={200: openapi.AccountSuccessMessageResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resend_verification_email(request):
    """인증 메일 재발송 (로그인 상태)"""
    user = request.user
    
    if user.email_verified:
        return Response({'error': '이미 인증된 이메일입니다.'}, status=400)
    
    if not user.email:
        return Response({'error': '이메일이 설정되어 있지 않습니다.'}, status=400)
    
    token_obj = EmailVerificationToken.create_token(user, user.email)
    
    if send_verification_email(user.email, token_obj.token, user.nickname):
        logger.info(f"인증 메일 재발송: user_id={user.id}")
        return Response({'success': True, 'message': '인증 메일이 발송되었습니다.'})
    else:
        return Response({'error': '메일 발송에 실패했습니다.'}, status=500)


# ========================================
# 비밀번호 재설정
# ========================================

@extend_schema(responses={200: openapi.AccountSuccessMessageResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetThrottle])
def request_password_reset(request):
    """비밀번호 재설정 요청"""
    email = normalize_email_identity(request.data.get('email'))
    
    if not email:
        return Response({'error': '이메일을 입력해주세요.'}, status=400)
    
    users = list(User.objects.filter(email__iexact=email, is_active=True).order_by('id')[:2])
    if len(users) != 1:
        return Response({
            'success': True, 
            'message': '해당 이메일로 비밀번호 재설정 안내가 발송됩니다.'
        })
    user = users[0]
    
    if not user.has_password_set() and not user.email_verified:
        return Response({
            'success': True,
            'message': '해당 이메일로 비밀번호 재설정 안내가 발송됩니다.'
        })
    
    token_obj = PasswordResetToken.create_token(user)
    
    if send_password_reset_email(user.email, token_obj.token, user.nickname):
        logger.info(f"비밀번호 재설정 메일 발송: user_id={user.id}")
    
    return Response({
        'success': True,
        'message': '해당 이메일로 비밀번호 재설정 안내가 발송됩니다.'
    })


@extend_schema(responses={200: openapi.ValidResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def verify_reset_token(request):
    """비밀번호 재설정 토큰 유효성 검사"""
    token = request.data.get('token')
    
    if not token:
        return Response({'error': '토큰이 필요합니다.'}, status=400)
    
    try:
        token_obj = PasswordResetToken.objects.get(token=token)
    except PasswordResetToken.DoesNotExist:
        return Response({'valid': False, 'error': '유효하지 않은 링크입니다.'}, status=400)
    
    if not token_obj.is_valid():
        return Response({'valid': False, 'error': '링크가 만료되었습니다.'}, status=400)
    
    return Response({'valid': True})


@extend_schema(responses={200: openapi.UserMessageResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def reset_password(request):
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    if not token or not new_password:
        return Response({'error': '토큰과 새 비밀번호가 필요합니다.'}, status=400)
    
    try:
        token_obj = PasswordResetToken.objects.select_related('user').get(token=token)
    except PasswordResetToken.DoesNotExist:
        return Response({'error': '유효하지 않은 링크입니다.'}, status=400)
    
    if not token_obj.is_valid():
        return Response({'error': '링크가 만료되었습니다. 새로운 재설정 링크를 요청해주세요.'}, status=400)
    
    user = token_obj.user
    if not user.is_active:
        return Response({'error': '비활성화된 계정입니다.'}, status=400)

    serializer = PasswordResetConfirmSerializer(
        data={'new_password': new_password},
        context={'user': user}
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    with transaction.atomic():
        if not token_obj.use_token():
            return Response({'error': '링크가 만료되었습니다. 새로운 재설정 링크를 요청해주세요.'}, status=400)

        user.set_password(new_password)
        user.has_usable_password_flag = True
        user.token_version += 1
        user.save(update_fields=['password', 'has_usable_password_flag', 'token_version'])
    
    tokens = get_tokens_for_user(user)
    response = Response({
        'success': True,
        'message': '비밀번호가 변경되었습니다.',
        'user': UserSerializer(user).data
    })
    set_auth_cookies(response, tokens['access'], tokens['refresh'])
    
    logger.info(f"비밀번호 재설정 완료: user_id={user.id}")
    return response


# ========================================
# 계정 삭제
# ========================================

@extend_schema(responses={200: openapi.DeleteAccountResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """
    계정 삭제 API (30일 유예 기간)
    
    - 모든 계정: 비밀번호 설정 및 비밀번호 확인 필요
    - 삭제 요청 시 30일 후 완전 삭제 예정으로 표시
    """
    user = request.user
    password = request.data.get('password')
    confirm_delete = request.data.get('confirm_delete') is True
    
    # 이미 삭제 예정인 계정인지 확인
    if user.scheduled_deletion_at:
        return Response({
            'error': '이미 삭제 예정인 계정입니다.',
            'scheduled_deletion_at': user.scheduled_deletion_at.isoformat()
        }, status=400)
    
    if not user.has_password_set():
        return Response({'error': '계정 삭제 전 비밀번호를 먼저 설정해주세요.'}, status=400)
    if not password:
        return Response({'error': '비밀번호를 입력해주세요.'}, status=400)
    if not user.check_password(password):
        return Response({'error': '비밀번호가 올바르지 않습니다.'}, status=400)

    if not confirm_delete:
        return Response({'error': '삭제 확인이 필요합니다.'}, status=400)
    
    try:
        with transaction.atomic():
            # 30일 후 삭제 예정으로 표시
            user.is_active = False
            user.scheduled_deletion_at = timezone.now() + timedelta(days=30)
            user.token_version += 1  # 모든 기기에서 로그아웃
            user.save(update_fields=[
                'is_active', 
                'scheduled_deletion_at', 
                'token_version'
            ])
            
            logger.info(f"계정 삭제 요청: user_id={user.id}, scheduled_deletion_at={user.scheduled_deletion_at}")
        
        response = Response({
            'success': True,
            'message': '계정 삭제가 요청되었습니다. 30일 후 완전히 삭제됩니다.',
            'scheduled_deletion_at': user.scheduled_deletion_at.isoformat()
        })
        clear_auth_cookies(response)
        return response
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic deletion error
        logger.error(f"계정 삭제 요청 오류: user_id={user.id}, error={str(e)}", exc_info=True)
        return Response({'error': '계정 삭제 요청 중 오류가 발생했습니다.'}, status=500)


# ========================================
# 세션 브리지 (Native ↔ WebView 인증 동기화)
# ========================================

@extend_schema(responses={200: openapi.SessionBridgeIssueResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def session_bridge_issue(request):
    """
    세션 브리지 코드 발급
    - 인증된 사용자만 접근 가능
    - 1회용 코드 생성 (TTL 60초)
    - Native 앱에서 호출하여 WebView 쿠키 동기화에 사용
    """
    from django.core.cache import cache
    
    user = request.user
    if not _is_session_bridge_user_eligible(user):
        return Response(
            {'error': '삭제 예정이거나 비활성화된 계정은 세션 브리지를 사용할 수 없습니다.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    code = str(uuid.uuid4())
    cache_key = f'session_bridge:{code}'
    
    cache.set(cache_key, user.id, timeout=SESSION_BRIDGE_TTL_SECONDS)
    
    logger.info(f"세션 브리지 코드 발급: user_id={user.id}, code={code[:8]}...")
    
    return Response({'code': code})


@extend_schema(
    parameters=[
        OpenApiParameter(
            'code',
            OpenApiTypes.UUID,
            required=True,
            description='Single-use session bridge code.',
        ),
        OpenApiParameter(
            'next',
            str,
            required=False,
            default='/',
            description='Frontend-relative redirect path. Unsafe values redirect to the frontend root.',
        ),
    ],
    responses={
        (200, 'text/html'): OpenApiTypes.STR,
        302: OpenApiResponse(
            description='Redirects to the frontend error route without a response body.',
        ),
    },
)
@api_view(['GET'])
@permission_classes([AllowAny])
def session_bridge_consume(request):
    """
    세션 브리지 코드 소비
    - 1회용 코드를 검증하고 쿠키 설정 후 리다이렉트
    - WebView에서 호출하여 인증 쿠키 획득
    """
    from django.core.cache import cache
    from django.http import HttpResponseRedirect
    
    frontend_url = 'https://maeil1dok.app'
    code = request.GET.get('code')
    raw_next = request.GET.get('next', '/')

    # Open redirect 방지: 프론트엔드 도메인 내부의 경로만 허용한다.
    # 절대 URL, protocol-relative(//), 백슬래시 트릭을 모두 차단하고
    # 앱 내부 경로(/로 시작, //가 아님)만 frontend_url에 이어 붙인다.
    def _safe_next(value):
        if not isinstance(value, str):
            return frontend_url
        value = value.strip()
        if value.startswith('/') and not value.startswith('//') and '\\' not in value:
            return frontend_url + value
        return frontend_url

    next_url = _safe_next(raw_next)

    try:
        if not code:
            logger.warning("세션 브리지: 코드 없음")
            return HttpResponseRedirect(f"{frontend_url}/auth/error?reason=code_required")
        
        user_id = _consume_session_bridge_user_id(cache, code)
        if user_id is None:
            logger.warning(f"세션 브리지: 유효하지 않거나 만료된 코드 code={code[:8]}...")
            return HttpResponseRedirect(f"{frontend_url}/auth/error?reason=invalid_code")
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.warning(f"세션 브리지: 사용자 없음 user_id={user_id}")
            return HttpResponseRedirect(f"{frontend_url}/auth/error?reason=user_not_found")
        if not _is_session_bridge_user_eligible(user):
            logger.warning(f"세션 브리지: 비활성 또는 삭제 예정 사용자 user_id={user_id}")
            return HttpResponseRedirect(f"{frontend_url}/auth/error?reason=inactive_user")
        
        tokens = get_tokens_for_user(user)
        access_token = tokens['access']
        refresh_token = tokens['refresh']
        
        from django.http import HttpResponse
        from django.utils.html import escape
        import json as _json
        # JS 컨텍스트: JSON 인코딩으로 따옴표/스크립트 종료 태그 주입 차단
        next_url_js = _json.dumps(next_url).replace('</', '<\\/')
        next_url_attr = escape(next_url)  # noscript meta refresh 속성용
        html_content = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Redirecting...</title></head>
<body>
<script>window.location.replace({next_url_js});</script>
<noscript><meta http-equiv="refresh" content="0;url={next_url_attr}"></noscript>
</body>
</html>'''
        response = HttpResponse(html_content, content_type='text/html')
        set_auth_cookies(response, access_token, refresh_token)
        
        logger.info(f"세션 브리지 코드 소비: user_id={user.id}, next={next_url}")
        
        return response
        
    except Exception as e:  # noqa: BROAD_EXCEPT_OK  — HTTP boundary returns a generic bridge error
        logger.error(f"세션 브리지 오류: {str(e)}", exc_info=True)
        return HttpResponseRedirect(f"{frontend_url}/auth/error?reason=server_error")

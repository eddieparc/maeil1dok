# noqa: SIZE_OK  — legacy profile endpoint module; account hardening only reuses its serializer validation path
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from utils.response import StandardResponse, handle_api_exception
from django.db.models import Q, Count, F
from django.utils import timezone
from datetime import datetime, timedelta
from .models import User, UserProfile, Follow, UserAchievement, UserReadingSettings
from .serializers import (
    UserProfileSerializer, FollowSerializer,
    UserAchievementSerializer, UserCalendarDataSerializer,
    UserSearchSerializer, UserSerializer,
    PublicUserSerializer, ReadingSettingsSerializer
)
from authz import can, subject_from_request
from authz.policies.user_profile import (
    FollowEdge,
    FollowTarget,
    FriendsCollection,
    ProfileSearch,
    ProfileUpdate,
    UserProfileResource,
)
from . import openapi_serializers as openapi
from .achievement_config import ACHIEVEMENT_METADATA
from todos.models import UserBibleProgress, PlanSubscription, DailyBibleSchedule, UserPlanDisplaySettings
from todos.serializers import CalendarMonthQuerySerializer
from todos.utils import abbreviate_schedule, get_plan_color
# noqa: SIZE_OK  — legacy profile endpoint module; account hardening only reuses its serializer validation path
import logging

logger = logging.getLogger(__name__)


def _authz_denial_response(decision):
    denial = decision.denial
    if denial.body is None:
        return Response(status=denial.status_code)
    return Response(denial.body, status=denial.status_code)


def _profile_from_read_decision(decision):
    context = decision.value
    if context.is_own_profile:
        profile, _ = UserProfile.objects.get_or_create(user=context.user)
        return context.user, profile, True
    return context.user, context.profile, False


_MAX_FOLLOW_USER_ID = 9223372036854775807


def _parse_follow_user_id(value):
    """Validate the follow target ``user_id`` from client input.

    Returns ``(user_id, error_response)``. Missing/empty values keep the
    existing required-field message; booleans, non-numeric strings/objects,
    non-positive integers, and out-of-range overflow values are rejected as
    HTTP 400 before any ORM lookup so malformed payloads never reach the
    generic 500 handler or accidentally target id 1.
    """
    if value is None or value == '':
        return None, StandardResponse.error(
            error='팔로우할 사용자 ID가 필요합니다.',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if isinstance(value, bool):
        return None, _invalid_follow_user_id_response()

    if isinstance(value, int):
        parsed = value
    elif isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None, StandardResponse.error(
                error='팔로우할 사용자 ID가 필요합니다.',
                status_code=status.HTTP_400_BAD_REQUEST
            )
        try:
            parsed = int(stripped, 10)
        except (TypeError, ValueError):
            return None, _invalid_follow_user_id_response()
    else:
        return None, _invalid_follow_user_id_response()

    if parsed < 1 or parsed > _MAX_FOLLOW_USER_ID:
        return None, _invalid_follow_user_id_response()

    return parsed, None


def _invalid_follow_user_id_response():
    return StandardResponse.error(
        error='팔로우할 사용자 ID가 올바르지 않습니다.',
        status_code=status.HTTP_400_BAD_REQUEST
    )


def _validated_calendar_month(request):
    serializer = CalendarMonthQuerySerializer(data=request.query_params)
    if not serializer.is_valid():
        return None, StandardResponse.error(
            error='달력 조회 입력값이 올바르지 않습니다.',
            errors=serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST
        )

    today = timezone.now().date()
    return {
        'year': serializer.validated_data.get('year', today.year),
        'month': serializer.validated_data.get('month', today.month),
    }, None


@extend_schema(responses={200: openapi.ProfileResponseSerializer})
@api_view(['GET'])
@permission_classes([AllowAny])
@handle_api_exception
def get_user_profile(request, user_id):
    """사용자 프로필 조회"""
    decision = can(
        subject_from_request(request),
        'view_profile',
        UserProfileResource(user_id=user_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    user, profile, is_own_profile = _profile_from_read_decision(decision)

    if is_own_profile:
        serializer = UserProfileSerializer(profile, context={'request': request})
    else:
        serializer = UserProfileSerializer(
            profile,
            context={
                'request': request,
                'user_serializer_class': PublicUserSerializer
            }
        )
    return StandardResponse.success(
        data={'profile': serializer.data},
        message='프로필을 성공적으로 조회했습니다.'
    )


@extend_schema(responses={200: openapi.ProfileResponseSerializer})
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
@handle_api_exception
def update_user_profile(request):
    """프로필 수정"""
    decision = can(
        subject_from_request(request),
        'update_profile',
        ProfileUpdate(),
    )
    if not decision:
        return _authz_denial_response(decision)
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    serializer = UserProfileSerializer(
        profile,
        data=request.data,
        partial=True,
        context={'request': request}
    )
    if not serializer.is_valid():
        return StandardResponse.error(
            error='프로필 입력값이 올바르지 않습니다.',
            errors=serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST
        )
    serializer.save()

    return StandardResponse.success(
        data={'profile': serializer.data},
        message='프로필이 업데이트되었습니다.'
    )


@extend_schema(
    parameters=[
        OpenApiParameter(
            'year',
            int,
            required=False,
            description='Calendar year (1-9999). Must be supplied together with month; defaults to the current year when both are omitted.',
        ),
        OpenApiParameter(
            'month',
            int,
            required=False,
            description='Calendar month (1-12). Must be supplied together with year; defaults to the current month when both are omitted.',
        ),
    ],
    responses={200: openapi.ProfileCalendarResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
@handle_api_exception
def get_user_calendar(request, user_id):
    """사용자 달력 데이터 조회"""
    decision = can(
        subject_from_request(request),
        'view_profile_calendar',
        UserProfileResource(user_id=user_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    user, _, _ = _profile_from_read_decision(decision)

    calendar_month, error_response = _validated_calendar_month(request)
    if error_response is not None:
        return error_response
    year = calendar_month['year']
    month = calendar_month['month']

    # 해당 월의 진행 데이터 조회
    start_date = datetime(year, month, 1).date()
    if month == 12:
        end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)

    # 사용자의 활성 구독 가져오기
    subscriptions = list(
        PlanSubscription.objects.filter(
            user=user,
            is_active=True
        ).select_related('plan').order_by('id')
    )

    if not subscriptions:
        return StandardResponse.success(
            data={'calendar': [], 'plans': []},
            message='달력 데이터를 조회했습니다.'
        )

    # 구독 ID 목록
    subscription_ids = [subscription.id for subscription in subscriptions]
    plan_ids = [subscription.plan_id for subscription in subscriptions]

    # 표시 설정 조회 (색상 정보)
    display_settings = UserPlanDisplaySettings.objects.filter(
        user=user,
        subscription_id__in=subscription_ids
    ).select_related('subscription')
    color_map = {ds.subscription_id: ds.color for ds in display_settings}

    # 해당 기간의 모든 스케줄을 한 번에 조회
    schedules = DailyBibleSchedule.objects.filter(
        plan_id__in=plan_ids,
        date__range=[start_date, end_date]
    ).select_related('plan').order_by('date')

    # 진행 상황을 한 번에 조회 (N+1 쿼리 최적화)
    progress_map = {
        (p.subscription_id, p.schedule_id): p.is_completed
        for p in UserBibleProgress.objects.filter(
            subscription_id__in=subscription_ids,
            schedule__date__range=[start_date, end_date]
        ).select_related('schedule')
    }

    # 구독-플랜 매핑 및 색상 정보 구성
    subscription_by_plan_id = {
        subscription.plan_id: subscription
        for subscription in subscriptions
    }
    plan_rank_by_subscription_id = {
        subscription.id: idx
        for idx, subscription in enumerate(subscriptions)
    }
    fallback_color_by_subscription_id = {
        subscription.id: get_plan_color(
            plan_rank_by_subscription_id[subscription.id]
        )
        for subscription in subscriptions
    }
    color_by_subscription_id = {
        subscription.id: (
            color_map.get(subscription.id)
            or fallback_color_by_subscription_id[subscription.id]
        )
        for subscription in subscriptions
    }

    # 플랜 정보 구성
    plans_info = []
    for sub in subscriptions:
        plans_info.append({
            'id': sub.plan.id,
            'name': sub.plan.name,
            'color': color_by_subscription_id[sub.id]
        })

    calendar_data = []
    for schedule in schedules:
        subscription = subscription_by_plan_id.get(schedule.plan_id)
        if subscription:
            is_completed = progress_map.get((subscription.id, schedule.id), False)
            calendar_data.append({
                'date': schedule.date,
                'is_completed': is_completed,
                'book': schedule.book,
                'start_chapter': schedule.start_chapter,
                'end_chapter': schedule.end_chapter,
                'chapters': f"{schedule.start_chapter}-{schedule.end_chapter}장",
                'plan_id': subscription.plan.id,
                'plan_name': subscription.plan.name,
                'color': color_by_subscription_id[subscription.id],
                'schedule_id': schedule.id,
                'schedule_text': abbreviate_schedule(
                    schedule.book,
                    schedule.start_chapter,
                    schedule.end_chapter
                )
            })

    return StandardResponse.success(
        data={'calendar': calendar_data, 'plans': plans_info},
        message='달력 데이터를 조회했습니다.'
    )


@extend_schema(responses={201: openapi.FollowResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@handle_api_exception
def follow_user(request):
    """사용자 팔로우"""
    following_id, invalid_response = _parse_follow_user_id(request.data.get('user_id'))
    if invalid_response is not None:
        return invalid_response
    
    decision = can(
        subject_from_request(request),
        'follow',
        FollowTarget(following_id=following_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    following_user = decision.value

    # 이미 팔로우 중인지 확인
    follow, created = Follow.objects.get_or_create(
        follower=request.user,
        following=following_user
    )
    
    if not created:
        return StandardResponse.error(
            error='이미 팔로우 중입니다.',
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    serializer = FollowSerializer(follow)
    return StandardResponse.success(
        data={'follow': serializer.data},
        message='팔로우했습니다.',
        status_code=status.HTTP_201_CREATED
    )


@extend_schema(responses={200: openapi.UnfollowResponseSerializer})
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@handle_api_exception
def unfollow_user(request, user_id):
    """사용자 언팔로우"""
    decision = can(
        subject_from_request(request),
        'unfollow',
        FollowEdge(following_id=user_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    follow = decision.value
    follow.delete()

    return StandardResponse.success(
        data={'unfollowed_user_id': user_id},
        message='언팔로우했습니다.'
    )


@extend_schema(responses={200: openapi.FollowersResponseSerializer})
@api_view(['GET'])
@permission_classes([AllowAny])
@handle_api_exception
def get_followers(request, user_id):
    """팔로워 목록 조회"""
    decision = can(
        subject_from_request(request),
        'view_followers',
        UserProfileResource(user_id=user_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    followers = decision.value

    # N+1 방지: 현재 사용자의 팔로잉 목록 미리 조회
    following_ids = set()
    if request.user.is_authenticated:
        following_ids = set(
            Follow.objects.filter(follower=request.user)
            .values_list('following_id', flat=True)
        )

    serializer = UserSearchSerializer(
        followers, many=True,
        context={'request': request, 'following_ids': following_ids}
    )
    return StandardResponse.success(
        data={'followers': serializer.data},
        message='팔로워 목록을 조회했습니다.'
    )


@extend_schema(responses={200: openapi.FollowingResponseSerializer})
@api_view(['GET'])
@permission_classes([AllowAny])
@handle_api_exception
def get_following(request, user_id):
    """팔로잉 목록 조회"""
    decision = can(
        subject_from_request(request),
        'view_following',
        UserProfileResource(user_id=user_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    following = decision.value

    # N+1 방지: 현재 사용자의 팔로잉 목록 미리 조회
    following_ids = set()
    if request.user.is_authenticated:
        following_ids = set(
            Follow.objects.filter(follower=request.user)
            .values_list('following_id', flat=True)
        )

    serializer = UserSearchSerializer(
        following, many=True,
        context={'request': request, 'following_ids': following_ids}
    )
    return StandardResponse.success(
        data={'following': serializer.data},
        message='팔로잉 목록을 조회했습니다.'
    )


@extend_schema(responses={200: openapi.FriendsResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@handle_api_exception
def get_friends(request):
    """상호 팔로우(친구) 목록 조회"""
    decision = can(
        subject_from_request(request),
        'view_friends',
        FriendsCollection(),
    )
    if not decision:
        return _authz_denial_response(decision)
    friends = decision.value

    # N+1 방지: 현재 사용자의 팔로잉 목록 미리 조회
    following_ids = set(
        Follow.objects.filter(follower=request.user)
        .values_list('following_id', flat=True)
    )

    serializer = UserSearchSerializer(
        friends, many=True,
        context={'request': request, 'following_ids': following_ids}
    )
    return StandardResponse.success(
        data={'friends': serializer.data},
        message='친구 목록을 성공적으로 조회했습니다.'
    )


@extend_schema(
    parameters=[
        OpenApiParameter(
            'q',
            str,
            required=True,
            description='Nickname or username search text (minimum two characters).',
        ),
    ],
    responses={200: openapi.UserSearchResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
@handle_api_exception
def search_users(request):
    """사용자 검색"""
    query = request.query_params.get('q', '')
    if len(query) < 2:
        return StandardResponse.error(
            error='검색어는 2자 이상 입력해주세요.',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    decision = can(
        subject_from_request(request),
        'search_profiles',
        ProfileSearch(),
    )
    if not decision:
        return _authz_denial_response(decision)
    users = decision.value.filter(
        Q(nickname__icontains=query) | Q(username__icontains=query)
    ).exclude(
        id=request.user.id if request.user.is_authenticated else None
    )[:20]

    # N+1 방지: 현재 사용자의 팔로잉 목록 미리 조회
    following_ids = set()
    if request.user.is_authenticated:
        following_ids = set(
            Follow.objects.filter(follower=request.user)
            .values_list('following_id', flat=True)
        )

    serializer = UserSearchSerializer(
        users, many=True,
        context={'request': request, 'following_ids': following_ids}
    )
    return StandardResponse.success(
        data={'users': serializer.data},
        message='검색 결과입니다.'
    )


@extend_schema(responses={200: openapi.AchievementsResponseSerializer})
@api_view(['GET'])
@permission_classes([AllowAny])
@handle_api_exception
def get_user_achievements(request, user_id):
    """사용자 업적 조회 - 모든 업적 포함 (획득/미획득)"""
    decision = can(
        subject_from_request(request),
        'view_achievements',
        UserProfileResource(user_id=user_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    user, _, _ = _profile_from_read_decision(decision)

    # 획득한 업적 조회
    earned_achievements = {
        a.achievement_type: a
        for a in UserAchievement.objects.filter(user=user)
    }

    # 모든 업적 구성 (획득 + 미획득)
    all_achievements = []
    for achievement_type, metadata in ACHIEVEMENT_METADATA.items():
        earned = earned_achievements.get(achievement_type)
        all_achievements.append({
            'id': earned.id if earned else None,
            'achievement_type': achievement_type,
            'title': metadata['title'],
            'description': metadata['description'],
            'icon': metadata['icon'],
            'order': metadata['order'],
            'unlocked': earned is not None,
            'unlockedAt': earned.achieved_at.isoformat() if earned else None,
            'milestone_value': earned.milestone_value if earned else metadata.get('milestone_value', 0),
        })

    # order 순으로 정렬
    all_achievements.sort(key=lambda x: x['order'])

    return StandardResponse.success(
        data={'achievements': all_achievements},
        message='업적을 조회했습니다.'
    )


@extend_schema(responses={200: openapi.ReadingSettingsResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@handle_api_exception
def get_reading_settings(request):
    """사용자 읽기 설정 조회"""
    settings, created = UserReadingSettings.objects.get_or_create(user=request.user)

    return StandardResponse.success(
        data={'settings': ReadingSettingsSerializer(settings).data},
        message='읽기 설정을 조회했습니다.'
    )


@extend_schema(responses={200: openapi.ReadingSettingsResponseSerializer})
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@handle_api_exception
def update_reading_settings(request):
    """사용자 읽기 설정 업데이트"""
    settings, created = UserReadingSettings.objects.get_or_create(user=request.user)
    serializer = ReadingSettingsSerializer(settings, data=request.data, partial=True)
    if not serializer.is_valid():
        return StandardResponse.error(
            error='읽기 설정 입력값이 올바르지 않습니다.',
            errors=serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST
        )
    serializer.save()

    return StandardResponse.success(
        data={'settings': serializer.data},
        message='읽기 설정이 업데이트되었습니다.'
    )

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Count, F, Q, Sum, Case, When, IntegerField, Prefetch
from django.utils import timezone
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from datetime import date, datetime, timedelta
from accounts.models import User, Follow
from accounts.serializers import UserSearchSerializer
from accounts.visibility import live_user_filter
from authz import can, subject_from_request
from authz.policies.reading_group import GroupScoreboardResource
from .models import BibleReadingPlan, UserBibleProgress, PlanSubscription, DailyBibleSchedule, ReadingGroup, GroupMembership
from . import openapi_serializers as openapi
from .services.hasena_activity import (
    calculate_hasena_activity_stats_bulk,
    get_hasena_count_annotation,
)
import logging

logger = logging.getLogger(__name__)

SCOREBOARD_CACHE_VERSION = 'v4'
VALID_SCOREBOARD_PERIODS = {'all', 'week', 'month'}
DEFAULT_SCOREBOARD_LIMIT = 100
MAX_SCOREBOARD_LIMIT = 500

SCOREBOARD_QUERY_PARAMETERS = [
    OpenApiParameter(
        'period',
        str,
        required=False,
        default='all',
        enum=sorted(VALID_SCOREBOARD_PERIODS),
        description='Activity period.',
    ),
    OpenApiParameter(
        'plan_id',
        int,
        required=False,
        description='Active reading plan ID (positive integer).',
    ),
    OpenApiParameter(
        'limit',
        int,
        required=False,
        default=DEFAULT_SCOREBOARD_LIMIT,
        description='Result limit (1-500). The global scoreboard applies it; other scoreboard variants validate it for compatibility.',
    ),
    OpenApiParameter(
        'month',
        str,
        required=False,
        pattern=r'^\d{4}-\d{2}$',
        description='Calendar month in YYYY-MM form. Used only when period is month; defaults to the current month.',
    ),
]


# ===== Helper Functions =====

def parse_scoreboard_params(request, default_limit=DEFAULT_SCOREBOARD_LIMIT, require_limit=True):
    period = request.query_params.get('period', 'all') or 'all'
    if period not in VALID_SCOREBOARD_PERIODS:
        return None, Response({
            'success': False,
            'error': 'period는 all, week, month 중 하나여야 합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    raw_plan_id = request.query_params.get('plan_id')
    plan_id = None
    if raw_plan_id not in (None, ''):
        try:
            plan_id = int(raw_plan_id)
        except (TypeError, ValueError):
            return None, Response({
                'success': False,
                'error': 'plan_id는 숫자여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        if plan_id <= 0:
            return None, Response({
                'success': False,
                'error': 'plan_id는 1 이상이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        if not BibleReadingPlan.objects.filter(id=plan_id, is_active=True).exists():
            return None, scoreboard_plan_not_found_response()

    limit = default_limit
    if require_limit or 'limit' in request.query_params:
        raw_limit = request.query_params.get('limit', default_limit)
        try:
            limit = int(raw_limit)
        except (TypeError, ValueError):
            return None, Response({
                'success': False,
                'error': 'limit은 숫자여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1 or limit > MAX_SCOREBOARD_LIMIT:
            return None, Response({
                'success': False,
                'error': f'limit은 1 이상 {MAX_SCOREBOARD_LIMIT} 이하이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

    month = parse_scoreboard_month(request.query_params.get('month'), period)
    if isinstance(month, Response):
        return None, month

    return {'plan_id': plan_id, 'period': period, 'limit': limit, 'month': month}, None


def scoreboard_plan_not_found_response():
    return Response({
        'success': False,
        'error': '해당 플랜을 찾을 수 없습니다.'
    }, status=status.HTTP_404_NOT_FOUND)


def parse_scoreboard_month(raw_month, period):
    if period != 'month':
        return None

    if raw_month in (None, ''):
        today = timezone.now().date()
        return today.replace(day=1)

    try:
        parsed = datetime.strptime(raw_month, '%Y-%m').date()
    except (TypeError, ValueError):
        return Response({
            'success': False,
            'error': 'month는 YYYY-MM 형식이어야 합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    return parsed.replace(day=1)


def parse_follow_type(request):
    follow_type = request.query_params.get('type', 'mutual') or 'mutual'
    if follow_type not in {'mutual', 'following'}:
        return None, Response({
            'success': False,
            'error': 'type은 mutual 또는 following이어야 합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    return follow_type, None


def visible_scoreboard_users_for_request(queryset, request):
    queryset = queryset.filter(live_user_filter())
    if request.user.is_authenticated:
        return queryset.filter(Q(profile__is_public=True) | Q(id=request.user.id))
    return queryset.filter(profile__is_public=True)


def get_month_end(month_start):
    if month_start.month == 12:
        if month_start.year >= date.max.year:
            return date.max
        return date(month_start.year + 1, 1, 1)
    return date(month_start.year, month_start.month + 1, 1)


def get_period_filter(period, month_start=None):
    """기간별 날짜 필터 생성"""
    if period == 'week':
        return timezone.now() - timedelta(days=7), None
    if period == 'month':
        start = month_start or timezone.now().date().replace(day=1)
        return start, get_month_end(start)
    return None, None


def get_completed_days_annotation(period, plan_id=None, month_start=None):
    """완료 일수 계산을 위한 annotate 필터 생성"""
    progress_filter = Q(
        plansubscription__is_active=True,
        plansubscription__progress__is_completed=True,
    )

    # 기간 필터
    start_date, end_date = get_period_filter(period, month_start)
    if start_date:
        progress_filter &= Q(plansubscription__progress__completed_at__gte=start_date)
    if end_date:
        progress_filter &= Q(plansubscription__progress__completed_at__lt=end_date)

    # 플랜 필터
    if plan_id:
        progress_filter &= Q(plansubscription__plan_id=plan_id)

    count_field = (
        'plansubscription__progress__schedule__date'
        if period == 'all' and not plan_id
        else 'plansubscription__progress'
    )

    return Count(
        count_field,
        filter=progress_filter,
        distinct=True
    )


def get_completed_count_annotation(period, plan_id=None, month_start=None):
    """리더보드 완료 일수 계산 기준 생성"""
    return get_completed_days_annotation(period, plan_id, month_start)


def calculate_progress_rate(user, plan_id=None):
    """사용자의 진행률 계산

    진도율은 항상 해당 구독 플랜 기준으로 계산됩니다:
    - 완료 스케줄 수 / 오늘까지의 총 스케줄 수 × 100

    주의: UserProfile.total_completed_days는 모든 플랜에 걸친 고유 날짜 수이므로
    특정 플랜의 진도율 계산에는 사용하지 않습니다.
    """
    try:
        subscriptions = PlanSubscription.objects.filter(user=user)
        if plan_id:
            subscriptions = subscriptions.filter(is_active=True)
        else:
            subscriptions = subscriptions.filter(is_active=True)

        if not subscriptions.exists():
            return 0

        if plan_id:
            # 특정 플랜의 진행률
            subscription = subscriptions.filter(plan_id=plan_id).first()
        else:
            # 첫 번째 활성 플랜 기준
            subscription = subscriptions.first()

        if not subscription:
            return 0

        if not plan_id:
            plan_ids = subscriptions.values_list('plan_id', flat=True).distinct()
            total_schedules = DailyBibleSchedule.objects.filter(
                plan_id__in=plan_ids,
                date__lte=timezone.now().date()
            ).count()

            if total_schedules == 0:
                return 0

            completed_schedules = UserBibleProgress.objects.filter(
                subscription__in=subscriptions,
                is_completed=True
            ).count()

            return round((completed_schedules / total_schedules * 100), 2)

        # 해당 플랜의 오늘까지 스케줄 수
        total_schedules = DailyBibleSchedule.objects.filter(
            plan=subscription.plan,
            date__lte=timezone.now().date()
        ).count()

        if total_schedules == 0:
            return 0

        # 해당 구독의 완료 스케줄 수 (플랜 기준으로 일관성 있게 계산)
        completed_schedules = UserBibleProgress.objects.filter(
            subscription=subscription,
            is_completed=True
        ).count()

        return round((completed_schedules / total_schedules * 100), 2)
    except Exception as e:
        logger.error(f"Error calculating progress rate for user {user.id}: {str(e)}")
        return 0


def calculate_progress_rates_bulk(users, plan_id=None):
    """사용자 목록의 진행률을 일괄 계산 (리더보드 N+1 쿼리 방지)

    calculate_progress_rate와 동일한 규칙:
    plan_id가 있으면 해당 플랜 구독 기준, 없으면 첫 번째 활성 구독 기준.
    사용자 수와 무관하게 쿼리 3개로 계산한다.
    """
    user_ids = [u.id for u in users]
    if not user_ids:
        return {}

    if plan_id:
        subs = PlanSubscription.objects.filter(user_id__in=user_ids, is_active=True)
        subs = subs.filter(plan_id=plan_id)
    else:
        subs = PlanSubscription.objects.filter(user_id__in=user_ids, is_active=True)

    if not plan_id:
        plan_ids_by_user = {}
        for sub in subs.order_by('user_id', 'id'):
            plan_ids_by_user.setdefault(sub.user_id, set()).add(sub.plan_id)

        if not plan_ids_by_user:
            return {uid: 0 for uid in user_ids}

        all_plan_ids = set()
        for plan_ids in plan_ids_by_user.values():
            all_plan_ids.update(plan_ids)

        total_by_plan = {
            row['plan_id']: row['cnt']
            for row in DailyBibleSchedule.objects
            .filter(plan_id__in=all_plan_ids, date__lte=timezone.now().date())
            .values('plan_id')
            .annotate(cnt=Count('id'))
        }

        completed_by_user = {
            row['subscription__user_id']: row['cnt']
            for row in UserBibleProgress.objects
            .filter(
                subscription__user_id__in=user_ids,
                subscription__is_active=True,
                is_completed=True
            )
            .values('subscription__user_id')
            .annotate(cnt=Count('id'))
        }

        rates = {}
        for uid in user_ids:
            total = sum(total_by_plan.get(plan_id, 0) for plan_id in plan_ids_by_user.get(uid, set()))
            if not total:
                rates[uid] = 0
                continue
            rates[uid] = round(completed_by_user.get(uid, 0) / total * 100, 2)
        return rates

    # 사용자별 기준 구독 1개 선택 (id 오름차순 → first()와 동일)
    sub_by_user = {}
    for sub in subs.order_by('user_id', 'id'):
        sub_by_user.setdefault(sub.user_id, sub)

    if not sub_by_user:
        return {uid: 0 for uid in user_ids}

    plan_ids = {sub.plan_id for sub in sub_by_user.values()}
    totals = {
        row['plan_id']: row['cnt']
        for row in DailyBibleSchedule.objects
        .filter(plan_id__in=plan_ids, date__lte=timezone.now().date())
        .values('plan_id')
        .annotate(cnt=Count('id'))
    }

    sub_ids = [sub.id for sub in sub_by_user.values()]
    completed = {
        row['subscription_id']: row['cnt']
        for row in UserBibleProgress.objects
        .filter(subscription_id__in=sub_ids, is_completed=True)
        .values('subscription_id')
        .annotate(cnt=Count('id'))
    }

    rates = {}
    for uid in user_ids:
        sub = sub_by_user.get(uid)
        total = totals.get(sub.plan_id, 0) if sub else 0
        if not sub or not total:
            rates[uid] = 0
            continue
        rates[uid] = round(completed.get(sub.id, 0) / total * 100, 2)
    return rates


def build_leaderboard_entry(
    user,
    completed_count,
    plan_id=None,
    is_me=False,
    extra_fields=None,
    progress_rate=None,
    hasena_stats=None,
):
    """리더보드 엔트리 생성"""
    profile = getattr(user, 'profile', None)

    if not profile:
        # Profile이 없는 경우 기본값 사용 (Signal이 동작하지 않은 경우 대비)
        logger.warning(f"User {user.id} has no profile")
        current_streak = 0
        longest_streak = 0
    else:
        current_streak = profile.current_streak
        longest_streak = profile.longest_streak

    safe_hasena_stats = hasena_stats or {
        'total_completed': 0,
        'current_streak': 0,
        'longest_streak': 0,
    }
    activity_score = completed_count + safe_hasena_stats['total_completed']

    entry = {
        'user': {
            'id': user.id,
            'nickname': user.nickname,
            'profile_image': user.profile_image,
            'is_me': is_me
        },
        'completed_days': completed_count,
        'bible_completed_days': completed_count,
        'hasena_completed_days': safe_hasena_stats['total_completed'],
        'activity_score': activity_score,
        'progress_rate': progress_rate if progress_rate is not None else calculate_progress_rate(user, plan_id),
        'current_streak': current_streak,
        'longest_streak': longest_streak,
        'current_hasena_streak': safe_hasena_stats['current_streak'],
        'longest_hasena_streak': safe_hasena_stats['longest_streak'],
    }

    # 추가 필드가 있으면 병합
    if extra_fields:
        entry.update(extra_fields)

    return entry


def get_leaderboard_rank_key(item):
    """순위 동점 여부를 판단하는 키"""
    activity_score = item.get('activity_score', item.get('completed_days', 0))
    return (
        activity_score,
        item['progress_rate'],
        item.get('longest_hasena_streak', 0),
        item['user']['nickname'],
    )


def rank_leaderboard(leaderboard, limit=None):
    """리더보드 정렬 및 순위 부여"""
    # 정렬: 완료 일수(내림차순) → 진행률(내림차순) → 닉네임(오름차순)
    leaderboard.sort(key=lambda x: (
        -x.get('activity_score', x.get('completed_days', 0)),
        -x['progress_rate'],
        -x.get('longest_hasena_streak', 0),
        x['user']['nickname']
    ))

    # 순위 부여 (동점자 처리)
    current_rank = 1
    for i, item in enumerate(leaderboard):
        if i > 0 and get_leaderboard_rank_key(item) != get_leaderboard_rank_key(leaderboard[i-1]):
            current_rank = i + 1
        item['rank'] = current_rank

    # 제한 적용
    if limit:
        return leaderboard[:limit]

    return leaderboard


def group_scoreboard_not_found_response():
    return Response({
        'success': False,
        'error': '그룹을 찾을 수 없습니다.'
    }, status=status.HTTP_404_NOT_FOUND)


# ===== API Views =====


@extend_schema(
    parameters=SCOREBOARD_QUERY_PARAMETERS,
    responses={200: openapi.ScoreboardResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_scoreboard(request):
    """전체 리더보드 조회 - N+1 쿼리 최적화"""
    try:
        params, error_response = parse_scoreboard_params(request)
        if error_response:
            return error_response

        plan_id = params['plan_id']
        period = params['period']
        limit = params['limit']
        month = params['month']
        month_key = month.strftime('%Y-%m') if month else None

        # 캐시 키 생성
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:global:{period}:{month_key}:{plan_id}:{limit}'
        can_use_shared_cache = not request.user.is_authenticated
        if can_use_shared_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)

        # 기본 쿼리셋
        users_query = User.objects.filter(
            live_user_filter()
        ).select_related('profile')

        # 플랜 필터링
        if plan_id:
            users_query = users_query.filter(
                plansubscription__plan_id=plan_id,
                plansubscription__is_active=True
            ).distinct()

        # 공개 프로필 또는 본인
        if request.user.is_authenticated:
            users_query = users_query.filter(
                Q(profile__is_public=True) | Q(id=request.user.id)
            )
        else:
            users_query = users_query.filter(profile__is_public=True)

        # 완료 일수 annotate 추가 (N+1 쿼리 해결)
        users_query = users_query.annotate(
            completed_count=get_completed_count_annotation(period, plan_id, month),
            hasena_completed_count=get_hasena_count_annotation(period, month),
        ).annotate(
            activity_count=F('completed_count') + F('hasena_completed_count'),
        )

        users_query = users_query.order_by('-activity_count', '-completed_count')

        # 리더보드 구성 (진행률은 일괄 계산)
        users = list(users_query)
        progress_rates = calculate_progress_rates_bulk(users, plan_id)
        hasena_stats = calculate_hasena_activity_stats_bulk(users)

        leaderboard = []
        for user in users:
            period_hasena_count = getattr(user, 'hasena_completed_count', 0)
            user_hasena_stats = {
                **hasena_stats.get(user.id, {
                    'total_completed': 0,
                    'current_streak': 0,
                    'longest_streak': 0,
                }),
                'total_completed': period_hasena_count,
            }

            if user.completed_count == 0 and period_hasena_count == 0 and len(leaderboard) >= limit:
                continue

            entry = build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan_id,
                is_me=(user == request.user if request.user.is_authenticated else False),
                progress_rate=progress_rates.get(user.id, 0),
                hasena_stats=user_hasena_stats,
            )
            leaderboard.append(entry)

        # 순위 부여 및 제한
        leaderboard = rank_leaderboard(leaderboard, limit)

        result = {
            'success': True,
            'leaderboard': leaderboard,
            'period': period,
            'month': month_key,
            'plan_id': plan_id
        }

        if can_use_shared_cache:
            cache.set(cache_key, result, 300)

        return Response(result)
    except Exception as e:
        logger.error(f"Error getting scoreboard: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '리더보드를 불러올 수 없습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=[
        *SCOREBOARD_QUERY_PARAMETERS,
        OpenApiParameter(
            'type',
            str,
            required=False,
            default='mutual',
            enum=['mutual', 'following'],
            description='Follow relationship included in the scoreboard.',
        ),
    ],
    responses={200: openapi.FriendsScoreboardResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_friends_scoreboard(request):
    """친구 리더보드 조회 - N+1 쿼리 최적화 + mutual/following 모드"""
    try:
        params, error_response = parse_scoreboard_params(request, require_limit=False)
        if error_response:
            return error_response
        follow_type, error_response = parse_follow_type(request)
        if error_response:
            return error_response

        plan_id = params['plan_id']
        period = params['period']
        month = params['month']
        month_key = month.strftime('%Y-%m') if month else None

        # 캐시 키 생성
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:friends:{request.user.id}:{follow_type}:{period}:{month_key}:{plan_id}'
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # 팔로우 관계에 따른 사용자 쿼리
        if follow_type == 'following':
            # 내가 팔로우하는 모든 사람
            friends = User.objects.filter(
                followers__follower=request.user
            ).distinct().select_related('profile')
        else:
            # 상호 팔로우 (기본값)
            friends = User.objects.filter(
                followers__follower=request.user,
                following__following=request.user
            ).distinct().select_related('profile')

        # 본인 포함 (ID로 쿼리 통합)
        friend_ids = list(friends.values_list('id', flat=True))
        user_ids = friend_ids + [request.user.id]

        # 통합 쿼리셋 (본인 포함)
        users_query = User.objects.filter(live_user_filter(), id__in=user_ids).select_related('profile')
        users_query = users_query.filter(Q(profile__is_public=True) | Q(id=request.user.id))

        # 완료 일수 annotate 추가
        users_query = users_query.annotate(
            completed_count=get_completed_count_annotation(period, plan_id, month),
            hasena_completed_count=get_hasena_count_annotation(period, month),
        ).annotate(
            activity_count=F('completed_count') + F('hasena_completed_count'),
        )

        users_query = users_query.order_by('-activity_count', '-completed_count')

        # 리더보드 구성 (진행률은 일괄 계산)
        users = list(users_query)
        progress_rates = calculate_progress_rates_bulk(users, plan_id)
        hasena_stats = calculate_hasena_activity_stats_bulk(users)

        leaderboard = []
        for user in users:
            period_hasena_count = getattr(user, 'hasena_completed_count', 0)
            user_hasena_stats = {
                **hasena_stats.get(user.id, {
                    'total_completed': 0,
                    'current_streak': 0,
                    'longest_streak': 0,
                }),
                'total_completed': period_hasena_count,
            }
            entry = build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan_id,
                is_me=(user.id == request.user.id),
                progress_rate=progress_rates.get(user.id, 0),
                hasena_stats=user_hasena_stats,
            )
            leaderboard.append(entry)

        # 순위 부여
        leaderboard = rank_leaderboard(leaderboard)

        result = {
            'success': True,
            'leaderboard': leaderboard,
            'period': period,
            'month': month_key,
            'plan_id': plan_id,
            'type': follow_type,
            'total_friends': len(friend_ids)
        }

        # 캐시 저장 (3분 - 친구는 더 자주 업데이트)
        cache.set(cache_key, result, 180)

        return Response(result)
    except Exception as e:
        logger.error(f"Error getting friends scoreboard: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '친구 리더보드를 불러올 수 없습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=SCOREBOARD_QUERY_PARAMETERS,
    responses={200: openapi.GroupScoreboardResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_scoreboard(request, group_id):
    """그룹 리더보드 조회 - N+1 쿼리 최적화"""
    try:
        decision = can(
            subject_from_request(request),
            'view_group_scoreboard',
            GroupScoreboardResource(group_id=group_id),
        )
        if not decision:
            denial = decision.denial
            if denial.body is None:
                return Response(status=denial.status_code)
            return Response(denial.body, status=denial.status_code)
        group = decision.value

        params, error_response = parse_scoreboard_params(request, require_limit=False)
        if error_response:
            return error_response

        period = params['period']
        plan_id = params['plan_id']
        month = params['month']
        month_key = month.strftime('%Y-%m') if month else None

        # 플랜 선택
        if plan_id:
            try:
                plan = group.plans.get(id=plan_id)
            except:
                return Response({
                    'success': False,
                    'error': '해당 플랜을 찾을 수 없습니다.'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            plan = group.plans.filter(is_active=True).first()
            if not plan:
                return Response({
                    'success': False,
                    'error': '그룹에 플랜이 없습니다.'
                }, status=status.HTTP_404_NOT_FOUND)

        can_use_shared_cache = group.is_public and not request.user.is_authenticated

        # 캐시 키
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:group:{group_id}:{plan.id}:{period}:{month_key}'
        if can_use_shared_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)

        # 그룹 멤버 쿼리 - annotate로 최적화
        members = User.objects.filter(
            group_memberships__group=group,
            group_memberships__is_active=True
        ).distinct().select_related('profile')
        members = visible_scoreboard_users_for_request(members, request)

        # 완료 일수 annotate
        members = members.annotate(
            completed_count=get_completed_count_annotation(period, plan.id, month),
            hasena_completed_count=get_hasena_count_annotation(period, month),
        ).annotate(
            activity_count=F('completed_count') + F('hasena_completed_count'),
        )

        # 멤버십 정보 Prefetch
        members = members.prefetch_related(
            Prefetch('group_memberships',
                     queryset=GroupMembership.objects.filter(group=group),
                     to_attr='current_membership')
        )

        # 플랜 구독 Prefetch
        members = members.prefetch_related(
            Prefetch(
                'plansubscription_set',
                queryset=PlanSubscription.objects.filter(plan=plan, is_active=True),
                to_attr='active_plan_subscriptions'
            )
        )

        # 정렬
        members = members.order_by('-activity_count', '-completed_count')

        # 리더보드 구성 (진행률은 일괄 계산)
        members = list(members)
        progress_rates = calculate_progress_rates_bulk(members, plan.id)
        hasena_stats = calculate_hasena_activity_stats_bulk(members)

        leaderboard = []
        for user in members:
            # 플랜 구독 확인
            subscriptions = getattr(user, 'active_plan_subscriptions', [])
            subscription = subscriptions[0] if subscriptions else None

            if not subscription:
                continue

            # 멤버십 정보
            membership = user.current_membership[0] if user.current_membership else None
            if not membership:
                continue

            period_hasena_count = getattr(user, 'hasena_completed_count', 0)
            user_hasena_stats = {
                **hasena_stats.get(user.id, {
                    'total_completed': 0,
                    'current_streak': 0,
                    'longest_streak': 0,
                }),
                'total_completed': period_hasena_count,
            }
            entry = build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan.id,
                is_me=(user == request.user if request.user.is_authenticated else False),
                extra_fields={
                    'joined_at': membership.joined_at
                },
                progress_rate=progress_rates.get(user.id, 0),
                hasena_stats=user_hasena_stats,
            )

            # role 추가
            entry['user']['role'] = membership.get_role_display()
            leaderboard.append(entry)

        # 순위 부여
        leaderboard = rank_leaderboard(leaderboard)

        result = {
            'success': True,
            'group': {
                'id': group.id,
                'name': group.name,
                'description': group.description,
                'member_count': group.member_count
            },
            'plan': {
                'id': plan.id,
                'name': plan.name,
                'description': plan.description
            },
            'leaderboard': leaderboard,
            'period': period,
            'month': month_key
        }

        if can_use_shared_cache:
            cache.set(cache_key, result, 180)

        return Response(result)
    except Exception as e:
        logger.error(f"Error getting group scoreboard: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '그룹 리더보드를 불러올 수 없습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=SCOREBOARD_QUERY_PARAMETERS,
    responses={200: openapi.MyRankingResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_ranking(request):
    """내 순위 조회 - 최적화 버전"""
    try:
        params, error_response = parse_scoreboard_params(request, require_limit=False)
        if error_response:
            return error_response

        plan_id = params['plan_id']
        period = params['period']
        month = params['month']
        month_key = month.strftime('%Y-%m') if month else None

        # 캐시 키
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:my_ranking:{request.user.id}:{period}:{month_key}:{plan_id}'
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # 내 프로필
        profile = getattr(request.user, 'profile', None)
        if not profile:
            logger.warning(f"User {request.user.id} has no profile")
            return Response({
                'success': True,
                'ranking': {
                    'rank': None,
                    'total_users': 0,
                    'completed_days': 0,
                    'current_streak': 0,
                    'longest_streak': 0,
                    'percentile': 0
                },
                'period': period,
                'plan_id': plan_id
            })

        users_query = User.objects.filter(live_user_filter()).select_related('profile')

        if plan_id:
            users_query = users_query.filter(
                plansubscription__plan_id=plan_id,
                plansubscription__is_active=True
            ).distinct()

        users_query = users_query.filter(
            Q(profile__is_public=True) | Q(id=request.user.id)
        ).annotate(
            completed_count=get_completed_count_annotation(period, plan_id, month),
            hasena_completed_count=get_hasena_count_annotation(period, month),
        )

        users = list(users_query)
        progress_rates = calculate_progress_rates_bulk(users, plan_id)
        hasena_stats = calculate_hasena_activity_stats_bulk(users)
        leaderboard = [
            build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan_id,
                is_me=(user.id == request.user.id),
                progress_rate=progress_rates.get(user.id, 0),
                hasena_stats={
                    **hasena_stats.get(user.id, {
                        'total_completed': 0,
                        'current_streak': 0,
                        'longest_streak': 0,
                    }),
                    'total_completed': getattr(user, 'hasena_completed_count', 0),
                },
            )
            for user in users
        ]
        ranked_leaderboard = rank_leaderboard(leaderboard)
        my_entry = next((entry for entry in ranked_leaderboard if entry['user']['id'] == request.user.id), None)

        if my_entry:
            my_rank = my_entry['rank']
            my_completed_days = my_entry['completed_days']
            my_activity_score = my_entry['activity_score']
            my_hasena_completed_days = my_entry['hasena_completed_days']
        else:
            my_rank = None
            my_completed_days = 0
            my_activity_score = 0
            my_hasena_completed_days = 0

        # 전체 활성 사용자 수
        if plan_id:
            plan_user_count = PlanSubscription.objects.filter(
                plan_id=plan_id,
                is_active=True,
                user__is_active=True,
                user__scheduled_deletion_at__isnull=True,
                user__profile__is_public=True
            ).values('user').distinct().count()
            total_users = max(plan_user_count, 1 if my_entry else 0)
        else:
            total_users = len(ranked_leaderboard)

        result = {
            'success': True,
            'ranking': {
                'rank': my_rank,
                'total_users': total_users,
                'completed_days': my_completed_days,
                'bible_completed_days': my_completed_days,
                'hasena_completed_days': my_hasena_completed_days,
                'activity_score': my_activity_score,
                'current_streak': profile.current_streak,
                'longest_streak': profile.longest_streak,
                'percentile': round((1 - (my_rank / total_users)) * 100, 2) if my_rank and total_users > 0 else 0
            },
            'period': period,
            'month': month_key,
            'plan_id': plan_id
        }

        # 캐시 저장 (2분 - 자주 변경될 수 있으므로 짧게)
        cache.set(cache_key, result, 120)

        return Response(result)
    except Exception as e:
        logger.error(f"Error getting my ranking: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '순위를 불러올 수 없습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

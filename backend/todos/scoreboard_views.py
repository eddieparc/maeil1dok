from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Count, Q, F, Sum, Case, When, IntegerField, Prefetch
from django.utils import timezone
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator
from datetime import datetime, timedelta
from accounts.models import User, UserProfile, Follow
from accounts.serializers import UserSearchSerializer
from .models import UserBibleProgress, PlanSubscription, DailyBibleSchedule, ReadingGroup, GroupMembership
import logging

logger = logging.getLogger(__name__)

SCOREBOARD_CACHE_VERSION = 'v2'


# ===== Helper Functions =====

def get_period_filter(period):
    """기간별 날짜 필터 생성"""
    if period == 'week':
        return timezone.now() - timedelta(days=7)
    elif period == 'month':
        return timezone.now() - timedelta(days=30)
    return None


def get_completed_days_annotation(period, plan_id=None):
    """완료 일수 계산을 위한 annotate 필터 생성"""
    progress_filter = Q(plansubscription__progress__is_completed=True)

    # 기간 필터
    start_date = get_period_filter(period)
    if start_date:
        progress_filter &= Q(plansubscription__progress__completed_at__gte=start_date)

    # 플랜 필터
    if plan_id:
        progress_filter &= Q(plansubscription__plan_id=plan_id)

    return Count(
        'plansubscription__progress',
        filter=progress_filter,
        distinct=True
    )


def get_completed_count_annotation(period, plan_id=None):
    """리더보드 완료 일수 계산 기준 생성"""
    if period == 'all' and not plan_id:
        return F('profile__total_completed_days')

    return get_completed_days_annotation(period, plan_id)


def calculate_progress_rate(user, plan_id=None):
    """사용자의 진행률 계산

    진도율은 항상 해당 구독 플랜 기준으로 계산됩니다:
    - 완료 스케줄 수 / 오늘까지의 총 스케줄 수 × 100

    주의: UserProfile.total_completed_days는 모든 플랜에 걸친 고유 날짜 수이므로
    특정 플랜의 진도율 계산에는 사용하지 않습니다.
    """
    try:
        subscriptions = PlanSubscription.objects.filter(user=user, is_active=True)
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

    subs = PlanSubscription.objects.filter(user_id__in=user_ids, is_active=True)
    if plan_id:
        subs = subs.filter(plan_id=plan_id)

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


def build_leaderboard_entry(user, completed_count, plan_id=None, is_me=False, extra_fields=None, progress_rate=None):
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

    entry = {
        'user': {
            'id': user.id,
            'nickname': user.nickname,
            'profile_image': user.profile_image,
            'is_me': is_me
        },
        'completed_days': completed_count,
        'progress_rate': progress_rate if progress_rate is not None else calculate_progress_rate(user, plan_id),
        'current_streak': current_streak,
        'longest_streak': longest_streak
    }

    # 추가 필드가 있으면 병합
    if extra_fields:
        entry.update(extra_fields)

    return entry


def get_leaderboard_rank_key(item):
    """순위 동점 여부를 판단하는 키"""
    return item['completed_days'], item['progress_rate']


def rank_leaderboard(leaderboard, limit=None):
    """리더보드 정렬 및 순위 부여"""
    # 정렬: 완료 일수(내림차순) → 진행률(내림차순) → 닉네임(오름차순)
    leaderboard.sort(key=lambda x: (
        -x['completed_days'],
        -x['progress_rate'],
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


# ===== API Views =====


@api_view(['GET'])
@permission_classes([AllowAny])
def get_scoreboard(request):
    """전체 리더보드 조회 - N+1 쿼리 최적화"""
    try:
        # 쿼리 파라미터
        plan_id = request.query_params.get('plan_id')
        period = request.query_params.get('period', 'all')  # all, week, month
        limit = int(request.query_params.get('limit', 100))

        # 캐시 키 생성
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:global:{period}:{plan_id}:{limit}'
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # 기본 쿼리셋
        users_query = User.objects.filter(is_active=True).select_related('profile')

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
            completed_count=get_completed_count_annotation(period, plan_id)
        )

        # 정렬 (DB 레벨에서 처리)
        users_query = users_query.order_by('-completed_count')[:limit * 2]  # 여유있게 가져오기

        # 리더보드 구성 (진행률은 일괄 계산)
        users = list(users_query)
        progress_rates = calculate_progress_rates_bulk(users, plan_id)

        leaderboard = []
        for user in users:
            # completed_count가 0인 사용자는 제외 (선택사항)
            if user.completed_count == 0 and len(leaderboard) >= limit:
                continue

            entry = build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan_id,
                is_me=(user == request.user if request.user.is_authenticated else False),
                progress_rate=progress_rates.get(user.id, 0)
            )
            leaderboard.append(entry)

        # 순위 부여 및 제한
        leaderboard = rank_leaderboard(leaderboard, limit)

        result = {
            'success': True,
            'leaderboard': leaderboard,
            'period': period,
            'plan_id': plan_id
        }

        # 캐시 저장 (5분)
        cache.set(cache_key, result, 300)

        return Response(result)
    except Exception as e:
        logger.error(f"Error getting scoreboard: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '리더보드를 불러올 수 없습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_friends_scoreboard(request):
    """친구 리더보드 조회 - N+1 쿼리 최적화 + mutual/following 모드"""
    try:
        # 쿼리 파라미터
        plan_id = request.query_params.get('plan_id')
        period = request.query_params.get('period', 'all')
        follow_type = request.query_params.get('type', 'mutual')  # mutual 또는 following

        # 캐시 키 생성
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:friends:{request.user.id}:{follow_type}:{period}:{plan_id}'
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
        users_query = User.objects.filter(id__in=user_ids).select_related('profile')

        # 완료 일수 annotate 추가
        users_query = users_query.annotate(
            completed_count=get_completed_count_annotation(period, plan_id)
        )

        # 정렬
        users_query = users_query.order_by('-completed_count')

        # 리더보드 구성 (진행률은 일괄 계산)
        users = list(users_query)
        progress_rates = calculate_progress_rates_bulk(users, plan_id)

        leaderboard = []
        for user in users:
            entry = build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan_id,
                is_me=(user.id == request.user.id),
                progress_rate=progress_rates.get(user.id, 0)
            )
            leaderboard.append(entry)

        # 순위 부여
        leaderboard = rank_leaderboard(leaderboard)

        result = {
            'success': True,
            'leaderboard': leaderboard,
            'period': period,
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


@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_scoreboard(request, group_id):
    """그룹 리더보드 조회 - N+1 쿼리 최적화"""
    try:
        # 그룹 확인
        try:
            group = ReadingGroup.objects.get(id=group_id)
        except ReadingGroup.DoesNotExist:
            return Response({
                'success': False,
                'error': '그룹을 찾을 수 없습니다.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 비공개 그룹이고 멤버가 아닌 경우
        if not group.is_public:
            if not request.user.is_authenticated:
                return Response({
                    'success': False,
                    'error': '비공개 그룹입니다.'
                }, status=status.HTTP_403_FORBIDDEN)

            is_member = GroupMembership.objects.filter(
                group=group,
                user=request.user,
                is_active=True
            ).exists()

            if not is_member:
                return Response({
                    'success': False,
                    'error': '그룹 멤버만 조회할 수 있습니다.'
                }, status=status.HTTP_403_FORBIDDEN)

        # 쿼리 파라미터
        period = request.query_params.get('period', 'all')
        plan_id = request.query_params.get('plan_id')

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
            plan = group.plans.first()
            if not plan:
                return Response({
                    'success': False,
                    'error': '그룹에 플랜이 없습니다.'
                }, status=status.HTTP_404_NOT_FOUND)

        # 캐시 키
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:group:{group_id}:{plan.id}:{period}'
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # 그룹 멤버 쿼리 - annotate로 최적화
        members = User.objects.filter(
            group_memberships__group=group,
            group_memberships__is_active=True
        ).distinct().select_related('profile')

        # 완료 일수 annotate
        members = members.annotate(
            completed_count=get_completed_count_annotation(period, plan.id)
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
        members = members.order_by('-completed_count')

        # 리더보드 구성 (진행률은 일괄 계산)
        members = list(members)
        progress_rates = calculate_progress_rates_bulk(members, plan.id)

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

            # 엔트리 생성
            entry = build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan.id,
                is_me=(user == request.user if request.user.is_authenticated else False),
                extra_fields={
                    'joined_at': membership.joined_at
                },
                progress_rate=progress_rates.get(user.id, 0)
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
            'period': period
        }

        # 캐시 저장 (3분)
        cache.set(cache_key, result, 180)

        return Response(result)
    except Exception as e:
        logger.error(f"Error getting group scoreboard: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '그룹 리더보드를 불러올 수 없습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_ranking(request):
    """내 순위 조회 - 최적화 버전"""
    try:
        plan_id = request.query_params.get('plan_id')
        period = request.query_params.get('period', 'all')

        # 캐시 키
        cache_key = f'scoreboard:{SCOREBOARD_CACHE_VERSION}:my_ranking:{request.user.id}:{period}:{plan_id}'
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

        users_query = User.objects.filter(is_active=True).select_related('profile')

        if plan_id:
            users_query = users_query.filter(
                plansubscription__plan_id=plan_id,
                plansubscription__is_active=True
            ).distinct()

        users_query = users_query.filter(
            Q(profile__is_public=True) | Q(id=request.user.id)
        ).annotate(
            completed_count=get_completed_count_annotation(period, plan_id)
        )

        users = list(users_query)
        progress_rates = calculate_progress_rates_bulk(users, plan_id)
        leaderboard = [
            build_leaderboard_entry(
                user=user,
                completed_count=user.completed_count,
                plan_id=plan_id,
                is_me=(user.id == request.user.id),
                progress_rate=progress_rates.get(user.id, 0)
            )
            for user in users
        ]
        ranked_leaderboard = rank_leaderboard(leaderboard)
        my_entry = next((entry for entry in ranked_leaderboard if entry['user']['id'] == request.user.id), None)

        if my_entry:
            my_rank = my_entry['rank']
            my_completed_days = my_entry['completed_days']
        else:
            my_rank = None
            my_completed_days = 0

        # 전체 활성 사용자 수
        if plan_id:
            plan_user_count = PlanSubscription.objects.filter(
                plan_id=plan_id,
                is_active=True,
                user__is_active=True,
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
                'current_streak': profile.current_streak,
                'longest_streak': profile.longest_streak,
                'percentile': round((1 - (my_rank / total_users)) * 100, 2) if my_rank and total_users > 0 else 0
            },
            'period': period,
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

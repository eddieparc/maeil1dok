"""
멀티 플랜 캘린더 관련 API 뷰
"""
from datetime import date, timedelta
from calendar import monthrange
from collections import defaultdict

from django.db import transaction
from django.db.models import Exists, OuterRef, Subquery

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    UserPlanDisplaySettings, PlanSubscription,
    DailyBibleSchedule, UserBibleProgress
)
from .serializers import (
    CalendarMonthQuerySerializer,
    CalendarSettingReorderItemSerializer,
    CalendarSettingUpdateSerializer,
    UserPlanDisplaySettingsSerializer,
)
from .views import book_to_code


def _calendar_settings_for_user(user):
    return UserPlanDisplaySettings.objects.filter(
        user=user,
        subscription__is_active=True,
    ).select_related('subscription', 'subscription__plan')


def _settings_by_id(user, setting_ids):
    settings = UserPlanDisplaySettings.objects.filter(
        user=user,
        id__in=setting_ids,
        subscription__is_active=True,
    )
    return {setting.id: setting for setting in settings}


def _duplicate_values(values):
    seen = set()
    duplicates = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return duplicates


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_calendar_settings(request):
    """
    사용자의 모든 플랜 표시 설정 조회
    GET /api/v1/todos/calendar/settings/
    """
    settings = _calendar_settings_for_user(request.user).order_by('display_order')

    serializer = UserPlanDisplaySettingsSerializer(settings, many=True)

    return Response({
        'success': True,
        'settings': serializer.data
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_calendar_setting(request, pk):
    """
    개별 플랜 표시 설정 업데이트
    PATCH /api/v1/todos/calendar/settings/<id>/
    """
    try:
        setting = UserPlanDisplaySettings.objects.get(
            pk=pk,
            user=request.user,
            subscription__is_active=True,
        )
    except UserPlanDisplaySettings.DoesNotExist:
        return Response({
            'success': False,
            'error': '설정을 찾을 수 없습니다.'
        }, status=status.HTTP_404_NOT_FOUND)

    serializer = CalendarSettingUpdateSerializer(
        setting,
        data=request.data,
        partial=True,
    )
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    serializer = UserPlanDisplaySettingsSerializer(setting)

    return Response({
        'success': True,
        'setting': serializer.data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reorder_calendar_settings(request):
    """
    플랜 표시 순서 일괄 변경
    POST /api/v1/todos/calendar/settings/reorder/
    Body: { "orders": [{"id": 1, "display_order": 0}, ...] }
    """
    orders = request.data.get('orders', [])

    if not orders:
        return Response({
            'success': False,
            'error': '순서 정보가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer = CalendarSettingReorderItemSerializer(data=orders, many=True)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    validated_orders = serializer.validated_data
    setting_ids = [item['id'] for item in validated_orders]
    if _duplicate_values(setting_ids):
        return Response({
            'success': False,
            'error': '중복된 설정 ID가 포함되어 있습니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    settings_map = _settings_by_id(request.user, setting_ids)
    if len(settings_map) != len(setting_ids):
        return Response({
            'success': False,
            'error': '설정을 찾을 수 없습니다.'
        }, status=status.HTTP_404_NOT_FOUND)

    with transaction.atomic():
        settings = []
        for item in validated_orders:
            setting = settings_map[item['id']]
            setting.display_order = item['display_order']
            settings.append(setting)
        UserPlanDisplaySettings.objects.bulk_update(settings, ['display_order'])

    # 업데이트된 설정 반환
    settings = _calendar_settings_for_user(request.user).order_by('display_order')

    serializer = UserPlanDisplaySettingsSerializer(settings, many=True)

    return Response({
        'success': True,
        'settings': serializer.data
    })


def _format_schedule_chapters(schedule):
    if schedule.start_chapter == schedule.end_chapter:
        return f"{schedule.start_chapter}장"
    return f"{schedule.start_chapter}-{schedule.end_chapter}장"


def _month_schedules_by_plan(plan_ids, start_date, end_date):
    if not plan_ids:
        return {}, []

    schedules_by_plan = defaultdict(list)
    schedule_ids = []
    schedules = DailyBibleSchedule.objects.filter(
        plan_id__in=plan_ids,
        date__range=[start_date, end_date],
    ).order_by('date', 'id')

    for schedule in schedules:
        schedules_by_plan[schedule.plan_id].append(schedule)
        schedule_ids.append(schedule.id)

    return schedules_by_plan, schedule_ids


def _progress_completion_map(subscription_ids, schedule_ids):
    if not subscription_ids or not schedule_ids:
        return {}

    progress_rows = UserBibleProgress.objects.filter(
        subscription_id__in=subscription_ids,
        schedule_id__in=schedule_ids,
    ).values_list('subscription_id', 'schedule_id', 'is_completed')
    return {
        (subscription_id, schedule_id): is_completed
        for subscription_id, schedule_id, is_completed in progress_rows
    }


def _calendar_item(display_setting, schedule, is_completed):
    subscription = display_setting.subscription
    plan = subscription.plan
    return {
        'plan_id': plan.id,
        'plan_name': plan.name,
        'subscription_id': subscription.id,
        'color': display_setting.color,
        'book': schedule.book,
        'chapters': _format_schedule_chapters(schedule),
        'is_completed': is_completed,
        'schedule_id': schedule.id,
        'is_visible': display_setting.is_visible
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_calendar_month_data(request):
    """
    멀티플랜 월별 캘린더 데이터 조회
    GET /api/v1/todos/calendar/month/?year=2025&month=12
    """
    query_serializer = CalendarMonthQuerySerializer(data=request.query_params)
    if not query_serializer.is_valid():
        return Response({
            'success': False,
            'errors': query_serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    # 기본값: 현재 월
    today = date.today()
    year = query_serializer.validated_data.get('year', today.year)
    month = query_serializer.validated_data.get('month', today.month)

    # 해당 월의 시작일과 종료일
    _, last_day = monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    # 사용자의 활성 구독 및 표시 설정 조회
    display_settings = list(
        _calendar_settings_for_user(request.user).order_by(
            'display_order',
            'created_at',
        )
    )
    subscription_ids = [setting.subscription_id for setting in display_settings]
    plan_ids = [setting.subscription.plan_id for setting in display_settings]
    display_rank_by_subscription_id = {
        setting.subscription_id: index
        for index, setting in enumerate(display_settings)
    }

    schedules_by_plan, schedule_ids = _month_schedules_by_plan(
        plan_ids,
        start_date,
        end_date,
    )
    progress_map = _progress_completion_map(subscription_ids, schedule_ids)

    calendar_data = defaultdict(list)
    for display_setting in display_settings:
        subscription_id = display_setting.subscription_id
        plan_id = display_setting.subscription.plan_id
        for schedule in schedules_by_plan.get(plan_id, []):
            date_str = schedule.date.isoformat()
            is_completed = progress_map.get((subscription_id, schedule.id), False)
            calendar_data[date_str].append(
                _calendar_item(display_setting, schedule, is_completed)
            )

    # 표시 순서에 따라 각 날짜의 데이터 정렬
    for date_str in calendar_data:
        calendar_data[date_str].sort(
            key=lambda item: display_rank_by_subscription_id.get(
                item['subscription_id'],
                999,
            )
        )

    # 설정 정보도 함께 반환
    settings_serializer = UserPlanDisplaySettingsSerializer(
        display_settings, many=True
    )

    return Response({
        'success': True,
        'calendar': dict(calendar_data),
        'settings': settings_serializer.data,
        'meta': {
            'year': year,
            'month': month
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_last_incomplete_positions(request):
    """
    각 플랜별 마지막 미완료 위치 조회
    GET /api/v1/todos/calendar/last-incomplete/
    """
    today = date.today()

    # 완료된 진도가 있는지 확인하기 위한 상관 서브쿼리
    # (바깥쪽 구독 + 후보 스케줄로 스코프)
    completed_progress = UserBibleProgress.objects.filter(
        subscription_id=OuterRef(OuterRef('pk')),
        schedule_id=OuterRef('pk'),
        is_completed=True,
    )

    # 각 구독별 마지막 미완료 스케줄 id를 구하는 상관 서브쿼리
    last_incomplete_schedule = DailyBibleSchedule.objects.filter(
        plan_id=OuterRef('plan_id'),
        date__lte=today,
    ).filter(
        ~Exists(completed_progress)
    ).order_by('-date', '-id').values('id')[:1]

    # 활성 구독을 한 번만 조회하면서 마지막 미완료 스케줄 id를 주석으로 첨부
    subscriptions = list(
        PlanSubscription.objects.filter(
            user=request.user,
            is_active=True,
        ).select_related('plan').annotate(
            last_incomplete_schedule_id=Subquery(last_incomplete_schedule)
        )
    )

    # 주석된 스케줄 id를 대량 조회
    schedule_ids = [
        subscription.last_incomplete_schedule_id
        for subscription in subscriptions
        if subscription.last_incomplete_schedule_id is not None
    ]
    schedule_by_id = {}
    if schedule_ids:
        schedule_by_id = {
            schedule.id: schedule
            for schedule in DailyBibleSchedule.objects.filter(id__in=schedule_ids)
        }

    # 표시 색상을 대량 조회 (없으면 기본색 대체)
    subscription_ids = [subscription.id for subscription in subscriptions]
    color_by_subscription_id = dict(
        UserPlanDisplaySettings.objects.filter(
            user=request.user,
            subscription_id__in=subscription_ids,
        ).values_list('subscription_id', 'color')
    )

    positions = []
    for subscription in subscriptions:
        schedule_id = subscription.last_incomplete_schedule_id
        if schedule_id is None:
            continue
        schedule = schedule_by_id.get(schedule_id)
        if schedule is None:
            continue

        plan = subscription.plan
        color = color_by_subscription_id.get(subscription.id, '#3B82F6')
        positions.append({
            'plan_id': plan.id,
            'plan_name': plan.name,
            'subscription_id': subscription.id,
            'color': color,
            'date': schedule.date.isoformat(),
            'book': schedule.book,
            'book_code': book_to_code.get(schedule.book, 'gen'),
            'chapters': _format_schedule_chapters(schedule),
            'start_chapter': schedule.start_chapter,
            'schedule_id': schedule.id
        })

    # 날짜 기준 정렬 (가장 최근 미완료가 먼저)
    positions.sort(key=lambda x: x['date'], reverse=True)

    return Response({
        'success': True,
        'positions': positions
    })

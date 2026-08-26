"""
Catchup 기능 관련 뷰
"""
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import Sum
from collections import defaultdict

from .models import PlanSubscription, CatchupSession, CatchupSchedule
from .serializers import (
    CatchupStatusSerializer, CatchupPreviewRequestSerializer,
    CatchupSessionSerializer, CatchupSessionCreateSerializer,
    CatchupSessionUpdateSerializer, CatchupSessionSchedulesQuerySerializer,
    CatchupScheduleSerializer, CatchupCompleteResponseSerializer,
    OverdueScheduleSerializer
)
from .services import (
    get_overdue_schedules, get_overdue_schedules_in_range,
    calculate_catchup_schedule, calculate_suggested_settings,
    copy_completed_progress, sync_original_progress, get_celebration_data
)
from .services.notifications import on_commit_notify_reading_completed
from . import openapi_serializers as openapi


def _parse_recalculate_flag(data):
    raw_value = data.get('recalculate', False)
    if raw_value is None or raw_value is False or raw_value == '':
        return False
    if raw_value is True:
        return True
    if isinstance(raw_value, str):
        normalized = raw_value.strip().lower()
        if normalized in {'true', '1', 'yes', 'on'}:
            return True
        if normalized in {'false', '0', 'no', 'off'}:
            return False
    raise ValidationError({'recalculate': 'Boolean value expected.'})


def _active_catchup_error_response():
    return Response(
        {'error': '이미 진행 중인 따라잡기가 있습니다. 기존 따라잡기를 완료하거나 포기 후 다시 시도해주세요.'},
        status=status.HTTP_400_BAD_REQUEST
    )


def _visible_catchup_session_queryset():
    return CatchupSession.objects.exclude(
        status='active',
        subscription__is_active=False,
    ).exclude(
        status='active',
        subscription__plan__is_active=False,
    )


def _operable_catchup_session_queryset():
    return CatchupSession.objects.filter(
        status='active',
        subscription__is_active=True,
        subscription__plan__is_active=True,
    )


def _catchup_overflow_message(remaining_count):
    return f'목표일까지 {remaining_count}개 스케줄을 완료할 수 없습니다. 목표일을 늦추거나 읽기량을 늘려주세요.'


class CatchupRedistributionOverflow(Exception):
    def __init__(self, remaining_count):
        self.remaining_count = remaining_count
        super().__init__(remaining_count)


def _is_active_catchup_identity_conflict(error):
    return 'active_subscription_identity' in str(error).lower()


def _redistribute_catchup_schedules(session):
    completed_original_ids = list(
        session.schedules
        .filter(is_completed=True)
        .values_list('original_schedule_id', flat=True)
    )
    remaining_originals = list(
        get_overdue_schedules_in_range(
            session.subscription,
            session.range_start,
            session.range_end
        ).exclude(id__in=completed_original_ids)
    )

    distributed, remaining = calculate_catchup_schedule(
        remaining_originals,
        start_date=timezone.now().date(),
        target_date=session.target_rejoin_date,
        max_daily_readings=session.max_daily_readings,
        max_daily_chapters=session.max_daily_chapters,
        weekend_multiplier=float(session.weekend_multiplier)
    )
    if remaining:
        raise CatchupRedistributionOverflow(len(remaining))

    session.schedules.filter(is_completed=False).delete()
    catchup_schedules = [
        CatchupSchedule(
            session=session,
            original_schedule=original_schedule,
            scheduled_date=day_data['date'],
        )
        for day_data in distributed
        for original_schedule in day_data['items']
    ]
    if catchup_schedules:
        CatchupSchedule.objects.bulk_create(catchup_schedules)


@extend_schema(responses={200: openapi.CatchupStatusResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catchup_status(request, subscription_id):
    """
    구독의 밀린 현황 조회
    GET /api/v1/todos/subscriptions/{subscription_id}/catchup-status/
    """
    subscription = get_object_or_404(
        PlanSubscription,
        id=subscription_id,
        user=request.user,
        is_active=True,
        plan__is_active=True,
    )

    # 밀린 스케줄 조회
    overdue_schedules = get_overdue_schedules(subscription)
    overdue_list = list(overdue_schedules)

    # 밀린 장 수 계산
    overdue_chapters = sum(
        s.end_chapter - s.start_chapter + 1 for s in overdue_list
    )

    # 밀린 기간
    overdue_range = None
    if overdue_list:
        overdue_range = {
            'start': overdue_list[0].date,
            'end': overdue_list[-1].date
        }

    # 활성 따라잡기 세션
    active_session = subscription.catchup_sessions.filter(status='active').first()

    # 추천 설정
    suggested_settings = calculate_suggested_settings(
        len(overdue_list), overdue_chapters
    )

    data = {
        'has_overdue': len(overdue_list) > 0,
        'overdue_count': len(overdue_list),
        'overdue_chapters': overdue_chapters,
        'overdue_range': overdue_range,
        'overdue_schedules': overdue_list,
        'active_catchup_session': active_session,
        'suggested_settings': suggested_settings
    }

    serializer = CatchupStatusSerializer(data)
    return Response(serializer.data)


@extend_schema(responses={200: openapi.CatchupPreviewResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_preview(request, subscription_id):
    """
    따라잡기 미리보기
    POST /api/v1/todos/subscriptions/{subscription_id}/catchup/preview/
    """
    subscription = get_object_or_404(
        PlanSubscription,
        id=subscription_id,
        user=request.user,
        is_active=True,
        plan__is_active=True,
    )

    serializer = CatchupPreviewRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # 범위 결정
    today = timezone.now().date()
    overdue_schedules = get_overdue_schedules(subscription)

    if not overdue_schedules.exists():
        return Response({
            'valid': False,
            'summary': {},
            'preview_schedules': [],
            'warnings': ['밀린 스케줄이 없습니다.']
        })

    range_start = data.get('range_start') or overdue_schedules.first().date
    range_end = data.get('range_end') or overdue_schedules.last().date

    # 범위 내 밀린 스케줄
    target_schedules = get_overdue_schedules_in_range(subscription, range_start, range_end)
    target_list = list(target_schedules)

    if not target_list:
        return Response({
            'valid': False,
            'summary': {},
            'preview_schedules': [],
            'warnings': ['선택한 기간에 밀린 스케줄이 없습니다.']
        })

    # 스케줄 분배
    target_date = data.get('target_rejoin_date')
    distributed, remaining = calculate_catchup_schedule(
        target_list,
        start_date=today,
        target_date=target_date,
        max_daily_readings=data.get('max_daily_readings'),
        max_daily_chapters=data.get('max_daily_chapters'),
        weekend_multiplier=float(data.get('weekend_multiplier', 1.0))
    )

    # 경고 메시지
    warnings = []
    if remaining:
        warnings.append(_catchup_overflow_message(len(remaining)))

    # 요약 계산
    total_schedules = len(target_list)
    total_chapters = sum(s.end_chapter - s.start_chapter + 1 for s in target_list)
    estimated_days = len(distributed)
    daily_avg_readings = total_schedules / estimated_days if estimated_days > 0 else 0
    daily_avg_chapters = total_chapters / estimated_days if estimated_days > 0 else 0
    rejoin_date = distributed[-1]['date'] if distributed else None

    # 미리보기 데이터 포맷팅
    preview_schedules = []
    for day_data in distributed:
        items = []
        for schedule in day_data['items']:
            items.append({
                'original_date': schedule.date,
                'book': schedule.book,
                'start_chapter': schedule.start_chapter,
                'end_chapter': schedule.end_chapter
            })
        preview_schedules.append({
            'date': day_data['date'],
            'is_weekend': day_data['is_weekend'],
            'items': items,
            'total_chapters': day_data['total_chapters']
        })

    return Response({
        'valid': len(remaining) == 0,
        'summary': {
            'total_schedules': total_schedules,
            'total_chapters': total_chapters,
            'daily_average_readings': round(daily_avg_readings, 1),
            'daily_average_chapters': round(daily_avg_chapters, 1),
            'estimated_days': estimated_days,
            'rejoin_date': rejoin_date.isoformat() if rejoin_date else None
        },
        'preview_schedules': preview_schedules,
        'warnings': warnings
    })


@extend_schema(responses={201: openapi.CatchupSessionResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_create(request, subscription_id):
    """
    따라잡기 세션 생성
    POST /api/v1/todos/subscriptions/{subscription_id}/catchup/
    """
    subscription = get_object_or_404(
        PlanSubscription,
        id=subscription_id,
        user=request.user,
        is_active=True,
        plan__is_active=True,
    )

    if subscription.catchup_sessions.filter(status='active').exists():
        return _active_catchup_error_response()

    serializer = CatchupSessionCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # 범위 내 밀린 스케줄 확인
    target_schedules = get_overdue_schedules_in_range(
        subscription,
        data['range_start'],
        data['range_end']
    )
    target_list = list(target_schedules)

    if not target_list:
        return Response(
            {'error': '선택한 기간에 밀린 스케줄이 없습니다.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 스케줄 분배
    today = timezone.now().date()
    distributed, remaining = calculate_catchup_schedule(
        target_list,
        start_date=today,
        target_date=data.get('target_rejoin_date'),
        max_daily_readings=data.get('max_daily_readings'),
        max_daily_chapters=data.get('max_daily_chapters'),
        weekend_multiplier=float(data.get('weekend_multiplier', 1.0))
    )

    if remaining:
        return Response(
            {'error': _catchup_overflow_message(len(remaining))},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        with transaction.atomic():
            locked_subscription = PlanSubscription.objects.select_for_update().get(
                id=subscription.id,
                user=request.user,
                is_active=True,
                plan__is_active=True,
            )
            if locked_subscription.catchup_sessions.filter(status='active').exists():
                return _active_catchup_error_response()

            session = CatchupSession.objects.create(
                subscription=locked_subscription,
                **data
            )

            catchup_schedules = [
                CatchupSchedule(
                    session=session,
                    original_schedule=original_schedule,
                    scheduled_date=day_data['date'],
                )
                for day_data in distributed
                for original_schedule in day_data['items']
            ]
            if catchup_schedules:
                CatchupSchedule.objects.bulk_create(catchup_schedules)

            # 이미 완료된 진도 복사
            copy_completed_progress(locked_subscription, session)
    except IntegrityError as exc:
        if _is_active_catchup_identity_conflict(exc):
            return _active_catchup_error_response()
        raise

    return Response(
        CatchupSessionSerializer(session).data,
        status=status.HTTP_201_CREATED
    )


@extend_schema(responses={200: openapi.CatchupSessionResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catchup_session_detail(request, session_id):
    """
    따라잡기 세션 상세 조회
    GET /api/v1/todos/catchup-sessions/{session_id}/
    """
    session = get_object_or_404(
        _visible_catchup_session_queryset(),
        id=session_id,
        subscription__user=request.user
    )
    return Response(CatchupSessionSerializer(session).data)


@extend_schema(responses={200: openapi.CatchupSessionResponseSerializer})
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def catchup_session_update(request, session_id):
    """
    따라잡기 세션 수정
    PATCH /api/v1/todos/catchup-sessions/{session_id}/
    """
    session = get_object_or_404(
        _operable_catchup_session_queryset(),
        id=session_id,
        subscription__user=request.user
    )

    serializer = CatchupSessionUpdateSerializer(
        session,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    should_recalculate = _parse_recalculate_flag(request.data)

    try:
        with transaction.atomic():
            session = serializer.save()
            if should_recalculate:
                _redistribute_catchup_schedules(session)
    except CatchupRedistributionOverflow as exc:
        return Response(
            {'error': _catchup_overflow_message(exc.remaining_count)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(CatchupSessionSerializer(session).data)


@extend_schema(
    parameters=[
        OpenApiParameter(
            'date',
            OpenApiTypes.DATE,
            required=False,
            description='Return schedules assigned to this date (YYYY-MM-DD). An empty value is invalid.',
        ),
    ],
    responses={200: openapi.CatchupSessionSchedulesResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catchup_session_schedules(request, session_id):
    """
    따라잡기 세션의 스케줄 목록 조회
    GET /api/v1/todos/catchup-sessions/{session_id}/schedules/
    """
    session = get_object_or_404(
        _visible_catchup_session_queryset(),
        id=session_id,
        subscription__user=request.user
    )

    query_serializer = CatchupSessionSchedulesQuerySerializer(data=request.query_params)
    query_serializer.is_valid(raise_exception=True)
    date_filter = query_serializer.validated_data.get('date')

    schedules = session.schedules.all()
    if date_filter is not None:
        schedules = schedules.filter(scheduled_date=date_filter)

    # 날짜별 그룹핑
    grouped = defaultdict(list)
    for schedule in schedules:
        grouped[schedule.scheduled_date].append(schedule)

    result = []
    for date, items in sorted(grouped.items()):
        is_weekend = date.weekday() >= 5
        result.append({
            'date': date,
            'is_weekend': is_weekend,
            'items': CatchupScheduleSerializer(items, many=True).data
        })

    return Response({
        'session': CatchupSessionSerializer(session).data,
        'schedules': result
    })


@extend_schema(responses={200: openapi.CatchupScheduleToggleResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_schedule_toggle(request, schedule_id):
    """
    따라잡기 스케줄 완료 토글
    POST /api/v1/todos/catchup-schedules/{schedule_id}/toggle/
    """
    with transaction.atomic():
        schedule = get_object_or_404(
            CatchupSchedule.objects.select_for_update().select_related(
                'session__subscription',
                'original_schedule',
            ),
            id=schedule_id,
            session__subscription__user=request.user,
            session__status='active',
            session__subscription__is_active=True,
            session__subscription__plan__is_active=True,
        )

        if schedule.is_completed:
            schedule.mark_as_incomplete()
            transitioned_to_completed = sync_original_progress(
                schedule.session.subscription,
                schedule.original_schedule,
                False,
                None,
            )
        else:
            schedule.mark_as_completed()
            transitioned_to_completed = sync_original_progress(
                schedule.session.subscription,
                schedule.original_schedule,
                True,
                schedule.completed_at,
            )

        if transitioned_to_completed:
            on_commit_notify_reading_completed(request.user, [schedule.original_schedule])

        session = schedule.session

    return Response({
        'id': schedule.id,
        'is_completed': schedule.is_completed,
        'completed_at': schedule.completed_at,
        'session_progress': {
            'percentage': session.progress_percentage,
            'completed': session.completed_count,
            'total': session.total_count
        }
    })


@extend_schema(responses={200: openapi.CatchupCompleteResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_session_complete(request, session_id):
    """
    따라잡기 세션 완료
    POST /api/v1/todos/catchup-sessions/{session_id}/complete/
    """
    with transaction.atomic():
        session = get_object_or_404(
            _operable_catchup_session_queryset().select_for_update(),
            id=session_id,
            subscription__user=request.user
        )

        # 미완료 스케줄 확인
        remaining = session.remaining_count
        warning = None
        if remaining > 0:
            warning = f'{remaining}개 미완료 스케줄이 있습니다.'

        # 세션 완료 처리
        session.status = 'completed'
        session.completed_at = timezone.now()
        session.save(update_fields=['status', 'completed_at', 'updated_at'])

        # 축하 데이터
        celebration = get_celebration_data(session)

    return Response({
        'success': True,
        'message': f"축하합니다! '{session.name}'을 완료했습니다!",
        'celebration': celebration,
        'warning': warning
    })


@extend_schema(responses={200: openapi.TodoSuccessMessageResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_session_abandon(request, session_id):
    """
    따라잡기 세션 포기
    POST /api/v1/todos/catchup-sessions/{session_id}/abandon/
    """
    with transaction.atomic():
        session = get_object_or_404(
            _operable_catchup_session_queryset().select_for_update(),
            id=session_id,
            subscription__user=request.user
        )

        session.status = 'abandoned'
        session.save(update_fields=['status', 'updated_at'])

    return Response({'success': True, 'message': '따라잡기가 종료되었습니다.'})


@extend_schema(responses={200: openapi.CatchupSessionResponseSerializer(many=True)})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_active_catchup_sessions(request):
    """
    내 활성 따라잡기 세션 목록
    GET /api/v1/todos/catchup-sessions/active/
    """
    sessions = CatchupSession.objects.filter(
        subscription__user=request.user,
        status='active',
        subscription__is_active=True,
        subscription__plan__is_active=True,
    )
    return Response(CatchupSessionSerializer(sessions, many=True).data)

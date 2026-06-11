"""
Catchup 기능 관련 뷰
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from collections import defaultdict

from .models import PlanSubscription, CatchupSession, CatchupSchedule
from .serializers import (
    CatchupStatusSerializer, CatchupPreviewRequestSerializer,
    CatchupSessionSerializer, CatchupSessionCreateSerializer,
    CatchupScheduleSerializer, CatchupCompleteResponseSerializer,
    OverdueScheduleSerializer
)
from .services import (
    get_overdue_schedules, get_overdue_schedules_in_range,
    calculate_catchup_schedule, calculate_suggested_settings,
    copy_completed_progress, get_celebration_data
)


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
        is_active=True
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
        is_active=True
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
        warnings.append(f'목표일까지 {len(remaining)}개 스케줄을 완료할 수 없습니다. 목표일을 늦추거나 읽기량을 늘려주세요.')

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
        is_active=True
    )

    # 이미 활성 세션이 있는지 확인
    if subscription.catchup_sessions.filter(status='active').exists():
        return Response(
            {'error': '이미 진행 중인 따라잡기가 있습니다. 기존 따라잡기를 완료하거나 포기 후 다시 시도해주세요.'},
            status=status.HTTP_400_BAD_REQUEST
        )

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

    # 세션·스케줄 생성과 진도 복사를 한 트랜잭션으로 묶어 고아 세션을 방지
    with transaction.atomic():
        session = CatchupSession.objects.create(
            subscription=subscription,
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
        copy_completed_progress(subscription, session)

    return Response(
        CatchupSessionSerializer(session).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catchup_session_detail(request, session_id):
    """
    따라잡기 세션 상세 조회
    GET /api/v1/todos/catchup-sessions/{session_id}/
    """
    session = get_object_or_404(
        CatchupSession,
        id=session_id,
        subscription__user=request.user
    )
    return Response(CatchupSessionSerializer(session).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def catchup_session_update(request, session_id):
    """
    따라잡기 세션 수정
    PATCH /api/v1/todos/catchup-sessions/{session_id}/
    """
    session = get_object_or_404(
        CatchupSession,
        id=session_id,
        subscription__user=request.user,
        status='active'
    )

    # 수정 가능한 필드만 업데이트
    allowed_fields = ['name', 'max_daily_readings', 'max_daily_chapters',
                      'weekend_multiplier', 'target_rejoin_date']

    for field in allowed_fields:
        if field in request.data:
            setattr(session, field, request.data[field])

    session.save()

    # 재계산 요청 시
    if request.data.get('recalculate'):
        # 미완료 스케줄 삭제 후 재분배
        session.schedules.filter(is_completed=False).delete()

        # 남은 원본 스케줄 다시 분배
        remaining_originals = get_overdue_schedules_in_range(
            session.subscription,
            session.range_start,
            session.range_end
        ).exclude(
            id__in=session.schedules.values_list('original_schedule_id', flat=True)
        )

        today = timezone.now().date()
        distributed, _ = calculate_catchup_schedule(
            list(remaining_originals),
            start_date=today,
            target_date=session.target_rejoin_date,
            max_daily_readings=session.max_daily_readings,
            max_daily_chapters=session.max_daily_chapters,
            weekend_multiplier=float(session.weekend_multiplier)
        )

        for day_data in distributed:
            for original_schedule in day_data['items']:
                CatchupSchedule.objects.create(
                    session=session,
                    original_schedule=original_schedule,
                    scheduled_date=day_data['date']
                )

    return Response(CatchupSessionSerializer(session).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catchup_session_schedules(request, session_id):
    """
    따라잡기 세션의 스케줄 목록 조회
    GET /api/v1/todos/catchup-sessions/{session_id}/schedules/
    """
    session = get_object_or_404(
        CatchupSession,
        id=session_id,
        subscription__user=request.user
    )

    schedules = session.schedules.all()

    # 날짜 필터
    date_filter = request.query_params.get('date')
    if date_filter:
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_schedule_toggle(request, schedule_id):
    """
    따라잡기 스케줄 완료 토글
    POST /api/v1/todos/catchup-schedules/{schedule_id}/toggle/
    """
    schedule = get_object_or_404(
        CatchupSchedule,
        id=schedule_id,
        session__subscription__user=request.user
    )

    if schedule.is_completed:
        schedule.mark_as_incomplete()
    else:
        schedule.mark_as_completed()

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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_session_complete(request, session_id):
    """
    따라잡기 세션 완료
    POST /api/v1/todos/catchup-sessions/{session_id}/complete/
    """
    session = get_object_or_404(
        CatchupSession,
        id=session_id,
        subscription__user=request.user,
        status='active'
    )

    # 미완료 스케줄 확인
    remaining = session.remaining_count
    warning = None
    if remaining > 0:
        warning = f'{remaining}개 미완료 스케줄이 있습니다.'

    # 세션 완료 처리
    session.status = 'completed'
    session.completed_at = timezone.now()
    session.save()

    # 축하 데이터
    celebration = get_celebration_data(session)

    return Response({
        'success': True,
        'message': f"축하합니다! '{session.name}'을 완료했습니다!",
        'celebration': celebration,
        'warning': warning
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def catchup_session_abandon(request, session_id):
    """
    따라잡기 세션 포기
    POST /api/v1/todos/catchup-sessions/{session_id}/abandon/
    """
    session = get_object_or_404(
        CatchupSession,
        id=session_id,
        subscription__user=request.user,
        status='active'
    )

    session.status = 'abandoned'
    session.save()

    return Response({'success': True, 'message': '따라잡기가 종료되었습니다.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_active_catchup_sessions(request):
    """
    내 활성 따라잡기 세션 목록
    GET /api/v1/todos/catchup-sessions/active/
    """
    sessions = CatchupSession.objects.filter(
        subscription__user=request.user,
        status='active'
    )
    return Response(CatchupSessionSerializer(sessions, many=True).data)

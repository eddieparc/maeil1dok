"""
Catchup 기능 관련 서비스 로직
"""
from datetime import date, timedelta
from typing import List, Tuple, Optional
from django.utils import timezone
from django.db.models import QuerySet

from ..models import (
    PlanSubscription, DailyBibleSchedule, UserBibleProgress,
    CatchupSession, CatchupSchedule
)


def get_overdue_schedules(subscription: PlanSubscription) -> QuerySet[DailyBibleSchedule]:
    """
    구독의 시작일부터 오늘까지 중 미완료된 스케줄 조회
    """
    today = timezone.now().date()

    # 해당 구독에서 이미 완료한 스케줄 ID 목록
    completed_schedule_ids = UserBibleProgress.objects.filter(
        subscription=subscription,
        is_completed=True
    ).values_list('schedule_id', flat=True)

    # 시작일부터 어제까지의 스케줄 중 미완료된 것
    return DailyBibleSchedule.objects.filter(
        plan=subscription.plan,
        date__gte=subscription.start_date,
        date__lt=today
    ).exclude(id__in=completed_schedule_ids).order_by('date')


def get_overdue_schedules_in_range(
    subscription: PlanSubscription,
    range_start: date,
    range_end: date
) -> QuerySet[DailyBibleSchedule]:
    """
    특정 기간 내의 미완료된 스케줄 조회
    """
    # 해당 구독에서 이미 완료한 스케줄 ID 목록
    completed_schedule_ids = UserBibleProgress.objects.filter(
        subscription=subscription,
        is_completed=True
    ).values_list('schedule_id', flat=True)

    return DailyBibleSchedule.objects.filter(
        plan=subscription.plan,
        date__gte=range_start,
        date__lte=range_end
    ).exclude(id__in=completed_schedule_ids).order_by('date')


def calculate_catchup_schedule(
    overdue_schedules: List[DailyBibleSchedule],
    start_date: date,
    target_date: Optional[date] = None,
    max_daily_readings: Optional[int] = None,
    max_daily_chapters: Optional[int] = None,
    weekend_multiplier: float = 1.0
) -> Tuple[List[dict], List[DailyBibleSchedule]]:
    """
    밀린 스케줄을 새 날짜에 분배

    Args:
        overdue_schedules: 밀린 스케줄 목록
        start_date: 따라잡기 시작일
        target_date: 목표 복귀일 (없으면 제한 없이 분배)
        max_daily_readings: 하루 최대 읽기 횟수
        max_daily_chapters: 하루 최대 장 수
        weekend_multiplier: 주말 배수

    Returns:
        (분배된 스케줄 목록, 남은 스케줄 목록)
    """
    result = []
    remaining = list(overdue_schedules)
    current_date = start_date

    # 목표일이 없으면 1년 후로 설정 (사실상 무제한)
    end_date = target_date or (start_date + timedelta(days=365))

    while remaining and current_date <= end_date:
        # 주말 여부 확인 (토요일=5, 일요일=6)
        is_weekend = current_date.weekday() >= 5

        # 오늘의 읽기량 제한
        daily_limit = max_daily_readings
        if is_weekend and daily_limit and weekend_multiplier:
            # 주말 배수가 적용돼도 하루 한도는 최소 1로 유지한다.
            # (floor가 0이 되면 '한도 없음'으로 오인돼 주말 하루에 밀린 분량이
            #  전부 쏟아지는 버그가 있었다)
            daily_limit = max(1, int(daily_limit * weekend_multiplier))

        today_items = []
        today_chapters = 0

        while remaining:
            schedule = remaining[0]
            chapters = schedule.end_chapter - schedule.start_chapter + 1

            # 횟수 제한 확인
            if daily_limit and len(today_items) >= daily_limit:
                break

            # 장 수 제한 확인
            if max_daily_chapters:
                chapter_limit = max_daily_chapters
                if is_weekend and weekend_multiplier:
                    chapter_limit = max(1, int(chapter_limit * weekend_multiplier))
                # 하루에 최소 한 개는 배치해 진도가 반드시 전진하도록 한다.
                # (단일 스케줄의 장 수가 하루 장 수 한도보다 크면 영원히 배치되지
                #  못하고 remaining으로 조용히 사라지던 버그를 방지)
                if today_items and today_chapters + chapters > chapter_limit:
                    break

            today_items.append(schedule)
            today_chapters += chapters
            remaining.pop(0)

        if today_items:
            result.append({
                'date': current_date,
                'is_weekend': is_weekend,
                'items': today_items,
                'total_chapters': today_chapters
            })

        current_date += timedelta(days=1)

    return result, remaining


def calculate_suggested_settings(overdue_count: int, overdue_chapters: int) -> dict:
    """
    밀린 분량에 따른 추천 설정 계산
    """
    today = timezone.now().date()

    # 기본 추천: 하루 3회
    default_daily_readings = 3

    # 예상 소요일 계산
    estimated_days = (overdue_count + default_daily_readings - 1) // default_daily_readings

    # 예상 복귀일
    estimated_rejoin_date = today + timedelta(days=estimated_days)

    return {
        'max_daily_readings': default_daily_readings,
        'estimated_days': estimated_days,
        'estimated_rejoin_date': estimated_rejoin_date.isoformat()
    }


def copy_completed_progress(subscription: PlanSubscription, session: CatchupSession):
    """
    원본 구독에서 이미 완료한 진도를
    따라잡기 세션의 스케줄에도 완료로 표시
    """
    completed_schedule_ids = UserBibleProgress.objects.filter(
        subscription=subscription,
        is_completed=True
    ).values_list('schedule_id', flat=True)

    CatchupSchedule.objects.filter(
        session=session,
        original_schedule_id__in=completed_schedule_ids
    ).update(is_completed=True, completed_at=timezone.now())


def sync_original_progress(subscription, original_schedule, is_completed, completed_at):
    """
    Keep the canonical UserBibleProgress row aligned with a catchup toggle.

    Returns True only when the canonical progress row transitions from incomplete
    to completed, so callers can avoid duplicate completion notifications.
    """
    progress, created = UserBibleProgress.objects.get_or_create(
        subscription=subscription,
        schedule=original_schedule,
        defaults={
            'is_completed': is_completed,
            'completed_at': completed_at if is_completed else None,
        }
    )

    if created:
        return is_completed

    transitioned_to_completed = is_completed and not progress.is_completed
    update_fields = []

    if progress.is_completed != is_completed:
        progress.is_completed = is_completed
        update_fields.append('is_completed')

    if is_completed:
        if progress.completed_at is None:
            progress.completed_at = completed_at
            update_fields.append('completed_at')
    elif progress.completed_at is not None:
        progress.completed_at = None
        update_fields.append('completed_at')

    if update_fields:
        progress.save(update_fields=update_fields + ['updated_at'])

    return transitioned_to_completed


def sync_catchup_schedules(subscription, schedules, is_completed, completed_at):
    """
    Propagate a main-flow reading toggle to the CatchupSchedule rows of the
    subscription's *active* catchup sessions (original -> catchup direction).

    Keeps the denormalized CatchupSchedule.is_completed/completed_at in sync with
    the canonical UserBibleProgress so catchup detail/status endpoints cannot
    diverge from the main reading flow. Only rows in active sessions are touched;
    completed/abandoned sessions and other users' sessions stay frozen. Never
    mutates CatchupSession.status (session completion stays user-explicit).
    """
    base = CatchupSchedule.objects.filter(
        session__subscription=subscription,
        session__status='active',
        original_schedule__in=schedules,
    )

    if is_completed:
        # Preserve the first-completion timestamp on already-completed rows,
        # mirroring the main-flow semantics in update_bible_progress.
        base.filter(is_completed=False).update(
            is_completed=True,
            completed_at=completed_at,
        )
    else:
        base.filter(is_completed=True).update(
            is_completed=False,
            completed_at=None,
        )


def get_celebration_data(session: CatchupSession) -> dict:
    """
    완료 축하 데이터 생성
    """
    total = session.schedules.count()
    completed = session.schedules.filter(is_completed=True).count()

    if session.completed_at and session.created_at:
        days_taken = (session.completed_at.date() - session.created_at.date()).days + 1
    else:
        days_taken = 0

    # 총 장 수 계산
    total_chapters = sum(
        s.original_schedule.end_chapter - s.original_schedule.start_chapter + 1
        for s in session.schedules.all()
    )

    return {
        'title': '대단해요!',
        'subtitle': f'{total}일치 읽기를 {days_taken}일 만에 완료했어요!',
        'stats': {
            'total_completed': completed,
            'total_chapters': total_chapters,
            'days_taken': days_taken,
            'started_at': session.created_at.date().isoformat() if session.created_at else None,
            'completed_at': session.completed_at.date().isoformat() if session.completed_at else None
        }
    }

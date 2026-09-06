from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
import numbers
import pandas as pd
from calendar import monthrange
from datetime import date, datetime
from django.conf import settings
import hmac
import time
from .models import DailyBibleSchedule, UserBibleProgress, BibleReadingPlan, PlanSubscription, VideoBibleIntro, HasenaRecord, HasenaEntry, UserVideoIntroProgress, PersonalReadingRecord
from . import serializers as todo_serializers
from . import openapi_serializers as openapi
from .serializers import DailyBibleScheduleSerializer, BibleReadingPlanSerializer, PlanSubscriptionSerializer, PlanSubscriptionUpdateSerializer, VideoBibleIntroSerializer, HasenaRecordCreateSerializer, HasenaRecordListQuerySerializer
import logging
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from django.contrib.auth import get_user_model
from rest_framework import mixins, viewsets, permissions, status
from rest_framework.decorators import action
from django.db import IntegrityError, OperationalError, transaction
from django.db.models import Q, Count
from django.utils.dateparse import parse_date
import re
from io import BytesIO
from django.utils.timezone import localtime
from accounts.services.achievement_service import AchievementService
from authz import can, subject_from_request
from authz.policies.bible_bookmark import (
    BibleBookmarkChapterQuery,
    BibleBookmarkCollection,
    BibleBookmarkCreation,
    BibleBookmarkResource,
)
from authz.policies.bible_highlight import (
    BibleHighlightChapterQuery,
    BibleHighlightCollection,
    BibleHighlightCreation,
    BibleHighlightResource,
)
from authz.policies.bible_note import (
    ReflectionNoteChapterQuery,
    ReflectionNoteCollection,
    ReflectionNoteCreation,
    ReflectionNoteResource,
)
from authz.policies.bible_personal_record import (
    PersonalReadingRecordBookQuery,
    PersonalReadingRecordCollection,
    PersonalReadingRecordCreation,
)
from authz.policies.bible_reading_position import ReadingPositionCurrent
from authz.policies.plan_subscription import (
    PlanSubscriptionCollection,
    PlanSubscriptionCreation,
    PlanSubscriptionResource,
)
from authz.policies.reading_progress import (
    CertificationProgress,
    ReadingProgressUpdate,
)
from .services.notifications import (
    on_commit_notify_hasena_completed,
    on_commit_notify_reading_completed,
)

from .services.catchup import sync_catchup_schedules
from .services.chapter_audio_service import build_fallback_audio_links

logger = logging.getLogger(__name__)
User = get_user_model()
SUBSCRIPTION_CREATE_RETRY_DELAYS = (0, 0.02, 0.05, 0.1)
HASENA_RECORD_UPSERT_RETRY_DELAYS = (0, 0.02, 0.05, 0.1)
PERSONAL_READING_RECORD_UPSERT_RETRY_DELAYS = (0, 0.02, 0.05, 0.1)


def _authz_denial_response(decision):
    denial = decision.denial
    if denial.body is None:
        return Response(status=denial.status_code)
    return Response(denial.body, status=denial.status_code)


def _authz_object_id(pk):
    try:
        return int(pk)
    except (TypeError, ValueError):
        return 0


def _get_cron_request_secret(request):
    authorization = request.headers.get('Authorization', '')
    bearer_secret = authorization.removeprefix('Bearer ').strip()
    return request.headers.get('X-Cron-Secret') or bearer_secret


def _cron_secret_error(request):
    cron_secret = getattr(settings, 'CRON_SECRET', None)
    if not cron_secret:
        return Response({
            'success': False,
            'error': 'CRON_SECRET이 설정되어 있지 않습니다.'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    request_secret = _get_cron_request_secret(request)
    if not hmac.compare_digest(str(request_secret), str(cron_secret)):
        return Response({
            'success': False,
            'error': 'Unauthorized'
        }, status=status.HTTP_401_UNAUTHORIZED)

    return None


def _is_database_lock_error(exc):
    return 'locked' in str(exc).lower()


def _get_existing_subscription(user, plan):
    return PlanSubscription.objects.filter(user=user, plan=plan).first()


def _get_subscription_plan(plan_id):
    for delay in SUBSCRIPTION_CREATE_RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        try:
            return BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return None
        except OperationalError as exc:
            if not _is_database_lock_error(exc):
                raise

    raise OperationalError("Could not load subscription plan because the database stayed locked.")


def _get_or_create_plan_subscription(user, plan):
    for delay in SUBSCRIPTION_CREATE_RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        try:
            with transaction.atomic():
                return PlanSubscription.objects.get_or_create(
                    user=user,
                    plan=plan,
                    defaults={'start_date': timezone.now().date()}
                )
        except IntegrityError:
            existing = _get_existing_subscription(user, plan)
            if existing:
                return existing, False
            raise
        except OperationalError as exc:
            if not _is_database_lock_error(exc):
                raise

    existing = _get_existing_subscription(user, plan)
    if existing:
        return existing, False
    raise OperationalError("Could not create subscription because the database stayed locked.")


def _delete_plan_subscription_with_artifacts(subscription):
    plan = subscription.plan
    user = subscription.user
    # Bulk deletes do not fire progress post_save signals; recompute stats explicitly.
    UserBibleProgress.objects.filter(subscription=subscription).delete()
    UserVideoIntroProgress.objects.filter(
        user=user,
        video_intro__plan=plan,
    ).delete()
    subscription.delete()
    AchievementService.update_user_stats(user)


def _upsert_hasena_record(user, target_date, is_completed):
    """Race-safe upsert for HasenaRecord.

    Uses UPDATE-first then CREATE-on-miss to avoid the SELECT-FOR-UPDATE gap
    locks that make `update_or_create` deadlock-prone on InnoDB under
    concurrent writes to the same (user, date) key. Retries on lock/deadlock
    OperationalError and on IntegrityError races the same way
    `_get_or_create_plan_subscription` does.
    """
    for delay in HASENA_RECORD_UPSERT_RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        try:
            with transaction.atomic():
                updated = HasenaRecord.objects.filter(
                    user=user, date=target_date
                ).update(
                    is_completed=is_completed,
                    updated_at=timezone.now(),
                )
                if updated:
                    record = HasenaRecord.objects.get(user=user, date=target_date)
                    if record.is_completed:
                        AchievementService.check_and_grant_achievements(user)
                    return record, False
                record = HasenaRecord.objects.create(
                    user=user, date=target_date, is_completed=is_completed
                )
                return record, True
        except IntegrityError:
            continue
        except OperationalError as exc:
            if not _is_database_lock_error(exc):
                raise
            continue

    existing = HasenaRecord.objects.filter(user=user, date=target_date).first()
    if existing:
        return existing, False
    raise OperationalError(
        "Could not upsert Hasena record because the database stayed locked."
    )


def _upsert_personal_reading_record(user, book, chapter, read_date):
    """Race-safe upsert for PersonalReadingRecord.

    The uniqueness key is ``(user, book, chapter)``. The observable API
    semantics on repeat POST are:

      * First insert → return (record, True) — HTTP 201 upstream.
      * Repeat/duplicate → refresh ``read_date`` in place, return
        (record, False) — HTTP 200 upstream.

    Under concurrency the naive check-then-create pattern raises
    ``IntegrityError`` for the loser thread and surfaces as HTTP 500. This
    helper mirrors ``_upsert_hasena_record``: UPDATE-first (bounded lock
    footprint, no gap locks) then CREATE-on-miss, wrapped in an atomic
    block and retried on lock/deadlock ``OperationalError`` and on
    ``IntegrityError`` races. On exhaustion of the retry budget it falls
    through to a final read; only if no row exists does it raise, which
    reflects a genuinely unavailable database.
    """
    for delay in PERSONAL_READING_RECORD_UPSERT_RETRY_DELAYS:
        if delay:
            time.sleep(delay)
        try:
            with transaction.atomic():
                updated = PersonalReadingRecord.objects.filter(
                    user=user, book=book, chapter=chapter
                ).update(read_date=read_date)
                if updated:
                    record = PersonalReadingRecord.objects.get(
                        user=user, book=book, chapter=chapter
                    )
                    return record, False
                record = PersonalReadingRecord.objects.create(
                    user=user, book=book, chapter=chapter, read_date=read_date
                )
                return record, True
        except IntegrityError:
            continue
        except OperationalError as exc:
            if not _is_database_lock_error(exc):
                raise
            continue

    existing = PersonalReadingRecord.objects.filter(
        user=user, book=book, chapter=chapter
    ).first()
    if existing:
        return existing, False
    raise OperationalError(
        "Could not upsert PersonalReadingRecord because the database stayed locked."
    )


def _validate_positive_int(value, name, default, min_value=1, max_value=None):
    """
    Validate and bound-check a positive integer parameter.
    
    Args:
        value: The value to validate (can be None, string, or int)
        name: Parameter name for error messages
        default: Default value if None
        min_value: Minimum allowed value (default: 1)
        max_value: Maximum allowed value (default: None for no limit)
    
    Returns:
        Validated integer value
    
    Raises:
        ValueError: If value is invalid or out of bounds
    """
    if value is None:
        return default
    
    try:
        int_value = int(value)
    except (ValueError, TypeError):
        raise ValueError(f'{name}은(는) 정수여야 합니다.')
    
    if int_value < min_value:
        raise ValueError(f'{name}은(는) {min_value} 이상이어야 합니다.')
    
    if max_value is not None and int_value > max_value:
        raise ValueError(f'{name}은(는) {max_value} 이하여야 합니다.')
    
    return int_value


# 최상단에 book_to_code 딕셔너리 정의
book_to_code = {
    '창세기': 'gen', '출애굽기': 'exo', '레위기': 'lev',
    '민수기': 'num', '신명기': 'deu', '여호수아': 'jos',
    '사사기': 'jdg', '룻기': 'rut', '사무엘상': '1sa',
    '사무엘하': '2sa', '열왕기상': '1ki', '열왕기하': '2ki',
    '역대상': '1ch', '역대하': '2ch', '에스라': 'ezr',
    '느헤미야': 'neh', '에스더': 'est', '욥기': 'job',
    '시편': 'psa', '잠언': 'pro', '전도서': 'ecc',
    '아가': 'sng', '이사야': 'isa', '예레미야': 'jer',
    '예레미야애가': 'lam', '에스겔': 'ezk', '다니엘': 'dan',
    '호세아': 'hos', '요엘': 'jol', '아모스': 'amo',
    '오바댜': 'oba', '요나': 'jnh', '미가': 'mic',
    '나훔': 'nam', '하박국': 'hab', '스바냐': 'zep',
    '학개': 'hag', '스가랴': 'zec', '말라기': 'mal',
    '마태복음': 'mat', '마가복음': 'mrk', '누가복음': 'luk',
    '요한복음': 'jhn', '사도행전': 'act', '로마서': 'rom',
    '고린도전서': '1co', '고린도후서': '2co', '갈라디아서': 'gal',
    '에베소서': 'eph', '빌립보서': 'php', '골로새서': 'col',
    '데살로니가전서': '1th', '데살로니가후서': '2th',
    '디모데전서': '1ti', '디모데후서': '2ti', '디도서': 'tit',
    '빌레몬서': 'phm', '히브리서': 'heb', '야고보서': 'jas',
    '베드로전서': '1pe', '베드로후서': '2pe', '요한일서': '1jn',
    '요한이서': '2jn', '요한삼서': '3jn', '유다서': 'jud',
    '요한계시록': 'rev'
}

# 성경별 총 장 수를 반환하는 함수 필요
def get_last_chapter(book_name):
    book_chapters = {
        '창세기': 50, '출애굽기': 40, '레위기': 27,
        '민수기': 36, '신명기': 34, '여호수아': 24,
        '사사기': 21, '룻기': 4, '사무엘상': 31,
        '사무엘하': 24, '열왕기상': 22, '열왕기하': 25,
        '역대상': 29, '역대하': 36, '에스라': 10,
        '느헤미야': 13, '에스더': 10, '욥기': 42,
        '시편': 150, '잠언': 31, '전도서': 12,
        '아가': 8, '이사야': 66, '예레미야': 52,
        '예레미야애가': 5, '에스겔': 48, '다니엘': 12,
        '호세아': 14, '요엘': 3, '아모스': 9,
        '오바댜': 1, '요나': 4, '미가': 7,
        '나훔': 3, '하박국': 3, '스바냐': 3,
        '학개': 2, '스가랴': 14, '말라기': 4,
        '마태복음': 28, '마가복음': 16, '누가복음': 24,
        '요한복음': 21, '사도행전': 28, '로마서': 16,
        '고린도전서': 16, '고린도후서': 13, '갈라디아서': 6,
        '에베소서': 6, '빌립보서': 4, '골로새서': 4,
        '데살로니가전서': 5, '데살로니가후서': 3,
        '디모데전서': 6, '디모데후서': 4, '디도서': 3,
        '빌레몬서': 1, '히브리서': 13, '야고보서': 5,
        '베드로전서': 5, '베드로후서': 3, '요한일서': 5,
        '요한이서': 1, '요한삼서': 1, '유다서': 1,
        '요한계시록': 22
    }
    result = book_chapters.get(book_name, 1)  # 기본값 1
    return result


def _progress_error(message, response_status=status.HTTP_400_BAD_REQUEST):
    return Response({'success': False, 'error': message}, status=response_status)

MAX_DB_BIGINT = 9223372036854775807
MAX_PROGRESS_SCHEDULE_IDS_PER_REQUEST = 500


def _parse_positive_id(value):
    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        parsed = value
    elif isinstance(value, str):
        stripped_value = value.strip()
        if not stripped_value:
            return None
        try:
            parsed = int(stripped_value)
        except ValueError:
            return None
    else:
        return None

    if parsed < 1 or parsed > MAX_DB_BIGINT:
        return None
    return parsed


def _parse_bounded_limit(value, *, default, maximum):
    """Parse a positive query limit clamped to [1, maximum].

    Returns ``default`` when the value is absent and ``None`` for
    non-integer input so callers can fail closed with a 400 instead of
    surfacing an unhandled 500 (e.g. ``int('abc')`` or a negative slice).
    """
    if value is None:
        return default
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 1:
        return 1
    return min(parsed, maximum)


def _schedule_base_queryset():
    return DailyBibleSchedule.objects.select_related('plan')


def _readable_schedule_queryset(user):
    schedules = _schedule_base_queryset()
    if user.is_staff:
        return schedules

    return schedules.filter(
        plan__is_active=True,
        plan__plansubscription__user=user,
        plan__plansubscription__is_active=True,
    )


def _can_read_plan_schedules(user, plan_id):
    if user.is_staff:
        return BibleReadingPlan.objects.filter(pk=plan_id).exists()

    return PlanSubscription.objects.filter(
        user=user,
        plan_id=plan_id,
        plan__is_active=True,
        is_active=True,
    ).exists()


def _validate_progress_request(data):
    plan_id = _parse_positive_id(data.get('plan_id'))
    schedule_ids = data.get('schedule_ids', [])
    action = data.get('action')

    if not plan_id or not schedule_ids or not action:
        return None, _progress_error('필수 파라미터(plan_id, schedule_ids, action)가 누락되었습니다.')

    if action not in ['complete', 'cancel']:
        return None, _progress_error('action은 complete 또는 cancel이어야 합니다.')

    if not isinstance(schedule_ids, list):
        return None, _progress_error('schedule_ids는 배열이어야 합니다.')

    if len(schedule_ids) > MAX_PROGRESS_SCHEDULE_IDS_PER_REQUEST:
        return None, _progress_error(
            f'schedule_ids는 한 번에 최대 {MAX_PROGRESS_SCHEDULE_IDS_PER_REQUEST}개까지 처리할 수 있습니다.'
        )

    parsed_schedule_ids = [_parse_positive_id(schedule_id) for schedule_id in schedule_ids]
    if any(schedule_id is None for schedule_id in parsed_schedule_ids):
        return None, _progress_error('schedule_ids는 양의 정수 배열이어야 합니다.')

    if len(set(parsed_schedule_ids)) != len(parsed_schedule_ids):
        return None, _progress_error('schedule_ids에 중복된 값이 있습니다.')

    return {
        'plan_id': plan_id,
        'schedule_ids': parsed_schedule_ids,
        'action': action,
    }, None


@extend_schema(responses={200: openapi.ProgressUpdateResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_bible_progress(request):
    """
    성경 진도 업데이트 API
    
    [필수 파라미터]
    - plan_id: 플랜 ID (문자열)
    - schedule_ids: 스케줄 ID 리스트 (배열)
    - action: 'complete' 또는 'cancel' (문자열)
    
    [요청 예시]
    {
        "plan_id": "1",
        "schedule_ids": ["42", "43", "44"],
        "action": "complete"
    }
    
    [응답 예시 - 성공]
    {
        "success": true,
        "plan_id": "1",
        "schedule_ids": ["42", "43", "44"],
        "is_completed": true
    }
    
    [응답 예시 - 실패]
    {
        "success": false,
        "error": "스케줄 ID와 플랜 ID가 일치하지 않습니다."
    }
    """
    try:
        progress_request, error_response = _validate_progress_request(request.data)
        if error_response:
            return error_response

        plan_id = progress_request['plan_id']
        schedule_ids = progress_request['schedule_ids']
        action = progress_request['action']

        decision = can(
            subject_from_request(request),
            'update_progress',
            ReadingProgressUpdate(
                plan_id=plan_id,
                schedule_ids=tuple(schedule_ids),
            ),
        )
        if not decision:
            return _authz_denial_response(decision)

        subscription = decision.value.subscription
        daily_schedules = decision.value.schedules

        # 진도 업데이트 또는 생성 (bulk 연산으로 최적화)
        is_completed = action == 'complete'
        now = timezone.now()
        completed_schedules = list(daily_schedules)
        with transaction.atomic():
            existing_qs = UserBibleProgress.objects.filter(
                subscription=subscription,
                schedule__in=daily_schedules
            )
            existing_schedule_ids = set(existing_qs.values_list('schedule_id', flat=True))

            # 기존 레코드 bulk update (1 쿼리)
            # 완료 시각은 최초 완료 시점을 보존하고, 취소 시에는 초기화한다.
            if is_completed:
                existing_qs.filter(
                    Q(is_completed=False) | Q(completed_at__isnull=True)
                ).update(is_completed=True, completed_at=now)
            else:
                existing_qs.update(is_completed=False, completed_at=None)

            # 새 레코드 bulk create (1 쿼리)
            # ignore_conflicts: 동시 요청이 같은 진도를 만들어도 중복 생성되지 않음
            new_progress = [
                UserBibleProgress(
                    subscription=subscription,
                    schedule=schedule,
                    is_completed=is_completed,
                    completed_at=now if is_completed else None
                )
                for schedule in daily_schedules
                if schedule.id not in existing_schedule_ids
            ]
            if new_progress:
                UserBibleProgress.objects.bulk_create(new_progress, ignore_conflicts=True)

            # 메인 읽기 흐름에서 토글된 진도를 활성 따라잡기 세션 스케줄에 동기화
            sync_catchup_schedules(subscription, daily_schedules, is_completed, now)
            # 벌크 연산은 post_save 시그널을 발생시키지 않으므로 통계/업적을 직접 재계산
            AchievementService.update_user_stats(request.user)
            if is_completed:
                AchievementService.check_and_grant_achievements(request.user)

            if is_completed:
                on_commit_notify_reading_completed(request.user, completed_schedules)

        return Response({
            'success': True,
            'plan_id': str(plan_id),
            'schedule_ids': [str(schedule_id) for schedule_id in schedule_ids],
            'is_completed': is_completed
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in update_bible_progress: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def parse_positive_int_param(request, name):
    raw_value = request.query_params.get(name)
    if raw_value in (None, ''):
        return None, None
    try:
        parsed_value = int(raw_value)
    except (TypeError, ValueError):
        return None, Response({
            'success': False,
            'error': f'{name}는 숫자여야 합니다.',
        }, status=status.HTTP_400_BAD_REQUEST)
    if parsed_value < 1:
        return None, Response({
            'success': False,
            'error': f'{name}는 1 이상이어야 합니다.',
        }, status=status.HTTP_400_BAD_REQUEST)
    if parsed_value > MAX_DB_BIGINT:
        return None, Response({
            'success': False,
            'error': f'{name}가 허용 범위를 벗어났습니다.',
        }, status=status.HTTP_400_BAD_REQUEST)
    return parsed_value, None


def format_schedule_range(schedule):
    if schedule.start_chapter == schedule.end_chapter:
        return f'{schedule.book} {schedule.start_chapter}장'
    return f'{schedule.book} {schedule.start_chapter}-{schedule.end_chapter}장'


@extend_schema(
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Active subscribed plan ID (positive integer); defaults to the first active subscription.',
        ),
        OpenApiParameter(
            'schedule_id',
            int,
            required=False,
            description='Schedule ID from the selected plan (positive integer); defaults to the latest completed schedule.',
        ),
    ],
    responses={200: openapi.CertificationProgressResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certification_progress(request):
    plan_id, error_response = parse_positive_int_param(request, 'plan_id')
    if error_response:
        return error_response

    schedule_id, error_response = parse_positive_int_param(request, 'schedule_id')
    if error_response:
        return error_response

    decision = can(
        subject_from_request(request),
        'view_certification_progress',
        CertificationProgress(plan_id=plan_id, schedule_id=schedule_id),
    )
    if not decision:
        return _authz_denial_response(decision)

    subscription = decision.value.subscription
    selected_schedule = decision.value.selected_schedule
    schedules = DailyBibleSchedule.objects.filter(plan=subscription.plan)
    total_schedules = schedules.count()
    end_date = schedules.order_by('-date').values_list('date', flat=True).first()
    progress = UserBibleProgress.objects.filter(
        subscription=subscription,
        is_completed=True,
    ).select_related('schedule').order_by('-completed_at', '-schedule__date', '-id')
    completed_schedules = progress.count()
    target_progress = (
        progress.filter(schedule=selected_schedule).first()
        if selected_schedule
        else progress.first()
    )
    target_schedule = target_progress.schedule if target_progress else None
    latest_completed_at = None
    if target_progress and target_progress.completed_at:
        completed_at = target_progress.completed_at
        latest_completed_at = (
            localtime(completed_at).isoformat()
            if timezone.is_aware(completed_at)
            else completed_at.isoformat()
        )
    completion_rate = round((completed_schedules / total_schedules) * 100, 2) if total_schedules else 0
    if completed_schedules == 0:
        progress_status = 'no_progress'
    elif total_schedules and completed_schedules >= total_schedules:
        progress_status = 'completed'
    else:
        progress_status = 'in_progress'

    profile = request.user.profile
    reading_range = format_schedule_range(target_schedule) if target_schedule else ''
    date_label = target_schedule.date.isoformat() if target_schedule else ''

    return Response({
        'success': True,
        'user': {
            'id': request.user.id,
            'nickname': request.user.nickname,
        },
        'plan': {
            'id': subscription.plan.id,
            'name': subscription.plan.name,
        },
        'period': {
            'startDate': subscription.start_date.isoformat(),
            'endDate': (end_date or subscription.start_date).isoformat(),
        },
        'progress': {
            'totalSchedules': total_schedules,
            'completedSchedules': completed_schedules,
            'completionRate': completion_rate,
            'currentStreak': profile.current_streak,
            'totalCompletedDays': profile.total_completed_days,
            'latestCompletedAt': latest_completed_at,
            'status': progress_status,
        },
        'card': {
            'title': '오늘 통독 완료',
            'subtitle': '오늘도 말씀을 읽었습니다',
            'readingRange': reading_range,
            'dateLabel': date_label,
            'footer': '매일 말씀을 읽는 작은 습관',
        },
    })

def _parse_optional_year(raw_year):
    if raw_year is None:
        return None, None

    try:
        year = int(raw_year)
    except (TypeError, ValueError):
        return None, Response({'error': 'Invalid year format'}, status=400)

    if year < 1 or year > 9999:
        return None, Response({'error': 'Year must be between 1 and 9999'}, status=400)

    return year, None


@extend_schema(
    parameters=[
        OpenApiParameter('month', int, required=True, description='Schedule month (1-12).'),
        OpenApiParameter('plan_id', int, required=True, description='Active public reading plan ID.'),
        OpenApiParameter(
            'year',
            int,
            required=False,
            description='Schedule year (1-9999). When omitted, matching months from every year are returned.',
        ),
    ],
    responses={200: openapi.DailyBibleScheduleWithProgressSerializer(many=True)},
)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_schedules_for_month(request):
    month = request.query_params.get('month')
    raw_year = request.query_params.get('year')
    plan_id = request.query_params.get('plan_id')
    user = request.user

    if not month or not plan_id:
        return Response({
            'error': 'Month and plan ID are required'
        }, status=400)

    try:
        month = int(month)
        plan_id = int(plan_id)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid plan ID or month format'}, status=400)

    if month < 1 or month > 12:
        return Response({'error': 'Month must be between 1 and 12'}, status=400)
    year, year_error = _parse_optional_year(raw_year)
    if year_error:
        return year_error


    plan = _get_active_public_plan(plan_id)
    if plan is None:
        return Response(
            {"detail": "존재하지 않는 플랜입니다."},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        schedules = DailyBibleSchedule.objects.filter(plan=plan).select_related('plan')

        if year is not None:
            start_date = date(year, month, 1)
            end_date = date(year, month, monthrange(year, month)[1])
            schedules = schedules.filter(date__range=(start_date, end_date))
        else:
            schedules = schedules.filter(date__month=month)

        schedule_list = list(schedules.order_by('date', 'id'))

        # 비로그인 사용자인 경우 기본 일정 정보만 반환
        if not user.is_authenticated:
            schedule_data = [DailyBibleScheduleSerializer(schedule).data for schedule in schedule_list]
            return Response(schedule_data)

        # 로그인 사용자인 경우 읽기 상태 정보 포함
        subscription = PlanSubscription.objects.filter(
            user=user,
            plan=plan,
            is_active=True
        ).first()

        if subscription:
            schedule_ids = [schedule.id for schedule in schedule_list]
            progress_records = UserBibleProgress.objects.filter(
                subscription=subscription,
                schedule_id__in=schedule_ids
            ).values_list('schedule_id', 'is_completed')

            progress_dict = dict(progress_records)

            schedule_data = []
            for schedule in schedule_list:
                schedule_dict = DailyBibleScheduleSerializer(schedule).data
                schedule_dict['is_completed'] = progress_dict.get(schedule.id, False)
                schedule_data.append(schedule_dict)

            return Response(schedule_data)

        # 구독이 없는 경우 기본 일정 정보만 반환
        return Response([DailyBibleScheduleSerializer(schedule).data for schedule in schedule_list])

    except Exception as e:
        logger.error(f"Error in get_schedules_for_month: {str(e)}", exc_info=True)
        return Response({
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=500)

class IsStaffOrReadOnly(permissions.BasePermission):
    """
    관리자만 생성/수정/삭제 가능, 일반 사용자는 조회만 가능
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff


def _get_active_public_plan(plan_id):
    try:
        return BibleReadingPlan.objects.get(id=plan_id, is_active=True)
    except (BibleReadingPlan.DoesNotExist, TypeError, ValueError):
        return None


def _parse_positive_chapter(value):
    if isinstance(value, bool):
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        return None

    if isinstance(value, numbers.Integral):
        chapter = int(value)
    elif isinstance(value, numbers.Real):
        if not value.is_integer():
            return None
        chapter = int(value)
    elif isinstance(value, str):
        stripped_value = value.strip()
        if not re.fullmatch(r'[+-]?\d+', stripped_value):
            return None
        chapter = int(stripped_value)
    else:
        return None

    if chapter < 1:
        return None
    return chapter


def _parse_excel_schedule_date(value):
    if isinstance(value, str):
        date_value = value.strip()
        if re.match(r'\d{4}\.\d{1,2}\.\d{1,2}', date_value):
            date_value = date_value.replace('.', '-')
        return datetime.strptime(date_value, '%Y-%m-%d').date()

    return value.date() if hasattr(value, 'date') else value


def _parse_required_excel_text(value):
    if value is None:
        raise ValueError('required text is blank')

    try:
        if pd.isna(value):
            raise ValueError('required text is blank')
    except TypeError:
        pass

    text = str(value).strip()
    if not text:
        raise ValueError('required text is blank')
    return text


def _parse_excel_chapter_range(start_value, end_value):
    start_chapter = _parse_positive_chapter(start_value)
    end_chapter = _parse_positive_chapter(end_value)

    if start_chapter is None or end_chapter is None:
        raise ValueError('chapter must be a positive integer')

    if end_chapter < start_chapter:
        raise ValueError('end chapter cannot be less than start chapter')

    return start_chapter, end_chapter


def _clean_function_upload_url(url):
    if isinstance(url, float) and pd.isna(url):
        return ''
    return url


def _parse_excel_schedule_row(row, url_cleaner):
    start_chapter, end_chapter = _parse_excel_chapter_range(row['시작장'], row['끝장'])
    return {
        'date': _parse_excel_schedule_date(row['날짜']),
        'book': _parse_required_excel_text(row['성경']),
        'start_chapter': start_chapter,
        'end_chapter': end_chapter,
        'audio_link': url_cleaner(row.get('오디오', '')),
        'guide_link': url_cleaner(row.get('가이드', '')),
    }


def _build_excel_row_error(index):
    return f"행 {index + 2}: 처리 중 오류가 발생했습니다."


def _excel_upload_error_response(errors):
    return Response({
        "detail": f"0개의 일정이 처리되었습니다. 오류: {len(errors)}개",
        "errors": errors,
    })


class DailyBibleScheduleViewSet(viewsets.ModelViewSet):
    queryset = DailyBibleSchedule.objects.all()
    serializer_class = DailyBibleScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        # N+1 쿼리 방지: plan을 미리 로드
        queryset = DailyBibleSchedule.objects.select_related('plan')
        
        # 플랜 ID로 필터링
        plan_id = self.request.query_params.get('plan_id')
        if plan_id:
            # 디버깅 로그 추가
            logger.info(f"Fetching schedules for plan_id: {plan_id}")
            filtered_queryset = queryset.filter(plan_id=plan_id)
            logger.info(f"Found {filtered_queryset.count()} schedules")
            return filtered_queryset
        return queryset
    
    @action(detail=False, methods=['post'])
    def upload_excel(self, request):
        """엑셀 파일로 세부 일정 대량 업로드"""
        plan_id = request.data.get('plan_id')
        file = request.FILES.get('file')
        update_mode = request.data.get('update_mode', 'add')  # 'add', 'update', 'replace'
        
        if not plan_id or not file:
            return Response(
                {"detail": "플랜 ID와 파일은 필수 항목입니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 플랜 존재 여부 확인
            plan = BibleReadingPlan.objects.get(id=plan_id)
            
            # 엑셀 파일 읽기
            df = pd.read_excel(file)
            
            # 필수 열 확인
            required_columns = ['날짜', '성경', '시작장', '끝장']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {"detail": f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            pending_rows = []
            errors = []

            for index, row in df.iterrows():
                try:
                    pending_rows.append(_parse_excel_schedule_row(row, self._validate_url))
                except Exception as e:
                    logger.warning(
                        "Invalid upload_excel row: row=%s",
                        index + 2,
                    )
                    errors.append(_build_excel_row_error(index))

            if errors:
                return _excel_upload_error_response(errors)

            success_count = 0
            with transaction.atomic():
                if update_mode == 'replace':
                    DailyBibleSchedule.objects.filter(plan=plan).delete()

                for row_data in pending_rows:
                    if update_mode in ['add', 'replace']:
                        DailyBibleSchedule.objects.create(plan=plan, **row_data)
                    else:
                        DailyBibleSchedule.objects.update_or_create(
                            plan=plan,
                            date=row_data['date'],
                            book=row_data['book'],
                            defaults={
                                'start_chapter': row_data['start_chapter'],
                                'end_chapter': row_data['end_chapter'],
                                'audio_link': row_data['audio_link'],
                                'guide_link': row_data['guide_link'],
                            }
                        )
                    success_count += 1

            return Response({
                "detail": f"{success_count}개의 일정이 처리되었습니다. 오류: 0개",
                "errors": None
            })
            
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {"detail": "해당 ID의 플랜을 찾을 수 없습니다."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in upload_excel: {str(e)}", exc_info=True)
            return Response(
                {"detail": "요청 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def _validate_url(self, url):
        """URL을 검증하고 필요하면 수정합니다"""
        # None 값 처리
        if url is None:
            return ''
        
        # float 타입이면 문자열로 변환
        if isinstance(url, float):
            # NaN 체크
            if pd.isna(url):
                return ''
            # 소수점 없는 정수형 숫자로 보이면 정수로 변환 (예: 12.0 -> '12')
            if url.is_integer():
                url = str(int(url))
            else:
                url = str(url)
        
        # 문자열 타입이 아니면 문자열로 변환
        if not isinstance(url, str):
            url = str(url)
        
        # 공백 제거
        url = url.strip()
        
        # 빈 문자열 처리
        if url == '':
            return ''
        
        # URL에 스키마가 없으면 https:// 추가
        if not url.startswith(('http://', 'https://')):
            return 'https://' + url
        
        return url

    # 추가 디버깅 액션
    @action(detail=False, methods=['get'])
    def debug_plan_schedules(self, request):
        """특정 플랜의 스케줄 데이터 디버깅"""
        plan_id = request.query_params.get('plan_id')
        if not plan_id:
            return Response({"error": "plan_id is required"}, status=400)
            
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
            schedules = DailyBibleSchedule.objects.filter(plan=plan)
            
            return Response({
                "plan_name": plan.name,
                "plan_id": plan.id,
                "schedule_count": schedules.count(),
                "schedules": DailyBibleScheduleSerializer(schedules, many=True).data[:5]  # 최대 5개 표시
            })
        except BibleReadingPlan.DoesNotExist:
            return Response({"error": f"Plan with id {plan_id} not found"}, status=404)
        except Exception as e:
            logger.error(f"Error in debug_plan_schedules: {str(e)}", exc_info=True)
            return Response({"error": "요청 처리 중 오류가 발생했습니다."}, status=500)

    @action(detail=True, methods=['post'])
    def generate_test_schedules(self, request, pk=None):
        """테스트용 일정 생성"""
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다"}, status=403)
        
        plan = self.get_object()
        count = int(request.data.get('count', 5))  # 기본 5개
        
        # 테스트 데이터 생성
        import random
        from datetime import timedelta, date
        
        bible_books = ["창세기", "출애굽기", "레위기", "민수기", "신명기"]
        start_date = date.today()
        
        created_schedules = []
        for i in range(count):
            schedule_date = start_date + timedelta(days=i)
            book = random.choice(bible_books)
            start_chapter = random.randint(1, 10)
            end_chapter = start_chapter + random.randint(0, 5)
            
            schedule = DailyBibleSchedule.objects.create(
                plan=plan,
                date=schedule_date,
                book=book,
                start_chapter=start_chapter,
                end_chapter=end_chapter,
                audio_link=f"https://example.com/audio/{book}/{start_chapter}-{end_chapter}",
                guide_link=f"https://example.com/guide/{book}/{start_chapter}-{end_chapter}"
            )
            created_schedules.append(DailyBibleScheduleSerializer(schedule).data)
        
        return Response({
            "detail": f"{count}개의 테스트 일정이 생성되었습니다",
            "schedules": created_schedules
        })

class BibleReadingPlanViewSet(viewsets.ModelViewSet):
    """성경 읽기 플랜 관리를 위한 ViewSet"""
    queryset = BibleReadingPlan.objects.all()
    serializer_class = BibleReadingPlanSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """사용자 권한에 따라 쿼리셋 필터링"""
        # N+1 쿼리 방지: created_by를 미리 로드하고 구독자 수를 집계
        queryset = BibleReadingPlan.objects.select_related('created_by').annotate(
            subscriber_count=Count('plansubscription', filter=Q(plansubscription__is_active=True))
        ).order_by('-is_default', 'name', 'id')
        
        if self.request.user.is_staff:
            # 관리자는 모든 플랜 조회 가능
            return queryset
        else:
            # 일반 사용자는 활성화된 플랜만 조회 가능
            return queryset.filter(is_active=True)

    def _save_as_sole_default(self, save_callable, plan_pk=None):
        """Persist a plan as the single default within one transaction.

        Clears is_default on every other plan, then runs the provided save.
        The unique generated column (default_plan_identity) is the concurrency
        backstop: a lost race surfaces as IntegrityError instead of silently
        creating duplicate defaults. select_for_update is intentionally avoided
        (no-op on the SQLite test backend).
        """
        with transaction.atomic():
            BibleReadingPlan.objects.filter(is_default=True).exclude(
                pk=plan_pk
            ).update(is_default=False)
            return save_callable()

    def perform_create(self, serializer):
        """플랜 생성 시 생성자 정보 추가"""
        if serializer.validated_data.get('is_default'):
            self._save_as_sole_default(
                lambda: serializer.save(created_by=self.request.user)
            )
            return
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """기존 생성자 정보를 유지하면서 업데이트"""
        instance = self.get_object()
        if serializer.validated_data.get('is_default'):
            self._save_as_sole_default(
                lambda: serializer.save(created_by=instance.created_by),
                plan_pk=instance.pk,
            )
            return
        serializer.save(created_by=instance.created_by)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None, format=None):
        """플랜 활성화/비활성화 토글"""
        plan = self.get_object()
        # 활성화 상태만 토글
        plan.is_active = not plan.is_active
        
        # update_fields 파라미터를 사용하여 특정 필드만 업데이트
        plan.save(update_fields=['is_active'])
        
        return Response({'detail': f'플랜이 {"활성화" if plan.is_active else "비활성화"}되었습니다.'})

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None, format=None):
        """특정 플랜을 기본 플랜으로 설정"""
        plan = self.get_object()

        def _mark_default():
            plan.is_default = True
            plan.save(update_fields=['is_default'])

        self._save_as_sole_default(_mark_default, plan_pk=plan.pk)

        return Response({'detail': '기본 플랜으로 설정되었습니다.'})

    @action(detail=True, methods=['get'])
    def schedules(self, request, pk=None, format=None):
        """특정 플랜의 스케줄 목록 조회"""
        plan = self.get_object()
        schedules = plan.schedules.all()
        serializer = DailyBibleScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

@extend_schema(methods=['GET'], responses={200: openapi.PLAN_SUBSCRIPTION_LIST_RESPONSE})
@extend_schema(methods=['POST'], responses={201: PlanSubscriptionSerializer})
@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def plan_subscription_list(request):
    """플랜 구독 목록 조회 및 생성"""
    subject = subject_from_request(request)

    if request.method == 'GET':
        decision = can(
            subject,
            'view_subscriptions',
            PlanSubscriptionCollection(),
        )
        if not decision:
            return _authz_denial_response(decision)

        collection = decision.value
        if collection.public_plans:
            return Response([{
                'plan_id': plan.id,
                'plan_name': plan.name,
                'is_default': plan.is_default
            } for plan in collection.items])

        serializer = PlanSubscriptionSerializer(collection.items, many=True)
        return Response(serializer.data)

    decision = can(
        subject,
        'subscribe',
        PlanSubscriptionCreation(owner_id=getattr(request.user, 'id', None)),
    )
    if not decision:
        return _authz_denial_response(decision)

    plan_id = request.data.get('plan')

    try:
        plan = _get_subscription_plan(plan_id)
    except OperationalError as exc:
        if not _is_database_lock_error(exc):
            raise
        return Response(
            {"detail": "구독 요청이 몰려 처리하지 못했습니다. 다시 시도해주세요."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if plan is None:
        return Response(
            {"detail": "존재하지 않는 플랜입니다."},
            status=status.HTTP_404_NOT_FOUND
        )

    if not plan.is_active:
        return Response(
            {"detail": "현재 신규 구독이 중단된 플랜입니다."},
            status=status.HTTP_400_BAD_REQUEST
        )

    subscription, created = _get_or_create_plan_subscription(request.user, plan)
    if not created:
        return Response(
            {"detail": "이미 구독 중인 플랜입니다."},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = PlanSubscriptionSerializer(subscription)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@extend_schema(methods=['GET'], responses={200: PlanSubscriptionSerializer})
@extend_schema(methods=['PUT'], responses={200: PlanSubscriptionSerializer})
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def plan_subscription_detail(request, pk):
    """플랜 구독 상세 조회, 수정, 삭제"""
    action_name = {
        'GET': 'view_subscription',
        'PUT': 'update_subscription',
        'DELETE': 'unsubscribe',
    }[request.method]
    decision = can(
        subject_from_request(request),
        action_name,
        PlanSubscriptionResource(subscription_id=pk),
    )
    if not decision:
        return _authz_denial_response(decision)

    subscription = decision.value
    if request.method == 'GET':
        serializer = PlanSubscriptionSerializer(subscription)
        return Response(serializer.data)

    if request.method == 'PUT':
        serializer = PlanSubscriptionUpdateSerializer(subscription, data=request.data, partial=True)
        if serializer.is_valid():
            updated_subscription = serializer.save()
            return Response(PlanSubscriptionSerializer(updated_subscription).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        _delete_plan_subscription_with_artifacts(subscription)
    return Response(status=status.HTTP_204_NO_CONTENT)

@extend_schema(responses={200: openapi.ActiveResponseSerializer})
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def plan_subscription_toggle_active(request, pk):
    """구독 활성화/비활성화 토글"""
    decision = can(
        subject_from_request(request),
        'toggle_active',
        PlanSubscriptionResource(subscription_id=pk),
    )
    if not decision:
        return _authz_denial_response(decision)

    subscription = decision.value
    subscription.is_active = not subscription.is_active
    subscription.save()

    return Response({"is_active": subscription.is_active})

@extend_schema(
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Active public reading plan ID. Without it, only basic chapter information is returned.',
        ),
        OpenApiParameter(
            'book',
            str,
            required=True,
            enum=sorted(book_to_code.values()),
            description='Bible book code.',
        ),
        OpenApiParameter('chapter', int, required=True, description='Positive chapter number.'),
    ],
    responses={200: openapi.ChapterDetailResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_chapter_detail(request):
    """
    1. 특정 장의 상세 데이터 조회
    """
    try:
        # 요청 파라미터
        plan_id = request.GET.get('plan_id')
        book = request.GET.get('book')
        chapter = request.GET.get('chapter')
        user = request.user if request.user.is_authenticated else None

        # book과 chapter는 필수 파라미터
        if not all([book, chapter]):
            return Response({'error': '필수 파라미터(book, chapter)가 누락되었습니다.'}, status=400)

        # 책 코드 -> 한글 이름 변환
        code_to_book = {v: k for k, v in book_to_code.items()}
        book_name = code_to_book.get(book)
        if not book_name:
            return Response({'error': '잘못된 성경 코드입니다.'}, status=400)

        chapter_number = _parse_positive_chapter(chapter)
        if chapter_number is None:
            return Response({'error': 'chapter는 1 이상의 정수여야 합니다.'}, status=400)

        # 기본 응답 데이터 (plan_id가 없을 때 반환할 기본 정보)
        response_data = {
            'book': book,
            'book_kor': book_name,
            'book_unit_kor': '편' if book == 'psa' else '장',
            'chapter': chapter,
            'is_logined': user is not None
        }

        # 플랜 없이 그냥 장을 열었어도 그 장의 장별 성경읽기 오디오는 들을 수 있다.
        if not plan_id:
            response_data['fallback_audio_links'] = build_fallback_audio_links(
                [(book, chapter_number, chapter_number)]
            )
            return Response(response_data)

        plan = _get_active_public_plan(plan_id)
        if plan is None:
            return Response({'error': '존재하지 않는 플랜입니다.'}, status=404)

        # 해당 장이 속한 일정 조회
        target_schedule = DailyBibleSchedule.objects.filter(
            plan=plan,
            book=book_name,
            start_chapter__lte=chapter_number,
            end_chapter__gte=chapter_number
        ).first()

        if not target_schedule:
            # 에러 코드 대신 정상 응답으로 메시지 전달
            response_data.update({
                'plan_id': plan_id,
                'plan_name': plan.name,
                'message': f"이 플랜에는 현재 위치에 대한 일정이 없어요.",
                'plan_detail': [],
                'fallback_audio_links': build_fallback_audio_links(
                    [(book, chapter_number, chapter_number)]
                ),
            })
            return Response(response_data)

        # 같은 날짜의 모든 일정 조회
        schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date=target_schedule.date
        ).order_by('id')

        progress_dict = {}

        # 읽기 상태 확인 (로그인 상태일 경우)
        if user:
            subscription = PlanSubscription.objects.filter(
                user=user,
                plan=plan,
                is_active=True
            ).first()

            if subscription:
                progress_records = UserBibleProgress.objects.filter(
                    subscription=subscription,
                    schedule__in=schedules,
                    is_completed=True
                ).values_list('schedule_id', flat=True)
                
                progress_dict = {str(schedule_id): True for schedule_id in progress_records}

        # 추가 응답 데이터
        response_data.update({
            'audio_link': target_schedule.audio_link,
            'guide_link': target_schedule.guide_link,
            'plan_id': plan_id,
            'plan_name': plan.name,
            'plan_date': target_schedule.date.isoformat(),
            'is_complete': False,
            'plan_detail': []
        })

        # 플랜 상세 정보 구성
        for schedule in schedules:
            schedule_id = str(schedule.id)
            response_data['plan_detail'].append({
                'book': book_to_code.get(schedule.book, 'gen'),
                'book_kor': schedule.book,
                'book_unit_kor': '편' if schedule.book == '시편' else '장',
                'start_chapter': schedule.start_chapter,
                'end_chapter': schedule.end_chapter,
                'schedule_id': schedule_id,
                'date': schedule.date.isoformat(),
                'is_complete': progress_dict.get(schedule_id, False)
            })

        # 플랜에 오디오가 없으면 @readingjesus 장별 성경읽기 영상을 기본 오디오로 제공한다.
        if target_schedule.audio_link:
            response_data['fallback_audio_links'] = []
        else:
            response_data['fallback_audio_links'] = build_fallback_audio_links(
                (item['book'], item['start_chapter'], item['end_chapter'])
                for item in response_data['plan_detail']
            )

        # 전체 완료 상태 업데이트
        response_data['is_complete'] = all(
            progress_dict.get(item['schedule_id'], False) 
            for item in response_data['plan_detail']
        )

        return Response(response_data)

    except Exception as e:
        logger.error(f"Error in get_chapter_detail: {str(e)}", exc_info=True)
        return Response({'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@extend_schema(
    parameters=[
        OpenApiParameter('plan_id', int, required=True, description='Active public reading plan ID.'),
    ],
    responses={200: openapi.TodaySchedulesResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_today_schedules(request):
    """
    오늘 날짜의 성경 일정을 반환하는 API
    
    [필수 파라미터]
    - plan_id: 플랜 ID
    
    [응답 예시]
    {
        "success": true,
        "schedules": [
            {
                "id": 123,
                "book": "창세기",
                "start_chapter": 1,
                "end_chapter": 3,
                "audio_link": "https://example.com/audio",
                "guide_link": "https://example.com/guide",
                "is_completed": false
            },
            ...
        ]
    }
    """
    try:
        plan_id = request.query_params.get('plan_id')
        
        if not plan_id:
            return Response({
                'success': False,
                'error': '플랜 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        plan = _get_active_public_plan(plan_id)
        if plan is None:
            return Response({
                'success': False,
                'error': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 오늘 날짜 가져오기
        today = timezone.now().date()
        
        # 오늘 날짜의 일정 조회
        schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date=today
        ).order_by('id')
        
        if not schedules.exists():
            return Response({
                'success': True,
                'schedules': []
            })
        
        # 사용자 인증 여부 확인
        user = request.user
        progress_dict = {}
        
        if user.is_authenticated:
            # 사용자의 구독 확인
            subscription = PlanSubscription.objects.filter(
                user=user,
                plan_id=plan_id,
                is_active=True
            ).first()
            
            if subscription:
                # 오늘 일정에 대한 진행 상태 조회
                progress_records = UserBibleProgress.objects.filter(
                    subscription=subscription,
                    schedule__in=schedules
                )
                
                # schedule_id를 키로 하는 progress 딕셔너리 생성
                progress_dict = {
                    record.schedule_id: record.is_completed 
                    for record in progress_records
                }
        
        # 응답 데이터 구성
        schedule_data = []
        for schedule in schedules:
            data = {
                'id': schedule.id,
                'book': schedule.book,
                'book_code': book_to_code.get(schedule.book, 'gen'),
                'start_chapter': schedule.start_chapter,
                'end_chapter': schedule.end_chapter,
                'audio_link': schedule.audio_link,
                'guide_link': schedule.guide_link,
                'is_completed': progress_dict.get(schedule.id, False)
            }
            schedule_data.append(data)
        
        return Response({
            'success': True,
            'schedules': schedule_data
        })
        
    except Exception as e:
        logger.error(f"Error in get_today_schedules: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(responses={200: openapi.UserPlansResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_plans(request):
    """사용자의 구독 중인 플랜과 구독 가능한 플랜 목록 반환"""
    try:
        # 1. 사용자가 구독 중인 모든 플랜 목록 조회 (숨김 포함, 활성 먼저)
        all_subscriptions = PlanSubscription.objects.filter(
            user=request.user
        ).select_related('plan').order_by('-is_active', '-plan__is_default')

        # 2. 구독 가능한 플랜 목록 조회 (모든 구독 중인 플랜 제외, 활성 여부 상관없이)
        subscribed_plan_ids = all_subscriptions.values_list('plan_id', flat=True)

        available_plans = BibleReadingPlan.objects.filter(
            is_active=True
        ).exclude(
            id__in=subscribed_plan_ids
        )

        # 3. 시리얼라이징 (숨김 플랜 포함)
        subscription_serializer = PlanSubscriptionSerializer(all_subscriptions, many=True)
        available_plan_serializer = BibleReadingPlanSerializer(available_plans, many=True)

        return Response({
            'subscriptions': subscription_serializer.data,
            'available_plans': available_plan_serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error in get_user_plans: {str(e)}", exc_info=True)
        return Response({'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@extend_schema(responses={200: openapi.AvailablePlansResponseSerializer})
@api_view(['GET'])
@permission_classes([AllowAny])
def get_available_plans(request):
    """모든 활성화된 읽기 플랜 목록 반환 (그룹 생성 등에 사용)"""
    try:
        plans = BibleReadingPlan.objects.filter(is_active=True).order_by('-is_default', 'name')
        serializer = BibleReadingPlanSerializer(plans, many=True)
        return Response({
            'success': True,
            'plans': serializer.data
        })
    except Exception as e:
        logger.error(f"Error in get_available_plans: {str(e)}", exc_info=True)
        return Response({'success': False, 'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@extend_schema(
    parameters=[
        OpenApiParameter('plan_id', int, required=True, description='Active public reading plan ID.'),
    ],
    responses={200: openapi.NextReadingPositionResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])
def get_next_reading_position(request):
    """
    다음 읽을 위치를 반환하는 API
    
    - 비로그인 사용자: 오늘 날짜 또는 가장 가까운 일정 반환
    - 로그인 사용자: 미완료 스케줄 중 첫 번째 반환
    
    [필수 파라미터]
    - plan_id: 플랜 ID
    
    [응답 예시]
    {
        "success": true,
        "status": "next_incomplete",  // 상태 코드
        "month": 3,
        "schedule_id": "123",
        "date": "2024-03-15"
    }
    
    [status 값]
    - "next_incomplete": 다음 미완료 일정
    - "all_completed": 모든 일정 완료
    - "today": 오늘 날짜 일정 (비로그인)
    - "nearest": 가장 가까운 일정 (비로그인, 오늘 일정 없을 때)
    - "no_schedule": 플랜에 일정이 없음
    """
    try:
        plan_id = request.query_params.get('plan_id')
        
        if not plan_id:
            return Response({
                'success': False,
                'status': 'missing_plan_id',
                'message': '플랜 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        plan = _get_active_public_plan(plan_id)
        if plan is None:
            return Response({
                'success': False,
                'status': 'plan_not_found',
                'message': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        today = timezone.now().date()
        user = request.user
        
        # 비로그인 사용자: 오늘 날짜 또는 가장 가까운 일정 반환
        if not user.is_authenticated:
            # 오늘 일정 확인
            today_schedule = DailyBibleSchedule.objects.filter(
                plan=plan,
                date=today
            ).first()
            
            if today_schedule:
                return Response({
                    'success': True,
                    'status': 'today',
                    'month': today.month,
                    'schedule_id': today_schedule.id,
                    'date': today.isoformat()
                })
            
            # 오늘 일정 없으면 가장 가까운 미래 일정
            next_schedule = DailyBibleSchedule.objects.filter(
                plan=plan,
                date__gte=today
            ).order_by('date').first()
            
            if next_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': next_schedule.date.month,
                    'schedule_id': next_schedule.id,
                    'date': next_schedule.date.isoformat()
                })
            
            # 미래 일정도 없으면 가장 마지막 일정
            last_schedule = DailyBibleSchedule.objects.filter(
                plan=plan
            ).order_by('-date').first()
            
            if last_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': last_schedule.date.month,
                    'schedule_id': last_schedule.id,
                    'date': last_schedule.date.isoformat()
                })
            
            return Response({
                'success': False,
                'status': 'no_schedule',
                'message': '플랜에 등록된 일정이 없습니다.'
            })
        
        # 로그인 사용자: 구독 확인 후 미완료 스케줄 반환
        subscription = PlanSubscription.objects.filter(
            user=user,
            plan_id=plan_id,
            is_active=True
        ).first()
        
        if not subscription:
            # 구독 없으면 비로그인과 동일하게 처리
            today_schedule = DailyBibleSchedule.objects.filter(
                plan=plan,
                date=today
            ).first()
            
            if today_schedule:
                return Response({
                    'success': True,
                    'status': 'today',
                    'month': today.month,
                    'schedule_id': today_schedule.id,
                    'date': today.isoformat()
                })
            
            next_schedule = DailyBibleSchedule.objects.filter(
                plan=plan,
                date__gte=today
            ).order_by('date').first()
            
            if next_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': next_schedule.date.month,
                    'schedule_id': next_schedule.id,
                    'date': next_schedule.date.isoformat()
                })
            
            last_schedule = DailyBibleSchedule.objects.filter(
                plan=plan
            ).order_by('-date').first()
            
            if last_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': last_schedule.date.month,
                    'schedule_id': last_schedule.id,
                    'date': last_schedule.date.isoformat()
                })
            
            return Response({
                'success': False,
                'status': 'no_schedule',
                'message': '플랜에 등록된 일정이 없습니다.'
            })
        
        # 구독 있는 로그인 사용자: 미완료 스케줄 찾기
        completed_schedule_ids = UserBibleProgress.objects.filter(
            subscription=subscription,
            is_completed=True
        ).values_list('schedule_id', flat=True)
        
        next_schedule = DailyBibleSchedule.objects.filter(
            plan=plan
        ).exclude(
            id__in=completed_schedule_ids
        ).order_by('date').first()
        
        if next_schedule:
            return Response({
                'success': True,
                'status': 'next_incomplete',
                'month': next_schedule.date.month,
                'schedule_id': next_schedule.id,
                'date': next_schedule.date.isoformat()
            })
        
        # 모든 스케줄 완료
        # 마지막 스케줄 날짜 반환 (UI에서 스크롤 위치용)
        last_schedule = DailyBibleSchedule.objects.filter(
            plan=plan
        ).order_by('-date').first()
        
        if last_schedule:
            return Response({
                'success': True,
                'status': 'all_completed',
                'month': last_schedule.date.month,
                'schedule_id': last_schedule.id,
                'date': last_schedule.date.isoformat(),
                'message': '모든 일정을 완료했습니다!'
            })
        
        return Response({
            'success': False,
            'status': 'no_schedule',
            'message': '플랜에 등록된 일정이 없습니다.'
        })
        
    except Exception as e:
        logger.error(f"Error in get_next_reading_position: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'status': 'error',
            'message': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(
    methods=['GET'],
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Active public reading plan ID.',
        ),
    ],
    responses={200: VideoBibleIntroSerializer(many=True)},
)
@extend_schema(methods=['POST'], responses={201: VideoBibleIntroSerializer})
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def video_intro_list(request):
    """영상 개론 목록 조회 및 생성
    GET: 비로그인 사용자도 접근 가능
    POST: 관리자만 접근 가능
    """
    if request.method == 'GET':
        logger.info(f"[디버그] 영상 개론 목록 조회 - 인증상태: {request.user.is_authenticated}")
        plan_id = request.query_params.get('plan_id')

        try:
            if plan_id:
                plan = _get_active_public_plan(plan_id)
                if plan is None:
                    return Response(
                        {"detail": "존재하지 않는 플랜입니다."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                video_intros = VideoBibleIntro.objects.filter(plan=plan)
            else:
                video_intros = VideoBibleIntro.objects.filter(plan__is_active=True)

            logger.info(f"[디버그] 조회된 영상 개론 개수: {video_intros.count()}, plan_id: {plan_id}")
            serializer = VideoBibleIntroSerializer(video_intros, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"[디버그] 영상 개론 목록 조회 오류: {str(e)}", exc_info=True)
            return Response(
                {"detail": "요청 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':
        permission_error = _admin_permission_error(request)
        if permission_error:
            return permission_error
            
        serializer = VideoBibleIntroSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _admin_permission_error(request):
    if not request.user.is_authenticated:
        return Response(
            {"detail": "인증이 필요합니다."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not request.user.is_staff:
        return Response(
            {"detail": "관리자 권한이 필요합니다."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return None


@extend_schema(methods=['GET'], responses={200: VideoBibleIntroSerializer})
@api_view(['GET', 'DELETE'])
@permission_classes([AllowAny])
def video_intro_detail(request, pk):
    """영상 개론 상세 조회 및 삭제
    GET: 비로그인 사용자도 접근 가능 (활성 플랜에 한함)
    DELETE: 관리자만 접근 가능
    """
    if request.method == 'DELETE':
        permission_error = _admin_permission_error(request)
        if permission_error:
            return permission_error
        video_intros_queryset = VideoBibleIntro.objects.all()
    else:
        video_intros_queryset = VideoBibleIntro.objects.filter(plan__is_active=True)

    try:
        video_intro = video_intros_queryset.get(pk=pk)
    except VideoBibleIntro.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        logger.info(f"[디버그] 영상 개론 상세 조회 - ID: {pk}, 인증상태: {request.user.is_authenticated}")
        serializer = VideoBibleIntroSerializer(video_intro)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        video_intro.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@extend_schema(responses={200: openapi.UploadResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def upload_video_intros(request):
    """엑셀 파일로 영상 개론 일괄 업로드"""
    try:
        plan_id = request.data.get('plan_id')
        file = request.FILES.get('file')
        
        # 기본 유효성 검사
        if not plan_id or not file:
            return Response(
                {'detail': '플랜 ID와 엑셀 파일이 필요합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 파일 확장자 확인
        file_name = file.name.lower()
        if not (file_name.endswith('.xlsx') or file_name.endswith('.xls')):
            return Response(
                {'detail': 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 파일 크기 제한 (5MB)
        if file.size > 5 * 1024 * 1024:
            return Response(
                {'detail': '파일 크기는 5MB를 초과할 수 없습니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 플랜 존재 여부 확인
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {'detail': '존재하지 않는 플랜입니다.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 엑셀 파일 읽기
        try:
            # 날짜 컬럼을 자동으로 datetime 객체로 변환
            df = pd.read_excel(file, parse_dates=['시작일', '종료일'])
            logger.info(f"엑셀 파일 로드 성공: {len(df)} 행")

            # 첫 5행 데이터 샘플 로깅
            if not df.empty:
                logger.debug(f"샘플 데이터 (첫 5행):\n{df.head().to_dict('records')}")

            # 각 열의 데이터 유형 로깅
            dtypes = df.dtypes.to_dict()
            logger.debug(f"컬럼 데이터 유형: {dtypes}")
        except Exception as e:
            logger.error(f"엑셀 파일 읽기 오류: {str(e)}", exc_info=True)
            return Response(
                {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 필수 컬럼 확인
        required_columns = ['시작일', '종료일', '성경', 'URL']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return Response(
                {'detail': f'다음 필수 컬럼이 없습니다: {", ".join(missing_columns)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 데이터 처리 및 저장
        created_count = 0
        updated_count = 0
        errors = []
        
        # 한국어 날짜 패턴 정규식
        date_pattern = r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일'
        
        with transaction.atomic():
            for index, row in df.iterrows():
                try:
                    row_number = index + 2  # 엑셀 행 번호 (헤더 제외)
                    
                    # 값이 비어있는지 확인
                    if pd.isna(row['시작일']) or pd.isna(row['종료일']) or pd.isna(row['성경']) or pd.isna(row['URL']):
                        errors.append(f"{row_number}행: 빈 값이 있습니다.")
                        continue
                    
                    # 날짜 문자열 가져오기
                    start_date_str = str(row['시작일']).strip()
                    end_date_str = str(row['종료일']).strip()
                    
                    # 날짜 파싱 함수
                    def parse_korean_date(date_str):
                        # pandas datetime 객체인 경우 (엑셀 날짜 셀)
                        if isinstance(date_str, pd.Timestamp):
                            return date_str.date()
                        
                        # 날짜형으로 직접 변환 시도 (pd.to_datetime은 다양한 형식 지원)
                        try:
                            return pd.to_datetime(date_str).date()
                        except:
                            pass
                        
                        # YYYY-MM-DD HH:MM:SS 형식인 경우
                        if re.match(r'\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}', date_str):
                            try:
                                return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S').date()
                            except ValueError:
                                pass
                            
                        # YYYY-MM-DD 형식인 경우
                        if re.match(r'\d{4}-\d{1,2}-\d{1,2}', date_str):
                            return parse_date(date_str)
                            
                        # YYYY년 MM월 DD일 형식인 경우
                        matches = re.search(date_pattern, date_str)
                        if matches:
                            year = int(matches.group(1))
                            month = int(matches.group(2))
                            day = int(matches.group(3))
                            return datetime(year, month, day).date()
                        
                        # 다른 형식 시도
                        try:
                            # 다양한 날짜 형식 파싱 시도
                            for fmt in ['%Y년 %m월 %d일', '%Y년%m월%d일', '%Y-%m-%d', '%Y/%m/%d']:
                                try:
                                    return datetime.strptime(date_str, fmt).date()
                                except ValueError:
                                    continue
                        except Exception:
                            pass
                            
                        # 모든 시도 실패
                        return None
                    
                    # 날짜 파싱
                    start_date = parse_korean_date(start_date_str)
                    end_date = parse_korean_date(end_date_str)
                    
                    # 파싱 실패 시 오류
                    if not start_date:
                        errors.append(f"{row_number}행: 시작일 형식이 올바르지 않습니다. ({start_date_str})")
                        continue
                        
                    if not end_date:
                        errors.append(f"{row_number}행: 종료일 형식이 올바르지 않습니다. ({end_date_str})")
                        continue
                    
                    # 날짜 유효성 검사
                    if end_date < start_date:
                        errors.append(f"{row_number}행: 종료일({end_date})이 시작일({start_date})보다 이전입니다.")
                        continue
                    
                    # 성경 이름 가져오기
                    book_name = str(row['성경']).strip()
                    if not book_name:
                        errors.append(f"{row_number}행: 성경 이름이 비어있습니다.")
                        continue
                        
                    # URL 유효성 검사
                    url = str(row['URL']).strip()
                    if not (url.startswith('http://') or url.startswith('https://')):
                        errors.append(f"{row_number}행: URL 형식이 올바르지 않습니다. ({url})")
                        continue
                    
                    # 중복 확인 (성경 이름과 플랜으로)
                    existing = VideoBibleIntro.objects.filter(
                        plan=plan,
                        book=book_name
                    ).first()
                    
                    logger.debug(f"처리 중: {book_name}, 시작일: {start_date}, 종료일: {end_date}, URL: {url}")
                    
                    if existing:
                        # 기존 데이터 업데이트
                        existing.start_date = start_date
                        existing.end_date = end_date
                        existing.url_link = url
                        existing.save()
                        updated_count += 1
                        logger.info(f"업데이트: {book_name}")
                    else:
                        # 새 데이터 생성
                        VideoBibleIntro.objects.create(
                            plan=plan,
                            book=book_name,
                            start_date=start_date,
                            end_date=end_date,
                            url_link=url
                        )
                        created_count += 1
                        logger.info(f"생성: {book_name}")
                        
                except Exception as e:
                    logger.error(f"{index+2}행 처리 중 오류: {str(e)}", exc_info=True)
                    errors.append(f"{index+2}행: 처리 중 오류가 발생했습니다.")
        
        # 결과 반환
        result = {
            'detail': f'{created_count}개 생성, {updated_count}개 업데이트 완료'
        }
        
        if errors:
            result['errors'] = errors
            
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"업로드 처리 중 예외 발생: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@extend_schema(
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Subscribed plan ID. Invalid or unsubscribed values are ignored and all active subscribed plans are returned.',
        ),
    ],
    responses={200: openapi.UserVideoIntroSerializer(many=True)},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_video_intros(request):
    """사용자가 구독 중인 플랜의 영상 개론 목록 조회."""
    try:
        plan_ids = list(PlanSubscription.objects.filter(
            user=request.user,
            is_active=True
        ).values_list('plan_id', flat=True))

        requested_plan_id = request.GET.get('plan_id')
        if requested_plan_id:
            try:
                requested_plan_id = int(requested_plan_id)
                if requested_plan_id in plan_ids:
                    plan_ids = [requested_plan_id]
            except (ValueError, TypeError):
                pass

        video_intros = VideoBibleIntro.objects.filter(
            plan_id__in=plan_ids
        ).order_by('start_date')
        progress_records = UserVideoIntroProgress.objects.filter(
            user=request.user,
            video_intro__in=video_intros
        ).select_related('video_intro')

        progress_dict = {
            record.video_intro_id: {
                'is_completed': record.is_completed,
                'completed_at': record.completed_at
            } 
            for record in progress_records
        }
        result = []

        for intro in video_intros:
            intro_data = VideoBibleIntroSerializer(intro).data
            progress = progress_dict.get(intro.id)
            intro_data['is_completed'] = progress['is_completed'] if progress else False
            intro_data['completed_at'] = progress['completed_at'] if progress else None
            result.append(intro_data)

        return Response(result)
        
    except Exception as e:
        logger.error(f"[디버그] 영상 개론 목록 조회 오류: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@extend_schema(
    methods=['GET'],
    parameters=[
        OpenApiParameter('year', int, required=False, description='Record year (1-9999).'),
        OpenApiParameter('month', int, required=False, description='Record month (1-12).'),
    ],
    responses={200: openapi.HasenaRecordListItemSerializer(many=True)},
)
@extend_schema(methods=['POST'], responses={200: openapi.HasenaRecordResponseSerializer, 201: openapi.HasenaRecordResponseSerializer})
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def hasena_record_list(request):
    """하세나 기록 목록 조회 및 생성"""
    if request.method == 'GET':
        # 날짜 필터링 (선택적)
        query_serializer = HasenaRecordListQuerySerializer(data=request.query_params)
        if not query_serializer.is_valid():
            return Response(
                {'success': False, 'errors': query_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        year = query_serializer.validated_data.get('year')
        month = query_serializer.validated_data.get('month')

        records = HasenaRecord.objects.filter(user=request.user)

        if year is not None:
            records = records.filter(date__year=year)
        if month is not None:
            records = records.filter(date__month=month)
            
        # 날짜 내림차순 정렬
        records = records.order_by('-date')
        
        # 간단한 직렬화 (모델이 단순하므로 별도 시리얼라이저 없이 처리)
        data = [{
            'id': record.id,
            'date': record.date.isoformat(),
            'is_completed': record.is_completed,
            'created_at': record.created_at.isoformat()
        } for record in records]
        
        return Response(data)
    
    elif request.method == 'POST':
        serializer = HasenaRecordCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_date = serializer.validated_data['date']
        validated_is_completed = serializer.validated_data['is_completed']

        record, created = _upsert_hasena_record(
            request.user, validated_date, validated_is_completed
        )

        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({
            'id': record.id,
            'date': record.date.isoformat(),
            'is_completed': record.is_completed,
            'created_at': record.created_at.isoformat(),
            'updated_at': record.updated_at.isoformat(),
        }, status=response_status)

@extend_schema(responses={200: openapi.VideoIntroProgressResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_video_intro_progress(request):
    """영상 개론 진행 상황 업데이트"""
    try:
        raw_video_intro_id = request.data.get('video_intro_id')
        is_completed = request.data.get('is_completed', True)
        if not isinstance(is_completed, bool):
            return Response(
                {'detail': 'is_completed는 true 또는 false 값이어야 합니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if raw_video_intro_id in (None, ''):
            return Response(
                {'detail': '영상 개론 ID가 필요합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        video_intro_id = _parse_positive_id(raw_video_intro_id)
        if video_intro_id is None:
            return Response(
                {'detail': 'video_intro_id는 양의 정수여야 합니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        video_intro = VideoBibleIntro.objects.filter(
            id=video_intro_id,
            plan__plansubscription__user=request.user,
            plan__plansubscription__is_active=True,
        ).first()
        if video_intro is None:
            return Response(
                {'detail': '존재하지 않는 영상 개론입니다.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        # 진행 상황 업데이트 또는 생성
        progress, created = UserVideoIntroProgress.objects.update_or_create(
            user=request.user,
            video_intro=video_intro,
            defaults={
                'is_completed': is_completed,
                'completed_at': timezone.now() if is_completed else None
            }
        )
        
        return Response({
            'id': progress.id,
            'video_intro_id': video_intro.id,
            'is_completed': progress.is_completed,
            'completed_at': progress.completed_at.isoformat() if progress.completed_at else None
        })
        
    except Exception as e:
        logger.error(f"Error in update_video_intro_progress: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@extend_schema(
    methods=['GET'],
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Readable plan ID (positive integer).',
        ),
    ],
    responses={200: DailyBibleScheduleSerializer(many=True)},
)
@extend_schema(methods=['POST'], responses={201: DailyBibleScheduleSerializer})
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def schedule_list(request):
    """스케줄 목록 조회 및 생성"""
    if request.method == 'GET':
        plan_id = request.query_params.get('plan_id')
        schedules = _readable_schedule_queryset(request.user)
        if plan_id:
            parsed_plan_id = _parse_positive_id(plan_id)
            if not parsed_plan_id or not _can_read_plan_schedules(request.user, parsed_plan_id):
                return Response(status=404)
            schedules = schedules.filter(plan_id=parsed_plan_id)
        serializer = DailyBibleScheduleSerializer(schedules, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다."}, status=403)
            
        serializer = DailyBibleScheduleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

@extend_schema(methods=['GET'], responses={200: DailyBibleScheduleSerializer})
@extend_schema(methods=['PUT'], responses={200: DailyBibleScheduleSerializer})
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def schedule_detail(request, pk):
    """스케줄 상세 조회/수정/삭제"""
    try:
        schedule = _readable_schedule_queryset(request.user).get(pk=pk)
    except DailyBibleSchedule.DoesNotExist:
        return Response(status=404)
        
    if request.method == 'GET':
        serializer = DailyBibleScheduleSerializer(schedule)
        return Response(serializer.data)
        
    elif request.method in ['PUT', 'PATCH']:
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다."}, status=403)
            
        serializer = DailyBibleScheduleSerializer(schedule, data=request.data, partial=request.method=='PATCH')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
        
    elif request.method == 'DELETE':
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다."}, status=403)
            
        schedule.delete()
        return Response(status=204)

@extend_schema(responses={200: openapi.UploadResponseSerializer})
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, permissions.IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def upload_schedules_excel(request):
    """엑셀 파일로 세부 일정 대량 업로드"""
    try:
        plan_id = request.data.get('plan_id')
        file = request.FILES.get('file')
        update_mode = request.data.get('update_mode', 'add')  # 'add', 'update', 'replace'
        
        if not plan_id or not file:
            return Response(
                {"detail": "플랜 ID와 파일은 필수 항목입니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 파일 확장자 확인
        file_name = file.name.lower()
        if not (file_name.endswith('.xlsx') or file_name.endswith('.xls')):
            return Response(
                {"detail": "Excel 파일(.xlsx, .xls)만 업로드 가능합니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 파일 크기 제한 (5MB)
        if file.size > 5 * 1024 * 1024:
            return Response(
                {"detail": "파일 크기는 5MB를 초과할 수 없습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 플랜 존재 여부 확인
            plan = BibleReadingPlan.objects.get(id=plan_id)
            
            # 엑셀 파일 읽기
            import pandas as pd
            import re
            from datetime import datetime
            
            # 날짜 컬럼을 자동으로 datetime 객체로 변환
            df = pd.read_excel(file)
            
            # 필수 열 확인
            required_columns = ['날짜', '성경', '시작장', '끝장']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {"detail": f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            pending_rows = []
            errors = []

            for index, row in df.iterrows():
                try:
                    pending_rows.append(_parse_excel_schedule_row(row, _clean_function_upload_url))
                except Exception as e:
                    logger.warning(
                        "Invalid upload_schedules_excel row: row=%s",
                        index + 2,
                    )
                    errors.append(_build_excel_row_error(index))

            if errors:
                return _excel_upload_error_response(errors)

            success_count = 0
            with transaction.atomic():
                if update_mode == 'replace':
                    DailyBibleSchedule.objects.filter(plan=plan).delete()

                for row_data in pending_rows:
                    if update_mode in ['add', 'replace']:
                        DailyBibleSchedule.objects.create(plan=plan, **row_data)
                    else:
                        DailyBibleSchedule.objects.update_or_create(
                            plan=plan,
                            date=row_data['date'],
                            book=row_data['book'],
                            defaults={
                                'start_chapter': row_data['start_chapter'],
                                'end_chapter': row_data['end_chapter'],
                                'audio_link': row_data['audio_link'],
                                'guide_link': row_data['guide_link'],
                            }
                        )
                    success_count += 1

            return Response({
                "detail": f"{success_count}개의 일정이 처리되었습니다. 오류: 0개",
                "errors": None
            })
            
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {"detail": "해당 ID의 플랜을 찾을 수 없습니다."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in upload_schedules_excel: {str(e)}", exc_info=True)
            return Response(
                {"detail": "요청 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Error in upload_schedules_excel request: {str(e)}", exc_info=True)
        return Response(
            {"detail": "요청 처리 중 오류가 발생했습니다."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@extend_schema(
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Active public reading plan ID. Without it, all active users are counted.',
        ),
    ],
    responses={200: openapi.TotalUsersResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])  # IsAuthenticated에서 AllowAny로 변경
def get_total_users(request):
    """전체 참여자 수 조회"""
    try:
        plan_id = request.query_params.get('plan_id')
        
        if plan_id:
            plan = _get_active_public_plan(plan_id)
            if plan is None:
                return Response({
                    'success': False,
                    'error': '존재하지 않는 플랜입니다.'
                }, status=status.HTTP_404_NOT_FOUND)

            # 특정 플랜의 활성 구독자 수 반환
            total_users = PlanSubscription.objects.filter(
                plan=plan,
                is_active=True
            ).count()
        else:
            # 전체 사용자 수 반환
            total_users = User.objects.filter(is_active=True).count()
            
        return Response({
            'success': True,
            'total_users': total_users
        })
    except Exception as e:
        logger.error(f"Error in get_total_users: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=[
        OpenApiParameter('plan_id', int, required=True, description='Active public reading plan ID.'),
    ],
    responses={200: openapi.PlanStatsResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])  # IsAuthenticated, IsAdminUser에서 AllowAny로 변경
def get_plan_stats(request):
    """플랜별 통계 조회"""
    try:
        plan_id = request.query_params.get('plan_id')
        if not plan_id:
            return Response({
                'success': False,
                'error': '플랜 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        plan = _get_active_public_plan(plan_id)
        if plan is None:
            return Response({
                'success': False,
                'error': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now().date()

        # 해당 플랜의 활성 구독자 수
        total_subscribers = PlanSubscription.objects.filter(
            plan=plan,
            is_active=True
        ).count()

        # 오늘의 일정
        today_schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date=today
        )

        # 오늘 일정을 완료한 사용자 수
        completed_users = set()
        for schedule in today_schedules:
            completed_users.update(
                UserBibleProgress.objects.filter(
                    schedule=schedule,
                    is_completed=True,
                    subscription__plan=plan,
                    subscription__is_active=True
                ).values_list('subscription__user_id', flat=True)
            )

        return Response({
            'success': True,
            'plan_name': plan.name,
            'today_completed_users': len(completed_users)
        })
    except Exception as e:
        logger.error(f"Error in get_plan_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(
    parameters=[
        OpenApiParameter(
            'plan_id',
            int,
            required=False,
            description='Active public reading plan ID; defaults to the active default plan.',
        ),
    ],
    responses={200: openapi.ProgressStatsResponseSerializer},
)
@api_view(['GET'])
@permission_classes([AllowAny])  # IsAuthenticated에서 AllowAny로 변경
def get_progress_stats(request):
    """
    진행률 통계 정보를 반환하는 API
    
    [필수 파라미터]
    - plan_id: 플랜 ID
    
    [응답 예시]
    {
        "success": true,
        "plan_name": "1년 성경 통독",
        "theoretical_progress": 23.45,  // 오늘까지 완료했을 때의 이론적 진행률 (%)
        "user_progress": 18.32          // 사용자의 실제 진행률 (%)
    }
    """
    try:
        plan_id = request.query_params.get('plan_id')
        
        if not plan_id:
            # 기본 플랜 ID를 사용 (추가)
            default_plan = BibleReadingPlan.objects.filter(
                is_default=True,
                is_active=True
            ).first()
            if default_plan:
                plan_id = default_plan.id
            else:
                return Response({
                    'success': False,
                    'error': '플랜 ID가 필요합니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        plan = _get_active_public_plan(plan_id)
        if plan is None:
            return Response({
                'success': False,
                'error': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 오늘 날짜 가져오기
        today = timezone.now().date()
        
        # 1. 전체 일정 개수 계산
        total_schedules = DailyBibleSchedule.objects.filter(plan=plan).count()
        
        if total_schedules == 0:
            return Response({
                'success': False,
                'error': '이 플랜에는 일정이 없습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 2. 오늘까지의 일정 개수 계산
        today_schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date__lte=today
        ).count()
        
        # 3. 이론적 진행률 계산 (오늘까지 완료했을 때)
        theoretical_progress = (today_schedules / total_schedules) * 100
        
        # 4. 사용자가 로그인 상태인지 확인
        user_progress = 0
        if request.user.is_authenticated:
            # 사용자의 구독 확인
            subscription = PlanSubscription.objects.filter(
                user=request.user,
                plan=plan,
                is_active=True
            ).first()
            
            if subscription:
                # 사용자가 완료한 일정 개수 계산
                completed_schedules = UserBibleProgress.objects.filter(
                    subscription=subscription,
                    is_completed=True
                ).count()
                
                # 사용자 진행률 계산
                user_progress = (completed_schedules / total_schedules) * 100
        
        return Response({
            'success': True,
            'plan_name': plan.name,
            'theoretical_progress': round(theoretical_progress, 2),
            'user_progress': round(user_progress, 2)
        })
        
    except Exception as e:
        logger.error(f"Error in get_progress_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@extend_schema(responses={200: openapi.HasenaRecordUpdateResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hasena_record_update(request):
    """하세나하시조 완료/취소 처리"""
    try:
        serializer = HasenaRecordCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'success': False, 'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        record, _ = _upsert_hasena_record(
            request.user,
            serializer.validated_data['date'],
            serializer.validated_data['is_completed'],
        )
        if record.is_completed:
            on_commit_notify_hasena_completed(request.user, record.date)

        return Response({
            'success': True,
            'data': {
                'id': record.id,
                'date': record.date.isoformat(),
                'is_completed': record.is_completed,
                'created_at': record.created_at.isoformat(),
                'updated_at': record.updated_at.isoformat()
            }
        })

    except Exception as e:
        logger.error(f"Error in hasena_record_update: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@extend_schema(responses={200: openapi.HasenaStatusResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_hasena_status(request):
    """현재 사용자의 하세나 완료 상태 조회"""
    try:
        # 오늘 날짜 가져오기
        today = timezone.now().date()
        
        # 오늘의 하세나 기록 조회
        record = HasenaRecord.objects.filter(
            user=request.user,
            date=today
        ).first()
        
        return Response({
            'success': True,
            'data': {
                'id': record.id if record else None,
                'date': today.isoformat(),
                'is_completed': record.is_completed if record else False
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_user_hasena_status: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=[
        OpenApiParameter('date', OpenApiTypes.DATE, required=True, description='Hasena date (YYYY-MM-DD).'),
    ],
    responses={200: openapi.HasenaDayResponseSerializer},
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_hasena_day(request):
    date_str = request.query_params.get('date')
    if not date_str:
        return Response({
            'success': False,
            'error': 'date 파라미터가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    target_date = parse_date(date_str)
    if not target_date:
        return Response({
            'success': False,
            'error': 'date 형식은 YYYY-MM-DD 이어야 합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .services.hasena_entry_service import ensure_hasena_entry, serialize_hasena_entry

        entry = ensure_hasena_entry(target_date)
        if not entry:
            return Response({
                'success': False,
                'error': '해당 날짜의 하세나 본문을 찾을 수 없습니다.',
                'date': target_date.isoformat(),
            }, status=status.HTTP_404_NOT_FOUND)

        is_completed = False
        if request.user.is_authenticated:
            is_completed = HasenaRecord.objects.filter(
                user=request.user,
                date=entry.date,
                is_completed=True,
            ).exists()

        return Response({
            'success': True,
            'entry': serialize_hasena_entry(entry),
            'is_completed': is_completed,
        })
    except Exception as e:
        logger.error(f"Error in get_hasena_day: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '하세나 본문 조회 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=[
        OpenApiParameter('year', int, required=True, description='Calendar year (2020 or later).'),
        OpenApiParameter('month', int, required=True, description='Calendar month (1-12).'),
    ],
    responses={200: openapi.HasenaCalendarResponseSerializer},
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_hasena_calendar(request):
    try:
        year = int(request.query_params.get('year', '0'))
        month = int(request.query_params.get('month', '0'))
    except ValueError:
        return Response({
            'success': False,
            'error': 'year와 month는 숫자여야 합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    if year < 2020 or month < 1 or month > 12:
        return Response({
            'success': False,
            'error': 'year와 month 파라미터가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .services.hasena_entry_service import merge_calendar_entries

        entries = HasenaEntry.objects.filter(date__year=year, date__month=month)

        completions = []
        if request.user.is_authenticated:
            completions = list(
                HasenaRecord.objects.filter(
                    user=request.user,
                    date__year=year,
                    date__month=month,
                ).values('date', 'is_completed')
            )

        return Response({
            'success': True,
            'entries': merge_calendar_entries(entries, completions),
        })
    except Exception as e:
        logger.error(f"Error in get_hasena_calendar: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '하세나 달력 조회 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(responses={200: openapi.HasenaSyncResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def sync_hasena_entries_from_cron(request):
    secret_error = _cron_secret_error(request)
    if secret_error is not None:
        return secret_error

    try:
        from .services.hasena_entry_service import sync_hasena_entries

        max_entries = int(request.data.get('max_entries', 40))
        return Response(sync_hasena_entries(max_entries=max(1, min(max_entries, 80))))
    except ValueError:
        return Response({
            'success': False,
            'error': 'max_entries는 숫자여야 합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error in sync_hasena_entries_from_cron: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '하세나 동기화 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=[
        OpenApiParameter('video_id', str, required=True, description='Hasena video ID.'),
        OpenApiParameter(
            'date',
            OpenApiTypes.DATE,
            required=False,
            description='Video date (strict YYYY-MM-DD).',
        ),
        OpenApiParameter(
            'generate',
            bool,
            required=False,
            default=False,
            description='Generate a missing summary. Only the case-insensitive literal `true` enables generation; every other value is treated as false. Staff authentication is required when enabled.',
        ),
    ],
    responses={200: openapi.HasenaSummaryResponseSerializer},
)
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_hasena_summary(request):
    video_id = request.query_params.get('video_id')
    video_date = request.query_params.get('date')
    generate = request.query_params.get('generate', 'false').lower() == 'true'
    
    if not video_id:
        return Response({
            'success': False,
            'error': 'video_id 파라미터가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if generate and not (request.user.is_authenticated and request.user.is_staff):
        return Response({
            'success': False,
            'error': '요약 생성은 관리자만 가능합니다.'
        }, status=status.HTTP_403_FORBIDDEN)

    parsed_date = None
    if video_date:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', video_date):
            return Response({
                'success': False,
                'error': 'date 형식은 YYYY-MM-DD 이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            parsed_date = datetime.strptime(video_date, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'error': 'date 형식은 YYYY-MM-DD 이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .services.hasena_summary_service import get_hasena_summary as fetch_summary, get_existing_summary

        if generate:
            result = fetch_summary(video_id, video_date=parsed_date)
        else:
            result = get_existing_summary(video_id)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        logger.error(f"Error in get_hasena_summary: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': 'AI 요약 조회 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(responses={200: openapi.HasenaSummaryResponseSerializer, 202: openapi.HasenaSummaryPendingResponseSerializer})
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def generate_hasena_summary_from_cron(request):
    secret_error = _cron_secret_error(request)
    if secret_error is not None:
        return secret_error

    video_id = request.data.get('video_id')
    video_date = request.data.get('video_date')
    title = request.data.get('title')

    parsed_date = None
    if video_date:
        try:
            parsed_date = datetime.strptime(video_date, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'error': 'video_date 형식은 YYYY-MM-DD 이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .services.hasena_summary_service import (
            get_hasena_summary as fetch_summary,
            get_hasena_video_for_date,
            get_recent_hasena_videos,
            require_cacheable_hasena_summary_result,
        )
        from .services.hasena_monitoring import (
            capture_hasena_summary_issue,
            record_hasena_summary_heartbeat,
        )

        if video_id:
            result = fetch_summary(video_id, video_date=parsed_date, title=title)
            if result['success']:
                record_hasena_summary_heartbeat(result)
                return Response(result)
            capture_hasena_summary_issue(
                "Hasena summary cron failed for requested video",
                extra={"video_id": video_id, "reason": result.get('error')},
            )
            record_hasena_summary_heartbeat(result)
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        candidates = get_recent_hasena_videos()
        if not candidates:
            capture_hasena_summary_issue(
                "Hasena summary cron could not find recent videos",
                level="warning",
            )
            result = {
                'success': False,
                'error': '최신 하세나 영상을 찾을 수 없습니다.'
            }
            record_hasena_summary_heartbeat(result)
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)

        current_time = timezone.now()
        current_local_time = (
            timezone.localtime(current_time)
            if timezone.is_aware(current_time)
            else current_time
        )
        target_date = parsed_date or current_local_time.date()
        candidate = get_hasena_video_for_date(target_date, candidates)
        if not candidate:
            capture_hasena_summary_issue(
                "Hasena summary cron could not find target-date video",
                level="warning",
                extra={"date": target_date.isoformat()},
            )
            result = {
                'success': False,
                'status': 'pending',
                'reason': 'no_video_for_date',
                'date': target_date.isoformat(),
                'error': '오늘 날짜의 하세나 영상을 아직 찾을 수 없습니다.'
            }
            record_hasena_summary_heartbeat(result)
            return Response(result, status=status.HTTP_202_ACCEPTED)

        result = fetch_summary(
            candidate['video_id'],
            video_date=target_date,
            title=title or candidate.get('title'),
        )
        result = require_cacheable_hasena_summary_result(result)
        if result['success']:
            record_hasena_summary_heartbeat(result)
            return Response(result)

        capture_hasena_summary_issue(
            "Hasena summary cron failed for target-date video",
            extra={
                "date": target_date.isoformat(),
                "video_id": candidate['video_id'],
                "reason": result.get('error'),
            },
        )
        record_hasena_summary_heartbeat(result)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error in generate_hasena_summary_from_cron: {str(e)}", exc_info=True)
        try:
            from .services.hasena_monitoring import capture_hasena_summary_issue

            capture_hasena_summary_issue(
                "Hasena summary cron raised an exception",
                exception=e,
            )
            from .services.hasena_monitoring import record_hasena_summary_heartbeat

            record_hasena_summary_heartbeat({
                'success': False,
                'status': 'error',
                'error': 'AI 요약 생성 중 오류가 발생했습니다.',
                'reason': str(e),
            })
        except Exception:
            logger.debug("Failed to report Hasena cron exception", exc_info=True)
        return Response({
            'success': False,
            'error': 'AI 요약 생성 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(
    parameters=[
        OpenApiParameter(
            'page',
            int,
            required=False,
            default=1,
            description='Positive page number.',
        ),
        OpenApiParameter(
            'page_size',
            int,
            required=False,
            default=20,
            description='Results per page (1-100).',
        ),
    ],
    responses={200: openapi.HasenaSummaryListResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_hasena_summaries(request):
    if not request.user.is_staff:
        return Response({
            'success': False,
            'error': '관리자 권한이 필요합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    page, page_error = parse_positive_int_param(request, 'page')
    if page_error is not None:
        return page_error
    if page is None:
        page = 1

    page_size, page_size_error = parse_positive_int_param(request, 'page_size')
    if page_size_error is not None:
        return page_size_error
    if page_size is None:
        page_size = 20
    if page_size > 100:
        return Response({
            'success': False,
            'error': 'page_size는 100 이하여야 합니다.',
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .services.hasena_summary_service import list_summaries

        result = list_summaries(page=page, page_size=page_size)
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error in list_hasena_summaries: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요약 목록 조회 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(responses={200: openapi.HasenaSummaryRegenerateResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_hasena_summary(request):
    if not request.user.is_staff:
        return Response({
            'success': False,
            'error': '관리자 권한이 필요합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    video_id = request.data.get('video_id')
    if not video_id:
        return Response({
            'success': False,
            'error': 'video_id가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .services.hasena_summary_service import regenerate_summary_for_video
        
        result = regenerate_summary_for_video(video_id)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error in regenerate_hasena_summary: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요약 재생성 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(responses={200: openapi.HasenaSummaryUpdateResponseSerializer})
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_hasena_summary(request, video_id):
    if not request.user.is_staff:
        return Response({
            'success': False,
            'error': '관리자 권한이 필요합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    summary = request.data.get('summary')
    title = request.data.get('title')
    
    if not summary:
        return Response({
            'success': False,
            'error': 'summary가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .services.hasena_summary_service import update_summary
        
        result = update_summary(video_id, summary=summary, title=title)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        logger.error(f"Error in update_hasena_summary: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요약 수정 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@extend_schema(responses={200: openapi.HasenaStatsResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_hasena_stats(request):
    from datetime import timedelta
    
    try:
        today = timezone.now().date()
        records = HasenaRecord.objects.filter(
            user=request.user,
            is_completed=True
        ).order_by('-date').values_list('date', flat=True)
        
        records_set = set(records)
        total_completed = len(records_set)
        
        current_streak = 0
        check_date = today
        
        while True:
            if check_date.weekday() == 6:
                check_date -= timedelta(days=1)
                continue
            
            if check_date in records_set:
                current_streak += 1
                check_date -= timedelta(days=1)
            elif check_date == today:
                check_date -= timedelta(days=1)
            else:
                break
        
        longest_streak = current_streak
        temp_streak = 0
        sorted_dates = sorted(records_set, reverse=True)
        
        for i, date in enumerate(sorted_dates):
            if i == 0:
                temp_streak = 1
            else:
                prev_date = sorted_dates[i - 1]
                diff = (prev_date - date).days
                
                weekdays_between = 0
                check = date + timedelta(days=1)
                while check <= prev_date:
                    if check.weekday() != 6:
                        weekdays_between += 1
                    check += timedelta(days=1)
                
                if weekdays_between <= 1:
                    temp_streak += 1
                else:
                    temp_streak = 1
            
            longest_streak = max(longest_streak, temp_streak)
        
        return Response({
            'success': True,
            'data': {
                'total_completed': total_completed,
                'current_streak': current_streak,
                'longest_streak': longest_streak
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_hasena_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '통계를 불러오는 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# 성경읽기 기능 API (읽기 위치, 북마크, 묵상노트, 개인 읽기 기록)
# ============================================

from .models import UserReadingPosition, BibleBookmark, ReflectionNote, BibleHighlight, PersonalReadingRecord
from .serializers import (
    UserReadingPositionSerializer,
    BibleBookmarkSerializer,
    ReflectionNoteSerializer,
    BibleHighlightSerializer,
    PersonalReadingRecordSerializer
)
from collections import defaultdict


@extend_schema(methods=['GET'], responses={200: openapi.ReadingPositionResponseSerializer})
@extend_schema(methods=['POST'], responses={200: openapi.TodoSuccessMessageResponseSerializer})
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reading_position_view(request):
    """마지막 읽기 위치 조회/저장 API"""
    action_name = (
        'view_reading_position' if request.method == 'GET' else 'save_reading_position'
    )
    decision = can(
        subject_from_request(request),
        action_name,
        ReadingPositionCurrent(),
    )
    if not decision:
        return _authz_denial_response(decision)
    position = decision.value

    if request.method == 'GET':
        try:
            if position:
                serializer = UserReadingPositionSerializer(position)
                return Response({'success': True, 'position': serializer.data})
            return Response({'success': True, 'position': None})
        except Exception as e:
            logger.error(f"Error in reading_position_view GET: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'detail': '요청 처리 중 오류가 발생했습니다.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    elif request.method == 'POST':
        try:
            serializer = UserReadingPositionSerializer(
                position,
                data=request.data,
                partial=position is not None,
            )
            if serializer.is_valid():
                serializer.save(user=request.user)
                return Response({'success': True, 'message': '위치가 저장되었습니다'})
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error in reading_position_view POST: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'detail': '요청 처리 중 오류가 발생했습니다.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BibleBookmarkViewSet(viewsets.ModelViewSet):
    """북마크 CRUD API"""
    queryset = BibleBookmark.objects.none()
    serializer_class = BibleBookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        decision = can(
            subject_from_request(self.request),
            'list_bookmarks',
            BibleBookmarkCollection(),
        )
        if not decision:
            return BibleBookmark.objects.none()
        return decision.value

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        decision = can(
            subject_from_request(request),
            'view_bookmark',
            BibleBookmarkResource(bookmark_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(decision.value)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        decision = can(
            subject_from_request(request),
            'update_bookmark',
            BibleBookmarkResource(bookmark_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(
            decision.value, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def _existing_bookmark_response(self, bookmark):
        return Response({
            'id': bookmark.id,
            'book': bookmark.book,
            'chapter': bookmark.chapter,
            'bookmark_type': bookmark.bookmark_type,
            'title': bookmark.title,
            'already_exists': True
        }, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            decision = can(
                subject_from_request(request),
                'create_bookmark',
                BibleBookmarkCreation(owner_id=getattr(request.user, 'id', None)),
            )
            if not decision:
                return _authz_denial_response(decision)
            # 중복 북마크 체크
            data = serializer.validated_data
            bookmark_type = data.get('bookmark_type', 'chapter')
            book = data.get('book')
            chapter = data.get('chapter')

            existing_query = self.get_queryset().filter(
                book=book,
                chapter=chapter,
                bookmark_type=bookmark_type
            )

            if bookmark_type == 'verse':
                start_verse = data.get('start_verse')
                end_verse = data.get('end_verse')
                existing_query = existing_query.filter(
                    start_verse=start_verse,
                    end_verse=end_verse
                )

            if existing_query.exists():
                # 이미 존재하는 북마크 반환 (중복 생성 방지)
                return self._existing_bookmark_response(existing_query.first())

            try:
                self.perform_create(serializer)
            except IntegrityError:
                existing_bookmark = existing_query.first()
                if existing_bookmark is None:
                    raise
                return self._existing_bookmark_response(existing_bookmark)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(responses={200: todo_serializers.SuccessMessageResponseSerializer})
    def destroy(self, request, *args, **kwargs):
        decision = can(
            subject_from_request(request),
            'delete_bookmark',
            BibleBookmarkResource(bookmark_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        self.perform_destroy(decision.value)
        return Response({'success': True, 'message': '북마크가 삭제되었습니다'})

    @extend_schema(
        parameters=[
            OpenApiParameter('book', str, required=True, description='Bible book code.'),
            OpenApiParameter('chapter', int, required=True, description='Chapter number.'),
        ],
        responses={200: todo_serializers.BibleBookmarkByChapterResponseSerializer},
    )
    @action(detail=False, methods=['get'], url_path='by-chapter')
    def by_chapter(self, request, format=None):
        """특정 장의 북마크 조회"""
        book = request.query_params.get('book')
        chapter = request.query_params.get('chapter')
        if not book or not chapter:
            return Response({
                'success': False,
                'error': 'book and chapter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            chapter = int(chapter)
        except ValueError:
            return Response({
                'success': False,
                'error': 'chapter must be a number'
            }, status=status.HTTP_400_BAD_REQUEST)

        decision = can(
            subject_from_request(request),
            'view_bookmarks_by_chapter',
            BibleBookmarkChapterQuery(book=book, chapter=chapter),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(decision.value, many=True)
        return Response({'success': True, 'bookmarks': serializer.data})

    @extend_schema(responses={200: todo_serializers.SuccessMessageResponseSerializer})
    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request, format=None):
        """모든 북마크 삭제"""
        decision = can(
            subject_from_request(request),
            'clear_bookmarks',
            BibleBookmarkCollection(),
        )
        if not decision:
            return _authz_denial_response(decision)
        count, _ = decision.value.delete()
        return Response({
            'success': True,
            'message': f'{count}개의 북마크가 삭제되었습니다'
        })


class ReflectionNoteViewSet(viewsets.ModelViewSet):
    """묵상노트 CRUD API"""
    queryset = ReflectionNote.objects.none()
    serializer_class = ReflectionNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        decision = can(
            subject_from_request(self.request),
            'list_notes',
            ReflectionNoteCollection(),
        )
        if not decision:
            return ReflectionNote.objects.none()
        return decision.value

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        decision = can(
            subject_from_request(request),
            'view_note',
            ReflectionNoteResource(note_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(decision.value)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        decision = can(
            subject_from_request(request),
            'update_note',
            ReflectionNoteResource(note_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(
            decision.value, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            decision = can(
                subject_from_request(request),
                'create_note',
                ReflectionNoteCreation(owner_id=getattr(request.user, 'id', None)),
            )
            if not decision:
                return _authz_denial_response(decision)
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(responses={200: todo_serializers.SuccessMessageResponseSerializer})
    def destroy(self, request, *args, **kwargs):
        decision = can(
            subject_from_request(request),
            'delete_note',
            ReflectionNoteResource(note_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        self.perform_destroy(decision.value)
        return Response({'success': True, 'message': '묵상노트가 삭제되었습니다'})

    @extend_schema(
        parameters=[
            OpenApiParameter('book', str, required=True, description='Bible book code.'),
            OpenApiParameter('chapter', int, required=True, description='Chapter number.'),
        ],
        responses={200: todo_serializers.ReflectionNoteByChapterResponseSerializer},
    )
    @action(detail=False, methods=['get'], url_path='by-chapter')
    def by_chapter(self, request, format=None):
        """특정 장의 묵상노트 조회"""
        book = request.query_params.get('book')
        chapter = request.query_params.get('chapter')
        if not book or not chapter:
            return Response({
                'success': False,
                'error': 'book and chapter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            chapter = int(chapter)
        except ValueError:
            return Response({
                'success': False,
                'error': 'chapter must be a number'
            }, status=status.HTTP_400_BAD_REQUEST)

        decision = can(
            subject_from_request(request),
            'view_notes_by_chapter',
            ReflectionNoteChapterQuery(book=book, chapter=chapter),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(decision.value, many=True)
        return Response({'success': True, 'notes': serializer.data})

    @extend_schema(responses={200: todo_serializers.SuccessMessageResponseSerializer})
    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request, format=None):
        """모든 묵상노트 삭제"""
        decision = can(
            subject_from_request(request),
            'clear_notes',
            ReflectionNoteCollection(),
        )
        if not decision:
            return _authz_denial_response(decision)
        count, _ = decision.value.delete()
        return Response({
            'success': True,
            'message': f'{count}개의 묵상노트가 삭제되었습니다'
        })


class BibleHighlightViewSet(viewsets.ModelViewSet):
    """하이라이트 CRUD API"""
    queryset = BibleHighlight.objects.none()
    serializer_class = BibleHighlightSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        decision = can(
            subject_from_request(self.request),
            'list_highlights',
            BibleHighlightCollection(),
        )
        if not decision:
            return BibleHighlight.objects.none()
        return decision.value

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        decision = can(
            subject_from_request(request),
            'view_highlight',
            BibleHighlightResource(highlight_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(decision.value)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        decision = can(
            subject_from_request(request),
            'update_highlight',
            BibleHighlightResource(highlight_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(
            decision.value, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            decision = can(
                subject_from_request(request),
                'create_highlight',
                BibleHighlightCreation(owner_id=getattr(request.user, 'id', None)),
            )
            if not decision:
                return _authz_denial_response(decision)
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(responses={200: todo_serializers.SuccessMessageResponseSerializer})
    def destroy(self, request, *args, **kwargs):
        decision = can(
            subject_from_request(request),
            'delete_highlight',
            BibleHighlightResource(highlight_id=_authz_object_id(kwargs.get('pk'))),
        )
        if not decision:
            return _authz_denial_response(decision)
        self.perform_destroy(decision.value)
        return Response({'success': True, 'message': '하이라이트가 삭제되었습니다'})

    @extend_schema(
        parameters=[
            OpenApiParameter('book', str, required=True, description='Bible book code.'),
            OpenApiParameter('chapter', int, required=True, description='Chapter number.'),
        ],
        responses={200: todo_serializers.BibleHighlightByChapterResponseSerializer},
    )
    @action(detail=False, methods=['get'], url_path='by-chapter')
    def by_chapter(self, request, format=None):
        """특정 장의 하이라이트 조회"""
        book = request.query_params.get('book')
        chapter = request.query_params.get('chapter')
        if not book or not chapter:
            return Response({
                'success': False,
                'error': 'book and chapter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            chapter = int(chapter)
        except ValueError:
            return Response({
                'success': False,
                'error': 'chapter must be a number'
            }, status=status.HTTP_400_BAD_REQUEST)

        decision = can(
            subject_from_request(request),
            'view_highlights_by_chapter',
            BibleHighlightChapterQuery(book=book, chapter=chapter),
        )
        if not decision:
            return _authz_denial_response(decision)
        serializer = self.get_serializer(decision.value, many=True)
        return Response({'success': True, 'highlights': serializer.data})

    @extend_schema(responses={200: todo_serializers.SuccessMessageResponseSerializer})
    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request, format=None):
        """모든 하이라이트 삭제"""
        decision = can(
            subject_from_request(request),
            'clear_highlights',
            BibleHighlightCollection(),
        )
        if not decision:
            return _authz_denial_response(decision)
        count, _ = decision.value.delete()
        return Response({
            'success': True,
            'message': f'{count}개의 하이라이트가 삭제되었습니다'
        })


# 성경책별 총 장 수
BIBLE_CHAPTER_COUNTS = {
    'gen': 50, 'exo': 40, 'lev': 27, 'num': 36, 'deu': 34,
    'jos': 24, 'jdg': 21, 'rut': 4, '1sa': 31, '2sa': 24,
    '1ki': 22, '2ki': 25, '1ch': 29, '2ch': 36, 'ezr': 10,
    'neh': 13, 'est': 10, 'job': 42, 'psa': 150, 'pro': 31,
    'ecc': 12, 'sng': 8, 'isa': 66, 'jer': 52, 'lam': 5,
    'ezk': 48, 'dan': 12, 'hos': 14, 'jol': 3, 'amo': 9,
    'oba': 1, 'jon': 4, 'mic': 7, 'nam': 3, 'hab': 3,
    'zep': 3, 'hag': 2, 'zec': 14, 'mal': 4,
    'mat': 28, 'mrk': 16, 'luk': 24, 'jhn': 21, 'act': 28,
    'rom': 16, '1co': 16, '2co': 13, 'gal': 6, 'eph': 6,
    'php': 4, 'col': 4, '1th': 5, '2th': 3,
    '1ti': 6, '2ti': 4, 'tit': 3, 'phm': 1, 'heb': 13,
    'jas': 5, '1pe': 5, '2pe': 3, '1jn': 5,
    '2jn': 1, '3jn': 1, 'jud': 1, 'rev': 22,
    'jnh': 4,  # 요나서 코드 별칭 ('jon'과 동일)
}


class PersonalReadingRecordViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """개인 읽기 기록 API"""
    queryset = PersonalReadingRecord.objects.none()
    serializer_class = PersonalReadingRecordSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post']  # 삭제/수정 불가

    def get_queryset(self):
        decision = can(
            subject_from_request(self.request),
            'list_reading_records',
            PersonalReadingRecordCollection(),
        )
        if not decision:
            return PersonalReadingRecord.objects.none()
        return decision.value

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Race-safe upsert on (user, book, chapter).

        The check-then-create pattern that lived here previously raised an
        unhandled ``IntegrityError`` (HTTP 500) whenever two concurrent
        POSTs for the same (user, book, chapter) both saw
        ``existing = None`` and both tried to create — a real race the
        mobile "완독" double-tap could hit. Delegating to
        ``_upsert_personal_reading_record`` keeps the exposed semantics
        (201 on first insert, 200 on refresh) while closing the race the
        same way ``_upsert_hasena_record`` closes the Hasena race.
        """
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        decision = can(
            subject_from_request(request),
            'record_reading',
            PersonalReadingRecordCreation(owner_id=getattr(request.user, 'id', None)),
        )
        if not decision:
            return _authz_denial_response(decision)

        data = serializer.validated_data
        record, created = _upsert_personal_reading_record(
            user=request.user,
            book=data['book'],
            chapter=data['chapter'],
            read_date=data['read_date'],
        )
        response_status = (
            status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )
        return Response(self.get_serializer(record).data, status=response_status)

    @extend_schema(
        responses={200: todo_serializers.PersonalRecordStatsResponseSerializer},
    )
    @action(detail=False, methods=['get'])
    def stats(self, request, format=None):
        """읽기 통계 조회"""
        decision = can(
            subject_from_request(request),
            'view_reading_record_stats',
            PersonalReadingRecordCollection(),
        )
        if not decision:
            return _authz_denial_response(decision)
        records = decision.value

        # 책별 읽은 장 수 계산
        books_progress = defaultdict(lambda: {'read': 0, 'total': 0})
        for record in records:
            books_progress[record.book]['read'] += 1

        # 각 책의 총 장 수 추가
        for book in books_progress:
            books_progress[book]['total'] = BIBLE_CHAPTER_COUNTS.get(book, 0)

        # 완독한 책 수 계산
        books_completed = sum(
            1 for book, progress in books_progress.items()
            if progress['read'] >= progress['total'] and progress['total'] > 0
        )

        # 연속 읽기 일수 (streak) 계산
        from datetime import timedelta
        dates = records.values_list('read_date', flat=True).distinct().order_by('-read_date')
        dates_list = list(dates)

        current_streak = 0
        if dates_list:
            # KST(Asia/Seoul) 기준 오늘 계산 (컨테이너 OS 타임존이 UTC여도 정확)
            today = timezone.now().date()
            # 클라이언트가 보낸 미래 날짜는 streak 계산에서 제외
            past_dates = [read_date for read_date in dates_list if read_date <= today]

            if past_dates:
                expected_date = today
                # 오늘 안 읽었지만 어제 읽었으면 어제부터 카운트
                if past_dates[0] == today - timedelta(days=1):
                    expected_date = past_dates[0]

                for read_date in past_dates:
                    if read_date == expected_date:
                        current_streak += 1
                        expected_date -= timedelta(days=1)
                    else:
                        break

        stats = {
            'total_chapters_read': records.count(),
            'books_read': records.values('book').distinct().count(),
            'books_completed': books_completed,
            'current_streak': current_streak,
            'books_progress': dict(books_progress)
        }

        return Response({'success': True, 'stats': stats})

    @extend_schema(
        parameters=[
            OpenApiParameter('book', str, required=True, description='Bible book code.'),
        ],
        responses={200: todo_serializers.PersonalRecordsByBookResponseSerializer},
    )
    @action(detail=False, methods=['get'], url_path='by-book')
    def by_book(self, request, format=None):
        """특정 책의 읽기 기록 조회"""
        book = request.query_params.get('book')
        if not book:
            return Response({
                'success': False,
                'error': 'book required'
            }, status=status.HTTP_400_BAD_REQUEST)

        decision = can(
            subject_from_request(request),
            'view_reading_records_by_book',
            PersonalReadingRecordBookQuery(book=book),
        )
        if not decision:
            return _authz_denial_response(decision)
        records = decision.value
        serializer = self.get_serializer(records, many=True)

        # 읽은 장 목록
        read_chapters = list(records.values_list('chapter', flat=True))
        total_chapters = BIBLE_CHAPTER_COUNTS.get(book, 0)

        return Response({
            'success': True,
            'records': serializer.data,
            'read_chapters': read_chapters,
            'total_chapters': total_chapters,
            'is_completed': len(read_chapters) >= total_chapters if total_chapters > 0 else False
        })

    @extend_schema(
        responses={200: todo_serializers.PersonalRecordDatesResponseSerializer},
    )
    @action(detail=False, methods=['get'])
    def dates(self, request, format=None):
        """읽기 날짜 목록 조회 (캘린더용)"""
        decision = can(
            subject_from_request(request),
            'view_reading_dates',
            PersonalReadingRecordCollection(),
        )
        if not decision:
            return _authz_denial_response(decision)
        records = decision.value
        dates = list(
            records.values_list('read_date', flat=True)
            .distinct()
            .order_by('-read_date')
        )
        # YYYY-MM-DD 포맷으로 변환
        date_strings = [d.isoformat() for d in dates if d]
        return Response({'success': True, 'dates': date_strings})


@extend_schema(
    parameters=[
        OpenApiParameter(
            'recent_limit',
            int,
            required=False,
            default=5,
            description='Number of recent reading records to return; values are clamped to 1-50.',
        ),
    ],
    responses={200: openapi.BibleHomeStatsResponseSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bible_home_stats(request):
    """
    성경 홈 화면용 통합 통계 API
    북마크, 노트, 하이라이트 카운트와 최근 읽은 기록을 효율적으로 반환
    """
    user = request.user
    limit = _parse_bounded_limit(
        request.query_params.get('recent_limit'), default=5, maximum=50
    )
    if limit is None:
        return Response({
            'success': False,
            'error': 'recent_limit 값이 올바르지 않습니다.',
        }, status=status.HTTP_400_BAD_REQUEST)

    # 카운트만 조회 (데이터 전체를 가져오지 않음)
    bookmark_count = BibleBookmark.objects.filter(user=user).count()
    note_count = ReflectionNote.objects.filter(user=user).count()
    highlight_count = BibleHighlight.objects.filter(user=user).count()

    # 최근 읽은 기록 (limit 개수만)
    recent_records = PersonalReadingRecord.objects.filter(user=user).order_by('-read_date', '-id')[:limit]
    recent_records_data = [
        {
            'book': r.book,
            'chapter': r.chapter,
            'read_date': r.read_date.isoformat() if r.read_date else None
        }
        for r in recent_records
    ]

    return Response({
        'bookmarks': bookmark_count,
        'notes': note_count,
        'highlights': highlight_count,
        'recent_records': recent_records_data
    }) 

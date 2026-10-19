from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import urlencode

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from accounts.models import Follow
from accounts.services.member_activity import eligible_members
from todos.models import (
    DailyBibleSchedule,
    HasenaRecord,
    Notification,
    NotificationSettings,
    PlanSubscription,
    PersonalReadingRecord,
    UserBibleProgress,
)


def get_notification_settings(user):
    settings, _ = NotificationSettings.objects.get_or_create(user=user)
    return settings


def ensure_reminder_notifications(user):
    if not eligible_members().filter(pk=user.pk).exists():
        return
    settings = get_notification_settings(user)
    _send_reminders_for_settings_batch([settings])


def send_due_reminder_notifications():
    settings_iterable = NotificationSettings.objects.filter(
        notifications_enabled=True,
        user_id__in=eligible_members().values('pk'),
    ).select_related('user')
    return _send_reminders_for_settings_batch(settings_iterable)


_READING_REMINDER = {
    'notification_type': 'reading_reminder',
    'title': '오늘의 통독이 기다리고 있어요',
    'body': '오늘 배정된 말씀을 읽고 흐름을 이어가볼까요?',
    'target_url': '/bible',
}
_HASENA_REMINDER = {
    'notification_type': 'hasena_reminder',
    'title': '오늘의 하세나하시조를 함께해요',
    'body': '잠시 멈추고 말씀을 마음에 새겨보세요.',
    'target_url': '/hasena',
}
_STREAK_REMINDER = {
    'notification_type': 'streak_reminder',
    'title': '연속 기록이 끊어질 수 있어요',
    'body': '오늘의 말씀을 읽고 연속 기록을 이어가볼까요?',
    'target_url': '/bible',
}

_REMINDER_TEMPLATES = {
    'reading': _READING_REMINDER,
    'hasena': _HASENA_REMINDER,
    'streak': _STREAK_REMINDER,
}


def _send_reminders_for_settings_batch(settings_iterable):
    candidates = _build_due_candidates(settings_iterable)
    if not candidates:
        return 0

    candidates = _drop_already_created(candidates)
    if not candidates:
        return 0

    _mark_eligible_reading([c for c in candidates if c['kind'] == 'reading'])
    _mark_eligible_hasena([c for c in candidates if c['kind'] == 'hasena'])
    _mark_eligible_streak([c for c in candidates if c['kind'] == 'streak'])

    # 같은 슬롯에 일반 통독 리마인더가 나가면 연속 기록 경고는 중복이다.
    reading_due_users = {
        c['user_id']
        for c in candidates
        if c['kind'] == 'reading' and c['eligible']
    }

    created_count = 0
    for candidate in candidates:
        if not candidate['eligible']:
            continue
        if candidate['kind'] == 'streak' and candidate['user_id'] in reading_due_users:
            continue
        template = dict(_REMINDER_TEMPLATES[candidate['kind']])
        if candidate.get('target_url'):
            template['target_url'] = candidate['target_url']
        if candidate.get('streak_scope') == 'plan':
            template['title'] = '통독 연속 기록을 이어가세요'
        _notification, created = _create_notification(
            recipient=candidate['user'],
            dedupe_key=candidate['dedupe_key'],
            data={
                'local_date': candidate['local_date'].isoformat(),
                **({'streak_scope': candidate['streak_scope'],
                    'reading_date': _server_today().isoformat()}
                   if candidate['kind'] == 'streak' else {}),
            },
            **template,
        )
        created_count += int(created)
    return created_count


def _build_due_candidates(settings_iterable):
    candidates = []
    for settings in settings_iterable:
        if not settings.notifications_enabled:
            continue
        if _is_paused(settings):
            continue
        local_now = _local_now(settings)
        local_date = local_now.date()
        if local_date.weekday() not in settings.reminder_weekdays:
            continue
        if settings.reading_reminders_enabled and _is_due(local_now, settings.reading_reminder_time):
            candidates.append({
                'kind': 'reading',
                'user': settings.user,
                'user_id': settings.user_id,
                'local_date': local_date,
                'dedupe_key': f'reading-reminder:{settings.user_id}:{local_date.isoformat()}',
                'eligible': False,
            })
        if (settings.hasena_reminders_enabled and local_date.weekday() != 6
                and _is_due(local_now, settings.hasena_reminder_time)):
            candidates.append({
                'kind': 'hasena',
                'user': settings.user,
                'user_id': settings.user_id,
                'local_date': local_date,
                'dedupe_key': f'hasena-reminder:{settings.user_id}:{local_date.isoformat()}',
                'eligible': False,
            })
        if settings.streak_reminders_enabled and _is_due(local_now, settings.streak_reminder_time):
            candidates.append({
                'kind': 'streak',
                'user': settings.user,
                'user_id': settings.user_id,
                'local_date': local_date,
                'dedupe_key': f'streak-reminder:{settings.user_id}:{local_date.isoformat()}',
                'eligible': False,
            })
    return candidates


def _is_paused(settings):
    paused_until = settings.paused_until
    return paused_until is not None and paused_until > timezone.now()


def _drop_already_created(candidates):
    user_ids = {c['user_id'] for c in candidates}
    dedupe_keys = {c['dedupe_key'] for c in candidates}
    existing = set(
        Notification.objects.filter(
            recipient_id__in=user_ids,
            dedupe_key__in=dedupe_keys,
        ).values_list('recipient_id', 'dedupe_key')
    )
    reading_in_this_slot = {
        c['user_id'] for c in candidates
        if c['kind'] == 'reading' and (c['user_id'], c['dedupe_key']) in existing
    }
    return [
        c for c in candidates
        if (c['user_id'], c['dedupe_key']) not in existing
        and not (c['kind'] == 'streak' and c['user_id'] in reading_in_this_slot)
    ]


def _mark_eligible_reading(candidates):
    if not candidates:
        return
    from todos.serializers import BIBLE_BOOKS_KOR

    book_codes = {name: code for code, name in BIBLE_BOOKS_KOR.items()}

    user_ids = {c['user_id'] for c in candidates}
    local_dates = {c['local_date'] for c in candidates}

    subscriptions = list(
        PlanSubscription.objects.filter(
            user_id__in=user_ids,
            is_active=True,
        ).values('id', 'user_id', 'plan_id')
    )
    subs_by_user = defaultdict(list)
    for sub in subscriptions:
        subs_by_user[sub['user_id']].append(sub)

    plan_ids = {sub['plan_id'] for sub in subscriptions}
    schedules_by_plan_date = defaultdict(list)
    schedules_by_id = {}
    if plan_ids:
        for row in DailyBibleSchedule.objects.filter(
            plan_id__in=plan_ids,
            date__in=local_dates,
        ).order_by('id').values('id', 'plan_id', 'date', 'book', 'start_chapter'):
            schedules_by_plan_date[(row['plan_id'], row['date'])].append(row['id'])
            schedules_by_id[row['id']] = row

    all_subscription_ids = set()
    all_schedule_ids = set()
    per_candidate = {}
    for candidate in candidates:
        user_subs = subs_by_user.get(candidate['user_id'], [])
        subscription_ids = {sub['id'] for sub in user_subs}
        today_schedule_ids = set()
        for sub in user_subs:
            today_schedule_ids.update(
                schedules_by_plan_date.get((sub['plan_id'], candidate['local_date']), [])
            )
        per_candidate[id(candidate)] = (subscription_ids, today_schedule_ids)
        all_subscription_ids |= subscription_ids
        all_schedule_ids |= today_schedule_ids

    completed_pairs = set()
    if all_subscription_ids and all_schedule_ids:
        completed_pairs = set(
            UserBibleProgress.objects.filter(
                subscription_id__in=all_subscription_ids,
                schedule_id__in=all_schedule_ids,
                is_completed=True,
            ).values_list('subscription_id', 'schedule_id')
        )

    for candidate in candidates:
        subscription_ids, today_schedule_ids = per_candidate[id(candidate)]
        if not subscription_ids or not today_schedule_ids:
            continue
        completed_count = sum(
            1
            for (sub_id, sch_id) in completed_pairs
            if sub_id in subscription_ids and sch_id in today_schedule_ids
        )
        if completed_count < len(today_schedule_ids):
            candidate['eligible'] = True
            for sub in subs_by_user[candidate['user_id']]:
                pending = [
                    schedule_id
                    for schedule_id in schedules_by_plan_date[(sub['plan_id'], candidate['local_date'])]
                    if (sub['id'], schedule_id) not in completed_pairs
                ]
                if pending:
                    row = schedules_by_id[pending[0]]
                    candidate['target_url'] = '/bible?' + urlencode({
                        'book': book_codes.get(row['book'], row['book']),
                        'chapter': row['start_chapter'], 'plan': sub['plan_id'], 'tongdok': 'true',
                    })
                    break


def _mark_eligible_streak(candidates):
    """일반 읽기와 통독 기록 각각의 서울 기준 연속 기록을 확인한다."""
    if not candidates:
        return

    user_ids = {c['user_id'] for c in candidates}
    server_today = _server_today()
    yesterday = server_today - timedelta(days=1)
    personal_dates = defaultdict(set)
    for user_id, read_date in PersonalReadingRecord.objects.filter(
        user_id__in=user_ids, read_date__in=[yesterday, server_today],
    ).values_list('user_id', 'read_date'):
        personal_dates[user_id].add(read_date)

    completed_dates_by_user = defaultdict(set)
    for user_id, completed_date in UserBibleProgress.objects.filter(
        subscription__user_id__in=user_ids,
        subscription__is_active=True,
        is_completed=True,
        schedule__date__gte=yesterday,
        schedule__date__lte=server_today,
    ).values_list('subscription__user_id', 'schedule__date'):
        completed_dates_by_user[user_id].add(completed_date)

    plan_candidates = []
    for candidate in candidates:
        user_id = candidate['user_id']
        personal = personal_dates[user_id]
        if yesterday in personal and server_today not in personal:
            candidate.update(eligible=True, streak_scope='personal', target_url='/bible')
            continue
        completed_dates = completed_dates_by_user.get(user_id, set())
        if yesterday in completed_dates and server_today not in completed_dates:
            plan_candidate = dict(candidate, local_date=server_today)
            plan_candidates.append((candidate, plan_candidate))
    _mark_eligible_reading([plan for _original, plan in plan_candidates])
    for candidate, plan in plan_candidates:
        if plan['eligible']:
            candidate.update(eligible=True, streak_scope='plan', target_url=plan['target_url'])


def _server_today():
    now = timezone.now()
    if timezone.is_naive(now):
        now = timezone.make_aware(now, timezone.get_default_timezone())
    return now.astimezone(ZoneInfo('Asia/Seoul')).date()


def _mark_eligible_hasena(candidates):
    if not candidates:
        return

    user_ids = {c['user_id'] for c in candidates}
    local_dates = {c['local_date'] for c in candidates}
    completed = set(
        HasenaRecord.objects.filter(
            user_id__in=user_ids,
            date__in=local_dates,
            is_completed=True,
        ).values_list('user_id', 'date')
    )
    for candidate in candidates:
        if (candidate['user_id'], candidate['local_date']) not in completed:
            candidate['eligible'] = True


def notify_friend_reading_completed(actor, schedules):
    schedule = schedules[0] if schedules else None
    if schedule is None:
        return

    label = f'{schedule.book} {schedule.start_chapter}장'
    if schedule.end_chapter != schedule.start_chapter:
        label = f'{schedule.book} {schedule.start_chapter}-{schedule.end_chapter}장'

    for recipient in _friend_recipients(actor):
        _create_notification(
            recipient=recipient,
            actor=actor,
            notification_type='friend_activity',
            title=f'{actor.nickname}님이 통독을 완료했어요',
            body=f'{label} 읽기를 마쳤어요. 함께 응원해 주세요!',
            target_url=f'/profile/{actor.id}',
            data={'activity': 'reading', 'actor_id': actor.id},
            dedupe_key=f'friend-reading:{recipient.id}:{actor.id}:{schedule.id}',
        )


def notify_friend_hasena_completed(actor, completed_date):
    for recipient in _friend_recipients(actor):
        _create_notification(
            recipient=recipient,
            actor=actor,
            notification_type='friend_activity',
            title=f'{actor.nickname}님이 하세나하시조를 완료했어요',
            body='오늘 묵상도 이어갔어요. 동행을 응원해 주세요!',
            target_url=f'/profile/{actor.id}',
            data={'activity': 'hasena', 'actor_id': actor.id},
            dedupe_key=f'friend-hasena:{recipient.id}:{actor.id}:{completed_date.isoformat()}',
        )


def mark_all_read(user):
    return Notification.objects.filter(recipient=user, read_at__isnull=True).update(
        read_at=timezone.now(),
    )


def _friend_recipients(actor):
    following_ids = Follow.objects.filter(follower=actor).values_list('following_id', flat=True)
    recipient_ids = Follow.objects.filter(
        following=actor,
        follower_id__in=following_ids,
    ).values_list('follower_id', flat=True)

    return list(
        eligible_members(actor.__class__.objects.filter(id__in=recipient_ids)).filter(
            Q(notification_settings__isnull=True)
            | Q(
                notification_settings__notifications_enabled=True,
                notification_settings__friend_activity_enabled=True,
            )
        )
    )


def _local_now(settings):
    try:
        user_timezone = ZoneInfo(settings.timezone)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        user_timezone = ZoneInfo('Asia/Seoul')
    now = timezone.now()
    if timezone.is_naive(now):
        now = timezone.make_aware(now, timezone.get_default_timezone())
    return now.astimezone(user_timezone)


def _is_due(local_now, reminder_time):
    due_at = datetime.combine(local_now.date(), reminder_time, tzinfo=local_now.tzinfo)
    return timedelta(0) <= local_now - due_at < timedelta(minutes=30)


@transaction.atomic
def _create_notification(
    recipient,
    notification_type,
    title,
    body,
    target_url='',
    actor=None,
    data=None,
    dedupe_key='',
):
    defaults = {
        'actor': actor,
        'type': notification_type,
        'title': title,
        'body': body,
        'target_url': target_url,
        'data': data or {},
    }
    if dedupe_key:
        recipient.__class__.objects.select_for_update().get(pk=recipient.pk)
        try:
            notification, created = Notification.objects.get_or_create(
                recipient=recipient,
                dedupe_key=dedupe_key,
                defaults=defaults,
            )
        except Notification.MultipleObjectsReturned:
            notification = Notification.objects.filter(
                recipient=recipient,
                dedupe_key=dedupe_key,
            ).order_by('created_at', 'id').first()
            return notification, False
        if created:
            _queue_push_delivery(notification)
        return notification, created

    notification = Notification.objects.create(recipient=recipient, **defaults)
    _queue_push_delivery(notification)
    return notification, True


def on_commit_notify_reading_completed(actor, schedules):
    schedule_list = list(schedules)
    transaction.on_commit(lambda: notify_friend_reading_completed(actor, schedule_list))


def on_commit_notify_hasena_completed(actor, completed_date):
    transaction.on_commit(lambda: notify_friend_hasena_completed(actor, completed_date))


def _queue_push_delivery(notification):
    from todos.tasks import deliver_notification_push_task

    transaction.on_commit(lambda: deliver_notification_push_task.delay(notification.id), robust=True)

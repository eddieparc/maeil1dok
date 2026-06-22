from django.db import transaction
from django.utils import timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from accounts.models import Follow
from todos.models import (
    HasenaRecord,
    Notification,
    NotificationSettings,
    PlanSubscription,
    UserBibleProgress,
)


def get_notification_settings(user):
    settings, _ = NotificationSettings.objects.get_or_create(user=user)
    return settings


def ensure_reminder_notifications(user):
    settings = get_notification_settings(user)
    _ensure_reminders_for_settings(settings)


def send_due_reminder_notifications():
    created_count = 0
    for settings in NotificationSettings.objects.filter(
        notifications_enabled=True,
    ).select_related('user'):
        created_count += _ensure_reminders_for_settings(settings)
    return created_count


def _ensure_reminders_for_settings(settings):
    if not settings.notifications_enabled:
        return 0

    local_now = _local_now(settings)
    today = local_now.date()
    created_count = 0
    if (
        settings.reading_reminders_enabled
        and _is_due(local_now, settings.reading_reminder_time)
        and _has_incomplete_today_schedule(settings.user, today)
    ):
        _notification, created = _create_notification(
            recipient=settings.user,
            notification_type='reading_reminder',
            title='오늘의 통독이 기다리고 있어요',
            body='오늘 배정된 말씀을 읽고 흐름을 이어가볼까요?',
            target_url='/plan',
            dedupe_key=f'reading-reminder:{settings.user_id}:{today.isoformat()}',
        )
        created_count += int(created)

    if (
        settings.hasena_reminders_enabled
        and _is_due(local_now, settings.hasena_reminder_time)
        and not _has_completed_hasena(settings.user, today)
    ):
        _notification, created = _create_notification(
            recipient=settings.user,
            notification_type='hasena_reminder',
            title='오늘의 하세나하시조를 함께해요',
            body='잠시 멈추고 말씀을 마음에 새겨보세요.',
            target_url='/hasena',
            dedupe_key=f'hasena-reminder:{settings.user_id}:{today.isoformat()}',
        )
        created_count += int(created)
    return created_count


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


def _has_incomplete_today_schedule(user, today):
    subscriptions = PlanSubscription.objects.filter(user=user, is_active=True)
    if not subscriptions.exists():
        return False

    today_schedule_ids = []
    for subscription in subscriptions.select_related('plan'):
        today_schedule_ids.extend(subscription.plan.schedules.filter(date=today).values_list('id', flat=True))

    if not today_schedule_ids:
        return False

    completed_count = UserBibleProgress.objects.filter(
        subscription__in=subscriptions,
        schedule_id__in=today_schedule_ids,
        is_completed=True,
    ).count()
    return completed_count < len(today_schedule_ids)


def _has_completed_hasena(user, today):
    return HasenaRecord.objects.filter(
        user=user,
        date=today,
        is_completed=True,
    ).exists()


def _friend_recipients(actor):
    following_ids = Follow.objects.filter(follower=actor).values_list('following_id', flat=True)
    recipient_ids = Follow.objects.filter(
        following=actor,
        follower_id__in=following_ids,
    ).values_list('follower_id', flat=True)

    users = actor.__class__.objects.filter(id__in=recipient_ids)
    return [
        user for user in users
        if _friend_activity_enabled(user)
    ]


def _friend_activity_enabled(user):
    settings = get_notification_settings(user)
    return settings.notifications_enabled and settings.friend_activity_enabled


def _local_now(settings):
    try:
        user_timezone = ZoneInfo(settings.timezone)
    except ZoneInfoNotFoundError:
        user_timezone = ZoneInfo('Asia/Seoul')
    return timezone.now().astimezone(user_timezone)


def _is_due(local_now, reminder_time):
    return local_now.time() >= reminder_time


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
        notification, created = Notification.objects.get_or_create(
            recipient=recipient,
            dedupe_key=dedupe_key,
            defaults=defaults,
        )
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
    from todos.services.push_notifications import deliver_push_notification

    transaction.on_commit(lambda: deliver_push_notification(notification.id))

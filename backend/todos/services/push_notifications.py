import json
import logging
from hashlib import sha256
from dataclasses import dataclass
from datetime import date, datetime, time as dt_time, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings as django_settings
from django.db import models, transaction
from django.utils import timezone
from config.observability import capture_observability_event

from todos.models import (
    HasenaRecord,
    NativePushSubscription,
    NativePushReceipt,
    Notification,
    NotificationPushSubscription,
    NotificationSettings,
)
from todos.services.expo_push import (
    EXPO_RECEIPT_BATCH_SIZE, ExpoDeliveryError, send_expo_push, fetch_expo_receipts,
)
from todos.services.notifications import (
    _local_now as _local_now_for, _is_due, _mark_eligible_reading, _mark_eligible_streak,
)
from accounts.services.member_activity import eligible_members

logger = logging.getLogger(__name__)

DEFAULT_PUSH_TTL_SECONDS = 24 * 60 * 60
EXPO_ANDROID_CHANNEL_ID = 'reading-reminders'


class PushFailureResponse(Protocol):
    status_code: int


@dataclass(frozen=True, slots=True)
class PushDeliveryError(Exception):
    response: PushFailureResponse | None = None


def is_web_push_configured():
    return bool(
        django_settings.WEB_PUSH_VAPID_PUBLIC_KEY
        and django_settings.WEB_PUSH_VAPID_PRIVATE_KEY
        and django_settings.WEB_PUSH_VAPID_SUBJECT
    )


def web_push_public_key():
    return django_settings.WEB_PUSH_VAPID_PUBLIC_KEY


def deliver_push_notification(notification_id):
    notification = Notification.objects.filter(id=notification_id).select_related('recipient').first()
    if notification is None:
        return {'sent': 0, 'failed': 0, 'skipped': 'missing_notification'}

    web_configured = is_web_push_configured()
    # Commit the claim before contacting a provider. A task redelivery after an
    # ambiguous network timeout must never repeat an already attempted push.
    with transaction.atomic():
        notification.recipient.__class__.objects.select_for_update().get(pk=notification.recipient_id)
        notification.refresh_from_db()
        if notification.push_attempted_at is not None:
            return {'sent': 0, 'failed': 0, 'skipped': 'already_attempted'}
        if not eligible_members().filter(pk=notification.recipient_id).exists():
            return {'sent': 0, 'failed': 0, 'skipped': 'account_paused'}
        settings, _created = NotificationSettings.objects.get_or_create(user=notification.recipient)
        if not _notification_type_enabled(settings, notification.type):
            return {'sent': 0, 'failed': 0, 'skipped': 'disabled_by_user'}
        local_now = _local_now_for(settings)
        local_date = _notification_local_date(notification)
        if settings.paused_until is not None and settings.paused_until > timezone.now():
            return {'sent': 0, 'failed': 0, 'skipped': 'paused'}
        if _in_quiet_hours(settings, local_now):
            return {'sent': 0, 'failed': 0, 'skipped': 'quiet_hours'}
        if local_date is not None and local_date != local_now.date():
            return {'sent': 0, 'failed': 0, 'skipped': 'stale'}
        if not _reminder_still_relevant(notification, local_date):
            return {'sent': 0, 'failed': 0, 'skipped': 'no_longer_relevant'}
        reminder_time = {
            'reading_reminder': settings.reading_reminder_time,
            'hasena_reminder': settings.hasena_reminder_time,
            'streak_reminder': settings.streak_reminder_time,
        }.get(notification.type)
        if reminder_time is not None:
            if local_now.weekday() not in settings.reminder_weekdays:
                return {'sent': 0, 'failed': 0, 'skipped': 'weekday_off'}
            if local_date is not None and not _is_due(local_now, reminder_time):
                return {'sent': 0, 'failed': 0, 'skipped': 'stale'}
        if _daily_push_count(notification.recipient, local_now.date(), settings) >= settings.daily_push_limit:
            return {'sent': 0, 'failed': 0, 'skipped': 'daily_limit'}
        has_web = web_configured and NotificationPushSubscription.objects.filter(
            user=notification.recipient, enabled=True,
        ).exists()
        has_native = NativePushSubscription.objects.filter(user=notification.recipient, enabled=True).exists()
        if not has_web and not has_native:
            return {'sent': 0, 'failed': 0,
                    'skipped': 'no_subscriptions' if web_configured else 'not_configured'}
        notification.push_attempted_at = timezone.now()
        notification.save(update_fields=['push_attempted_at'])

    sent = 0
    failed = 0

    if web_configured:
        payload = _push_payload(notification)
        subscriptions = NotificationPushSubscription.objects.filter(
            user=notification.recipient,
            enabled=True,
        )
        for subscription in subscriptions:
            try:
                _send_web_push(_subscription_info(subscription), payload)
                NotificationPushSubscription.objects.filter(id=subscription.id).update(
                    failure_count=0,
                    last_success_at=timezone.now(),
                )
                sent += 1
                _record_push_outcome('accepted', subscription, notification)
            except PushDeliveryError as exc:
                failed += 1
                outcome = _classify_push_failure(exc)
                _handle_push_failure(subscription, exc)
                _record_push_outcome(outcome, subscription, notification)

    native_subscriptions = NativePushSubscription.objects.filter(
        user=notification.recipient,
        enabled=True,
    )
    for subscription in native_subscriptions:
        with transaction.atomic():
            subscription = NativePushSubscription.objects.select_for_update().filter(
                pk=subscription.pk, user=notification.recipient, enabled=True,
            ).first()
            if subscription is None:
                continue
            try:
                ticket = send_expo_push(
                    subscription.token,
                    _build_expo_message(notification, subscription),
                )
            except ExpoDeliveryError as exc:
                failed += 1
                _handle_native_send_failure(subscription, exc)
            else:
                sent += 1
                NativePushReceipt.objects.create(
                    subscription=subscription, notification=notification,
                    ticket_id=ticket['id'],
                    token_fingerprint=sha256(subscription.token.encode()).hexdigest(),
                    subscription_generation=subscription.generation,
                )
                NativePushSubscription.objects.filter(id=subscription.id).update(
                    failure_count=0,
                    last_success_at=timezone.now(),
                    last_ticket_id=ticket.get('id'),
                )
                _record_push_outcome('accepted', subscription, notification)

    if sent:
        Notification.objects.filter(pk=notification.pk).update(push_sent_at=timezone.now())
    return {'sent': sent, 'failed': failed}


def _handle_native_send_failure(subscription, exc):
    error_code = getattr(exc, 'error_code', None)
    if error_code == 'DeviceNotRegistered':
        NativePushSubscription.objects.filter(id=subscription.id).update(
            enabled=False,
            last_failure_at=timezone.now(),
        )
        logger.info('Disabled native push subscription after DeviceNotRegistered')
        return
    NativePushSubscription.objects.filter(id=subscription.id).update(
        failure_count=models.F('failure_count') + 1,
        last_failure_at=timezone.now(),
    )
    logger.warning(
        'Native push send failed (code=%s)',
        error_code or exc.__class__.__name__,
    )


def check_expo_push_receipts():
    now = timezone.now()
    pending = list(NativePushReceipt.objects.filter(
        checked_at__isnull=True, created_at__lte=now - timedelta(minutes=15),
    ).select_related('subscription', 'notification').order_by('id')[:EXPO_RECEIPT_BATCH_SIZE])
    ticket_ids = [row.ticket_id for row in pending if row.created_at >= now - timedelta(hours=24)]
    receipts = fetch_expo_receipts(ticket_ids) or {}
    checked = disabled = 0
    for row in pending:
        receipt = receipts.get(row.ticket_id)
        if row.created_at < now - timedelta(hours=24):
            receipt = {'status': 'error', 'details': {'error': 'ReceiptExpired'}}
        if not isinstance(receipt, dict) or receipt.get('status') not in ('ok', 'error'):
            continue
        error_code = (receipt.get('details') or {}).get('error', '')
        if not NativePushReceipt.objects.filter(pk=row.pk, checked_at__isnull=True).update(
            checked_at=now, error_code=error_code,
        ):
            continue
        checked += 1
        subscription = row.subscription
        same_token = sha256(subscription.token.encode()).hexdigest() == row.token_fingerprint
        if error_code == 'DeviceNotRegistered' and same_token:
            disabled += NativePushSubscription.objects.filter(
                pk=subscription.pk, token=subscription.token, enabled=True,
                generation=row.subscription_generation,
            ).update(enabled=False, last_failure_at=now)
        NativePushSubscription.objects.filter(
            pk=subscription.pk, last_ticket_id=row.ticket_id,
        ).update(last_ticket_id=None)
        if error_code:
            _record_push_outcome(error_code, subscription, row.notification)
    return {'checked': checked, 'disabled': disabled}


def _build_expo_message(notification, subscription):
    return {
        'to': subscription.token,
        'title': notification.title,
        'body': notification.body,
        'sound': 'default',
        'channelId': EXPO_ANDROID_CHANNEL_ID,
        'ttl': _push_ttl_seconds(notification),
        'data': {
            'notification_id': notification.id,
            'type': notification.type,
            'url': notification.target_url or '/notifications',
            'origin': _notification_origin(),
        },
    }


def _notification_origin():
    """Canonical frontend origin for deep links (beta/prod safe)."""
    return getattr(django_settings, 'FRONTEND_URL', '') or ''


def _push_ttl_seconds(notification):
    """Do not let a delayed device receive yesterday's or hours-old reminders."""
    local_date = _notification_local_date(notification)
    if local_date is None:
        return DEFAULT_PUSH_TTL_SECONDS
    settings_obj, _ = NotificationSettings.objects.get_or_create(
        user=notification.recipient
    )
    tz = _settings_timezone(settings_obj)
    end_of_day = datetime.combine(
        local_date + timedelta(days=1), dt_time.min, tzinfo=tz
    )
    remaining = int((end_of_day - _local_now_for(settings_obj)).total_seconds())
    reminder_time = {
        'reading_reminder': settings_obj.reading_reminder_time,
        'hasena_reminder': settings_obj.hasena_reminder_time,
        'streak_reminder': settings_obj.streak_reminder_time,
    }.get(notification.type)
    if reminder_time is not None:
        expires_at = datetime.combine(local_date, reminder_time, tzinfo=tz) + timedelta(minutes=30)
        remaining = min(remaining, int((expires_at - _local_now_for(settings_obj)).total_seconds()))
    return max(remaining, 0)


def _notification_local_date(notification):
    raw = (notification.data or {}).get('local_date')
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except (TypeError, ValueError):
        return None


def _settings_timezone(settings_obj):
    try:
        return ZoneInfo(settings_obj.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo('Asia/Seoul')


def _in_quiet_hours(settings_obj, local_now):
    if not settings_obj.quiet_hours_enabled:
        return False
    start = settings_obj.quiet_hours_start
    end = settings_obj.quiet_hours_end
    if start == end:
        return False
    current = local_now.time()
    if start < end:
        return start <= current < end
    return current >= start or current < end


def _daily_push_count(user, local_date, settings_obj):
    """Count committed delivery claims, not inbox creation or device count."""
    tz = _settings_timezone(settings_obj)
    day_start = datetime.combine(local_date, dt_time.min, tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    if not django_settings.USE_TZ:
        day_start = timezone.make_naive(day_start, timezone.get_default_timezone())
        day_end = timezone.make_naive(day_end, timezone.get_default_timezone())
    return Notification.objects.filter(
        recipient=user,
        push_attempted_at__gte=day_start,
        push_attempted_at__lt=day_end,
    ).count()


def _reminder_still_relevant(notification, local_date):
    """생성과 발송 사이에 완료됐거나 날짜가 지난 리마인더는 보내지 않는다."""
    if local_date is None:
        return True
    if notification.type == 'reading_reminder':
        candidate = {'user_id': notification.recipient_id, 'local_date': local_date, 'eligible': False}
        _mark_eligible_reading([candidate])
        return candidate['eligible']
    if notification.type == 'hasena_reminder':
        return not HasenaRecord.objects.filter(
            user=notification.recipient,
            date=local_date,
            is_completed=True,
        ).exists()
    if notification.type == 'streak_reminder':
        candidate = {'user_id': notification.recipient_id, 'local_date': local_date, 'eligible': False}
        _mark_eligible_streak([candidate])
        scope = notification.data.get('streak_scope')
        return candidate['eligible'] and (scope is None or candidate.get('streak_scope') == scope)
    return True


def _send_web_push(subscription_info, payload):
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=django_settings.WEB_PUSH_VAPID_PRIVATE_KEY,
            vapid_claims={'sub': django_settings.WEB_PUSH_VAPID_SUBJECT},
            ttl=86400,
            timeout=5,
        )
    except WebPushException as exc:
        raise PushDeliveryError(response=getattr(exc, 'response', None)) from exc


def _subscription_info(subscription):
    return {
        'endpoint': subscription.endpoint,
        'keys': {
            'p256dh': subscription.p256dh,
            'auth': subscription.auth,
        },
    }


def _push_payload(notification):
    return {
        'title': notification.title,
        'body': notification.body,
        'url': notification.target_url or '/notifications',
        'origin': _notification_origin(),
        'tag': notification.dedupe_key or f'notification:{notification.id}',
        'type': notification.type,
        'notification_id': notification.id,
        'created_at': notification.created_at.isoformat(),
        'data': {
            **(notification.data or {}),
            'origin': _notification_origin(),
            'url': notification.target_url or '/notifications',
        },
    }


def _notification_type_enabled(settings, notification_type):
    if not settings.notifications_enabled:
        return False
    if notification_type == 'reading_reminder':
        return settings.reading_reminders_enabled
    if notification_type == 'hasena_reminder':
        return settings.hasena_reminders_enabled
    if notification_type == 'streak_reminder':
        return settings.streak_reminders_enabled
    if notification_type == 'friend_activity':
        return settings.friend_activity_enabled
    return True


def _record_push_outcome(outcome, subscription, notification):
    capture_observability_event(
        'Native Push delivery outcome' if isinstance(subscription, NativePushSubscription)
        else 'Web Push delivery outcome',
        tags={
            'journey': 'notifications',
            'push_outcome': outcome,
            'notification_type': notification.type,
        },
        extra={
            'subscription_id': subscription.id,
            'notification_id': notification.id,
            'recipient_id': notification.recipient_id,
        },
    )


def _classify_push_failure(exc):
    status_code = _push_failure_status_code(exc)
    if status_code in {404, 410}:
        return 'expired_subscription'
    if status_code and 400 <= status_code < 500:
        return 'client_error'
    if status_code and status_code >= 500:
        return 'server_error'
    return 'unknown_error'


def _handle_push_failure(subscription, exc):
    status_code = _push_failure_status_code(exc)
    updates = {
        'failure_count': models.F('failure_count') + 1,
        'last_failure_at': timezone.now(),
    }
    if status_code in {404, 410}:
        updates['enabled'] = False
    NotificationPushSubscription.objects.filter(id=subscription.id).update(**updates)
    logger.warning(
        'Web Push delivery failed for subscription %s with status %s',
        subscription.id,
        status_code,
        exc_info=status_code not in {404, 410},
    )


def _push_failure_status_code(exc):
    response = getattr(exc, 'response', None)
    return getattr(response, 'status_code', None)

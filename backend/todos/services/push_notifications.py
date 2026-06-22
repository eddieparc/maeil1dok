import json
import logging
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings as django_settings
from django.db import models
from django.utils import timezone

from todos.models import Notification, NotificationPushSubscription, NotificationSettings

logger = logging.getLogger(__name__)


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
    if not is_web_push_configured():
        return {'sent': 0, 'failed': 0, 'skipped': 'not_configured'}

    notification = Notification.objects.filter(id=notification_id).select_related('recipient').first()
    if notification is None:
        return {'sent': 0, 'failed': 0, 'skipped': 'missing_notification'}

    settings, _created = NotificationSettings.objects.get_or_create(user=notification.recipient)
    if not _notification_type_enabled(settings, notification.type):
        return {'sent': 0, 'failed': 0, 'skipped': 'disabled_by_user'}

    payload = _push_payload(notification)
    sent = 0
    failed = 0
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
        except PushDeliveryError as exc:
            failed += 1
            _handle_push_failure(subscription, exc)
    return {'sent': sent, 'failed': failed}


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
        'tag': notification.dedupe_key or f'notification:{notification.id}',
        'type': notification.type,
        'notification_id': notification.id,
        'created_at': notification.created_at.isoformat(),
        'data': notification.data,
    }


def _notification_type_enabled(settings, notification_type):
    if not settings.notifications_enabled:
        return False
    if notification_type == 'reading_reminder':
        return settings.reading_reminders_enabled
    if notification_type == 'hasena_reminder':
        return settings.hasena_reminders_enabled
    if notification_type == 'friend_activity':
        return settings.friend_activity_enabled
    return True


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

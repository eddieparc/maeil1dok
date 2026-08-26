"""Notification and push-subscription authorization."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision
from todos.models import Notification, NotificationPushSubscription


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
NOTIFICATION_NOT_FOUND = {
    "success": False,
    "error": "알림을 찾을 수 없습니다.",
}


@dataclass(frozen=True)
class NotificationInbox:
    resource_type: ClassVar[str] = "notification"


@dataclass(frozen=True)
class NotificationResource:
    notification_id: int
    resource_type: ClassVar[str] = "notification"


@dataclass(frozen=True)
class NotificationSettingsCurrent:
    resource_type: ClassVar[str] = "notification_settings"


@dataclass(frozen=True)
class PushConfiguration:
    resource_type: ClassVar[str] = "push_configuration"


@dataclass(frozen=True)
class PushSubscriptionCurrent:
    resource_type: ClassVar[str] = "push_subscription"


@dataclass(frozen=True)
class PushSubscriptionRemoval:
    endpoint: str
    resource_type: ClassVar[str] = "push_subscription"


def _require_authenticated(subject):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow()


def _view_notifications(subject, resource):
    del resource
    denied = _require_authenticated(subject)
    if not denied:
        return denied
    return Decision.allow(
        Notification.objects.filter(recipient_id=subject.user_id).select_related(
            "actor"
        )
    )


def _mark_notification_read(subject, resource):
    notification = Notification.objects.filter(pk=resource.notification_id).first()
    if (
        notification is None
        or not subject.is_authenticated
        or notification.recipient_id != subject.user_id
    ):
        return Decision.deny(404, NOTIFICATION_NOT_FOUND, value=notification)
    return Decision.allow(notification)


def _self_scoped(subject, resource):
    del resource
    return _require_authenticated(subject)


def _remove_push_subscription(subject, resource):
    denied = _require_authenticated(subject)
    if not denied:
        return denied
    return Decision.allow(
        NotificationPushSubscription.objects.filter(
            user_id=subject.user_id,
            endpoint=resource.endpoint,
        )
    )


POLICIES = {
    ("view_notifications", NotificationInbox): _view_notifications,
    ("mark_notification_read", NotificationResource): _mark_notification_read,
    ("mark_all_notifications_read", NotificationInbox): _self_scoped,
    ("view_notification_settings", NotificationSettingsCurrent): _self_scoped,
    ("update_notification_settings", NotificationSettingsCurrent): _self_scoped,
    ("view_push_config", PushConfiguration): _self_scoped,
    ("register_push_subscription", PushSubscriptionCurrent): _self_scoped,
    ("remove_push_subscription", PushSubscriptionRemoval): _remove_push_subscription,
}

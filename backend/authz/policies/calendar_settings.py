"""Calendar display-setting and month-data authorization."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision
from todos.models import UserPlanDisplaySettings

AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
SETTING_NOT_FOUND = {"success": False, "error": "설정을 찾을 수 없습니다."}


@dataclass(frozen=True)
class CalendarSettingsCollection:
    resource_type: ClassVar[str] = "calendar_settings"


@dataclass(frozen=True)
class CalendarSettingResource:
    setting_id: int
    resource_type: ClassVar[str] = "calendar_settings"


@dataclass(frozen=True)
class CalendarSettingsReorder:
    setting_ids: tuple[int, ...]
    resource_type: ClassVar[str] = "calendar_settings"


@dataclass(frozen=True)
class ReadingCalendarCurrent:
    resource_type: ClassVar[str] = "reading_calendar"


def _owned_settings(subject):
    return UserPlanDisplaySettings.objects.filter(
        user_id=subject.user_id,
        subscription__is_active=True,
    ).select_related("subscription", "subscription__plan")


def _require_user(subject):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return None


def _view_calendar_settings(subject, resource):
    del resource
    denied = _require_user(subject)
    if denied is not None:
        return denied
    return Decision.allow(_owned_settings(subject))


def _update_calendar_setting(subject, resource):
    denied = _require_user(subject)
    if denied is not None:
        return denied
    setting = UserPlanDisplaySettings.objects.filter(
        pk=resource.setting_id,
        subscription__is_active=True,
    ).first()
    if setting is None:
        return Decision.deny(404, SETTING_NOT_FOUND)
    # Load-bearing owner check: must stay a separate comparison.
    if setting.user_id != subject.user_id:
        return Decision.deny(404, SETTING_NOT_FOUND)
    return Decision.allow(setting)


def _reorder_calendar_settings(subject, resource):
    denied = _require_user(subject)
    if denied is not None:
        return denied
    settings = UserPlanDisplaySettings.objects.filter(
        id__in=resource.setting_ids,
        subscription__is_active=True,
    )
    settings_map = {setting.id: setting for setting in settings}
    if len(settings_map) != len(resource.setting_ids):
        return Decision.deny(404, SETTING_NOT_FOUND)
    if any(setting.user_id != subject.user_id for setting in settings_map.values()):
        return Decision.deny(404, SETTING_NOT_FOUND)
    return Decision.allow(settings_map)


def _view_calendar_month(subject, resource):
    del resource
    denied = _require_user(subject)
    if denied is not None:
        return denied
    return Decision.allow(_owned_settings(subject))


POLICIES = {
    ("view_calendar_settings", CalendarSettingsCollection): _view_calendar_settings,
    ("update_calendar_setting", CalendarSettingResource): _update_calendar_setting,
    ("reorder_calendar_settings", CalendarSettingsReorder): _reorder_calendar_settings,
    ("view_calendar_month", ReadingCalendarCurrent): _view_calendar_month,
}

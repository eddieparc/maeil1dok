from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import ClassVar

from authz.core import Decision
from todos.models import DailyBibleSchedule, PlanSubscription


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReadingProgressUpdate:
    plan_id: int
    schedule_ids: tuple[int, ...]
    resource_type: ClassVar[str] = "reading_progress"


@dataclass(frozen=True)
class ReadingProgressUpdateContext:
    subscription: PlanSubscription
    schedules: tuple[DailyBibleSchedule, ...]


@dataclass(frozen=True)
class CertificationProgress:
    plan_id: int | None = None
    schedule_id: int | None = None
    resource_type: ClassVar[str] = "reading_progress"


@dataclass(frozen=True)
class CertificationProgressContext:
    subscription: PlanSubscription
    selected_schedule: DailyBibleSchedule | None


def _update_progress(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(
            404,
            {"success": False, "error": "구독 중인 플랜이 아닙니다."},
        )

    try:
        schedules = tuple(
            DailyBibleSchedule.objects.select_related("plan").filter(
                id__in=resource.schedule_ids
            )
        )
        if subject.is_staff:
            readable_schedules = schedules
        else:
            readable_plan_ids = set(
                PlanSubscription.objects.filter(
                    user_id=subject.user_id,
                    plan_id__in={schedule.plan_id for schedule in schedules},
                    plan__is_active=True,
                    is_active=True,
                ).values_list("plan_id", flat=True)
            )
            readable_schedules = tuple(
                schedule
                for schedule in schedules
                if schedule.plan_id in readable_plan_ids
            )

        if (
            not readable_schedules
            or {schedule.id for schedule in readable_schedules}
            != set(resource.schedule_ids)
        ):
            return Decision.deny(
                404,
                {"success": False, "error": "존재하지 않는 스케줄입니다."},
            )
    except Exception as exc:
        logger.error(
            "Error in update_progress schedule lookup: %s",
            exc,
            exc_info=True,
        )
        return Decision.deny(
            400,
            {"success": False, "error": "요청 처리 중 오류가 발생했습니다."},
        )

    if any(schedule.plan_id != resource.plan_id for schedule in readable_schedules):
        return Decision.deny(
            400,
            {
                "success": False,
                "error": "스케줄 ID와 플랜 ID가 일치하지 않습니다.",
            },
        )

    subscription = (
        PlanSubscription.objects.select_related("plan")
        .filter(
            user_id=subject.user_id,
            plan_id=resource.plan_id,
            plan__is_active=True,
            is_active=True,
        )
        .first()
    )
    if subscription is None:
        return Decision.deny(
            404,
            {"success": False, "error": "구독 중인 플랜이 아닙니다."},
        )

    return Decision.allow(
        ReadingProgressUpdateContext(
            subscription=subscription,
            schedules=readable_schedules,
        )
    )


def _view_certification_progress(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(
            404,
            {"success": False, "error": "활성 구독 중인 플랜이 없습니다."},
        )

    subscriptions = PlanSubscription.objects.filter(
        user_id=subject.user_id,
        is_active=True,
    ).select_related("plan").order_by("id")
    if resource.plan_id:
        subscriptions = subscriptions.filter(plan_id=resource.plan_id)

    subscription = subscriptions.first()
    if subscription is None:
        return Decision.deny(
            404,
            {"success": False, "error": "활성 구독 중인 플랜이 없습니다."},
        )

    selected_schedule = None
    if resource.schedule_id:
        selected_schedule = DailyBibleSchedule.objects.filter(
            id=resource.schedule_id,
            plan=subscription.plan,
        ).first()
        if selected_schedule is None:
            return Decision.deny(
                404,
                {"success": False, "error": "선택한 스케줄을 찾을 수 없습니다."},
            )

    return Decision.allow(
        CertificationProgressContext(
            subscription=subscription,
            selected_schedule=selected_schedule,
        )
    )


POLICIES = {
    ("update_progress", ReadingProgressUpdate): _update_progress,
    ("view_certification_progress", CertificationProgress): (
        _view_certification_progress
    ),
}

"""Catch-up authorization. Ownership hangs off PlanSubscription."""

from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision
from authz.policies.plan_subscription import (
    PlanSubscriptionResource,
    _owned_subscription,
)
from todos.models import CatchupSchedule, CatchupSession


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
NOT_FOUND = {"detail": "Not found."}


@dataclass(frozen=True)
class CatchupSubscriptionResource:
    subscription_id: int
    resource_type: ClassVar[str] = "catchup_session"


@dataclass(frozen=True)
class CatchupSessionResource:
    session_id: int
    resource_type: ClassVar[str] = "catchup_session"


@dataclass(frozen=True)
class CatchupSessionCollection:
    resource_type: ClassVar[str] = "catchup_session"


@dataclass(frozen=True)
class CatchupScheduleResource:
    schedule_id: int
    resource_type: ClassVar[str] = "catchup_schedule"


@dataclass(frozen=True)
class CatchupSessionSchedulesQuery:
    session_id: int
    resource_type: ClassVar[str] = "catchup_schedule"


def _active_owned_subscription(subject, subscription_id):
    decision = _owned_subscription(
        subject,
        PlanSubscriptionResource(subscription_id=subscription_id),
    )
    subscription = decision.value
    if (
        not decision
        or subscription is None
        or not subscription.is_active
        or not subscription.plan.is_active
    ):
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow(subscription)


def _session_by_id(session_id):
    return (
        CatchupSession.objects.select_related("subscription", "subscription__plan")
        .filter(pk=session_id)
        .first()
    )


def _owned_session_subscription(subject, session):
    return _owned_subscription(
        subject,
        PlanSubscriptionResource(subscription_id=session.subscription_id),
    )


def _is_visible_session(session):
    if session.status != "active":
        return True
    return (
        session.subscription.is_active and session.subscription.plan.is_active
    )


def _is_operable_session(session):
    return (
        session.status == "active"
        and session.subscription.is_active
        and session.subscription.plan.is_active
    )


def _view_or_mutate_via_subscription(subject, resource):
    return _active_owned_subscription(subject, resource.subscription_id)


def _visible_session(subject, resource):
    session = _session_by_id(resource.session_id)
    if session is None or not _owned_session_subscription(subject, session):
        return Decision.deny(404, NOT_FOUND)
    if not _is_visible_session(session):
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow(session)


def _operable_session(subject, resource):
    session = _session_by_id(resource.session_id)
    if session is None or not _owned_session_subscription(subject, session):
        return Decision.deny(404, NOT_FOUND)
    if not _is_operable_session(session):
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow(session)


def _view_active_catchups(subject, resource):
    del resource
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(
        CatchupSession.objects.filter(
            subscription__user_id=subject.user_id,
            status="active",
            subscription__is_active=True,
            subscription__plan__is_active=True,
        )
    )


def _toggle_catchup_schedule(subject, resource):
    schedule = (
        CatchupSchedule.objects.select_related(
            "session__subscription",
            "session__subscription__plan",
            "original_schedule",
        )
        .filter(pk=resource.schedule_id)
        .first()
    )
    if schedule is None or not _owned_session_subscription(subject, schedule.session):
        return Decision.deny(404, NOT_FOUND)
    if not _is_operable_session(schedule.session):
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow(schedule)


POLICIES = {
    ("view_catchup_status", CatchupSubscriptionResource): (
        _view_or_mutate_via_subscription
    ),
    ("preview_catchup", CatchupSubscriptionResource): (
        _view_or_mutate_via_subscription
    ),
    ("create_catchup", CatchupSubscriptionResource): (
        _view_or_mutate_via_subscription
    ),
    ("view_active_catchups", CatchupSessionCollection): _view_active_catchups,
    ("view_catchup", CatchupSessionResource): _visible_session,
    ("update_catchup", CatchupSessionResource): _operable_session,
    ("complete_catchup", CatchupSessionResource): _operable_session,
    ("abandon_catchup", CatchupSessionResource): _operable_session,
    ("view_catchup_schedules", CatchupSessionSchedulesQuery): _visible_session,
    ("toggle_catchup_schedule", CatchupScheduleResource): _toggle_catchup_schedule,
}

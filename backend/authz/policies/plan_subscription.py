from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision, SubjectKind
from todos.models import BibleReadingPlan, PlanSubscription


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}


@dataclass(frozen=True)
class PlanSubscriptionCollection:
    resource_type: ClassVar[str] = "plan_subscription"


@dataclass(frozen=True)
class PlanSubscriptionCollectionResult:
    items: object
    public_plans: bool


@dataclass(frozen=True)
class PlanSubscriptionCreation:
    owner_id: int | None
    resource_type: ClassVar[str] = "plan_subscription"


@dataclass(frozen=True)
class PlanSubscriptionResource:
    subscription_id: int
    resource_type: ClassVar[str] = "plan_subscription"


def _view_subscriptions(subject, resource):
    del resource
    if subject.kind is SubjectKind.ANONYMOUS:
        plans = BibleReadingPlan.objects.filter(is_active=True).order_by(
            "-is_default", "name"
        )
        if not plans.exists():
            return Decision.deny(
                404,
                {"error": "활성화된 플랜이 없습니다."},
            )
        return Decision.allow(
            PlanSubscriptionCollectionResult(items=plans, public_plans=True)
        )

    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)

    subscriptions = PlanSubscription.objects.filter(
        user_id=subject.user_id,
        is_active=True,
    ).distinct()
    return Decision.allow(
        PlanSubscriptionCollectionResult(
            items=subscriptions,
            public_plans=False,
        )
    )


def _subscribe(subject, resource):
    if not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    if subject.user_id != resource.owner_id:
        return Decision.deny(404)
    return Decision.allow()


def _owned_subscription(subject, resource):
    subscription = (
        PlanSubscription.objects.select_related("plan")
        .filter(pk=resource.subscription_id)
        .first()
    )
    if (
        subscription is None
        or not subject.is_authenticated
        or subscription.user_id != subject.user_id
    ):
        return Decision.deny(404, value=subscription)
    return Decision.allow(subscription)


def _view_subscription(subject, resource):
    return _owned_subscription(subject, resource)


def _update_subscription(subject, resource):
    return _owned_subscription(subject, resource)


def _unsubscribe(subject, resource):
    decision = _owned_subscription(subject, resource)
    if not decision:
        return decision

    subscription = decision.value
    if subscription.plan.is_default:
        return Decision.deny(
            400,
            {"detail": "기본 플랜 구독은 삭제할 수 없습니다."},
            value=subscription,
        )
    return decision


def _toggle_active(subject, resource):
    decision = _owned_subscription(subject, resource)
    if not decision:
        return decision

    subscription = decision.value
    if subscription.plan.is_default and subscription.is_active:
        return Decision.deny(
            400,
            {"detail": "기본 플랜 구독은 취소할 수 없습니다."},
            value=subscription,
        )
    if not subscription.is_active and not subscription.plan.is_active:
        return Decision.deny(
            400,
            {
                "detail": (
                    "현재 신규 구독이 중단된 플랜은 다시 활성화할 수 없습니다."
                )
            },
            value=subscription,
        )
    return decision


POLICIES = {
    ("view_subscriptions", PlanSubscriptionCollection): _view_subscriptions,
    ("subscribe", PlanSubscriptionCreation): _subscribe,
    ("view_subscription", PlanSubscriptionResource): _view_subscription,
    ("update_subscription", PlanSubscriptionResource): _update_subscription,
    ("unsubscribe", PlanSubscriptionResource): _unsubscribe,
    ("toggle_active", PlanSubscriptionResource): _toggle_active,
}

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from .registry import ENDPOINTS


class SubjectKind(str, Enum):
    ANONYMOUS = "anonymous"
    USER = "user"
    SYSTEM = "system"


@dataclass(frozen=True)
class Subject:
    kind: SubjectKind
    user_id: int | None = None
    is_staff: bool = False
    system: str | None = None

    @property
    def is_authenticated(self):
        return self.kind is SubjectKind.USER


@dataclass(frozen=True)
class Denial:
    status_code: int
    body: Any = None


@dataclass(frozen=True)
class Decision:
    is_allowed: bool
    value: Any = None
    denial: Denial | None = None

    def __bool__(self):
        return self.is_allowed

    @classmethod
    def allow(cls, value=None):
        return cls(is_allowed=True, value=value)

    @classmethod
    def deny(cls, status_code, body=None, *, value=None):
        return cls(
            is_allowed=False,
            value=value,
            denial=Denial(status_code=status_code, body=body),
        )


_REGISTERED_ACTIONS = {
    (action.resource_type, action.name)
    for endpoint in ENDPOINTS
    for action in endpoint.actions
}


def subject_from_request(request, *, system=None):
    """Build the authorization subject from an authenticated request.

    ``system`` identifies a credential that the caller has already verified,
    such as a cron secret. Credential validation remains at the request
    boundary; policy receives only the resulting system identity.
    """
    if system is not None:
        return Subject(kind=SubjectKind.SYSTEM, system=system)

    user = getattr(request, "user", None)
    if user is None or not bool(getattr(user, "is_authenticated", False)):
        return Subject(kind=SubjectKind.ANONYMOUS)

    return Subject(
        kind=SubjectKind.USER,
        user_id=getattr(user, "id", None),
        is_staff=bool(getattr(user, "is_staff", False)),
    )


def can(subject, action, resource):
    """Evaluate one registry action against a hydrated or referenced resource.

    The returned decision is boolean-compatible and also carries the policy's
    authorized resource and action-specific denial contract.
    """
    resource_type = getattr(resource, "resource_type", None)
    if (resource_type, action) not in _REGISTERED_ACTIONS:
        raise LookupError(
            f"Action {action!r} is not registered for resource type {resource_type!r}."
        )

    from .policies import get_policy

    policy = get_policy(action, type(resource))
    if policy is None:
        raise LookupError(
            f"No authorization policy for action {action!r} and "
            f"resource {type(resource).__name__}."
        )
    return policy(subject, resource)

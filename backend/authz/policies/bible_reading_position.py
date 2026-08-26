from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision, SubjectKind
from todos.models import UserReadingPosition


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}


@dataclass(frozen=True)
class ReadingPositionCurrent:
    resource_type: ClassVar[str] = "reading_position"


def _current_position(subject, resource):
    del resource
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(
        UserReadingPosition.objects.filter(user_id=subject.user_id).first()
    )


POLICIES = {
    ("view_reading_position", ReadingPositionCurrent): _current_position,
    ("save_reading_position", ReadingPositionCurrent): _current_position,
}

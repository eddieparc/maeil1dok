from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision, SubjectKind
from todos.models import PersonalReadingRecord


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
NOT_FOUND = {"detail": "Not found."}


@dataclass(frozen=True)
class PersonalReadingRecordCollection:
    resource_type: ClassVar[str] = "personal_reading_record"


@dataclass(frozen=True)
class PersonalReadingRecordCreation:
    owner_id: int | None
    resource_type: ClassVar[str] = "personal_reading_record"


@dataclass(frozen=True)
class PersonalReadingRecordBookQuery:
    book: str
    resource_type: ClassVar[str] = "personal_reading_record"


def _owned_queryset(subject):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return None
    return PersonalReadingRecord.objects.filter(user_id=subject.user_id)


def _view_collection(subject, resource):
    del resource
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(queryset)


def _record_reading(subject, resource):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    if subject.user_id != resource.owner_id:
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow()


def _view_by_book(subject, resource):
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(queryset.filter(book=resource.book))


POLICIES = {
    ("list_reading_records", PersonalReadingRecordCollection): _view_collection,
    ("record_reading", PersonalReadingRecordCreation): _record_reading,
    ("view_reading_records_by_book", PersonalReadingRecordBookQuery): _view_by_book,
    ("view_reading_dates", PersonalReadingRecordCollection): _view_collection,
    ("view_reading_record_stats", PersonalReadingRecordCollection): _view_collection,
}

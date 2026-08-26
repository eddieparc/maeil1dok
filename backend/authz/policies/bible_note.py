from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision, SubjectKind
from todos.models import ReflectionNote


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
NOT_FOUND = {"detail": "Not found."}


@dataclass(frozen=True)
class ReflectionNoteCollection:
    resource_type: ClassVar[str] = "reflection_note"


@dataclass(frozen=True)
class ReflectionNoteCreation:
    owner_id: int | None
    resource_type: ClassVar[str] = "reflection_note"


@dataclass(frozen=True)
class ReflectionNoteResource:
    note_id: int
    resource_type: ClassVar[str] = "reflection_note"


@dataclass(frozen=True)
class ReflectionNoteChapterQuery:
    book: str
    chapter: int
    resource_type: ClassVar[str] = "reflection_note"


def _owned_queryset(subject):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return None
    return ReflectionNote.objects.filter(user_id=subject.user_id)


def _view_collection(subject, resource):
    del resource
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(queryset)


def _create_note(subject, resource):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    if subject.user_id != resource.owner_id:
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow()


def _owned_note(subject, resource):
    note = ReflectionNote.objects.filter(pk=resource.note_id).first()
    if (
        note is None
        or subject.kind is not SubjectKind.USER
        or not subject.is_authenticated
        or note.user_id != subject.user_id
    ):
        return Decision.deny(404, NOT_FOUND, value=note)
    return Decision.allow(note)


def _view_by_chapter(subject, resource):
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(
        queryset.filter(book=resource.book, chapter=resource.chapter)
    )


POLICIES = {
    ("list_notes", ReflectionNoteCollection): _view_collection,
    ("create_note", ReflectionNoteCreation): _create_note,
    ("view_note", ReflectionNoteResource): _owned_note,
    ("update_note", ReflectionNoteResource): _owned_note,
    ("delete_note", ReflectionNoteResource): _owned_note,
    ("view_notes_by_chapter", ReflectionNoteChapterQuery): _view_by_chapter,
    ("clear_notes", ReflectionNoteCollection): _view_collection,
}

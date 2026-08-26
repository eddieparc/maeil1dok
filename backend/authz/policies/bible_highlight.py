from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision, SubjectKind
from todos.models import BibleHighlight


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
NOT_FOUND = {"detail": "Not found."}


@dataclass(frozen=True)
class BibleHighlightCollection:
    resource_type: ClassVar[str] = "bible_highlight"


@dataclass(frozen=True)
class BibleHighlightCreation:
    owner_id: int | None
    resource_type: ClassVar[str] = "bible_highlight"


@dataclass(frozen=True)
class BibleHighlightResource:
    highlight_id: int
    resource_type: ClassVar[str] = "bible_highlight"


@dataclass(frozen=True)
class BibleHighlightChapterQuery:
    book: str
    chapter: int
    resource_type: ClassVar[str] = "bible_highlight"


def _owned_queryset(subject):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return None
    return BibleHighlight.objects.filter(user_id=subject.user_id)


def _view_collection(subject, resource):
    del resource
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(queryset)


def _create_highlight(subject, resource):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    if subject.user_id != resource.owner_id:
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow()


def _owned_highlight(subject, resource):
    highlight = BibleHighlight.objects.filter(pk=resource.highlight_id).first()
    if (
        highlight is None
        or subject.kind is not SubjectKind.USER
        or not subject.is_authenticated
        or highlight.user_id != subject.user_id
    ):
        return Decision.deny(404, NOT_FOUND, value=highlight)
    return Decision.allow(highlight)


def _view_by_chapter(subject, resource):
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(
        queryset.filter(book=resource.book, chapter=resource.chapter)
    )


POLICIES = {
    ("list_highlights", BibleHighlightCollection): _view_collection,
    ("create_highlight", BibleHighlightCreation): _create_highlight,
    ("view_highlight", BibleHighlightResource): _owned_highlight,
    ("update_highlight", BibleHighlightResource): _owned_highlight,
    ("delete_highlight", BibleHighlightResource): _owned_highlight,
    ("view_highlights_by_chapter", BibleHighlightChapterQuery): _view_by_chapter,
    ("clear_highlights", BibleHighlightCollection): _view_collection,
}

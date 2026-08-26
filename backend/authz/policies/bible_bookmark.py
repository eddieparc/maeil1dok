from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from authz.core import Decision, SubjectKind
from todos.models import BibleBookmark


AUTHENTICATION_REQUIRED = {
    "detail": "Authentication credentials were not provided."
}
NOT_FOUND = {"detail": "Not found."}


@dataclass(frozen=True)
class BibleBookmarkCollection:
    resource_type: ClassVar[str] = "bible_bookmark"


@dataclass(frozen=True)
class BibleBookmarkCreation:
    owner_id: int | None
    resource_type: ClassVar[str] = "bible_bookmark"


@dataclass(frozen=True)
class BibleBookmarkResource:
    bookmark_id: int
    resource_type: ClassVar[str] = "bible_bookmark"


@dataclass(frozen=True)
class BibleBookmarkChapterQuery:
    book: str
    chapter: int
    resource_type: ClassVar[str] = "bible_bookmark"


def _owned_queryset(subject):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return None
    return BibleBookmark.objects.filter(user_id=subject.user_id)


def _view_collection(subject, resource):
    del resource
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(queryset)


def _create_bookmark(subject, resource):
    if subject.kind is not SubjectKind.USER or not subject.is_authenticated:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    if subject.user_id != resource.owner_id:
        return Decision.deny(404, NOT_FOUND)
    return Decision.allow()


def _owned_bookmark(subject, resource):
    bookmark = BibleBookmark.objects.filter(pk=resource.bookmark_id).first()
    if (
        bookmark is None
        or subject.kind is not SubjectKind.USER
        or not subject.is_authenticated
        or bookmark.user_id != subject.user_id
    ):
        return Decision.deny(404, NOT_FOUND, value=bookmark)
    return Decision.allow(bookmark)


def _view_by_chapter(subject, resource):
    queryset = _owned_queryset(subject)
    if queryset is None:
        return Decision.deny(401, AUTHENTICATION_REQUIRED)
    return Decision.allow(
        queryset.filter(book=resource.book, chapter=resource.chapter)
    )


POLICIES = {
    ("list_bookmarks", BibleBookmarkCollection): _view_collection,
    ("create_bookmark", BibleBookmarkCreation): _create_bookmark,
    ("view_bookmark", BibleBookmarkResource): _owned_bookmark,
    ("update_bookmark", BibleBookmarkResource): _owned_bookmark,
    ("delete_bookmark", BibleBookmarkResource): _owned_bookmark,
    ("view_bookmarks_by_chapter", BibleBookmarkChapterQuery): _view_by_chapter,
    ("clear_bookmarks", BibleBookmarkCollection): _view_collection,
}

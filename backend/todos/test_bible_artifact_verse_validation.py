from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import BibleBookmark, BibleHighlight, ReflectionNote, UserReadingPosition


User = get_user_model()


@override_settings(ROOT_URLCONF="config.test_urls")
class BibleArtifactVerseValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="verse-validation-reader",
            nickname="절검증독자",
            email="verse-validation@example.com",
        )
        self.client.force_authenticate(user=self.user)

    def test_reading_position_rejects_zero_verse_before_write(self):
        response = self.client.post(
            "/api/v1/todos/bible/reading-position/",
            {
                "book": "gen",
                "chapter": 1,
                "verse": 0,
                "scroll_position": 0.25,
                "version": "GAE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(UserReadingPosition.objects.filter(user=self.user).exists())

    def test_verse_bookmark_requires_start_and_end_before_write(self):
        response = self.client.post(
            "/api/v1/todos/bible/bookmarks/",
            {
                "bookmark_type": "verse",
                "book": "gen",
                "chapter": 1,
                "start_verse": 3,
                "title": "missing end",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(BibleBookmark.objects.filter(user=self.user).exists())

    def test_duplicate_bookmark_integrity_race_returns_existing_bookmark(self):
        payload = {
            "bookmark_type": "chapter",
            "book": "gen",
            "chapter": 1,
            "title": "race winner",
        }
        original_create = BibleBookmark.objects.create

        def create_competing_bookmark(*args, **kwargs):
            original_create(*args, **kwargs)
            raise IntegrityError("unique_chapter_bookmark")

        self.client.raise_request_exception = False
        with patch("todos.models.BibleBookmark.objects.create", side_effect=create_competing_bookmark):
            response = self.client.post(
                "/api/v1/todos/bible/bookmarks/",
                payload,
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["already_exists"])
        self.assertEqual(
            BibleBookmark.objects.filter(
                user=self.user,
                book="gen",
                chapter=1,
                bookmark_type="chapter",
            ).count(),
            1,
        )

    def test_reflection_note_rejects_reversed_verse_range_before_write(self):
        response = self.client.post(
            "/api/v1/todos/bible/notes/",
            {
                "book": "gen",
                "chapter": 1,
                "start_verse": 8,
                "end_verse": 4,
                "content": "invalid range",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ReflectionNote.objects.filter(user=self.user).exists())

    def test_highlight_rejects_negative_verse_before_write(self):
        response = self.client.post(
            "/api/v1/todos/bible/highlights/",
            {
                "book": "gen",
                "chapter": 1,
                "start_verse": -1,
                "end_verse": 2,
                "color": "#FEF3C7",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(BibleHighlight.objects.filter(user=self.user).exists())

    def test_highlight_partial_update_preserves_existing_valid_verse_window(self):
        highlight = BibleHighlight.objects.create(
            user=self.user,
            book="gen",
            chapter=1,
            start_verse=1,
            end_verse=2,
            color="#FEF3C7",
        )

        response = self.client.patch(
            f"/api/v1/todos/bible/highlights/{highlight.id}/",
            {"memo": "updated memo"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        highlight.refresh_from_db()
        self.assertEqual(highlight.memo, "updated memo")

    def test_valid_verse_artifacts_still_create(self):
        bookmark_response = self.client.post(
            "/api/v1/todos/bible/bookmarks/",
            {
                "bookmark_type": "verse",
                "book": "gen",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 2,
                "title": "valid bookmark",
            },
            format="json",
        )
        note_response = self.client.post(
            "/api/v1/todos/bible/notes/",
            {
                "book": "gen",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 2,
                "content": "valid note",
            },
            format="json",
        )
        highlight_response = self.client.post(
            "/api/v1/todos/bible/highlights/",
            {
                "book": "gen",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 2,
                "color": "#FEF3C7",
            },
            format="json",
        )

        self.assertEqual(bookmark_response.status_code, 201)
        self.assertEqual(note_response.status_code, 201)
        self.assertEqual(highlight_response.status_code, 201)

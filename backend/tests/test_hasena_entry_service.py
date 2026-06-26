from datetime import date
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from todos.models import HasenaEntry, HasenaRecord
from todos.services.hasena_entry_service import parse_hasena_body


class HasenaEntryServiceTest(TestCase):
    def test_parse_hasena_body_extracts_passage_and_verses(self):
        html = """
        <div class="bible_tit">마태복음 1:1-2</div>
        <div class="bible_contents">
          <p><span class="bullet_number">1</span><span class="bullet_txt">아브라함과 다윗의 자손</span></p>
          <p><span class="bullet_number">2</span><span class="bullet_txt">아브라함이 이삭을 낳고</span></p>
        </div>
        """

        parsed = parse_hasena_body(html)

        self.assertEqual(parsed.passage, "마태복음 1:1-2")
        self.assertEqual(parsed.body_text, "1 아브라함과 다윗의 자손\n2 아브라함이 이삭을 낳고")
        self.assertEqual(parsed.verses, [
            {"number": "1", "text": "아브라함과 다윗의 자손"},
            {"number": "2", "text": "아브라함이 이삭을 낳고"},
        ])


class HasenaEntryApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="hasena-reader",
            password="password",
        )
        self.entry = HasenaEntry.objects.create(
            date=date(2026, 6, 25),
            video_id="LYmfNxK90YA",
            title="2026년 6월 25일 목요일 하세나하시조",
            passage="마태복음 1:1-2",
            body_text="1 아브라함과 다윗의 자손",
            verses=[{"number": "1", "text": "아브라함과 다윗의 자손"}],
        )

    def test_hasena_day_returns_cached_entry_with_completion(self):
        self.client.force_authenticate(self.user)
        HasenaRecord.objects.create(user=self.user, date=self.entry.date, is_completed=True)

        response = self.client.get("/api/v1/todos/hasena/day/?date=2026-06-25")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertTrue(response.data["is_completed"])
        self.assertEqual(response.data["entry"]["video_id"], "LYmfNxK90YA")
        self.assertEqual(response.data["entry"]["verses"][0]["text"], "아브라함과 다윗의 자손")

    @patch("todos.services.hasena_entry_service.sync_hasena_entries")
    def test_hasena_calendar_merges_cached_entries_and_completion_marks(self, sync_entries):
        self.client.force_authenticate(self.user)
        HasenaRecord.objects.create(user=self.user, date=self.entry.date, is_completed=True)
        sync_entries.return_value = {"success": True, "synced": [], "skipped": []}

        response = self.client.get("/api/v1/todos/hasena/calendar/?year=2026&month=6")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["entries"], [{
            "date": "2026-06-25",
            "passage": "마태복음 1:1-2",
            "video_id": "LYmfNxK90YA",
            "title": "2026년 6월 25일 목요일 하세나하시조",
            "is_completed": True,
        }])

    @patch("todos.services.hasena_entry_service.sync_hasena_entries")
    def test_hasena_calendar_syncs_when_month_cache_is_sparse(self, sync_entries):
        sync_entries.return_value = {"success": True, "synced": ["2026-06-25"], "skipped": []}

        response = self.client.get("/api/v1/todos/hasena/calendar/?year=2026&month=6")

        self.assertEqual(response.status_code, 200)
        sync_entries.assert_called_once_with(max_entries=40)

    @patch("todos.services.hasena_entry_service.requests.get")
    @patch("todos.services.hasena_entry_service.get_recent_hasena_videos")
    def test_hasena_day_syncs_missing_cached_entry(self, recent_videos, fetch):
        recent_videos.return_value = [{
            "video_id": "CkJhOAlhlgA",
            "title": "2026년 6월 26일 금요일 하세나하시조",
            "published_at": None,
        }]
        fetch.return_value = Mock(
            ok=True,
            text="""
            <div class="bible_tit">마태복음 2:1</div>
            <div class="bible_contents">
              <p><span class="bullet_number">1</span><span class="bullet_txt">헤롯 왕 때에</span></p>
            </div>
            """,
            raise_for_status=Mock(),
        )

        response = self.client.get("/api/v1/todos/hasena/day/?date=2026-06-26")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["entry"]["video_id"], "CkJhOAlhlgA")
        self.assertTrue(HasenaEntry.objects.filter(date=date(2026, 6, 26)).exists())

from __future__ import annotations

from datetime import date, datetime
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase


class HasenaSummaryCommandTest(SimpleTestCase):
    def test_generate_hasena_summary_once_uses_latest_public_video(self) -> None:
        out = StringIO()

        with (
            patch(
                "todos.management.commands.generate_hasena_summary_once.timezone.now",
                return_value=datetime(2026, 6, 17, 1, 0, 0),
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "video-123",
                        "title": "하세나하시조",
                        "published_at": "2026-06-17T00:30:00Z",
                    }
                ],
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.generate_summary",
                return_value={
                    "success": True,
                    "cacheable": True,
                    "persisted": True,
                    "video_id": "video-123",
                    "created": True,
                },
            ) as generate_summary,
        ):
            call_command("generate_hasena_summary_once", stdout=out)

        generate_summary.assert_called_once_with(
            "video-123",
            video_date=date(2026, 6, 17),
            title="하세나하시조",
        )
        self.assertIn("generated video-123", out.getvalue())

    def test_generate_hasena_summary_once_uses_kst_video_date_for_midnight_video(self) -> None:
        out = StringIO()

        with (
            patch(
                "todos.management.commands.generate_hasena_summary_once.timezone.now",
                return_value=datetime(2026, 6, 25, 1, 0, 0),
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "VkWhiXwG-Fw",
                        "title": "2026년 6월 25일 목요일 하세나하시조",
                        "published_at": "2026-06-24T15:00:02+00:00",
                    }
                ],
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.generate_summary",
                return_value={
                    "success": True,
                    "cacheable": True,
                    "persisted": True,
                    "video_id": "VkWhiXwG-Fw",
                    "created": True,
                },
            ) as generate_summary,
        ):
            call_command("generate_hasena_summary_once", stdout=out)

        generate_summary.assert_called_once_with(
            "VkWhiXwG-Fw",
            video_date=date(2026, 6, 25),
            title="2026년 6월 25일 목요일 하세나하시조",
        )
        self.assertIn("generated VkWhiXwG-Fw", out.getvalue())

    def test_generate_hasena_summary_once_fails_when_latest_video_missing(self) -> None:
        out = StringIO()

        with patch(
            "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
            return_value=[],
        ):
            with self.assertRaises(CommandError):
                call_command("generate_hasena_summary_once", stdout=out)

        self.assertIn("failed no_video_info", out.getvalue())

    def test_generate_hasena_summary_once_fails_when_latest_video_id_missing(self) -> None:
        out = StringIO()

        with patch(
            "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
            return_value=[{"title": "하세나하시조", "published_at": "2026-06-17T00:30:00Z"}],
        ):
            with self.assertRaises(CommandError):
                call_command("generate_hasena_summary_once", stdout=out)

        self.assertIn("failed no_video_info", out.getvalue())

    def test_generate_hasena_summary_once_does_not_try_previous_date_after_generation_failure(self) -> None:
        out = StringIO()

        with (
            patch(
                "todos.management.commands.generate_hasena_summary_once.timezone.now",
                return_value=datetime(2026, 6, 18, 1, 0, 0),
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "LY-mfNxK90Y",
                        "title": "아직 자막 없는 영상",
                        "published_at": "2026-06-18T00:30:00Z",
                    },
                    {
                        "video_id": "CkJhOAlh_lg",
                        "title": "자막 준비된 영상",
                        "published_at": "2026-06-17T00:30:00Z",
                    },
                ],
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.generate_summary",
                return_value={"success": False, "error": "RESOURCE_EXHAUSTED: free-tier quota exceeded"},
            ) as generate_summary,
        ):
            with self.assertRaises(CommandError):
                call_command("generate_hasena_summary_once", stdout=out)

        generate_summary.assert_called_once_with(
            "LY-mfNxK90Y",
            video_date=date(2026, 6, 18),
            title="아직 자막 없는 영상",
        )
        self.assertIn("failed RESOURCE_EXHAUSTED: free-tier quota exceeded", out.getvalue())

    def test_generate_hasena_summary_once_fail_soft_exits_successfully(self) -> None:
        out = StringIO()

        with (
            patch(
                "todos.management.commands.generate_hasena_summary_once.timezone.now",
                return_value=datetime(2026, 6, 18, 1, 0, 0),
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "LY-mfNxK90Y",
                        "title": "아직 자막 없는 영상",
                        "published_at": "2026-06-18T00:30:00Z",
                    }
                ],
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.generate_summary",
                return_value={"success": False, "error": "PERMISSION_DENIED: key blocked"},
            ),
        ):
            call_command("generate_hasena_summary_once", "--fail-soft", stdout=out)

        self.assertIn("failed PERMISSION_DENIED: key blocked", out.getvalue())
        self.assertIn("exiting 0 due to --fail-soft", out.getvalue())

    def test_generate_hasena_summary_once_rejects_non_cacheable_automatic_success(self) -> None:
        out = StringIO()

        with (
            patch(
                "todos.management.commands.generate_hasena_summary_once.timezone.now",
                return_value=datetime(2026, 6, 25, 1, 0, 0),
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "VkWhiXwG-Fw",
                        "title": "2026년 6월 25일 목요일 하세나하시조",
                        "published_at": "2026-06-24T15:00:02+00:00",
                    }
                ],
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.generate_summary",
                return_value={
                    "success": True,
                    "cacheable": False,
                    "persisted": False,
                    "video_id": "VkWhiXwG-Fw",
                    "error": "summary was not persisted",
                },
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.capture_hasena_summary_issue"
            ) as capture_issue,
        ):
            with self.assertRaises(CommandError):
                call_command("generate_hasena_summary_once", stdout=out)

        self.assertIn("failed summary was not persisted", out.getvalue())
        capture_issue.assert_called_once()

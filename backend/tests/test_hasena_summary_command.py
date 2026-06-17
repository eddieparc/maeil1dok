from __future__ import annotations

from datetime import date
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase


class HasenaSummaryCommandTest(TestCase):
    def test_generate_hasena_summary_once_uses_latest_public_video(self) -> None:
        out = StringIO()

        with (
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

    def test_generate_hasena_summary_once_tries_next_recent_video(self) -> None:
        out = StringIO()

        with (
            patch(
                "todos.management.commands.generate_hasena_summary_once.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "video-new",
                        "title": "아직 자막 없는 영상",
                        "published_at": "2026-06-17T00:30:00Z",
                    },
                    {
                        "video_id": "video-ready",
                        "title": "자막 준비된 영상",
                        "published_at": "2026-06-16T00:30:00Z",
                    },
                ],
            ),
            patch(
                "todos.management.commands.generate_hasena_summary_once.generate_summary",
                side_effect=[
                    {"success": False, "error": "영상 자막을 가져올 수 없습니다."},
                    {"success": True, "video_id": "video-ready", "created": True},
                ],
            ) as generate_summary,
        ):
            call_command("generate_hasena_summary_once", stdout=out)

        self.assertEqual(generate_summary.call_count, 2)
        self.assertIn("generated video-ready", out.getvalue())

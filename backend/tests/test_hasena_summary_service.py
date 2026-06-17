from __future__ import annotations

from unittest.mock import patch

from django.test import TestCase

from todos.models import HasenaSummary
from todos.services.hasena_summary_service import get_hasena_summary


class HasenaSummaryServiceTest(TestCase):
    def test_get_hasena_summary_uses_gemini_video_when_transcript_is_blocked(self) -> None:
        with (
            patch(
                "todos.services.hasena_summary_service.get_youtube_transcript",
                return_value=None,
            ),
            patch(
                "todos.services.hasena_summary_service.summarize_youtube_video_with_gemini",
                return_value={
                    "summary": "**오늘의 본문**\n요약",
                    "model": "gemini-2.5-flash-video",
                },
            ) as summarize_video,
        ):
            result = get_hasena_summary(
                "video-123",
                title="하세나하시조",
            )

        self.assertTrue(result["success"])
        summarize_video.assert_called_once_with("video-123")
        summary = HasenaSummary.objects.get(video_id="video-123")
        self.assertEqual(summary.transcript, "")
        self.assertEqual(summary.model_used, "gemini-2.5-flash-video")

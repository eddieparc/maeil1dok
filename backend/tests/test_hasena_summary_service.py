from __future__ import annotations

from unittest.mock import patch

import requests
from django.test import TestCase, override_settings

from todos.models import HasenaSummary
from todos.services.hasena_summary_service import (
    _generate_content_with_gemini_fallback,
    get_hasena_summary,
    get_recent_hasena_videos,
)


class HasenaSummaryServiceTest(TestCase):
    def test_get_recent_hasena_videos_uses_public_playlist_feed(self) -> None:
        class Response:
            content = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>LY-mfNxK90Y</yt:videoId>
    <title>2026년 6월 18일 목요일 하세나하시조</title>
    <published>2026-06-17T15:00:21+00:00</published>
  </entry>
</feed>""".encode()

            def raise_for_status(self) -> None:
                return None

        with patch(
            "todos.services.hasena_summary_service.requests.get",
            return_value=Response(),
        ) as fetch:
            result = get_recent_hasena_videos()

        self.assertEqual(
            result,
            [
                {
                    "video_id": "LY-mfNxK90Y",
                    "title": "2026년 6월 18일 목요일 하세나하시조",
                    "published_at": "2026-06-17T15:00:21+00:00",
                }
            ],
        )
        fetch.assert_called_once()

    def test_get_recent_hasena_videos_uses_playlist_page_when_feed_is_unavailable(self) -> None:
        class Response:
            text = """
{"videoId":"LY-mfNxK90Y","title":{"runs":[{"text":"2026년 6월 18일 목요일 하세나하시조"}]}}
{"videoId":"CkJhOAlh_lg","title":{"runs":[{"text":"2026년 6월 17일 수요일 하세나하시조"}]}}
{"videoId":"LY-mfNxK90Y","title":{"runs":[{"text":"중복"}]}}
"""

            def raise_for_status(self) -> None:
                return None

        with (
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_feed",
                return_value=[],
            ),
            patch(
                "todos.services.hasena_summary_service.requests.get",
                return_value=Response(),
            ) as fetch,
        ):
            result = get_recent_hasena_videos(max_results=2)

        self.assertEqual(
            result,
            [
                {
                    "video_id": "LY-mfNxK90Y",
                    "title": "2026년 6월 18일 목요일 하세나하시조",
                    "published_at": None,
                },
                {
                    "video_id": "CkJhOAlh_lg",
                    "title": "2026년 6월 17일 수요일 하세나하시조",
                    "published_at": None,
                },
            ],
        )
        fetch.assert_called_once()

    @override_settings(YOUTUBE_API_KEY=None, GEMINI_API_KEY="gemini-secret")
    def test_get_recent_hasena_videos_does_not_use_gemini_key_for_youtube_api(self) -> None:
        with (
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_feed",
                return_value=[],
            ),
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_playlist_page",
                return_value=[],
            ),
            patch("todos.services.hasena_summary_service.requests.get") as fetch,
        ):
            result = get_recent_hasena_videos()

        self.assertEqual(result, [])
        fetch.assert_not_called()

    @override_settings(YOUTUBE_API_KEY="shared-secret", GEMINI_API_KEY="shared-secret")
    def test_get_recent_hasena_videos_skips_youtube_api_when_keys_are_shared(self) -> None:
        with (
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_feed",
                return_value=[],
            ),
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_playlist_page",
                return_value=[],
            ),
            patch("todos.services.hasena_summary_service.requests.get") as fetch,
        ):
            result = get_recent_hasena_videos()

        self.assertEqual(result, [])
        fetch.assert_not_called()

    @override_settings(YOUTUBE_API_KEY="youtube-secret")
    def test_get_recent_hasena_videos_redacts_api_key_from_errors(self) -> None:
        with (
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_feed",
                return_value=[],
            ),
            patch(
                "todos.services.hasena_summary_service._get_recent_hasena_videos_from_playlist_page",
                return_value=[],
            ),
            patch(
                "todos.services.hasena_summary_service.requests.get",
                side_effect=requests.exceptions.HTTPError(
                    "403 Client Error for url: https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&key=youtube-secret"
                ),
            ),
            patch("todos.services.hasena_summary_service.logger") as logger,
        ):
            result = get_recent_hasena_videos()

        self.assertEqual(result, [])
        logged_message = logger.error.call_args.args[0]
        self.assertNotIn("youtube-secret", logged_message)
        self.assertIn("key=[REDACTED]", logged_message)

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

    def test_gemini_generation_falls_back_when_primary_model_quota_is_exhausted(self) -> None:
        class Response:
            text = "요약"

        class Models:
            def __init__(self) -> None:
                self.calls = []

            def generate_content(self, model, contents, config):
                self.calls.append(model)
                if model == "gemini-3.5-flash":
                    raise Exception("429 RESOURCE_EXHAUSTED")
                return Response()

        class Client:
            def __init__(self) -> None:
                self.models = Models()

        class Types:
            class GenerateContentConfig:
                def __init__(self, temperature, max_output_tokens) -> None:
                    self.temperature = temperature
                    self.max_output_tokens = max_output_tokens

        client = Client()

        response, model = _generate_content_with_gemini_fallback(
            client=client,
            types=Types,
            contents="prompt",
        )

        self.assertEqual(response.text, "요약")
        self.assertEqual(model, "gemini-3.1-flash-lite")
        self.assertEqual(client.models.calls, ["gemini-3.5-flash", "gemini-3.1-flash-lite"])

    def test_gemini_generation_falls_back_when_intermediate_model_is_blocked(self) -> None:
        class Response:
            text = "요약"

        class Models:
            def __init__(self) -> None:
                self.calls = []

            def generate_content(self, model, contents, config):
                self.calls.append(model)
                if model == "gemini-3.5-flash":
                    raise Exception("429 RESOURCE_EXHAUSTED")
                if model == "gemini-3.1-flash-lite":
                    raise Exception("403 PERMISSION_DENIED unrestricted keys")
                return Response()

        class Client:
            def __init__(self) -> None:
                self.models = Models()

        class Types:
            class GenerateContentConfig:
                def __init__(self, temperature, max_output_tokens) -> None:
                    self.temperature = temperature
                    self.max_output_tokens = max_output_tokens

        client = Client()

        response, model = _generate_content_with_gemini_fallback(
            client=client,
            types=Types,
            contents="prompt",
        )

        self.assertEqual(response.text, "요약")
        self.assertEqual(model, "gemini-2.5-flash")
        self.assertEqual(
            client.models.calls,
            ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"],
        )

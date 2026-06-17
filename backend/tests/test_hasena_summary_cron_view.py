from __future__ import annotations

from datetime import date
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from todos.views import generate_hasena_summary_from_cron


@override_settings(CRON_SECRET="test-secret")
class HasenaSummaryCronViewTest(TestCase):
    def test_generate_hasena_summary_from_cron_tries_next_recent_video(self) -> None:
        request = APIRequestFactory().post(
            "/api/v1/todos/hasena/summary/cron/",
            {},
            format="json",
            HTTP_X_CRON_SECRET="test-secret",
        )

        with (
            patch(
                "todos.services.hasena_summary_service.get_recent_hasena_videos",
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
                "todos.services.hasena_summary_service.get_hasena_summary",
                side_effect=[
                    {"success": False, "error": "영상 자막을 가져올 수 없습니다."},
                    {"success": True, "video_id": "video-ready", "created": True},
                ],
            ) as fetch_summary,
        ):
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["video_id"], "video-ready")
        self.assertEqual(fetch_summary.call_count, 2)
        fetch_summary.assert_any_call(
            "video-ready",
            video_date=date(2026, 6, 16),
            title="자막 준비된 영상",
        )

from __future__ import annotations

from datetime import date, datetime
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from todos.views import generate_hasena_summary_from_cron


@override_settings(CRON_SECRET="test-secret")
class HasenaSummaryCronViewTest(TestCase):
    def test_generate_hasena_summary_from_cron_does_not_try_previous_date_after_failure(self) -> None:
        request = APIRequestFactory().post(
            "/api/v1/todos/hasena/summary/cron/",
            {},
            format="json",
            HTTP_X_CRON_SECRET="test-secret",
        )

        with (
            patch("todos.views.timezone.now", return_value=datetime(2026, 6, 17, 1, 0, 0)),
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
                return_value={"success": False, "error": "영상 자막을 가져올 수 없습니다."},
            ) as fetch_summary,
        ):
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "영상 자막을 가져올 수 없습니다.")
        fetch_summary.assert_called_once_with(
            "video-new",
            video_date=date(2026, 6, 17),
            title="아직 자막 없는 영상",
        )

    def test_generate_hasena_summary_from_cron_returns_pending_when_today_video_is_not_visible(self) -> None:
        request = APIRequestFactory().post(
            "/api/v1/todos/hasena/summary/cron/",
            {},
            format="json",
            HTTP_X_CRON_SECRET="test-secret",
        )

        with (
            patch("todos.views.timezone.now", return_value=datetime(2026, 6, 25, 0, 0, 0)),
            patch(
                "todos.services.hasena_summary_service.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "GEP5Hi4Rp_A",
                        "title": "2026년 6월 24일 수요일 하세나하시조",
                        "published_at": "2026-06-23T15:00:31+00:00",
                    },
                ],
            ),
            patch("todos.services.hasena_summary_service.get_hasena_summary") as fetch_summary,
            patch("todos.services.hasena_monitoring.capture_hasena_summary_issue") as capture_issue,
        ):
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["reason"], "no_video_for_date")
        self.assertEqual(response.data["date"], "2026-06-25")
        fetch_summary.assert_not_called()
        capture_issue.assert_called_once()

    def test_generate_hasena_summary_from_cron_generates_current_service_date_video(self) -> None:
        request = APIRequestFactory().post(
            "/api/v1/todos/hasena/summary/cron/",
            {},
            format="json",
            HTTP_X_CRON_SECRET="test-secret",
        )

        with (
            patch("todos.views.timezone.now", return_value=datetime(2026, 6, 25, 0, 5, 0)),
            patch(
                "todos.services.hasena_summary_service.get_recent_hasena_videos",
                return_value=[
                    {
                        "video_id": "VkWhiXwG-Fw",
                        "title": "2026년 6월 25일 목요일 하세나하시조",
                        "published_at": "2026-06-24T15:00:02+00:00",
                    },
                ],
            ),
            patch(
                "todos.services.hasena_summary_service.get_hasena_summary",
                return_value={"success": True, "video_id": "VkWhiXwG-Fw", "created": True},
            ) as fetch_summary,
        ):
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["video_id"], "VkWhiXwG-Fw")
        fetch_summary.assert_called_once_with(
            "VkWhiXwG-Fw",
            video_date=date(2026, 6, 25),
            title="2026년 6월 25일 목요일 하세나하시조",
        )

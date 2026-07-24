from __future__ import annotations

from datetime import date, datetime
from unittest.mock import patch
from django.core.cache import cache

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory
from config.observability import HASENA_SUMMARY_HEARTBEAT_CACHE_KEY

from todos.views import generate_hasena_summary_from_cron, get_hasena_summary


@override_settings(CRON_SECRET="test-secret")
class HasenaSummaryCronViewTest(TestCase):
    def setUp(self) -> None:
        cache.delete(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)

    def assert_heartbeat(self, **expected) -> None:
        heartbeat = cache.get(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)
        self.assertIsNotNone(heartbeat)
        self.assertIn("recorded_at", heartbeat)
        for key, value in expected.items():
            self.assertEqual(heartbeat[key], value)
    def test_public_summary_rejects_malformed_date_before_lookup(self) -> None:
        request = APIRequestFactory().get(
            "/api/v1/todos/hasena/summary/",
            {"video_id": "video-123", "date": "not-a-date"},
        )

        with patch("todos.services.hasena_summary_service.get_existing_summary") as existing_summary:
            response = get_hasena_summary(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "date 형식은 YYYY-MM-DD 이어야 합니다.")
        existing_summary.assert_not_called()

    def test_public_summary_rejects_non_padded_date_before_lookup(self) -> None:
        request = APIRequestFactory().get(
            "/api/v1/todos/hasena/summary/",
            {"video_id": "video-123", "date": "2026-1-2"},
        )

        with patch("todos.services.hasena_summary_service.get_existing_summary") as existing_summary:
            response = get_hasena_summary(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "date 형식은 YYYY-MM-DD 이어야 합니다.")
        existing_summary.assert_not_called()

    def test_generate_hasena_summary_from_cron_rejects_malformed_date_without_heartbeat(self) -> None:
        request = APIRequestFactory().post(
            "/api/v1/todos/hasena/summary/cron/",
            {"video_date": "not-a-date"},
            format="json",
            HTTP_X_CRON_SECRET="test-secret",
        )

        with patch("todos.services.hasena_summary_service.get_recent_hasena_videos") as videos:
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "video_date 형식은 YYYY-MM-DD 이어야 합니다.")
        videos.assert_not_called()
        self.assertIsNone(cache.get(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY))

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
        self.assert_heartbeat(status="failed", error="영상 자막을 가져올 수 없습니다.")

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
        self.assert_heartbeat(
            status="pending",
            reason="no_video_for_date",
            date="2026-06-25",
            error="오늘 날짜의 하세나 영상을 아직 찾을 수 없습니다.",
        )

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
                return_value={
                    "success": True,
                    "cacheable": True,
                    "persisted": True,
                    "video_id": "VkWhiXwG-Fw",
                    "created": True,
                },
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
        self.assert_heartbeat(status="success", video_id="VkWhiXwG-Fw")

    def test_generate_hasena_summary_from_cron_rejects_non_cacheable_automatic_success(self) -> None:
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
                return_value={
                    "success": True,
                    "cacheable": False,
                    "persisted": False,
                    "video_id": "VkWhiXwG-Fw",
                    "error": "summary was not persisted",
                },
            ),
            patch("todos.services.hasena_monitoring.capture_hasena_summary_issue") as capture_issue,
        ):
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["error"], "summary was not persisted")
        capture_issue.assert_called_once()
        self.assert_heartbeat(
            status="failed",
            video_id="VkWhiXwG-Fw",
            error="summary was not persisted",
        )

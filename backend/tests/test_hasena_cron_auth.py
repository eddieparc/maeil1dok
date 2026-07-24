from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate
from unittest.mock import patch

from config.observability import HASENA_SUMMARY_HEARTBEAT_CACHE_KEY

from todos.views import generate_hasena_summary_from_cron, sync_hasena_entries_from_cron


class HasenaCronAuthTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        cache.delete(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY)

    @override_settings(CRON_SECRET=None)
    def test_hasena_sync_fails_closed_when_cron_secret_is_missing_even_for_staff(self):
        staff = get_user_model().objects.create_user(
            username="cron-staff",
            nickname="크론관리자",
            is_staff=True,
        )
        request = self.factory.post("/api/v1/todos/hasena/sync/", {}, format="json")
        force_authenticate(request, user=staff)

        with patch("todos.services.hasena_entry_service.sync_hasena_entries") as sync_entries:
            response = sync_hasena_entries_from_cron(request)

        self.assertEqual(response.status_code, 503)
        self.assertIn("CRON_SECRET", response.data["error"])
        sync_entries.assert_not_called()

    @override_settings(CRON_SECRET="test-secret")
    def test_hasena_sync_rejects_invalid_cron_secret_before_effect(self):
        request = self.factory.post(
            "/api/v1/todos/hasena/sync/",
            {"max_entries": 10},
            format="json",
            HTTP_X_CRON_SECRET="wrong-secret",
        )

        with patch("todos.services.hasena_entry_service.sync_hasena_entries") as sync_entries:
            response = sync_hasena_entries_from_cron(request)

        self.assertEqual(response.status_code, 401)
        sync_entries.assert_not_called()

    @override_settings(CRON_SECRET="test-secret")
    def test_hasena_sync_accepts_bearer_cron_secret(self):
        request = self.factory.post(
            "/api/v1/todos/hasena/sync/",
            {"max_entries": 10},
            format="json",
            HTTP_AUTHORIZATION="Bearer test-secret",
        )

        with patch(
            "todos.services.hasena_entry_service.sync_hasena_entries",
            return_value={"success": True, "synced": [], "skipped": []},
        ) as sync_entries:
            response = sync_hasena_entries_from_cron(request)

        self.assertEqual(response.status_code, 200)
        sync_entries.assert_called_once_with(max_entries=10)

    @override_settings(CRON_SECRET="test-secret")
    def test_hasena_summary_cron_rejects_invalid_secret_before_effect(self):
        request = self.factory.post(
            "/api/v1/todos/hasena/summary/cron/",
            {},
            format="json",
            HTTP_X_CRON_SECRET="wrong-secret",
        )

        with patch("todos.services.hasena_summary_service.get_recent_hasena_videos") as videos:
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 401)
        videos.assert_not_called()
        self.assertIsNone(cache.get(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY))

    @override_settings(CRON_SECRET=None)
    def test_hasena_summary_cron_rejects_missing_secret_without_heartbeat(self):
        request = self.factory.post(
            "/api/v1/todos/hasena/summary/cron/",
            {},
            format="json",
        )

        with patch("todos.services.hasena_summary_service.get_recent_hasena_videos") as videos:
            response = generate_hasena_summary_from_cron(request)

        self.assertEqual(response.status_code, 503)
        videos.assert_not_called()
        self.assertIsNone(cache.get(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY))

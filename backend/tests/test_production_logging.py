from __future__ import annotations

import json
import logging
import logging.config
import os
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.test import RequestFactory
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from utils.response import StandardResponse
from config import observability, security_settings
from config.logging_config import (
    JsonFormatter,
    bind_correlation_context,
    reset_correlation_context,
)


class ProductionJsonLoggingTests(SimpleTestCase):
    def test_celery_preserves_json_root_logging(self) -> None:
        self.assertFalse(settings.CELERY_WORKER_HIJACK_ROOT_LOGGER)

        from config.celery import configure_celery_logging

        configure_celery_logging()
        handler = next(
            handler
            for handler in logging.getLogger().handlers
            if isinstance(handler, logging.StreamHandler)
        )
        self.assertIsInstance(handler.formatter, JsonFormatter)

    def test_celery_publish_and_worker_bind_correlation_context(self) -> None:
        from config.celery import (
            bind_task_correlation,
            clear_task_correlation,
            publish_correlation_headers,
        )

        parent_tokens = bind_correlation_context(
            request_id="request-parent",
            trace_id="0123456789abcdef0123456789abcdef",
        )
        headers: dict[str, str] = {}
        try:
            publish_correlation_headers(headers=headers)
        finally:
            reset_correlation_context(parent_tokens)

        class Request:
            pass

        class Task:
            request = Request()

        task = Task()
        task.request.headers = headers
        bind_task_correlation(task_id="task-73", task=task)
        try:
            rendered = JsonFormatter(service="backend", environment="test").format(
                logging.LogRecord(
                    name="celery.task",
                    level=logging.INFO,
                    pathname=__file__,
                    lineno=40,
                    msg="task_started",
                    args=(),
                    exc_info=None,
                )
            )
        finally:
            clear_task_correlation(task=task)

        payload = json.loads(rendered)
        self.assertEqual(payload["request_id"], "request-parent")
        self.assertEqual(payload["trace_id"], "0123456789abcdef0123456789abcdef")
        self.assertEqual(payload["task_id"], "task-73")

    def test_console_formatter_emits_machine_queryable_json(self) -> None:
        handler = next(
            handler
            for handler in logging.getLogger().handlers
            if isinstance(handler, logging.StreamHandler)
        )
        record = logging.LogRecord(
            name="tests.production_logging",
            level=logging.WARNING,
            pathname=__file__,
            lineno=20,
            msg="structured warning",
            args=(),
            exc_info=None,
        )

        rendered = handler.format(record)
        try:
            payload = json.loads(rendered)
        except json.JSONDecodeError:
            self.fail(f"production console log is not JSON: {rendered!r}")

        self.assertEqual(payload["level"], "WARNING")
        self.assertEqual(payload["logger"], "tests.production_logging")
        self.assertEqual(payload["message"], "structured warning")
        self.assertEqual(payload["service"], "backend")
        self.assertEqual(payload["environment"], "test")
        self.assertIsInstance(datetime.fromisoformat(payload["timestamp"]), datetime)

    def test_json_formatter_redacts_secrets_and_email_from_message_and_exception(self) -> None:
        handler = next(
            handler
            for handler in logging.getLogger().handlers
            if isinstance(handler, logging.StreamHandler)
        )
        secret = "token-value-that-must-not-ship"
        email = "private-log@example.test"
        password = "database-password-that-must-not-ship"
        try:
            raise RuntimeError(
                f"refresh_token={secret} for {email}; "
                f"database password {password}; mysql://admin:{password}@db/internal"
            )
        except RuntimeError:
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="tests.production_logging",
            level=logging.ERROR,
            pathname=__file__,
            lineno=60,
            msg=f"request failed?access_token={secret}&email={email}",
            args=(),
            exc_info=exc_info,
        )
        record.reason = {
            "client_secret": secret,
            "nested": {"api_key": secret, "safe": "keep"},
        }

        rendered = handler.format(record)
        self.assertNotIn(secret, rendered)
        self.assertNotIn(email, rendered)
        self.assertNotIn(password, rendered)
        self.assertIn("[redacted]", rendered)
        self.assertIn('"safe":"keep"', rendered)

    def test_gunicorn_uses_json_error_logs_without_duplicate_access_lines(self) -> None:
        backend_root = Path(__file__).resolve().parents[1]
        entrypoint = (backend_root / "entrypoint.sh").read_text(encoding="utf-8")
        gunicorn_config = (backend_root / "config" / "gunicorn.py").read_text(
            encoding="utf-8",
        )

        self.assertIn("--config config/gunicorn.py", entrypoint)
        self.assertNotIn("--access-logfile -", entrypoint)
        self.assertIn("accesslog = None", gunicorn_config)
        self.assertIn("config.logging_config.JsonFormatter", gunicorn_config)

    def test_gunicorn_log_config_survives_default_config_merge(self) -> None:
        from gunicorn.glogging import CONFIG_DEFAULTS

        from config.gunicorn import logconfig_dict

        merged = CONFIG_DEFAULTS.copy()
        merged.update(logconfig_dict)

        logging.config.dictConfig(merged)


class RequestCorrelationTests(TestCase):
    def test_cors_allows_trace_headers_and_exposes_request_id(self) -> None:
        self.assertTrue(
            {
                "baggage",
                "sentry-trace",
                "traceparent",
                "x-request-id",
            }.issubset(security_settings.CORS_ALLOW_HEADERS)
        )
        self.assertIn("x-request-id", security_settings.CORS_EXPOSE_HEADERS)

    def test_request_id_is_preserved_in_response_and_completion_log(self) -> None:
        request_id = "01a056-production-request"

        with self.assertLogs("http.request", level="INFO") as captured:
            response = self.client.get("/health/", HTTP_X_REQUEST_ID=request_id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Request-ID"], request_id)
        record = captured.records[-1]
        self.assertEqual(record.request_id, request_id)
        self.assertEqual(record.event, "http_request")
        self.assertEqual(record.method, "GET")
        self.assertEqual(record.route, "/health/")
        self.assertEqual(record.status, 200)
        self.assertGreaterEqual(record.duration_ms, 0)

    def test_mobile_client_platform_and_version_reach_completion_log(self) -> None:
        self.assertTrue(
            {
                "x-app-platform",
                "x-app-version",
                "x-client",
            }.issubset(security_settings.CORS_ALLOW_HEADERS)
        )

        with self.assertLogs("http.request", level="INFO") as captured:
            response = self.client.get(
                "/health/",
                HTTP_X_CLIENT="shell",
                HTTP_X_APP_PLATFORM="android",
                HTTP_X_APP_VERSION="1.2.3",
            )

        self.assertEqual(response.status_code, 200)
        record = captured.records[-1]
        self.assertEqual(record.client, "shell")
        self.assertEqual(record.platform, "android")
        self.assertEqual(record.app_version, "1.2.3")

    def test_untrusted_client_observation_headers_are_not_logged(self) -> None:
        with self.assertLogs("http.request", level="INFO") as captured:
            response = self.client.get(
                "/health/",
                HTTP_X_CLIENT="invented-client",
                HTTP_X_APP_PLATFORM="android-forged",
                HTTP_X_APP_VERSION="v" * 100,
            )

        self.assertEqual(response.status_code, 200)
        record = captured.records[-1]
        self.assertFalse(hasattr(record, "client"))
        self.assertFalse(hasattr(record, "platform"))
        self.assertFalse(hasattr(record, "app_version"))

    def test_untrusted_request_id_is_replaced(self) -> None:
        response = self.client.get(
            "/health/",
            HTTP_X_REQUEST_ID="bad\nforged-log-line",
        )

        generated = response.headers["X-Request-ID"]
        self.assertNotIn("\n", generated)
        self.assertNotEqual(generated, "bad\nforged-log-line")
        self.assertRegex(generated, r"^[0-9a-f]{32}$")

    @patch("sentry_sdk.get_current_span")
    def test_active_sentry_trace_is_used_without_incoming_trace_header(
        self, get_current_span
    ) -> None:
        get_current_span.return_value.trace_id = "abcdef0123456789abcdef0123456789"
        request = RequestFactory().get("/health/")

        from config.logging_config import _trace_id_from_request

        self.assertEqual(
            _trace_id_from_request(request),
            "abcdef0123456789abcdef0123456789",
        )


class SeverityAndPrivacyLoggingTests(TestCase):
    def test_http_completion_level_matches_response_class(self) -> None:
        with self.assertLogs("http.request", level="WARNING") as client_logs:
            client_response = self.client.get("/api/v1/auth/account-email/")

        self.assertEqual(client_response.status_code, 401)
        self.assertEqual(client_logs.records[-1].levelno, logging.WARNING)

        with (
            patch("todos.group_views.can", side_effect=RuntimeError("lookup failed")),
            self.assertLogs("http.request", level="ERROR") as server_logs,
        ):
            server_response = self.client.get("/api/v1/todos/groups/")

        self.assertEqual(server_response.status_code, 500)
        self.assertEqual(server_logs.records[-1].levelno, logging.ERROR)

    def test_client_error_is_warning_without_error_payload(self) -> None:
        secret = "private-person@example.test"

        with self.assertLogs("utils.response", level="WARNING") as captured:
            response = StandardResponse.error(
                error=f"invalid email {secret}",
                errors={"email": [secret]},
                status_code=400,
            )

        self.assertEqual(response.status_code, 400)
        record = captured.records[-1]
        self.assertEqual(record.levelno, logging.WARNING)
        self.assertEqual(record.event, "api_error")
        self.assertEqual(record.status, 400)
        self.assertNotIn(secret, captured.output[-1])

    def test_server_error_remains_error(self) -> None:
        with self.assertLogs("utils.response", level="ERROR") as captured:
            StandardResponse.error(error="database unavailable", status_code=503)

        record = captured.records[-1]
        self.assertEqual(record.levelno, logging.ERROR)
        self.assertEqual(record.status, 503)

    def test_successful_login_log_excludes_raw_identifier(self) -> None:
        email = "logging-private@example.test"
        get_user_model().objects.create_user(
            username="logging-private",
            email=email,
            password="pw-12345",
        )
        client = APIClient()

        with self.assertLogs("accounts.views", level="INFO") as captured:
            response = client.post(
                "/api/v1/auth/email-login/",
                {"email": email, "password": "pw-12345"},
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertNotIn(email, "\n".join(captured.output))
        self.assertIn("user_id=", captured.output[-1])

    @patch("todos.group_views.can", side_effect=RuntimeError("group lookup failed"))
    def test_group_boundary_error_preserves_traceback(self, _can) -> None:
        with self.assertLogs("todos.group_views", level="ERROR") as captured:
            response = self.client.get("/api/v1/todos/groups/")

        self.assertEqual(response.status_code, 500)
        record = captured.records[-1]
        self.assertIsNotNone(record.exc_info)
        self.assertEqual(record.exc_info[0], RuntimeError)


class BackendSentryPrivacyTests(SimpleTestCase):
    @patch.dict(os.environ, {"SENTRY_DSN": "https://public@example.test/1"})
    @patch("sentry_sdk.init")
    def test_error_and_transaction_events_share_privacy_boundary(self, sentry_init) -> None:
        self.assertTrue(observability.init_sentry_from_env())

        options = sentry_init.call_args.kwargs
        self.assertIs(options["before_send"], observability.scrub_sentry_event)
        self.assertIs(
            options["before_send_transaction"],
            observability.scrub_sentry_event,
        )

    def test_before_send_drops_explicitly_captured_logging_duplicate(self) -> None:
        event = {
            "message": "duplicate",
            "extra": {"_skip_sentry_duplicate": True},
        }

        self.assertIsNone(observability.scrub_sentry_event(event, {}))

    def test_before_send_scrubs_request_user_and_nested_secrets(self) -> None:
        scrub = getattr(observability, "scrub_sentry_event", None)
        self.assertIsNotNone(scrub, "Sentry must have a backend privacy boundary")
        secret = "backend-sentry-secret"
        email = "backend-private@example.test"
        event = {
            "message": f"failure for {email} token={secret}",
            "request": {
                "url": f"https://api.maeil1dok.app/callback?code={secret}",
                "headers": {
                    "Authorization": f"Bearer {secret}",
                    "Cookie": f"refresh_token={secret}",
                    "Accept": "application/json",
                },
                "data": {"password": secret, "safe": "keep"},
            },
            "user": {"id": "73", "email": email, "ip_address": "203.0.113.9"},
            "extra": {"nested": {"refresh_token": secret, "safe": "keep"}},
            "contexts": {
                "credentials": {
                    "api_key": secret,
                    "client_secret": secret,
                    "refresh": secret,
                    "phone_number": "+821012345678",
                    "safe": "keep",
                }
            },
        }

        scrubbed = scrub(event, {})
        serialized = json.dumps(scrubbed)
        self.assertNotIn(secret, serialized)
        self.assertNotIn(email, serialized)
        self.assertEqual(scrubbed["request"]["headers"]["Accept"], "application/json")
        self.assertEqual(scrubbed["request"]["data"]["safe"], "keep")
        self.assertEqual(scrubbed["user"], {"id": "73"})
        self.assertNotIn("+821012345678", serialized)
        self.assertEqual(scrubbed["contexts"]["credentials"]["safe"], "keep")

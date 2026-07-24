import json
from unittest.mock import patch

from django.test import SimpleTestCase
import sentry_sdk
from sentry_sdk import Scope
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.transport import Transport

from accounts import email_utils


RECIPIENT = "reader-sentinel@example.test"
TOKEN = "token-sentinel-1234567890"
RESET_URL = f"https://frontend.example.test/auth/reset-password?token={TOKEN}"
HTML = f"<a href=\"{RESET_URL}\">reset</a> html-sentinel"


class ProviderFailure(Exception):
    pass


class CollectingSentryTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.events = []

    def capture_envelope(self, envelope):
        for item in envelope.items:
            event = item.get_event()
            if event is not None:
                self.events.append(event)


class EmailObservabilityTests(SimpleTestCase):
    def setUp(self):
        self._previous_api_key = email_utils.resend.api_key
        self._previous_client = sentry_sdk.get_global_scope().client
        self._previous_current_scope = sentry_sdk.get_current_scope()
        self._previous_isolation_scope = sentry_sdk.get_isolation_scope()
        self._test_sentry_client = None

    def tearDown(self):
        email_utils.resend.api_key = self._previous_api_key
        if self._test_sentry_client is not None:
            self._test_sentry_client.close()
        sentry_sdk.get_global_scope().set_client(self._previous_client)
        Scope.set_current_scope(self._previous_current_scope)
        Scope.set_isolation_scope(self._previous_isolation_scope)

    def _assert_no_sensitive_values(self, value):
        rendered = repr(value)
        for sentinel in (RECIPIENT, TOKEN, RESET_URL, HTML):
            self.assertNotIn(sentinel, rendered)

    def test_send_email_missing_api_key_emits_redacted_failure_event(self):
        email_utils.resend.api_key = None

        with (
            patch("accounts.email_utils.capture_observability_event", create=True) as capture_event,
            self.assertLogs("accounts.email_utils", level="WARNING") as logs,
        ):
            result = email_utils.send_email(
                RECIPIENT,
                "subject-sentinel",
                HTML,
                purpose="password_reset",
            )

        self.assertFalse(result)
        capture_event.assert_called_once_with(
            "account email delivery failed",
            level="error",
            tags={
                "journey": "account_email",
                "email_purpose": "password_reset",
                "outcome": "failed",
                "reason": "missing_api_key",
            },
            extra={},
            isolate_request_context=True,
        )
        self._assert_no_sensitive_values(logs.output)
        self._assert_no_sensitive_values(capture_event.call_args)

    def test_send_email_provider_exception_emits_only_error_class(self):
        email_utils.resend.api_key = "test-api-key"
        error = ProviderFailure(f"provider detail {RECIPIENT} {TOKEN} {RESET_URL} {HTML}")

        with (
            patch("accounts.email_utils.capture_observability_event", create=True) as capture_event,
            patch("accounts.email_utils.resend.Emails.send", side_effect=error),
            self.assertLogs("accounts.email_utils", level="WARNING") as logs,
        ):
            result = email_utils.send_email(
                RECIPIENT,
                "subject-sentinel",
                HTML,
                purpose="password_reset",
            )

        self.assertFalse(result)
        capture_event.assert_called_once_with(
            "account email delivery failed",
            level="error",
            tags={
                "journey": "account_email",
                "email_purpose": "password_reset",
                "outcome": "failed",
                "reason": "provider_exception",
            },
            extra={"error_class": "ProviderFailure"},
            isolate_request_context=True,
        )
        self._assert_no_sensitive_values(logs.output)
        self._assert_no_sensitive_values(capture_event.call_args)

    def test_send_email_provider_exception_isolated_from_request_scope(self):
        transport = CollectingSentryTransport()
        sentry_sdk.init(
            dsn="https://public@example.ingest.sentry.io/1",
            default_integrations=False,
            integrations=[LoggingIntegration(event_level="ERROR")],
            transport=transport,
        )
        client = sentry_sdk.get_client()
        self._test_sentry_client = client
        current_scope = Scope(client=client)
        isolation_scope = Scope(client=client)
        for scope in (current_scope, isolation_scope):
            scope.set_user({"id": "request-user-sentinel"})
            scope.add_event_processor(self._inject_request_pii)
        Scope.set_current_scope(current_scope)
        Scope.set_isolation_scope(isolation_scope)
        email_utils.resend.api_key = "test-api-key"

        with patch(
            "accounts.email_utils.resend.Emails.send",
            side_effect=ProviderFailure(
                f"provider failure {RECIPIENT} {TOKEN} {RESET_URL} {HTML}"
            ),
        ):
            result = email_utils.send_email(
                RECIPIENT,
                "subject-sentinel",
                HTML,
                purpose="password_reset",
            )

        self.assertIs(sentry_sdk.get_current_scope(), current_scope)
        self.assertIs(sentry_sdk.get_isolation_scope(), isolation_scope)
        self.assertFalse(result)
        self.assertEqual(len(transport.events), 1)
        event = transport.events[0]
        self.assertEqual(
            event.get("tags"),
            {
                "journey": "account_email",
                "email_purpose": "password_reset",
                "outcome": "failed",
                "reason": "provider_exception",
            },
        )
        self.assertEqual(event.get("extra"), {"error_class": "ProviderFailure"})
        self.assertNotIn("user", event)
        self.assertNotIn("request", event)
        serialized_event = json.dumps(event, sort_keys=True, default=str)
        for sentinel in (
            RECIPIENT,
            TOKEN,
            RESET_URL,
            HTML,
            "request-user-sentinel",
            "request-body-sentinel",
            "request-query-sentinel",
            "request-cookie-sentinel",
            "request-authorization-sentinel",
        ):
            self.assertNotIn(sentinel, serialized_event)

    @staticmethod
    def _inject_request_pii(event, hint):
        event["request"] = {
            "data": "request-body-sentinel",
            "query_string": "request-query-sentinel",
            "cookies": {"session": "request-cookie-sentinel"},
            "headers": {"Authorization": "request-authorization-sentinel"},
        }
        return event

    def test_send_email_success_log_excludes_recipient_and_content(self):
        email_utils.resend.api_key = "test-api-key"

        with (
            patch("accounts.email_utils.resend.Emails.send", return_value={"id": "email-id-123"}),
            self.assertLogs("accounts.email_utils", level="INFO") as logs,
        ):
            result = email_utils.send_email(
                RECIPIENT,
                "subject-sentinel",
                HTML,
                purpose="email_verification",
            )

        self.assertTrue(result)
        self.assertIn("email_verification", logs.output[0])
        self.assertIn("email-id-123", logs.output[0])
        self._assert_no_sensitive_values(logs.output)

    def test_email_wrappers_forward_stable_purposes(self):
        with patch("accounts.email_utils.send_email", return_value=True) as send_email:
            self.assertTrue(email_utils.send_verification_email(RECIPIENT, TOKEN))
            self.assertTrue(email_utils.send_password_reset_email(RECIPIENT, TOKEN))
            self.assertTrue(email_utils.send_welcome_email(RECIPIENT, "reader"))

        purposes = [call.kwargs["purpose"] for call in send_email.call_args_list]
        self.assertEqual(purposes, ["email_verification", "password_reset", "welcome"])

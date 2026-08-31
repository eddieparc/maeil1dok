from __future__ import annotations

import json
import logging
import re
import uuid
from contextvars import ContextVar
from collections.abc import Mapping
from datetime import datetime, timezone
from time import monotonic

from django.http import HttpRequest, HttpResponse


_REQUEST_ID = ContextVar("request_id", default="")
_TRACE_ID = ContextVar("trace_id", default="")
_TASK_ID = ContextVar("task_id", default="")
_SAFE_CORRELATION_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_SENTRY_TRACE_ID = re.compile(r"^([0-9a-fA-F]{32})-")
_TRACEPARENT_ID = re.compile(r"^[0-9a-fA-F]{2}-([0-9a-fA-F]{32})-")
_SENSITIVE_ASSIGNMENT = re.compile(
    r"(?i)\b(access|access_token|refresh|refresh_token|id_token|signup_token|"
    r"token|code|state|password|authorization|api[_-]?key|client[_-]?secret|"
    r"secret|sessionid|key)"
    r"(\s*[=:]\s*)"
    r"(?:bearer\s+)?[^&\s,;\"']+"
)
_SENSITIVE_JSON_VALUE = re.compile(
    r'(?i)(["\'](?:access|access_token|refresh|refresh_token|id_token|'
    r'signup_token|token|code|state|password|authorization|api[_-]?key|'
    r'client[_-]?secret|secret|sessionid|key)'
    r'["\']\s*:\s*["\'])[^"\']+'
)
_EMAIL_ADDRESS = re.compile(
    r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"
)
_BEARER_TOKEN = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
_JWT = re.compile(
    r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"
)
_URL_CREDENTIALS = re.compile(
    r"(?i)([a-z][a-z0-9+.-]*://[^:/@\s]+:)[^@\s/]+(@)"
)
_SENSITIVE_WORD_VALUE = re.compile(
    r"(?i)\b(password|secret|api[ _-]?key)(\s+)[^&\s,;\"']+"
)
_EXTRA_FIELDS = (
    "event",
    "request_id",
    "trace_id",
    "method",
    "route",
    "status",
    "duration_ms",
    "task_id",
    "outcome",
    "reason",
)
_SENSITIVE_FIELD_KEYS = {
    "access",
    "accesstoken",
    "apikey",
    "authorization",
    "clientsecret",
    "code",
    "cookie",
    "csrftoken",
    "email",
    "idtoken",
    "ipaddress",
    "password",
    "phonenumber",
    "proxyauthorization",
    "refresh",
    "refreshtoken",
    "secret",
    "sessionid",
    "setcookie",
    "signuptoken",
    "state",
    "token",
    "username",
    "xapikey",
}


def _clean_correlation_id(value: str | None) -> str:
    if value and _SAFE_CORRELATION_ID.fullmatch(value):
        return value
    return uuid.uuid4().hex


def _trace_id_from_request(request: HttpRequest) -> str:
    sentry_trace = request.headers.get("sentry-trace", "")
    if match := _SENTRY_TRACE_ID.match(sentry_trace):
        return match.group(1).lower()

    traceparent = request.headers.get("traceparent", "")
    if match := _TRACEPARENT_ID.match(traceparent):
        return match.group(1).lower()
    try:
        import sentry_sdk
    except ImportError:
        return ""
    span = sentry_sdk.get_current_span()
    active_trace_id = str(getattr(span, "trace_id", ""))
    if re.fullmatch(r"[0-9a-fA-F]{32}", active_trace_id):
        return active_trace_id.lower()
    return ""


def current_correlation_context() -> tuple[str, str]:
    return _REQUEST_ID.get(), _TRACE_ID.get()


def bind_correlation_context(
    *, request_id: str = "", trace_id: str = "", task_id: str = ""
):
    return (
        _REQUEST_ID.set(request_id),
        _TRACE_ID.set(trace_id),
        _TASK_ID.set(task_id),
    )


def reset_correlation_context(tokens) -> None:
    request_token, trace_token, task_token = tokens
    _TASK_ID.reset(task_token)
    _TRACE_ID.reset(trace_token)
    _REQUEST_ID.reset(request_token)


def redact_log_text(value: object) -> str:
    text = str(value)
    text = _URL_CREDENTIALS.sub(r"\1[redacted]\2", text)
    text = _SENSITIVE_ASSIGNMENT.sub(r"\1\2[redacted]", text)
    text = _SENSITIVE_JSON_VALUE.sub(r"\1[redacted]", text)
    text = _SENSITIVE_WORD_VALUE.sub(r"\1\2[redacted]", text)
    text = _BEARER_TOKEN.sub("Bearer [redacted]", text)
    text = _JWT.sub("[redacted]", text)
    return _EMAIL_ADDRESS.sub("[redacted]", text)


def _normalise_field_key(value: object) -> str:
    return "".join(character for character in str(value).lower() if character.isalnum())


def redact_log_value(value: object, seen: set[int] | None = None):
    if isinstance(value, str):
        return redact_log_text(value)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if seen is None:
        seen = set()
    if id(value) in seen:
        return "[circular]"
    if isinstance(value, Mapping):
        seen.add(id(value))
        return {
            key: (
                "[redacted]"
                if _normalise_field_key(key) in _SENSITIVE_FIELD_KEYS
                else redact_log_value(nested, seen)
            )
            for key, nested in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        seen.add(id(value))
        return [redact_log_value(item, seen) for item in value]
    return redact_log_text(value)


def _set_sentry_correlation(request_id: str, trace_id: str) -> None:
    try:
        import sentry_sdk
    except ImportError:
        return

    scope = sentry_sdk.get_current_scope()
    scope.set_tag("request_id", request_id)
    if trace_id:
        scope.set_tag("trace_id", trace_id)


class JsonFormatter(logging.Formatter):
    def __init__(self, *, service: str, environment: str) -> None:
        super().__init__()
        self.service = service
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_log_text(record.getMessage()),
            "service": self.service,
            "environment": self.environment,
        }

        request_id = getattr(record, "request_id", None) or _REQUEST_ID.get()
        trace_id = getattr(record, "trace_id", None) or _TRACE_ID.get()
        if request_id:
            payload["request_id"] = request_id
        if trace_id:
            payload["trace_id"] = trace_id
        task_id = getattr(record, "task_id", None) or _TASK_ID.get()
        if task_id:
            payload["task_id"] = task_id

        for field in _EXTRA_FIELDS:
            if field in {"request_id", "trace_id"}:
                continue
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = redact_log_value(value)

        if record.exc_info:
            payload["exception"] = redact_log_text(self.formatException(record.exc_info))
        if record.stack_info:
            payload["stack"] = redact_log_text(self.formatStack(record.stack_info))

        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)


class RequestCorrelationMiddleware:
    def __init__(self, get_response) -> None:
        self.get_response = get_response
        self.logger = logging.getLogger("http.request")

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming_id = request.headers.get("CF-Ray") or request.headers.get("X-Request-ID")
        request_id = _clean_correlation_id(incoming_id)
        trace_id = _trace_id_from_request(request)
        request_token = _REQUEST_ID.set(request_id)
        trace_token = _TRACE_ID.set(trace_id)
        started = monotonic()
        _set_sentry_correlation(request_id, trace_id)

        try:
            response = self.get_response(request)
            response.headers["X-Request-ID"] = request_id
            route_template = (
                getattr(getattr(request, "resolver_match", None), "route", None)
                or request.path
            )
            route = f"/{route_template.lstrip('/')}"
            level = (
                logging.ERROR
                if response.status_code >= 500
                else logging.WARNING
                if response.status_code >= 400
                else logging.INFO
            )
            self.logger.log(
                level,
                "http_request",
                extra={
                    "event": "http_request",
                    "request_id": request_id,
                    "trace_id": trace_id,
                    "method": request.method,
                    "route": route,
                    "status": response.status_code,
                    "duration_ms": round((monotonic() - started) * 1000, 3),
                },
            )
            return response
        finally:
            _TRACE_ID.reset(trace_token)
            _REQUEST_ID.reset(request_token)

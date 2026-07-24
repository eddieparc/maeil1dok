from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Literal
from django.core.cache import cache
from django.utils import timezone

from config.observability import HASENA_SUMMARY_HEARTBEAT_CACHE_KEY

logger = logging.getLogger(__name__)
_HEARTBEAT_OPTIONAL_KEYS = ("reason", "error", "date", "video_id")


def _hasena_summary_status(result: Mapping[str, Any]) -> str:
    if "status" in result:
        return str(result["status"])
    if result.get("success") is True:
        return "success"
    return "failed"


def record_hasena_summary_heartbeat(result: Mapping[str, Any]) -> Mapping[str, Any]:
    try:
        heartbeat = {
            "recorded_at": timezone.now(),
            "status": _hasena_summary_status(result),
        }
        for key in _HEARTBEAT_OPTIONAL_KEYS:
            if key in result:
                heartbeat[key] = result[key]
        cache.set(HASENA_SUMMARY_HEARTBEAT_CACHE_KEY, heartbeat, timeout=None)
    except Exception:
        logger.debug("Failed to record Hasena summary heartbeat", exc_info=True)
    return result


def capture_hasena_summary_issue(
    message: str,
    *,
    level: Literal["warning", "error"] = "error",
    extra: Mapping[str, Any] | None = None,
    exception: BaseException | None = None,
) -> None:
    try:
        import sentry_sdk
    except ImportError:
        return

    try:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("feature", "hasena_summary")
            if extra:
                for key, value in extra.items():
                    scope.set_extra(key, value)

            if exception:
                sentry_sdk.capture_exception(exception)
            else:
                sentry_sdk.capture_message(message, level=level)
    except Exception:
        logger.debug("Failed to report Hasena summary issue to Sentry", exc_info=True)
